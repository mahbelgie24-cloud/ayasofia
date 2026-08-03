import type { ReceiptData } from "@/lib/db/queries";

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
  if (parseFloat(data.tax) > 0) lines.push(`الضريبة: ${data.tax} ₪`);
  if (parseFloat(data.discount) > 0) lines.push(`الخصم: ${data.discount} ₪`);
  lines.push(`الإجمالي: ${data.total} ₪`);
  lines.push("───────────────────────");
  if (data.receiptFooter) lines.push(data.receiptFooter);
  return lines.join("\n");
}
