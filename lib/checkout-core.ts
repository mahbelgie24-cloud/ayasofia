import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { orders, orderItems, ingredients, recipes, inventoryMoves } from "@/db/schema";
import { recalculateCartServerSide, type CartItemForServer } from "@/lib/pricing-server";
import { toMinorUnits } from "@/lib/pricing";
import { eq, inArray, sql } from "drizzle-orm";

export interface SharedCheckoutParams {
  cartItems: CartItemForServer[];
  idempotencyKey: string;
  paymentMethod: string;
  channel: "dine_in" | "takeaway" | "drive_thru";
  staffId: string | null;
  customerPhone?: string;
  customerName?: string;
  clientTotal?: number;
}

export type SharedCheckoutResult =
  | { success: true; orderId: string; orderNumber: string; total: string }
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
  } = params;

  if (!cartItems.length) return { success: false, error: "Cart is empty" };
  if (!idempotencyKey) return { success: false, error: "Missing idempotency key" };

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: orders.id, orderNumber: orders.orderNumber, total: orders.total })
        .from(orders)
        .where(eq(orders.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existing) {
        return {
          success: true as const,
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          total: existing.total,
        };
      }

      const { lineItems, subtotal, modifierLookup } = await recalculateCartServerSide(cartItems);

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
      const totalStr = subtotalStr;

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          channel,
          status: "received",
          subtotal: subtotalStr,
          tax: "0.00",
          discount: "0.00",
          total: totalStr,
          paymentMethod,
          staffId,
          idempotencyKey,
          customerPhone: customerPhone || null,
          customerName: customerName || null,
        })
        .returning({ id: orders.id });

      if (!order) {
        tx.rollback();
        return { success: false as const, error: "Failed to create order" };
      }

      for (const item of lineItems) {
        const modIds = cartItems.find((ci) => ci.productId === item.productId)?.modifierIds ?? [];
        const snapshot = modIds.map((id) => modifierLookup.get(id)).filter(Boolean);
        await tx.insert(orderItems).values({
          orderId: order.id,
          productId: item.productId,
          selectedModifiers: snapshot,
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

      for (const line of lineItems) {
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
      }

      return { success: true as const, orderId: order.id, orderNumber, total: totalStr };
    });

    return result;
  } catch (err) {
    const pgCode = getPostgresErrorCode(err);
    if (pgCode === "23505") {
      const [existing] = await db
        .select({ id: orders.id, orderNumber: orders.orderNumber, total: orders.total })
        .from(orders)
        .where(eq(orders.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existing) {
        return {
          success: true,
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          total: existing.total,
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
