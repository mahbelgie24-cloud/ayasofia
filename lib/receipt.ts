import type { ReceiptData } from "@/lib/db/queries";
import { toMinorUnits } from "@/lib/pricing";

/**
 * Extract per-modifier price deltas from the JSONB snapshot stored on
 * `order_items.selectedModifiers`, for server-side receipt line-total
 * recomputation.  Receipts must never trust stored totals — recompute
 * from the snapshot's priceDeltas so line items sum to the printed
 * subtotal (WEB-DATA-002: previously `[]` was passed, dropping every
 * modifier delta and making per-line totals silently wrong).
 *
 * Snapshot formats persisted over time:
 *   - current: Array<{ modifierId, nameAr, nameEn, priceDelta }>
 *   - legacy:   Array<string>           — modifier IDs only, no deltas
 *   - null/undefined                      — no modifiers
 *
 * Legacy entries carry no price-delta information (reported as 0).
 * Only rows written before the snapshot migration are affected.
 */
type ModifierSnapshotEntry = {
  modifierId?: string;
  nameAr?: string;
  nameEn?: string;
  priceDelta?: string | number | null;
};

export function extractModifierDeltas(snapshot: unknown): { priceDelta: string }[] {
  if (!Array.isArray(snapshot)) return [];
  const deltas: { priceDelta: string }[] = [];
  for (const entry of snapshot) {
    if (entry && typeof entry === "object") {
      // One delta per modifier object.  A missing/null priceDelta is
      // treated as "0" so the modifier still contributes (as nothing)
      // — math-identical to skipping, but keeps a 1:1 mapping between
      // snapshot entries and delta entries.
      const e = entry as ModifierSnapshotEntry;
      deltas.push({ priceDelta: String(e.priceDelta ?? "0") });
    }
    // Legacy plain-string entries carry no delta information — skip.
  }
  return deltas;
}

/**
 * Build a plain-text receipt summary suitable for WhatsApp sharing.
 * No HTML — pure text designed for mobile messaging.
 */
export function buildReceiptText(data: ReceiptData): string {
  const lines: string[] = [];
  lines.push(data.shopName);
  if (data.shopAddress) lines.push(data.shopAddress);
  if (data.shopPhone) lines.push(data.shopPhone);
  lines.push("───────────────────────");
  lines.push(`رقم الطلب: ${data.orderNumber}`);
  lines.push(`طريقة الدفع: ${data.paymentMethod ?? "غير محدد"}`);
  if (data.tableCode) lines.push(`الطاولة: ${data.tableCode}`);
  if (data.staffName) lines.push(`الموظف: ${data.staffName}`);
  lines.push(`التاريخ: ${new Date(data.createdAt).toLocaleString("ar")}`);
  lines.push("───────────────────────");
  for (const item of data.items) {
    let line = `${item.productNameAr} ×${item.quantity}`;
    if (item.modifierNames.length > 0) {
      line += ` (${item.modifierNames.join("، ")})`;
    }
    line += ` — ${item.lineTotal} ₪`;
    lines.push(line);
  }
  lines.push("───────────────────────");
  lines.push(`المجموع الفرعي: ${data.subtotal} ₪`);
  if (toMinorUnits(data.tax) > 0) lines.push(`الضريبة: ${data.tax} ₪`);
  if (toMinorUnits(data.discount) > 0) lines.push(`الخصم: ${data.discount} ₪`);
  lines.push(`الإجمالي: ${data.total} ₪`);
  lines.push("───────────────────────");
  if (data.receiptFooter) lines.push(data.receiptFooter);
  return lines.join("\n");
}
