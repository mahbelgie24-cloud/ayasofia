/**
 * Offline order queue — IndexedDB via Dexie.js.
 *
 * When the POS loses connectivity, orders are queued here with their
 * full payload and idempotencyKey.  The sync engine flushes the queue
 * on reconnect, calling the same `executeCheckout` path used online.
 */

import Dexie, { type EntityTable } from "dexie";

export interface QueuedOrder {
  id?: number;
  /** JSON-serialised CartItemForServer array */
  cartItems: string;
  /** crypto.randomUUID — same key used during online checkout */
  idempotencyKey: string;
  paymentMethod: string;
  channel: "dine_in" | "takeaway" | "drive_thru";
  customerPhone?: string;
  /** Unix timestamp when the order was queued */
  queuedAt: number;
  /** 0 = pending, > 0 = synced (Unix timestamp) */
  syncedAt: number;
  /** Server-returned order ID after sync */
  serverOrderId: string | null;
  /** Server-returned order number after sync */
  serverOrderNumber: string | null;
  /** Server-returned total after sync */
  serverTotal: string | null;
  /** User-visible error message if sync failed */
  syncError: string | null;
}

const db = new Dexie("AyasofiaOffline") as Dexie & {
  orders: EntityTable<QueuedOrder, "id">;
};

db.version(1).stores({
  orders: "++id, idempotencyKey, queuedAt, syncedAt",
});

export { db };

/** Add an order to the offline queue.  Returns the auto-generated id. */
export async function enqueueOrder(
  cartItemsJson: string,
  idempotencyKey: string,
  paymentMethod: string,
  channel: "dine_in" | "takeaway" | "drive_thru",
  customerPhone?: string,
): Promise<number> {
  const id = await db.orders.add({
    cartItems: cartItemsJson,
    idempotencyKey,
    paymentMethod,
    channel,
    customerPhone,
    queuedAt: Date.now(),
    syncedAt: 0,
    serverOrderId: null,
    serverOrderNumber: null,
    serverTotal: null,
    syncError: null,
  });
  return id as number;
}

/** Get all pending (unsynced) orders, oldest first. */
export async function getPendingOrders(): Promise<QueuedOrder[]> {
  return db.orders.where("syncedAt").equals(0).sortBy("queuedAt");
}

/** Mark an order as successfully synced. */
export async function markOrderSynced(
  id: number,
  serverOrderId: string,
  serverOrderNumber: string,
  serverTotal: string,
): Promise<void> {
  await db.orders.update(id, {
    syncedAt: Date.now(),
    serverOrderId,
    serverOrderNumber,
    serverTotal,
    syncError: null,
  });
}

/** Mark an order as failed with a user-visible error message. */
export async function markOrderFailed(id: number, error: string): Promise<void> {
  await db.orders.update(id, { syncError: error });
}

/** Count pending orders in the queue. */
export async function pendingCount(): Promise<number> {
  return db.orders.where("syncedAt").equals(0).count();
}

/** Clear all synced orders older than `maxAgeDays` days. */
export async function pruneSyncedOrders(maxAgeDays = 7): Promise<number> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return db.orders.where("syncedAt").between(1, cutoff).delete();
}
