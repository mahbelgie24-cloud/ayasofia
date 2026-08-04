/* eslint-disable @typescript-eslint/no-require-imports */
import { vi } from "vitest";
import { describe, it, expect, afterAll, afterEach, beforeEach } from "vitest";

// Mock next/headers — placeCustomerOrder now calls headers() for IP
// rate-limiting.  In the integration test there's no request scope,
// so we provide a stable test IP.  vi.mock is hoisted above imports.
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

const { testPool } = await vi.hoisted(async () => {
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
  const { Pool } = require("pg") as typeof import("pg");
  return { testPool: new Pool({ connectionString: process.env.DATABASE_URL }) };
});

import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { orders, orderItems, inventoryMoves, ingredients } from "@/db/schema";
import { placeCustomerOrder } from "@/app/order/actions";

const db = drizzle(testPool, { schema: { orders, orderItems, inventoryMoves, ingredients } });

const stockSnapshots = new Map<string, string>();
let createdOrderIds: string[] = [];

beforeEach(async () => {
  createdOrderIds = [];
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
    // Snapshot stock for one ingredient
    const [ing] = await db.select().from(ingredients).limit(1);
    expect(ing).toBeDefined();
    stockSnapshots.set(ing.id, ing.currentStock);
    const beforeStock = parseFloat(ing.currentStock);

    const result = await placeCustomerOrder({
      cartItems: [
        {
          productId: ing.id,
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
