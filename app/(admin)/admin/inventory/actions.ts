"use server";

import { requireStaffSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ingredients, inventoryMoves, purchases, suppliers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Log a purchase — adds stock to an ingredient and records the move.
 * Manager or owner only.
 */
export async function logPurchase(input: {
  ingredientId: string;
  quantity: number;
  totalCost: number;
  supplierId?: string;
}): Promise<ActionResult> {
  const { staffId } = await requireStaffSession("manager");
  const { ingredientId, quantity, totalCost, supplierId } = input;

  if (!ingredientId || quantity <= 0) {
    return { success: false, error: "Invalid input" };
  }

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
          totalCost: totalCost.toFixed(2),
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
 */
export async function getInventoryOptions() {
  const [ingRows, supRows] = await Promise.all([
    db.select({ id: ingredients.id, name: ingredients.name }).from(ingredients),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers),
  ]);
  return { ingredients: ingRows, suppliers: supRows };
}
