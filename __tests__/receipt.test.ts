import { describe, it, expect } from "vitest";
import { buildReceiptText, extractModifierDeltas } from "@/lib/receipt";
import { calculateLineTotal } from "@/lib/pricing";
import type { ReceiptData } from "@/lib/db/queries";

const sampleData: ReceiptData = {
  shopName: "Ayasofia Sweet",
  shopAddress: "Al-Wad Street, Qalqilya",
  shopPhone: "+972 56-645-8003",
  receiptFooter: "Thank you!",
  orderNumber: "POS-123",
  channel: "dine_in",
  paymentMethod: "cash",
  staffName: "Owner",
  customerPhone: "+972 59-1234567",
  subtotal: "50.00",
  tax: "0.00",
  discount: "0.00",
  total: "50.00",
  createdAt: "2026-08-03T12:00:00Z",
  items: [
    {
      productNameAr: "ميلك تي كلاسيك",
      productNameEn: "Classic Milk Tea",
      quantity: 2,
      unitPrice: "15.00",
      modifierNames: ["لؤلؤ التابيوكا", "كبير"],
      lineTotal: "36.00",
    },
    {
      productNameAr: "بان كيك سوفليه كلاسيك",
      productNameEn: "Classic Soufflé Pancake",
      quantity: 1,
      unitPrice: "22.00",
      modifierNames: [],
      lineTotal: "22.00",
    },
  ],
};

describe("buildReceiptText", () => {
  it("produces plain text with no HTML", () => {
    const text = buildReceiptText(sampleData);
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
    expect(text).not.toContain("&lt;");
  });

  it("includes shop name and order number", () => {
    const text = buildReceiptText(sampleData);
    expect(text).toContain("Ayasofia Sweet");
    expect(text).toContain("POS-123");
  });

  it("includes Arabic product names and modifiers", () => {
    const text = buildReceiptText(sampleData);
    expect(text).toContain("ميلك تي كلاسيك ×2");
    expect(text).toContain("(لؤلؤ التابيوكا، كبير)");
    expect(text).toContain("بان كيك سوفليه كلاسيك ×1");
  });

  it("includes correct totals from the data", () => {
    const text = buildReceiptText(sampleData);
    expect(text).toContain("المجموع الفرعي: 50.00 ₪");
    expect(text).toContain("الإجمالي: 50.00 ₪");
  });

  it("includes staff name and payment method", () => {
    const text = buildReceiptText(sampleData);
    expect(text).toContain("الموظف: Owner");
    expect(text).toContain("طريقة الدفع: cash");
  });

  it("includes footer text", () => {
    const text = buildReceiptText(sampleData);
    expect(text).toContain("Thank you!");
  });

  it("hides tax line when tax is zero", () => {
    const text = buildReceiptText(sampleData);
    expect(text).not.toContain("الضريبة");
  });

  it("hides discount line when discount is zero", () => {
    const text = buildReceiptText(sampleData);
    expect(text).not.toContain("الخصم");
  });

  it("shows tax line when tax is non-zero", () => {
    const data = { ...sampleData, tax: "8.50" };
    const text = buildReceiptText(data);
    expect(text).toContain("الضريبة: 8.50 ₪");
  });

  it("shows discount line when discount is non-zero", () => {
    const data = { ...sampleData, discount: "5.00" };
    const text = buildReceiptText(data);
    expect(text).toContain("الخصم: 5.00 ₪");
  });

  it("omits optional fields gracefully", () => {
    const data: ReceiptData = {
      ...sampleData,
      shopAddress: "",
      shopPhone: "",
      staffName: null,
      customerPhone: null,
      receiptFooter: "",
    };
    const text = buildReceiptText(data);
    expect(text).toContain("Ayasofia Sweet");
    expect(text).toContain("رقم الطلب: POS-123");
  });

  it("is URL-encodeable for WhatsApp sharing", () => {
    const text = buildReceiptText(sampleData);
    const encoded = encodeURIComponent(text);
    // Should not throw, and should contain the encoded shop name
    expect(encoded).toContain(encodeURIComponent("Ayasofia Sweet"));
    // Arabic text should be encoded
    expect(encoded).toContain(encodeURIComponent("ميلك تي كلاسيك"));
  });
});

// ── WEB-DATA-002: extractModifierDeltas — receipt line-total recomputation ──

describe("extractModifierDeltas", () => {
  it("returns [] for null / undefined / non-array", () => {
    expect(extractModifierDeltas(null)).toEqual([]);
    expect(extractModifierDeltas(undefined)).toEqual([]);
    expect(extractModifierDeltas({})).toEqual([]);
    expect(extractModifierDeltas("not-an-array")).toEqual([]);
  });

  it("returns [] for an empty snapshot", () => {
    expect(extractModifierDeltas([])).toEqual([]);
  });

  it("extracts priceDeltas from the current snapshot format", () => {
    const snapshot = [
      { modifierId: "m1", nameAr: "لؤلؤ", nameEn: "Pearls", priceDelta: "2.00" },
      { modifierId: "m2", nameAr: "كبير", nameEn: "Large", priceDelta: "1.00" },
    ];
    expect(extractModifierDeltas(snapshot)).toEqual([
      { priceDelta: "2.00" },
      { priceDelta: "1.00" },
    ]);
  });

  it("ignores legacy plain-string entries (no delta information)", () => {
    // Legacy rows stored modifier IDs as strings — no recoverable delta
    expect(extractModifierDeltas(["m1", "m2"])).toEqual([]);
  });

  it("handles a mixed snapshot (object + legacy string)", () => {
    const snapshot = [
      { modifierId: "m1", nameAr: "لؤلؤ", nameEn: "Pearls", priceDelta: "2.00" },
      "legacy-id",
    ];
    expect(extractModifierDeltas(snapshot)).toEqual([{ priceDelta: "2.00" }]);
  });

  it("coerces a numeric priceDelta to a string", () => {
    const snapshot = [{ modifierId: "m1", nameAr: "x", nameEn: "y", priceDelta: 1.5 }];
    expect(extractModifierDeltas(snapshot)).toEqual([{ priceDelta: "1.5" }]);
  });

  it('treats a missing/zero priceDelta as "0"', () => {
    const snapshot = [
      { modifierId: "m1", nameAr: "Regular", nameEn: "Regular" }, // no priceDelta key
      { modifierId: "m2", nameAr: "Large", nameEn: "Large", priceDelta: "0.00" },
    ];
    expect(extractModifierDeltas(snapshot)).toEqual([{ priceDelta: "0" }, { priceDelta: "0.00" }]);
  });

  it("WEB-DATA-002 regression: line total now includes modifier deltas", () => {
    // getReceiptData previously passed [] to calculateLineTotal, dropping
    // every modifier delta. base 15.00 + 2.00 + 1.00 = 18.00 × 2 = 3600.
    const snapshot = [
      { modifierId: "m1", nameAr: "لؤلؤ", nameEn: "Pearls", priceDelta: "2.00" },
      { modifierId: "m2", nameAr: "كبير", nameEn: "Large", priceDelta: "1.00" },
    ];
    const lineTotal = calculateLineTotal("15.00", extractModifierDeltas(snapshot), 2);
    expect(lineTotal).toBe(3600);
    // The pre-fix code path ([]) would have produced 3000 — guard against regression
    expect(calculateLineTotal("15.00", [], 2)).toBe(3000);
  });
});
