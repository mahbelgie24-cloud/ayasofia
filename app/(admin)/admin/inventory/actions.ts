"use server";

import { requireStaffSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ingredients, inventoryMoves, purchases, suppliers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { toScaledInt, formatPrice } from "@/lib/pricing";

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Normalise a user-entered amount into canonical numeric-as-string at
 * scale 2 (spec §12 money boundary — no raw JS float may touch a price).
 * Returns null for invalid input.
 */
function sanitizeAmount(input: string | undefined | null): string | null {
  if (input === undefined || input === null) return null;
  const trimmed = input.trim();
  if (trimmed === "" || !/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return formatPrice(toScaledInt(trimmed, 2));
}

/**
 * Log a purchase — adds stock to an ingredient and records the move.
 * Manager or owner only.
 */
export async function logPurchase(input: {
  ingredientId: string;
  quantity: number;
  totalCost?: string;
  supplierId?: string;
}): Promise<ActionResult> {
  const { staffId } = await requireStaffSession("manager");
  const { ingredientId, quantity, totalCost, supplierId } = input;

  if (!ingredientId || quantity <= 0) {
    return { success: false, error: "Invalid input" };
  }

  const costStr = sanitizeAmount(totalCost ?? "0") ?? "0.00";

  try {
    await db.transaction(async (tx) => {
      const deltaStr = quantity.toFixed(2);

      // Insert the inventory move
      await tx.insert(inventoryMoves).values({
        ingredientId,
        deltaQty: deltaStr,
        reason: "purchase",
        createdBy: staffId,
      });

      // Update stock
      await tx
        .update(ingredients)
        .set({
          currentStock: sql`${ingredients.currentStock} + ${deltaStr}::numeric`,
        })
        .where(eq(ingredients.id, ingredientId));

      // Optionally insert a purchase record
      if (supplierId) {
        await tx.insert(purchases).values({
          supplierId,
          totalCost: costStr,
          status: "received",
        });
      }
    });

    return { success: true };
  } catch (err) {
    console.error("logPurchase failed:", err);
    return { success: false, error: "Transaction failed" };
  }
}

/**
 * Log waste — subtracts stock from an ingredient and records the move.
 * Manager or owner only.  Allows stock to go negative (same deliberate
 * policy as sales — a reconciliation flag, not a blocker).
 */
export async function logWaste(input: {
  ingredientId: string;
  quantity: number;
}): Promise<ActionResult> {
  const { staffId } = await requireStaffSession("manager");
  const { ingredientId, quantity } = input;

  if (!ingredientId || quantity <= 0) {
    return { success: false, error: "Invalid input" };
  }

  try {
    await db.transaction(async (tx) => {
      const deltaStr = (-quantity).toFixed(2);

      await tx.insert(inventoryMoves).values({
        ingredientId,
        deltaQty: deltaStr,
        reason: "waste",
        createdBy: staffId,
      });

      await tx
        .update(ingredients)
        .set({
          currentStock: sql`${ingredients.currentStock} + ${deltaStr}::numeric`,
        })
        .where(eq(ingredients.id, ingredientId));
    });

    return { success: true };
  } catch (err) {
    console.error("logWaste failed:", err);
    return { success: false, error: "Transaction failed" };
  }
}

/**
 * Fetch all ingredients and suppliers for dropdowns.
 * Manager+ only — like every other action in this module.  Listing
 * ingredient names and supplier names to an unauthenticated caller
 * is an information-disclosure risk (OWASP A01:2021 / ASVS 7.1.1).
 */
export async function getInventoryOptions() {
  await requireStaffSession("manager");
  const [ingRows, supRows] = await Promise.all([
    db.select({ id: ingredients.id, name: ingredients.name }).from(ingredients),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers),
  ]);
  return { ingredients: ingRows, suppliers: supRows };
}
