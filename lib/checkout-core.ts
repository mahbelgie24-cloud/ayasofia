import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
import {
  orders,
  orderItems,
  ingredients,
  recipes,
  inventoryMoves,
  settings,
  modifierGroups,
  modifiers,
} from "@/db/schema";
import { recalculateCartServerSide, type CartItemForServer } from "@/lib/pricing-server";
import { toMinorUnits } from "@/lib/pricing";
import { eq, inArray, sql } from "drizzle-orm";
import { getDeliveryFeeRules, computeDeliveryFee, validateMinimumOrder } from "@/lib/delivery";
import { validateModifierSelection } from "@/lib/modifier-validation";

export interface SharedCheckoutParams {
  cartItems: CartItemForServer[];
  idempotencyKey: string;
  paymentMethod: string;
  channel: "dine_in" | "takeaway" | "drive_thru" | "delivery";
  staffId: string | null;
  customerPhone?: string;
  customerName?: string;
  clientTotal?: number;
  // Digital-menu & extra fields (FR-DM-15, C1, C6)
  source?: "POS" | "DIGITAL_MENU";
  tableId?: string | null;
  deliveryAddress?: string;
}

export type SharedCheckoutResult =
  | {
      success: true;
      orderId: string;
      orderNumber: string;
      total: string;
      // Per-order bearer for the public status page (P2-SEC-1).
      accessToken: string;
    }
  | { success: false; error: string };

/**
 * Shared atomic checkout logic used by both staff POS checkout and
 * customer self-order.  Never trust client-supplied prices — always
 * recompute server-side.
 */
export async function executeCheckout(params: SharedCheckoutParams): Promise<SharedCheckoutResult> {
  const {
    cartItems,
    idempotencyKey,
    paymentMethod,
    channel,
    staffId,
    customerPhone,
    customerName,
    clientTotal,
    source = "POS",
    tableId = null,
    deliveryAddress,
  } = params;

  if (!cartItems.length) return { success: false, error: "Cart is empty" };
  if (!idempotencyKey) return { success: false, error: "Missing idempotency key" };

  // Reject invalid quantities before any DB write (SEC-001).
  // quantity must be a safe integer ≥ 1 — a negative, zero, or
  // fractional quantity can produce malformed/zero-total orders on
  // the public, unauthenticated self-order endpoint.
  for (const item of cartItems) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      return {
        success: false,
        error: "Invalid quantity — must be a whole number of at least 1",
      };
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          total: orders.total,
          accessToken: orders.accessToken,
        })
        .from(orders)
        .where(eq(orders.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existing) {
        return {
          success: true as const,
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          total: existing.total,
          accessToken: String(existing.accessToken),
        };
      }

      const { lineItems, subtotal, modifierLookup } = await recalculateCartServerSide(cartItems);

      // Every submitted product must have been recognized by the server-side
      // recalculation. If any productId was unknown (recalc skips it with
      // `if (!base) continue`), lineItems will be shorter than cartItems —
      // reject the whole order rather than silently creating a partial/
      // zero-total order (SEC-001).
      if (lineItems.length !== cartItems.length) {
        return {
          success: false as const,
          error: "One or more products could not be found",
        };
      }

      // Server-side modifier validation (FR-DM-13): a crafted payload must
      // not skip a required modifier group, exceed a multi-group's max
      // selections, or submit modifiers that don't belong to the product.
      // Runs for every source (POS + digital menu) on the single pipeline.
      const productIds = [...new Set(cartItems.map((ci) => ci.productId))];
      const groupRows = await tx
        .select({
          id: modifierGroups.id,
          productId: modifierGroups.productId,
          type: modifierGroups.type,
          isRequired: modifierGroups.isRequired,
          maxSelections: modifierGroups.maxSelections,
        })
        .from(modifierGroups)
        .where(inArray(modifierGroups.productId, productIds));
      const groupIds = groupRows.map((g) => g.id);
      const modRows =
        groupIds.length > 0
          ? await tx
              .select({ id: modifiers.id, groupId: modifiers.groupId })
              .from(modifiers)
              .where(inArray(modifiers.groupId, groupIds))
          : [];
      const modsByGroup = new Map<string, string[]>();
      for (const m of modRows) {
        const list = modsByGroup.get(m.groupId) ?? [];
        list.push(m.id);
        modsByGroup.set(m.groupId, list);
      }

      for (let li = 0; li < cartItems.length; li++) {
        const cartLine = cartItems[li];
        const lineGroups = groupRows
          .filter((g) => g.productId === cartLine.productId)
          .map((g) => ({
            id: g.id,
            type: g.type as "single" | "multi",
            isRequired: g.isRequired,
            maxSelections: g.maxSelections,
            modifiers: (modsByGroup.get(g.id) ?? []).map((id) => ({ id })),
          }));
        const violations = validateModifierSelection(lineGroups, cartLine.modifierIds);
        if (violations.length > 0) {
          return {
            success: false as const,
            error: "Invalid modifier selection",
          };
        }
      }

      if (clientTotal !== undefined && clientTotal !== subtotal) {
        console.warn(
          `[checkout] Total mismatch — client ${clientTotal} agorot vs server ${subtotal} agorot. ` +
            `Proceeding with server total. key=${idempotencyKey}`,
        );
      }

      const orderNumber =
        `POS-${Date.now().toString(36).toUpperCase()}-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`.slice(
          0,
          20,
        );
      const subtotalStr = (subtotal / 100).toFixed(2);

      // Read tax rate from settings — default to 0 if absent
      const [taxRow] = await tx
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, "tax_rate"))
        .limit(1);
      const taxRateMinor = taxRow ? toMinorUnits(taxRow.value) : 0;
      // taxRateMinor eg. 1700 = 17.00% → tax = subtotal * 1700 / 10000
      const taxAgorot = Math.round((subtotal * taxRateMinor) / 10000);
      const totalAgorot = subtotal + taxAgorot;
      const taxStr = (taxAgorot / 100).toFixed(2);

      // Delivery fee — computed SERVER-side from settings rules, never
      // trusted from the client (C6). Applies only to channel=delivery.
      let deliveryFeeAgorot = 0;
      let deliveryFeeStr = "0.00";
      if (channel === "delivery") {
        const rules = await getDeliveryFeeRules();
        const minErr = validateMinimumOrder(subtotal, rules);
        if (minErr) {
          return { success: false as const, error: minErr };
        }
        const fee = computeDeliveryFee(subtotal, rules);
        deliveryFeeAgorot = fee.feeMinor;
        deliveryFeeStr = fee.fee;
      }

      const grandTotalAgorot = totalAgorot + deliveryFeeAgorot;
      const totalStr = (grandTotalAgorot / 100).toFixed(2);

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          channel,
          status: "received",
          subtotal: subtotalStr,
          tax: taxStr,
          discount: "0.00",
          total: totalStr,
          paymentMethod,
          staffId,
          idempotencyKey,
          customerPhone: customerPhone || null,
          customerName: customerName || null,
          source,
          tableId,
          deliveryAddress: deliveryAddress || null,
          deliveryFee: deliveryFeeStr,
        })
        .returning({ id: orders.id, accessToken: orders.accessToken });

      if (!order) {
        tx.rollback();
        return { success: false as const, error: "Failed to create order" };
      }

      // lineItems is 1:1 with cartItems by index (verified by the
      // length check above) — index-aligned so two lines of the SAME
      // product with different modifier sets keep their own modifiers.
      for (let li = 0; li < lineItems.length; li++) {
        const item = lineItems[li];
        const cartLine = cartItems[li];
        const modIds = cartLine?.modifierIds ?? [];
        const snapshot = modIds.map((id) => modifierLookup.get(id)).filter(Boolean);
        // Free-text line note (DM-03) — capped server-side so a malicious
        // payload can't bloat the row. Empty/"whitespace" notes stored as null.
        const rawNote = cartLine?.notes?.trim() ?? "";
        const note = rawNote.length > 0 ? rawNote.slice(0, 500) : null;
        await tx.insert(orderItems).values({
          orderId: order.id,
          productId: item.productId,
          selectedModifiers: snapshot,
          notes: note,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        });
      }

      const allProductIds = [...new Set(cartItems.map((ci) => ci.productId))];
      const recipeRows = await tx
        .select()
        .from(recipes)
        .where(inArray(recipes.productId, allProductIds));
      const recipeMap = new Map<string, { ingredientId: string; quantityUsed: string }[]>();
      for (const row of recipeRows) {
        const list = recipeMap.get(row.productId) ?? [];
        list.push({ ingredientId: row.ingredientId, quantityUsed: row.quantityUsed });
        recipeMap.set(row.productId, list);
      }

      for (let li = 0; li < lineItems.length; li++) {
        const line = lineItems[li];
        const cartLine = cartItems[li];
        const productRecipes = recipeMap.get(line.productId);
        if (!productRecipes) continue;
        for (const rec of productRecipes) {
          const qtyMinor = toMinorUnits(rec.quantityUsed);
          const totalMinor = qtyMinor * line.quantity;
          const deltaStr = (-totalMinor / 100).toFixed(2);
          await tx.insert(inventoryMoves).values({
            ingredientId: rec.ingredientId,
            deltaQty: deltaStr,
            reason: "sale",
            refOrderId: order.id,
            createdBy: staffId,
          });
          await tx
            .update(ingredients)
            .set({
              currentStock: sql`${ingredients.currentStock} + ${deltaStr}::numeric`,
            })
            .where(eq(ingredients.id, rec.ingredientId));
        }

        // Modifier-linked ingredients (spec §8.4): each selected topping
        // that carries an ingredient linkage deducts its per-serving
        // quantity.  The linkage is resolved server-side from the DB
        // (modifierLookup), never trusted from the client (review M2).
        const modIds = (cartLine?.modifierIds ?? []).filter((id) => modifierLookup.has(id));
        for (const modId of modIds) {
          const mod = modifierLookup.get(modId)!;
          if (!mod.ingredientId || mod.ingredientQty == null) continue;
          const qtyMinor = toMinorUnits(mod.ingredientQty);
          const totalMinor = qtyMinor * line.quantity;
          const deltaStr = (-totalMinor / 100).toFixed(2);
          await tx.insert(inventoryMoves).values({
            ingredientId: mod.ingredientId,
            deltaQty: deltaStr,
            reason: "sale",
            refOrderId: order.id,
            createdBy: staffId,
          });
          await tx
            .update(ingredients)
            .set({
              currentStock: sql`${ingredients.currentStock} + ${deltaStr}::numeric`,
            })
            .where(eq(ingredients.id, mod.ingredientId));
        }
      }

      return {
        success: true as const,
        orderId: order.id,
        orderNumber,
        total: totalStr,
        accessToken: String(order.accessToken),
      };
    });

    return result;
  } catch (err) {
    const pgCode = getPostgresErrorCode(err);
    if (pgCode === "23505") {
      const [existing] = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          total: orders.total,
          accessToken: orders.accessToken,
        })
        .from(orders)
        .where(eq(orders.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existing) {
        return {
          success: true,
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          total: existing.total,
          accessToken: String(existing.accessToken),
        };
      }
    }
    console.error("Checkout transaction failed:", err);
    return { success: false, error: "Transaction failed — nothing was charged" };
  }
}

/** Drizzle wraps Postgres errors — dig out the real error code. */
function getPostgresErrorCode(err: unknown): string | undefined {
  if (err instanceof Error) {
    const anyErr = err as unknown as Record<string, unknown>;
    if (typeof anyErr.code === "string") return anyErr.code;
    if (anyErr.cause instanceof Error) {
      const cause = anyErr.cause as unknown as Record<string, unknown>;
      if (typeof cause.code === "string") return cause.code;
    }
    if (Array.isArray(anyErr.errors)) {
      for (const sub of anyErr.errors as unknown[]) {
        if (sub instanceof Error) {
          const subErr = sub as unknown as Record<string, unknown>;
          if (typeof subErr.code === "string") return subErr.code;
          if (subErr.cause instanceof Error) {
            const subCause = subErr.cause as unknown as Record<string, unknown>;
            if (typeof subCause.code === "string") return subCause.code;
          }
        }
      }
    }
  }
  return undefined;
}
