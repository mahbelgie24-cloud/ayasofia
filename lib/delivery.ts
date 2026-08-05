/**
 * Delivery fee rules (C6) — computed server-side from settings, NEVER
 * trusted from the client.
 *
 * Settings keys (see docs/digital-menu.md):
 *   delivery.fee            — flat fee as numeric-as-string, e.g. "5.00"
 *   delivery.free_threshold — subtotal (in shekels) above which the fee is waived, e.g. "50"
 *   delivery.min_order      — optional minimum order subtotal (shekels); empty = no minimum
 *
 * All arithmetic uses lib/pricing minor-unit helpers — no floats.
 * NOTE: no `"use server"` directive — imported only from server modules.
 */

import { db } from "@/lib/db";
import { settings } from "@/db/schema";
import { toMinorUnits, formatPrice } from "@/lib/pricing";

export interface DeliveryFeeRules {
  fee: string; // numeric-as-string, e.g. "5.00"
  freeThreshold: string | null; // numeric-as-string, e.g. "50.00"
  minOrder: string | null;
}

export interface FeeResult {
  feeMinor: number;
  fee: string;
  waived: boolean;
}

/** Read delivery fee rules from settings, with safe defaults. */
export async function getDeliveryFeeRules(): Promise<DeliveryFeeRules> {
  const rows = await db.select({ key: settings.key, value: settings.value }).from(settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    fee: map.get("delivery.fee") ?? "0.00",
    freeThreshold: map.get("delivery.free_threshold") ?? null,
    minOrder: map.get("delivery.min_order") ?? null,
  };
}

/**
 * Compute the delivery fee for a subtotal (in agorot).
 * Server-side only — the client never supplies a fee.
 */
export function computeDeliveryFee(subtotalAgorot: number, rules: DeliveryFeeRules): FeeResult {
  const feeMinor = toMinorUnits(rules.fee);
  if (subtotalAgorot <= 0) return { feeMinor: 0, fee: "0.00", waived: true };

  if (rules.freeThreshold) {
    const thresholdMinor = toMinorUnits(rules.freeThreshold);
    if (subtotalAgorot >= thresholdMinor) {
      return { feeMinor: 0, fee: "0.00", waived: true };
    }
  }
  return { feeMinor, fee: formatPrice(feeMinor), waived: false };
}

/** Validate the subtotal meets the minimum-order rule, if any. Returns error message or null. */
export function validateMinimumOrder(
  subtotalAgorot: number,
  rules: DeliveryFeeRules,
): string | null {
  if (!rules.minOrder) return null;
  const minMinor = toMinorUnits(rules.minOrder);
  if (subtotalAgorot < minMinor) {
    const shortage = formatPrice(minMinor - subtotalAgorot);
    return `الحد الأدنى للطلب: ${formatPrice(minMinor)} ₪ — أضف ${shortage} ₪`;
  }
  return null;
}
