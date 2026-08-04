/**
 * Offline queue tests — unit tests for the IndexedDB queue layer.
 *
 * Uses Dexie's fake-indexeddb for browser-less testing.
 * Import order matters: fake-indexeddb must be imported before Dexie.
 */
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";

// Dynamic import so fake-indexeddb patches globals before the module loads.
const queue = await import("@/lib/offline/queue");

describe("offline order queue", () => {
  beforeEach(async () => {
    await queue.db.orders.clear();
  });

  it("enqueueOrder stores an order with syncedAt=0 (pending)", async () => {
    const id = await queue.enqueueOrder(
      JSON.stringify([{ productId: "p1", modifierIds: [], quantity: 1 }]),
      "key-1",
      "cash",
      "dine_in",
    );
    expect(typeof id).toBe("number");

    const pending = await queue.getPendingOrders();
    expect(pending.length).toBe(1);
    expect(pending[0].idempotencyKey).toBe("key-1");
    expect(pending[0].syncedAt).toBe(0);
  });

  it("getPendingOrders returns only unsynced orders", async () => {
    await queue.enqueueOrder("[]", "key-a", "cash", "dine_in");
    const id2 = await queue.enqueueOrder("[]", "key-b", "card", "takeaway");

    await queue.markOrderSynced(id2, "order-1", "POS-ABC", "15.00");

    const pending = await queue.getPendingOrders();
    expect(pending.length).toBe(1);
    expect(pending[0].idempotencyKey).toBe("key-a");
  });

  it("markOrderSynced updates syncedAt and server fields", async () => {
    const id = await queue.enqueueOrder("[]", "key-sync", "cash", "dine_in");

    await queue.markOrderSynced(id, "order-999", "POS-XYZ", "42.50");

    const all = await queue.db.orders.toArray();
    const synced = all.find((o) => o.id === id)!;
    expect(synced.syncedAt).toBeGreaterThan(0);
    expect(synced.serverOrderId).toBe("order-999");
    expect(synced.serverOrderNumber).toBe("POS-XYZ");
    expect(synced.serverTotal).toBe("42.50");
    expect(synced.syncError).toBeNull();
  });

  it("markOrderFailed stores the error message", async () => {
    const id = await queue.enqueueOrder("[]", "key-fail", "cash", "dine_in");

    await queue.markOrderFailed(id, "تعذر الاتصال بالخادم");

    const all = await queue.db.orders.toArray();
    const failed = all.find((o) => o.id === id)!;
    expect(failed.syncError).toBe("تعذر الاتصال بالخادم");
    expect(failed.syncedAt).toBe(0); // still pending
  });

  it("pendingCount returns correct count", async () => {
    expect(await queue.pendingCount()).toBe(0);

    await queue.enqueueOrder("[]", "k1", "cash", "dine_in");
    await queue.enqueueOrder("[]", "k2", "cash", "dine_in");

    expect(await queue.pendingCount()).toBe(2);
  });

  it("pruneSyncedOrders deletes old synced records", async () => {
    const id = await queue.enqueueOrder("[]", "k1", "cash", "dine_in");
    await queue.markOrderSynced(id, "o1", "P1", "10.00");

    // Manually set syncedAt to 14 days ago
    await queue.db.orders.update(id, { syncedAt: Date.now() - 14 * 24 * 60 * 60 * 1000 });

    const deleted = await queue.pruneSyncedOrders(7);
    expect(deleted).toBe(1);
    expect(await queue.db.orders.count()).toBe(0);
  });

  it("stores and retrieves customerPhone", async () => {
    await queue.enqueueOrder("[]", "k1", "cash", "takeaway", "+972501234567");
    const pending = await queue.getPendingOrders();
    expect(pending[0].customerPhone).toBe("+972501234567");
  });

  it("idempotencyKey is preserved across enqueue and retrieval", async () => {
    const key = crypto.randomUUID();
    await queue.enqueueOrder("[]", key, "cash", "drive_thru");
    const pending = await queue.getPendingOrders();
    expect(pending[0].idempotencyKey).toBe(key);
  });
});
