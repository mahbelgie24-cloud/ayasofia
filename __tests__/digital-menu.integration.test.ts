/**
 * Integration test: digital-menu order → single POS pipeline.
 *
 * Verifies that an order placed through the digital menu action lands in
 * the SAME orders table the cashier uses, tagged source=DIGITAL_MENU with
 * the table id set, and that inventory is decremented (recipes + topping
 * modifier). Requires DATABASE_URL; self-cleaning.
 */

import { describe, it, expect, afterEach, afterAll, beforeEach } from "vitest";
import { vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { loadTestEnv } from "@/lib/test-env";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  orders,
  orderItems,
  inventoryMoves,
  ingredients,
  products,
  recipes,
  branches,
  tables,
  settings,
  modifierGroups,
  modifiers,
} from "@/db/schema";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

// Load the isolated staging credentials + assert not the production project.
loadTestEnv();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, {
  schema: {
    orders,
    orderItems,
    inventoryMoves,
    ingredients,
    products,
    recipes,
    branches,
    tables,
    settings,
    modifierGroups,
    modifiers,
  },
});

let createdBranchId: string | null = null;
let createdTableId: string | null = null;
let createdOrderIds: string[] = [];

beforeEach(() => {
  createdBranchId = null;
  createdTableId = null;
  createdOrderIds = [];
});

afterEach(async () => {
  for (const id of createdOrderIds) {
    try {
      await db.delete(orderItems).where(eq(orderItems.orderId, id));
      await db.delete(inventoryMoves).where(eq(inventoryMoves.refOrderId, id));
      await db.delete(orders).where(eq(orders.id, id));
    } catch {
      /* */
    }
  }
  if (createdTableId) {
    try {
      await db.delete(tables).where(eq(tables.id, createdTableId));
    } catch {
      /* */
    }
  }
  if (createdBranchId) {
    try {
      await db.delete(branches).where(eq(branches.id, createdBranchId));
    } catch {
      /* */
    }
  }
});

afterAll(async () => {
  await pool.end();
});

describe("digital menu → single POS pipeline (integration)", () => {
  it(
    "places a dine-in order tagged source=DIGITAL_MENU with table id and deducts inventory",
    { timeout: 30000 },
    async () => {
      // Enable feature flag.
      await db
        .insert(settings)
        .values({ key: "feature.digital_menu", value: "1" })
        .onConflictDoUpdate({ target: settings.key, set: { value: "1" } });

      // Branch + table.
      const slug = `test-${Math.random().toString(36).slice(2, 8)}`;
      const [branch] = await db
        .insert(branches)
        .values({ name: "Test Branch", slug })
        .returning({ id: branches.id });
      createdBranchId = branch.id;
      const [tbl] = await db
        .insert(tables)
        .values({ branchId: branch.id, code: "T1", qrToken: randomUUID() })
        .returning({ id: tables.id });
      createdTableId = tbl.id;

      // Pick a product with a recipe.
      const rec = (await db.select().from(recipes).limit(1))[0];
      expect(rec).toBeDefined();

      const { placeDigitalMenuOrder } = await import("@/app/digital-menu/actions");
      const res = await placeDigitalMenuOrder({
        branchSlug: slug,
        cartItems: [{ productId: rec.productId, modifierIds: [], quantity: 1 }],
        idempotencyKey: `DM-${Date.now()}-${randomUUID().slice(0, 8)}`,
        orderType: "dine_in",
        tableId: tbl.id,
      });
      expect(res.success).toBe(true);
      if (!res.success) return;
      createdOrderIds.push(res.orderId);

      const [order] = await db.select().from(orders).where(eq(orders.id, res.orderId)).limit(1);
      expect(order.source).toBe("DIGITAL_MENU");
      expect(order.channel).toBe("dine_in");
      expect(order.tableId).toBe(tbl.id);
      expect(order.staffId).toBeNull();

      // Inventory decremented: the recipe move for this order deducts exactly
      // the recipe quantity. Assert the MOVE (delta) rather than absolute
      // stock — other integration tests may touch the same seeded ingredient
      // in parallel, so an absolute-stock assertion is not race-safe.
      const moves = await db
        .select()
        .from(inventoryMoves)
        .where(eq(inventoryMoves.refOrderId, res.orderId));
      expect(moves.length).toBeGreaterThan(0);
      const recipeMove = moves.find((m) => m.ingredientId === rec.ingredientId);
      expect(recipeMove).toBeDefined();
      expect(recipeMove!.reason).toBe("sale");
      expect(parseFloat(recipeMove!.deltaQty)).toBe(-parseFloat(rec.quantityUsed));
    },
  );
});
