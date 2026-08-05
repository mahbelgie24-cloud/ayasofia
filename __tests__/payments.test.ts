import { describe, it, expect } from "vitest";
import { PayAtCounterProvider, CashOnDeliveryProvider, resolveProvider } from "@/lib/payments";

describe("payment providers", () => {
  it("pay-at-counter supports its intent and records a counter reference", async () => {
    const p = new PayAtCounterProvider();
    expect(p.supports("pay_at_counter")).toBe(true);
    expect(p.supports("cash_on_delivery")).toBe(false);
    const res = await p.initiate({
      amount: "15.00",
      currency: "ILS",
      orderId: "o1",
      orderNumber: "N1",
      intent: "pay_at_counter",
    });
    expect(res.ok).toBe(true);
    expect(res.reference).toContain("counter:");
  });

  it("cash-on-delivery records a cod reference", async () => {
    const p = new CashOnDeliveryProvider();
    expect(p.supports("cash_on_delivery")).toBe(true);
    const res = await p.initiate({
      amount: "20.00",
      currency: "ILS",
      orderId: "o2",
      orderNumber: "N2",
      intent: "cash_on_delivery",
    });
    expect(res.ok).toBe(true);
    expect(res.reference).toContain("cod:");
  });

  it("resolveProvider returns the right impl per intent", () => {
    expect(resolveProvider("pay_at_counter")).toBeInstanceOf(PayAtCounterProvider);
    expect(resolveProvider("cash_on_delivery")).toBeInstanceOf(CashOnDeliveryProvider);
  });
});
