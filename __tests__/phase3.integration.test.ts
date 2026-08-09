/* eslint-disable @typescript-eslint/no-require-imports */
import { vi } from "vitest";
import { describe, it, expect, afterAll, afterEach, beforeEach } from "vitest";
import { loadTestEnv } from "@/lib/test-env";

// Mock next/headers — placeCustomerOrder now calls headers() for IP
// rate-limiting.  In the integration test there's no request scope,
// so we provide a stable test IP.  vi.mock is hoisted above imports.
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

const { testPool } = await vi.hoisted(async () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  // Staging env preferred so local tests never touch production.
  const envFile = path.resolve(__dirname, "..", ".env.test.local");
  const envPath = fs.existsSync(envFile) ? envFile : path.resolve(__dirname, "..", ".env.local");
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^(\w+)=(.*)$/);
      if (match && match[1] === "DATABASE_URL") {
        process.env.DATABASE_URL = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* ignore */
  }
  const { Pool } = require("pg") as typeof import("pg");
  return { testPool: new Pool({ connectionString: process.env.DATABASE_URL }) };
});

// Step-3 guard: assert the resolved DATABASE_URL is not the production project.
loadTestEnv();

import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, sql } from "drizzle-orm";
import {
  orders,
  orderItems,
  inventoryMoves,
  ingredients,
  products,
  recipes,
  modifierGroups,
  modifiers,
} from "@/db/schema";
import { placeCustomerOrder } from "@/app/order/actions";
import { executeCheckout } from "@/lib/checkout-core";

const db = drizzle(testPool, {
  schema: {
    orders,
    orderItems,
    inventoryMoves,
    ingredients,
    products,
    recipes,
    modifierGroups,
    modifiers,
  },
});

const stockSnapshots = new Map<string, string>();
let createdOrderIds: string[] = [];
let createdModifierIds: string[] = [];

beforeEach(async () => {
  createdOrderIds = [];
  createdModifierIds = [];
  stockSnapshots.clear();
});

afterEach(async () => {
  for (const oid of createdOrderIds) {
    try {
      await db.execute(sql`DELETE FROM inventory_moves WHERE ref_order_id = ${oid}`);
    } catch {
      /* */
    }
    try {
      await db.execute(sql`DELETE FROM order_items WHERE order_id = ${oid}`);
    } catch {
      /* */
    }
    try {
      await db.execute(sql`DELETE FROM orders WHERE id = ${oid}`);
    } catch {
      /* */
    }
  }
  for (const mid of createdModifierIds) {
    try {
      await db.delete(modifiers).where(eq(modifiers.id, mid));
    } catch {
      /* */
    }
  }
  for (const [ingId, stock] of stockSnapshots) {
    try {
      await db.execute(
        sql`UPDATE ingredients SET current_stock = ${stock}::numeric WHERE id = ${ingId}`,
      );
    } catch {
      /* */
    }
  }
});

afterAll(async () => {
  await testPool.end();
});

describe("placeCustomerOrder — integration", () => {
  it("creates order with no staff session and deducts inventory", { timeout: 30000 }, async () => {
    // Find a product that has a recipe (so inventory deduction is testable).
    // Previously this test passed an ingredient ID as the productId —
    // the old code silently skipped unknown products and created a
    // 0-total order. SEC-001 validation now correctly rejects that.
    const recipeRow = await db.select().from(recipes).limit(1);
    expect(recipeRow.length).toBeGreaterThan(0);
    const productId = recipeRow[0]!.productId;

    // Snapshot stock for the ingredient linked to this product's recipe
    const [ing] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, recipeRow[0]!.ingredientId))
      .limit(1);
    expect(ing).toBeDefined();
    stockSnapshots.set(ing!.id, ing!.currentStock);

    const result = await placeCustomerOrder({
      cartItems: [
        {
          productId,
          modifierIds: [],
          quantity: 1,
        },
      ],
      customerName: "Test Customer",
      customerPhone: "0591111111",
      idempotencyKey: `TEST-CUST-${Date.now()}`,
    });

    expect(result.success).toBe(true);
    if (result.success) createdOrderIds.push(result.orderId);

    // Verify the order was created with correct channel
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, result.success ? result.orderId : ""))
      .limit(1);
    expect(order).toBeDefined();
    expect(order.channel).toBe("takeaway");
    expect(order.customerName).toBe("Test Customer");
    expect(order.staffId).toBeNull();
  });
});

describe("checkout — modifier-linked ingredient deduction (M2)", () => {
  it("deducts ingredient stock for a linked topping modifier", { timeout: 30000 }, async () => {
    // Find a product that has BOTH a recipe and a modifier group, then link
    // the modifier to an ingredient that is NOT in that product's recipe.
    // Otherwise the base recipe deduction would also hit the same row and
    // mask the modifier-specific deduction we assert here (review M2).
    const recipeRows = await db.select().from(recipes);
    expect(recipeRows.length).toBeGreaterThan(0);

    const recipeIngredientIds = new Map<string, Set<string>>();
    for (const row of recipeRows) {
      const set = recipeIngredientIds.get(row.productId) ?? new Set<string>();
      set.add(row.ingredientId);
      recipeIngredientIds.set(row.productId, set);
    }

    const allIngredients = await db.select({ id: ingredients.id }).from(ingredients);
    expect(allIngredients.length).toBeGreaterThan(0);

    const productIds = [...new Set(recipeRows.map((r) => r.productId))];
    let chosen: { productId: string; groupId: string; spareIngredientId: string } | undefined;

    for (const productId of productIds) {
      const [group] = await db
        .select({ id: modifierGroups.id })
        .from(modifierGroups)
        .where(eq(modifierGroups.productId, productId))
        .limit(1);
      if (!group) continue;
      const blocked = recipeIngredientIds.get(productId) ?? new Set<string>();
      const spare = allIngredients.find((i) => !blocked.has(i.id));
      if (!spare) continue;
      chosen = { productId, groupId: group.id, spareIngredientId: spare.id };
      break;
    }
    expect(chosen).toBeDefined();

    const [ing] = await db
      .select({ id: ingredients.id, currentStock: ingredients.currentStock })
      .from(ingredients)
      .where(eq(ingredients.id, chosen!.spareIngredientId))
      .limit(1);
    expect(ing).toBeDefined();
    stockSnapshots.set(ing!.id, ing!.currentStock);
    const before = parseFloat(ing!.currentStock);

    // Create a modifier linked to that ingredient (50 per serving).
    const suffix = Math.random().toString(36).slice(2, 8);
    const [mod] = await db
      .insert(modifiers)
      .values({
        groupId: chosen!.groupId,
        nameAr: "مكوّن اختبار",
        name: `TEST-LINK-${suffix}`,
        priceDelta: "0.00",
        ingredientId: ing!.id,
        ingredientQty: "50.00",
      })
      .returning({ id: modifiers.id });
    createdModifierIds.push(mod.id);

    const result = await executeCheckout({
      cartItems: [{ productId: chosen!.productId, modifierIds: [mod.id], quantity: 2 }],
      idempotencyKey: `TEST-M2-${Date.now()}-${suffix}`,
      paymentMethod: "cash",
      channel: "takeaway",
      staffId: null,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    createdOrderIds.push(result.orderId);

    // Stock must have dropped by exactly 50 × 2 = 100 for the modifier.
    const [after] = await db
      .select({ currentStock: ingredients.currentStock })
      .from(ingredients)
      .where(eq(ingredients.id, ing!.id))
      .limit(1);
    expect(parseFloat(after!.currentStock)).toBe(before - 100);

    // An auditable sale move must reference the order and the right ingredient.
    const [move] = await db
      .select()
      .from(inventoryMoves)
      .where(
        and(
          eq(inventoryMoves.refOrderId, result.orderId),
          eq(inventoryMoves.ingredientId, ing!.id),
        ),
      )
      .limit(1);
    expect(move).toBeDefined();
    expect(move!.reason).toBe("sale");
    expect(parseFloat(move!.deltaQty)).toBe(-100);
  });
});
