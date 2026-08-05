"use server";

import { executeCheckout } from "@/lib/checkout-core";
import { checkThrottle } from "@/lib/rate-limit";
import { callerIp } from "@/lib/ip";
import type { CartItemForServer } from "@/lib/pricing";

export type PlaceOrderResult =
  | { success: true; orderId: string; orderNumber: string; total: string }
  | { success: false; error: string };

// Public-endpoint abuse cap (WEB-SEC-001).  A single source IP may
// place at most 10 self-orders per 60s.  Legitimate one-person use
// never approaches this; a script does.  The idempotency key still
// prevents duplicate writes — this caps *attempt rate*.
const ORDER_RATE_LIMIT = { max: 10, windowMs: 60_000 };

/**
 * Place a customer self-order — no auth required, no staff session.
 * This is the deliberate public exception alongside verifyStaffPin.
 * Still: rate-limited by IP, server-side recomputation, atomic
 * transaction, idempotency.
 */
export async function placeCustomerOrder(input: {
  cartItems: CartItemForServer[];
  customerName: string;
  customerPhone?: string;
  idempotencyKey: string;
}): Promise<PlaceOrderResult> {
  // Throttle first — shed abuse load before any work.  This is a
  // public, unauthenticated endpoint (spec §12 exception), so an IP
  // cap is the only abuse signal available (WEB-SEC-001).
  const ip = await callerIp();
  const throttle = checkThrottle(`order:${ip}`, ORDER_RATE_LIMIT);
  if (!throttle.allowed) {
    const secs = Math.ceil(throttle.retryAfterMs / 1000);
    return {
      success: false,
      error: `عدد طلبات كثيرة من هذا الجهاز، يرجى المحاولة بعد ${secs} ثانية`,
    };
  }

  if (!input.customerName.trim()) {
    return { success: false, error: "Customer name is required" };
  }

  return executeCheckout({
    cartItems: input.cartItems,
    idempotencyKey: input.idempotencyKey,
    paymentMethod: "cash", // self-orders default to cash until Phase 6 online payments
    channel: "takeaway",
    staffId: null,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
  });
}
