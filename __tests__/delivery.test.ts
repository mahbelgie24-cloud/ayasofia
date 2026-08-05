import { describe, it, expect } from "vitest";
import { computeDeliveryFee, validateMinimumOrder, type DeliveryFeeRules } from "@/lib/delivery";

function rules(overrides: Partial<DeliveryFeeRules>): DeliveryFeeRules {
  return {
    fee: "5.00",
    freeThreshold: null,
    minOrder: null,
    ...overrides,
  };
}

describe("computeDeliveryFee", () => {
  it("flat fee applies below threshold", () => {
    const r = computeDeliveryFee(3000, rules({ fee: "5.00", freeThreshold: "50.00" }));
    expect(r.feeMinor).toBe(500);
    expect(r.fee).toBe("5.00");
    expect(r.waived).toBe(false);
  });

  it("fee waived at/above free threshold", () => {
    const r = computeDeliveryFee(5000, rules({ fee: "5.00", freeThreshold: "50.00" }));
    expect(r.feeMinor).toBe(0);
    expect(r.waived).toBe(true);
  });

  it("no threshold → always charges flat fee", () => {
    const r = computeDeliveryFee(9000, rules({ fee: "5.00", freeThreshold: null }));
    expect(r.feeMinor).toBe(500);
    expect(r.waived).toBe(false);
  });

  it("zero subtotal → no fee", () => {
    const r = computeDeliveryFee(0, rules({ fee: "5.00" }));
    expect(r.feeMinor).toBe(0);
    expect(r.waived).toBe(true);
  });

  it("sub-agorot fee is exact (no float drift)", () => {
    const r = computeDeliveryFee(1990, rules({ fee: "3.50", freeThreshold: "40.00" }));
    expect(r.feeMinor).toBe(350);
    expect(r.fee).toBe("3.50");
  });
});

describe("validateMinimumOrder", () => {
  it("null minOrder → no error", () => {
    expect(validateMinimumOrder(100, rules({ minOrder: null }))).toBeNull();
  });

  it("below minimum returns a message", () => {
    const msg = validateMinimumOrder(2000, rules({ minOrder: "30.00" }));
    expect(msg).not.toBeNull();
    expect(msg).toContain("30.00");
  });

  it("at/above minimum → no error", () => {
    expect(validateMinimumOrder(3000, rules({ minOrder: "30.00" }))).toBeNull();
  });
});
