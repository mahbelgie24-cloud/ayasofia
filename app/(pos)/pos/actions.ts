"use server";

import { requireStaffSession } from "@/lib/auth";
import { executeCheckout } from "@/lib/checkout-core";
import type { CartItemForServer } from "@/lib/pricing";

export interface CheckoutInput {
  cartItems: CartItemForServer[];
  idempotencyKey: string;
  paymentMethod: string;
  channel?: "dine_in" | "takeaway" | "drive_thru";
  clientTotal?: number;
  customerPhone?: string;
}

export type CheckoutResult =
  | { success: true; orderId: string; orderNumber: string; total: string }
  | { success: false; error: string };

export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  const { staffId } = await requireStaffSession();
  return executeCheckout({
    ...input,
    channel: input.channel ?? "dine_in",
    staffId,
  });
}
