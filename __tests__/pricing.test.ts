import { describe, it, expect } from "vitest";
import { calculateLineTotal, calculateCartTotal, formatPrice } from "@/lib/pricing";

describe("calculateLineTotal", () => {
  it("single item with no modifiers", () => {
    const result = calculateLineTotal("15.00", [], 1);
    expect(result).toBe(1500);
    expect(formatPrice(result)).toBe("15.00");
  });

  it("single item with multiple priced modifiers", () => {
    const result = calculateLineTotal("15.00", [{ priceDelta: "3.00" }, { priceDelta: "2.00" }], 1);
    expect(result).toBe(2000);
    expect(formatPrice(result)).toBe("20.00");
  });

  it("multiple quantities", () => {
    const result = calculateLineTotal("10.00", [], 5);
    expect(result).toBe(5000);
    expect(formatPrice(result)).toBe("50.00");
  });

  it("item with a 0-price modifier (e.g. Regular size)", () => {
    const result = calculateLineTotal("18.00", [{ priceDelta: "0.00" }], 1);
    expect(result).toBe(1800);
    expect(formatPrice(result)).toBe("18.00");
  });

  it("multiple quantities with priced modifiers", () => {
    const result = calculateLineTotal("15.00", [{ priceDelta: "3.00" }, { priceDelta: "2.00" }], 3);
    // (15 + 3 + 2) * 3 = 60 * 100 = 6000
    expect(result).toBe(6000);
  });

  it("handles decimal prices (e.g. 0.50)", () => {
    const result = calculateLineTotal("2.50", [{ priceDelta: "1.25" }], 2);
    // (2.50 + 1.25) * 2 = 3.75 * 2 = 7.50 → 750 agorot
    expect(result).toBe(750);
    expect(formatPrice(result)).toBe("7.50");
  });

  it("handles large numbers without floating-point drift", () => {
    const result = calculateLineTotal("9.99", [{ priceDelta: "0.01" }], 3);
    // (9.99 + 0.01) * 3 = 10.00 * 3 = 30.00 → 3000 agorot
    expect(result).toBe(3000);
  });

  it("zero quantity returns zero", () => {
    const result = calculateLineTotal("15.00", [{ priceDelta: "2.00" }], 0);
    expect(result).toBe(0);
  });

  it("handles invalid basePrice gracefully", () => {
    const result = calculateLineTotal("not-a-number", [], 1);
    expect(result).toBe(0);
  });
});

describe("calculateCartTotal", () => {
  it("empty cart returns zero", () => {
    expect(calculateCartTotal([])).toBe(0);
  });

  it("single line item", () => {
    const result = calculateCartTotal([{ lineTotal: 1500 }]);
    expect(result).toBe(1500);
  });

  it("multiple line items", () => {
    const result = calculateCartTotal([
      { lineTotal: 1500 },
      { lineTotal: 2000 },
      { lineTotal: 750 },
    ]);
    // 1500 + 2000 + 750 = 4250
    expect(result).toBe(4250);
    expect(formatPrice(result)).toBe("42.50");
  });
});

describe("formatPrice", () => {
  it("formats whole numbers", () => {
    expect(formatPrice(1500)).toBe("15.00");
  });

  it("formats fractional values", () => {
    expect(formatPrice(50)).toBe("0.50");
  });

  it("formats zero", () => {
    expect(formatPrice(0)).toBe("0.00");
  });

  it("formats large values", () => {
    expect(formatPrice(99999)).toBe("999.99");
  });
});
