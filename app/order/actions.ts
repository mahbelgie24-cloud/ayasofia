"use server";

import { executeCheckout } from "@/lib/checkout-core";
import type { CartItemForServer } from "@/lib/pricing";

export type PlaceOrderResult =
  | { success: true; orderId: string; orderNumber: string; total: string }
  | { success: false; error: string };

/**
 * Place a customer self-order — no auth required, no staff session.
 * This is the deliberate public exception alongside verifyStaffPin.
 * Still: server-side recomputation, atomic transaction, idempotency.
 */
export async function placeCustomerOrder(input: {
  cartItems: CartItemForServer[];
  customerName: string;
  customerPhone?: string;
  idempotencyKey: string;
}): Promise<PlaceOrderResult> {
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
