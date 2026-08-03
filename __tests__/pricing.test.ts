import { describe, it, expect } from "vitest";
import {
  calculateLineTotal,
  calculateCartTotal,
  formatPrice,
  toMinorUnits,
  addMinor,
  subtractMinor,
  multiplyMinor,
  divideMinor,
} from "@/lib/pricing";

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

// ── A2: toMinorUnits without float, integer-cent correctness ──

describe("toMinorUnits — no-float conversion", () => {
  it("converts simple whole number", () => {
    expect(toMinorUnits("15.00")).toBe(1500);
  });

  it("converts decimal without float drift (0.10)", () => {
    // parseFloat("0.10") * 100 === 9.999999999999998... — this must be 10
    expect(toMinorUnits("0.10")).toBe(10);
  });

  it("converts negative values", () => {
    expect(toMinorUnits("-3.50")).toBe(-350);
  });

  it("handles trailing zeros", () => {
    expect(toMinorUnits("7.50")).toBe(750);
  });

  it("converts large values without overflow", () => {
    expect(toMinorUnits("9999.99")).toBe(999999);
  });

  it("converts values with more than 2 decimal places (truncates)", () => {
    expect(toMinorUnits("1.234")).toBe(123);
  });

  it("returns 0 for empty string", () => {
    expect(toMinorUnits("")).toBe(0);
  });

  it("returns 0 for non-numeric", () => {
    expect(toMinorUnits("not-a-number")).toBe(0);
  });

  it("formatPrice roundtrip", () => {
    const agorot = toMinorUnits("42.99");
    expect(formatPrice(agorot)).toBe("42.99");
  });
});

describe("addMinor / subtractMinor / multiplyMinor / divideMinor", () => {
  it("addMinor sums two agorot values", () => {
    expect(addMinor(toMinorUnits("15.50"), toMinorUnits("3.25"))).toBe(1875);
  });

  it("subtractMinor computes difference", () => {
    expect(subtractMinor(toMinorUnits("20.00"), toMinorUnits("7.35"))).toBe(1265);
  });

  it("multiplyMinor multiplies by integer", () => {
    expect(multiplyMinor(toMinorUnits("15.00"), 3)).toBe(4500);
  });

  it("divideMinor divides by integer", () => {
    expect(divideMinor(4500, 3)).toBe(1500);
    expect(formatPrice(divideMinor(4500, 3))).toBe("15.00");
  });
});

describe("Z-report discrepancy — integer-cent arithmetic", () => {
  const computeDiscrepancy = (closingStr: string, openingStr: string, salesStr: string) => {
    const c = toMinorUnits(closingStr);
    const o = toMinorUnits(openingStr);
    const s = toMinorUnits(salesStr);
    return c - o - s;
  };

  it("exact match", () => {
    expect(computeDiscrepancy("650.00", "100.00", "550.00")).toBe(0);
  });

  it("over — positive", () => {
    expect(computeDiscrepancy("700.00", "100.00", "550.00")).toBe(5000);
    expect(formatPrice(5000)).toBe("50.00");
  });

  it("short — negative", () => {
    expect(computeDiscrepancy("600.00", "100.00", "550.00")).toBe(-5000);
  });

  it("repeating-decimal-prone values (0.10 + 0.20)", () => {
    const a = toMinorUnits("0.10");
    const b = toMinorUnits("0.20");
    expect(a + b).toBe(30);
    expect(formatPrice(30)).toBe("0.30");
  });
});

describe("margin calculation — integer-cent arithmetic", () => {
  it("positive margin", () => {
    const price = toMinorUnits("15.00");
    const cost = toMinorUnits("5.50");
    expect(price - cost).toBe(950);
    expect(formatPrice(950)).toBe("9.50");
  });

  it("high-cost ingredient edge case", () => {
    // costPerUnit="0.3333", quantityUsed="200.00" → cost = 0.3333*200 = 66.66 → 6666 agorot
    // basePrice="12.00"
    const price = toMinorUnits("12.00"); // 1200
    const cost = toMinorUnits("5.67"); // 567
    const margin = price - cost; // 633
    expect(formatPrice(margin)).toBe("6.33");
  });

  it("negative margin (ingredients cost more than price)", () => {
    const price = toMinorUnits("8.00");
    const cost = toMinorUnits("12.00");
    expect(price - cost).toBe(-400);
    expect(formatPrice(-400)).toBe("-4.00");
  });
});
