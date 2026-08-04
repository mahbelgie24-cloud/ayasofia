/**
 * Offline sync engine.
 *
 * Monitors network connectivity and flushes the offline order queue
 * whenever the app comes back online.  Uses the same idempotency keys
 * that were generated during checkout, so a retry on a successfully
 * synced order is a no-op server-side.
 *
 * Single-instance: only one sync run at a time.  Invoke `initSync()`
 * once at app boot (layout mount).  The engine listens for the browser
 * `online` event and runs `flushQueue()` automatically.
 */

import { getPendingOrders, markOrderSynced, markOrderFailed, pendingCount } from "./queue";
import type { CartItemForServer } from "@/lib/pricing";

// Track whether a flush is in progress to avoid concurrent runs.
let syncing = false;

/** Result of a flush run. */
export interface FlushResult {
  synced: number;
  failed: number;
  remaining: number;
  lastOrderNumber?: string;
}

/**
 * Attempt to sync all pending offline orders with the server.
 *
 * For each pending order:
 * 1. Deserialise stored cart items
 * 2. Call checkout server action with the original idempotencyKey
 * 3. On success: mark synced with server response
 * 4. On failure: store error message, continue to next order
 *
 * Returns counts so callers can update UI.
 */
export async function flushQueue(): Promise<FlushResult> {
  if (syncing) return { synced: 0, failed: 0, remaining: await pendingCount() };
  syncing = true;

  let synced = 0;
  let failed = 0;
  let lastOrderNumber: string | undefined;

  try {
    const pending = await getPendingOrders();

    // Dynamic import: the checkout server action must only be called
    // when we're online — avoid tree-shaking it into the SW bundle.
    const { checkout: checkoutAction } = await import("@/app/(pos)/pos/actions");

    for (const order of pending) {
      try {
        let cartItems: CartItemForServer[];
        try {
          cartItems = JSON.parse(order.cartItems) as CartItemForServer[];
        } catch {
          await markOrderFailed(order.id!, "تالف: بيانات السلة غير صالحة");
          failed++;
          continue;
        }

        const result = await checkoutAction({
          cartItems,
          idempotencyKey: order.idempotencyKey,
          paymentMethod: order.paymentMethod,
          channel: order.channel,
          customerPhone: order.customerPhone,
        });

        if (result.success) {
          await markOrderSynced(order.id!, result.orderId, result.orderNumber, result.total);
          lastOrderNumber = result.orderNumber;
          synced++;
        } else {
          await markOrderFailed(order.id!, result.error);
          failed++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "تعذر الاتصال بالخادم";
        await markOrderFailed(order.id!, message);
        failed++;
      }
    }
  } finally {
    syncing = false;
  }

  return {
    synced,
    failed,
    remaining: await pendingCount(),
    lastOrderNumber,
  };
}

/**
 * Initialise the sync engine — call once at app mount.
 *
 * Sets up an `online` event listener that triggers `flushQueue()`
 * whenever the browser detects network restoration.  Also runs an
 * immediate flush if we're already online at boot.
 */
export function initSync(onFlushComplete?: (result: FlushResult) => void): () => void {
  const handleOnline = () => {
    flushQueue().then((result) => {
      if (result.synced > 0 || result.failed > 0) {
        onFlushComplete?.(result);
      }
    });
  };

  window.addEventListener("online", handleOnline);

  // Initial flush on boot if online
  if (navigator.onLine) {
    flushQueue().then((result) => {
      if (result.synced > 0) {
        onFlushComplete?.(result);
      }
    });
  }

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}
