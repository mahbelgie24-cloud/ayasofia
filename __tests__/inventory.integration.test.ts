/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, afterAll, afterEach, beforeEach } from "vitest";

// Set DATABASE_URL before any module imports via vi.hoisted
const { testPool, staffId } = await vi.hoisted(async () => {
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
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { staff } = await import("@/db/schema");
  const db = drizzle(pool, { schema: { staff } });
  const [s] = await db.select({ id: staff.id }).from(staff).limit(1);
  await pool.end();
  return {
    testPool: new Pool({ connectionString: process.env.DATABASE_URL }),
    staffId: s?.id ?? "00000000-0000-0000-0000-000000000001",
  };
});

import { vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireStaffSession: vi.fn().mockResolvedValue({ staffId, role: "manager" as const }),
}));

import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { ingredients, inventoryMoves } from "@/db/schema";
import { logPurchase, logWaste } from "@/app/(admin)/admin/inventory/actions";

const db = drizzle(testPool, { schema: { ingredients, inventoryMoves } });

const stockSnapshots = new Map<string, string>();
let createdMoveIds: string[] = [];
let createdIngredientIds: string[] = [];

beforeEach(async () => {
  createdMoveIds = [];
  createdIngredientIds = [];
  stockSnapshots.clear();
});

afterEach(async () => {
  for (const id of createdMoveIds) {
    try {
      await db.delete(inventoryMoves).where(eq(inventoryMoves.id, id));
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
  for (const id of createdIngredientIds) {
    try {
      await db.delete(ingredients).where(eq(ingredients.id, id));
    } catch {
      /* */
    }
  }
});

afterAll(async () => {
  await testPool.end();
});

describe("logPurchase — integration", () => {
  it("increases stock by the exact purchase amount", { timeout: 30000 }, async () => {
    const [ing] = await db
      .insert(ingredients)
      .values({
        name: `test-purchase-${Date.now()}`,
        unit: "g",
      })
      .returning();
    createdIngredientIds.push(ing.id);

    const before = parseFloat(ing.currentStock);
    const result = await logPurchase({ ingredientId: ing.id, quantity: 10, totalCost: "50" });
    expect(result.success).toBe(true);

    const [after] = await db.select().from(ingredients).where(eq(ingredients.id, ing.id)).limit(1);
    expect(parseFloat(after.currentStock)).toBeCloseTo(before + 10, 2);

    const [move] = await db
      .select()
      .from(inventoryMoves)
      .orderBy(sql`created_at DESC`)
      .limit(1);
    createdMoveIds.push(move.id);
    expect(move.reason).toBe("purchase");
  });
});

describe("logWaste — integration", () => {
  it(
    "decreases stock by the exact waste amount and can go negative",
    { timeout: 30000 },
    async () => {
      const [ing] = await db
        .insert(ingredients)
        .values({
          name: `test-waste-${Date.now()}`,
          unit: "g",
        })
        .returning();
      createdIngredientIds.push(ing.id);

      const before = parseFloat(ing.currentStock);
      const result = await logWaste({ ingredientId: ing.id, quantity: 99999 });
      expect(result.success).toBe(true);

      const [after] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, ing.id))
        .limit(1);
      expect(parseFloat(after.currentStock)).toBeCloseTo(before - 99999, 2);

      const [move] = await db
        .select()
        .from(inventoryMoves)
        .orderBy(sql`created_at DESC`)
        .limit(1);
      createdMoveIds.push(move.id);
      expect(move.reason).toBe("waste");
    },
  );
});
