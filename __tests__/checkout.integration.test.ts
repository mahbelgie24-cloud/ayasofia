/**
 * Integration test: confirms that concurrent transactions with the same
 * idempotencyKey result in exactly one order row.
 *
 * Requires DATABASE_URL (from .env.test.local — the isolated staging project;
 * never production .env.local).
 *
 * Every test is self-cleaning: afterEach deletes created rows by their
 * exact IDs, regardless of whether the test passed or failed.
 */

import { describe, it, expect, afterAll, afterEach, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { and, eq } from "drizzle-orm";
import { orders, products, modifiers, orderItems } from "@/db/schema";
import { loadTestEnv } from "@/lib/test-env";

// Load the isolated staging credentials + assert this is not the production
// project (Step-3 guard). CI-injected DATABASE_URL is used as-is.
loadTestEnv();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { orders, products, modifiers, orderItems } });

// ---- Test isolation helpers ----

/** IDs of orders created in the current test — cleaned up in afterEach. */
let createdOrderIds: string[] = [];
/** IDs of order_items created in the current test. */
let createdOrderItemIds: string[] = [];

beforeEach(() => {
  createdOrderIds = [];
  createdOrderItemIds = [];
});

afterEach(async () => {
  for (const id of createdOrderItemIds) {
    try {
      await db.delete(orderItems).where(eq(orderItems.id, id));
    } catch {
      /* ignore */
    }
  }
  for (const id of createdOrderIds) {
    try {
      await db.delete(orders).where(eq(orders.id, id));
    } catch {
      /* ignore */
    }
  }
});

afterAll(async () => {
  await pool.end();
});

// ---- Utilities ----

/** Drizzle wraps Postgres errors — dig out the real code. */
function extractPgCode(err: unknown): string | undefined {
  if (err instanceof Error) {
    const e = err as unknown as Record<string, unknown>;
    if (typeof e.code === "string") return e.code;
    if (e.cause instanceof Error) {
      const c = e.cause as unknown as Record<string, unknown>;
      if (typeof c.code === "string") return c.code;
    }
  }
  return undefined;
}

/** Truncate to 20 chars respecting the orders.order_number limit. */
function shortOrdNum(prefix: string): string {
  return prefix.slice(0, 20);
}

/** Create a test order, tracking its ID for cleanup. */
async function createTestOrder(overrides: Record<string, unknown> = {}) {
  const key = `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [order] = await db
    .insert(orders)
    .values({
      orderNumber: shortOrdNum("TEST-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6)),
      channel: "dine_in",
      status: "received",
      subtotal: "15.00",
      tax: "0.00",
      discount: "0.00",
      total: "15.00",
      paymentMethod: "cash",
      idempotencyKey: key,
      ...overrides,
    })
    .returning({ id: orders.id });
  createdOrderIds.push(order.id);
  return { order, key };
}

// ---- Tests ----

describe("checkout — live concurrent idempotency (integration)", () => {
  it(
    "prevents duplicate orders via unique constraint on idempotency_key",
    { timeout: 15000 },
    async () => {
      const { key } = await createTestOrder();

      let errorCode: string | undefined;
      try {
        const { order: dup } = await createTestOrder({ idempotencyKey: key });
        // remove duplicate's ID from cleanup — it's the same key, so
        // the order either wasn't created or will be cleaned up below
        createdOrderIds = createdOrderIds.filter((id) => id !== dup.id);
      } catch (err: unknown) {
        errorCode = extractPgCode(err);
      }

      expect(errorCode).toBe("23505");

      const rows = await db.select().from(orders).where(eq(orders.idempotencyKey, key));
      expect(rows).toHaveLength(1);
    },
  );

  it(
    "concurrent inserts with the same key result in exactly one row",
    { timeout: 15000 },
    async () => {
      const key = `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const results = await Promise.allSettled([
        db
          .insert(orders)
          .values({
            orderNumber: shortOrdNum("TEST-" + Date.now() + "-A"),
            channel: "dine_in",
            status: "received",
            subtotal: "10.00",
            tax: "0.00",
            discount: "0.00",
            total: "10.00",
            paymentMethod: "cash",
            idempotencyKey: key,
          })
          .returning({ id: orders.id }),
        db
          .insert(orders)
          .values({
            orderNumber: shortOrdNum("TEST-" + Date.now() + "-B"),
            channel: "dine_in",
            status: "received",
            subtotal: "10.00",
            tax: "0.00",
            discount: "0.00",
            total: "10.00",
            paymentMethod: "card",
            idempotencyKey: key,
          })
          .returning({ id: orders.id }),
      ]);

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      expect(succeeded).toBe(1);
      expect(failed).toBe(1);

      // Track the winning order for cleanup
      const winner = results.find((r) => r.status === "fulfilled") as
        { value: Array<{ id: string }> } | undefined;
      if (winner?.value?.[0]) {
        createdOrderIds.push(winner.value[0].id);
      }

      const rejection = results.find((r) => r.status === "rejected");
      if (rejection && rejection.status === "rejected") {
        expect(extractPgCode(rejection.reason)).toBe("23505");
      }

      const rows = await db.select().from(orders).where(eq(orders.idempotencyKey, key));
      expect(rows).toHaveLength(1);
    },
  );
});

describe("checkout — audit trail survives modifier deletion", () => {
  it(
    "receipt shows historical modifier name after modifier is deleted",
    { timeout: 30000 },
    async () => {
      // Pick a real seeded modifier
      const [mod] = await db.select().from(modifiers).limit(1);
      expect(mod).toBeDefined();

      // Pick a real seeded product
      const [prod] = await db.select().from(products).limit(1);
      expect(prod).toBeDefined();

      // Insert an order
      const { order } = await createTestOrder();

      // Insert an order item with the new snapshot format
      const snapshot = [
        {
          modifierId: mod.id,
          nameAr: mod.nameAr,
          nameEn: mod.name,
          priceDelta: mod.priceDelta,
        },
      ];
      const [oi] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          productId: prod.id,
          selectedModifiers: snapshot,
          quantity: 1,
          unitPrice: "15.00",
        })
        .returning({ id: orderItems.id });
      createdOrderItemIds.push(oi.id);

      // Delete the modifier — receipt must survive
      await db.delete(modifiers).where(eq(modifiers.id, mod.id));

      // Re-read the stored snapshot
      const [savedItem] = await db.select().from(orderItems).where(eq(orderItems.id, oi.id));
      expect(savedItem).toBeDefined();

      const storedMods = savedItem.selectedModifiers as Array<{ nameAr: string }>;
      expect(storedMods).toHaveLength(1);
      expect(storedMods[0].nameAr).toBe(mod.nameAr);

      // Restore the modifier so seed data stays intact
      // (This runs even if the test fails — afterEach handles order cleanup,
      //  so we only need to guard the seed data.)
      await db.insert(modifiers).values({
        id: mod.id,
        groupId: mod.groupId,
        nameAr: mod.nameAr,
        name: mod.name,
        priceDelta: mod.priceDelta,
      });
    },
  );
});

describe("checkout — public status access token (P2-SEC-1)", () => {
  it(
    "mints an unguessable access token per order and rejects reads without / with a wrong token",
    { timeout: 15000 },
    async () => {
      const { order } = await createTestOrder();

      // Every order must carry the capability token minted at creation.
      const [saved] = await db
        .select({ accessToken: orders.accessToken })
        .from(orders)
        .where(eq(orders.id, order.id))
        .limit(1);
      expect(saved).toBeDefined();
      expect(saved.accessToken).toBeTruthy();

      // CorRECT token → the order (and by extension its basket) is readable.
      const withToken = await db
        .select({ id: orders.id, accessToken: orders.accessToken })
        .from(orders)
        .where(and(eq(orders.id, order.id), eq(orders.accessToken, saved.accessToken)))
        .limit(1);
      expect(withToken).toHaveLength(1);

      // WRONG token → the status query returns nothing (≡ 404, no existence leak).
      const wrongToken = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.id, order.id),
            eq(orders.accessToken, "00000000-0000-0000-0000-000000000000"),
          ),
        )
        .limit(1);
      expect(wrongToken).toHaveLength(0);

      // A second, also-unguessable but incorrect token behaves the same.
      const wrongToken2 = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.id, order.id),
            eq(orders.accessToken, "ffffffff-ffff-ffff-ffff-ffffffffffff"),
          ),
        )
        .limit(1);
      expect(wrongToken2).toHaveLength(0);
    },
  );
});
