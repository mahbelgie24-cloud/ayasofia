/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * P1-M2 — idempotency redesign integration test.
 *
 * Exercises executeCheckout end-to-end with keys derived by
 * computeIdempotencyKey (session + cart fingerprint):
 *   (a) an IDENTICAL cart resubmit is deduped — same order, deduped:true;
 *   (b) a MODIFIED cart (quantity change) derives a different key and creates
 *       a NEW order — deduped:false, different order id.
 *
 * Requires a migrated + seeded Postgres (see README "CI seed gate").
 * Self-cleaning: removes created inventory moves / order items / orders and
 * restores ingredient stock, modelled on phase3.integration.test.ts.
 */

import { vi } from "vitest";
import { describe, it, expect, afterAll, afterEach, beforeEach } from "vitest";
import { loadTestEnv } from "@/lib/test-env";

await vi.hoisted(async () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const testEnvFile = path.resolve(__dirname, "..", ".env.test.local");
  const envPath = fs.existsSync(testEnvFile)
    ? testEnvFile
    : path.resolve(__dirname, "..", ".env.local");
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
import { eq, inArray, sql } from "drizzle-orm";
import { orders, orderItems, inventoryMoves, ingredients, products, recipes } from "@/db/schema";
import { executeCheckout } from "@/lib/checkout-core";
import { computeIdempotencyKey } from "@/lib/idempotency";

// Step-3 guard: assert the resolved DATABASE_URL is not the production project.
loadTestEnv();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, {
  schema: { orders, orderItems, inventoryMoves, ingredients, products, recipes },
});

let createdOrderIds: string[] = [];
const stockSnapshots = new Map<string, string>();

beforeEach(() => {
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
  await pool.end();
}, 30000);

describe("P1-M2 idempotency redesign — executeCheckout", () => {
  it(
    "identical cart resubmit dedupes; a modified cart creates a new order",
    { timeout: 60000 },
    async () => {
      // Pick a real seeded product that deducts inventory (has a recipe) and
      // whose modifier groups are not required (empty modifiers pass validation).
      const recipeRow = await db.select().from(recipes).limit(1);
      expect(recipeRow.length).toBeGreaterThan(0);
      const productId = recipeRow[0]!.productId;

      // Snapshot the first recipe ingredient's stock for restoration.
      const [ing] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, recipeRow[0]!.ingredientId))
        .limit(1);
      expect(ing).toBeDefined();
      stockSnapshots.set(ing!.id, ing!.currentStock);

      // A structural cart shape accepted by both computeIdempotencyKey and
      // executeCheckout (modifierIds always present).
      type CartLine = { productId: string; modifierIds: string[]; quantity: number };

      const baseCart: CartLine[] = [{ productId, modifierIds: [], quantity: 1 }];
      // Unique per run so the derived key never collides with a prior run's
      // order on a persistent/shared live DB (a hardcoded session would make
      // the first submit appear deduped on the second run).
      const session = `p1m2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // (a) identical submit → same key → deduped.
      const keyA = await computeIdempotencyKey(session, baseCart);
      const r1 = await executeCheckout({
        cartItems: baseCart,
        idempotencyKey: keyA,
        paymentMethod: "cash",
        channel: "takeaway",
        staffId: null,
      });
      expect(r1.success).toBe(true);
      if (!r1.success) return;
      expect(r1.deduped).toBe(false);
      createdOrderIds.push(r1.orderId);

      const r2 = await executeCheckout({
        cartItems: baseCart,
        idempotencyKey: keyA,
        paymentMethod: "cash",
        channel: "takeaway",
        staffId: null,
      });
      expect(r2.success).toBe(true);
      if (!r2.success) return;
      expect(r2.deduped).toBe(true);
      expect(r2.orderId).toBe(r1.orderId);

      // (b) modified cart (qty 2) → different key → a NEW order.
      const modifiedCart: CartLine[] = [{ productId, modifierIds: [], quantity: 2 }];
      const keyB = await computeIdempotencyKey(session, modifiedCart);
      expect(keyB).not.toBe(keyA);

      const r3 = await executeCheckout({
        cartItems: modifiedCart,
        idempotencyKey: keyB,
        paymentMethod: "cash",
        channel: "takeaway",
        staffId: null,
      });
      expect(r3.success).toBe(true);
      if (!r3.success) return;
      expect(r3.deduped).toBe(false);
      expect(r3.orderId).not.toBe(r1.orderId);
      createdOrderIds.push(r3.orderId);

      // Exactly two distinct orders exist for this session's two carts.
      const rows = await db
        .select({ id: orders.id })
        .from(orders)
        .where(inArray(orders.id, createdOrderIds));
      expect(rows).toHaveLength(2);
    },
  );
});
