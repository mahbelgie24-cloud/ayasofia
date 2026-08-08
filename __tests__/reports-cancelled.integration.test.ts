/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * T-A2 (P1-M13) — reports exclude cancelled orders.
 *
 * getSalesSummary and getBestSellers must not count cancelled orders. Also
 * asserts /order now carries source=DIGITAL_MENU (Q1=B). Uses a real migrated
 * + seeded Postgres with the auth module mocked to a manager session.
 */
import { vi } from "vitest";
import { describe, it, expect, afterAll, afterEach, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

const authSession = vi.hoisted(() => ({
  current: { staffId: "s1", role: "manager" as const },
}));
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireStaffSession: vi.fn().mockImplementation(() => Promise.resolve(authSession.current)),
  };
});

await vi.hoisted(async () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const envPath = path.resolve(__dirname, "..", ".env.local");
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
});

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, sql } from "drizzle-orm";
import {
  orders,
  orderItems,
  products,
  staff,
  recipes,
  inventoryMoves,
  ingredients,
} from "@/db/schema";
import { getSalesSummary, getBestSellers } from "@/app/(admin)/admin/reports/actions";
import { placeCustomerOrder } from "@/app/order/actions";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, {
  schema: { orders, orderItems, products, staff, recipes, inventoryMoves, ingredients },
});

let createdOrderIds: string[] = [];
const stockSnapshots = new Map<string, string>();

function shortOrdNum(prefix: string): string {
  return prefix.slice(0, 20);
}

beforeEach(async () => {
  createdOrderIds = [];
  const [s] = await db.select({ id: staff.id }).from(staff).limit(1);
  if (s) authSession.current = { staffId: s.id, role: "manager" };
});

afterEach(async () => {
  for (const oid of createdOrderIds) {
    try {
      await db.execute(sql`DELETE FROM inventory_moves WHERE ref_order_id = ${oid}`);
    } catch {
      /* */
    }
    try {
      await db.delete(orderItems).where(eq(orderItems.orderId, oid));
    } catch {
      /* */
    }
    try {
      await db.delete(orders).where(eq(orders.id, oid));
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
  await pool.end();
});

describe("reports exclude cancelled orders (P1-M13)", () => {
  it("getSalesSummary and getBestSellers ignore cancelled orders", { timeout: 30000 }, async () => {
    const prods = await db.select({ id: products.id }).from(products).limit(2);
    expect(prods.length).toBe(2);

    // Isolate to a unique day so no other test's orders — nor leftover rows
    // from a prior run on a persistent/shared DB — fall inside the range.
    // A fixed date would accumulate `received` rows across runs and inflate
    // the absolute revenue total.
    const uniqueDay = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const today = uniqueDay.toISOString().slice(0, 10);
    const createdAt = new Date(`${today}T10:00:00Z`);

    // Guarantee the range starts empty: a rapid same-day rerun (or an
    // interrupted prior run) could otherwise leave `received` rows on this
    // date that inflate the absolute total. Delete anything already there.
    const dayStart = new Date(`${today}T00:00:00Z`);
    const dayEnd = new Date(`${today}T23:59:59.999Z`);
    const preExisting = await db.execute(
      sql`SELECT id, status FROM orders WHERE created_at >= ${dayStart} AND created_at <= ${dayEnd}`,
    );
    for (const row of preExisting.rows as Array<{ id: string }>) {
      try {
        await db.execute(sql`DELETE FROM order_items WHERE order_id = ${row.id}`);
      } catch {
        /* */
      }
      try {
        await db.execute(sql`DELETE FROM orders WHERE id = ${row.id}`);
      } catch {
        /* */
      }
    }

    // Cancelled order with an item — must be excluded.
    const cKey = `TEST-C-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const [cancelled] = await db
      .insert(orders)
      .values({
        orderNumber: shortOrdNum("TEST-C-" + Date.now()),
        channel: "takeaway",
        status: "cancelled",
        subtotal: "20.00",
        tax: "0.00",
        discount: "0.00",
        total: "20.00",
        paymentMethod: "cash",
        idempotencyKey: cKey,
        createdAt,
      })
      .returning({ id: orders.id });
    createdOrderIds.push(cancelled.id);
    await db.insert(orderItems).values({
      orderId: cancelled.id,
      productId: prods[0].id,
      selectedModifiers: [],
      quantity: 1,
      unitPrice: "20.00",
    });

    // Valid order with an item — must be counted.
    const rKey = `TEST-R-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const [valid] = await db
      .insert(orders)
      .values({
        orderNumber: shortOrdNum("TEST-R-" + Date.now()),
        channel: "takeaway",
        status: "received",
        subtotal: "30.00",
        tax: "0.00",
        discount: "0.00",
        total: "30.00",
        paymentMethod: "cash",
        idempotencyKey: rKey,
        createdAt,
      })
      .returning({ id: orders.id });
    createdOrderIds.push(valid.id);
    await db.insert(orderItems).values({
      orderId: valid.id,
      productId: prods[1].id,
      selectedModifiers: [],
      quantity: 1,
      unitPrice: "30.00",
    });

    const sales = await getSalesSummary(today, today);
    expect(sales.totalRevenue).toBe("30.00");
    expect(sales.orderCount).toBe(1);

    const best = await getBestSellers(today, today);
    expect(best).toHaveLength(1);
    expect(best[0].productId).toBe(prods[1].id);
    expect(best[0].quantitySold).toBe(1);
    expect(best[0].totalRevenue).toBe("30.00");
  });

  it("placeCustomerOrder records source=DIGITAL_MENU (Q1=B)", { timeout: 30000 }, async () => {
    // Reuse the phase3-proven approach: a recipe-bearing product whose
    // modifier groups are not required (empty modifiers pass validation).
    const recipeRow = await db.select().from(recipes).limit(1);
    expect(recipeRow.length).toBeGreaterThan(0);
    const productId = recipeRow[0]!.productId;
    const [ing] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, recipeRow[0]!.ingredientId))
      .limit(1);
    if (ing) stockSnapshots.set(ing.id, ing.currentStock);

    const res = await placeCustomerOrder({
      cartItems: [{ productId, modifierIds: [], quantity: 1 }],
      customerName: "Order Retirement Test",
      idempotencyKey: `TEST-SRC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    createdOrderIds.push(res.orderId);

    const [row] = await db
      .select({ source: orders.source })
      .from(orders)
      .where(eq(orders.id, res.orderId))
      .limit(1);
    expect(row?.source).toBe("DIGITAL_MENU");
  });
});
