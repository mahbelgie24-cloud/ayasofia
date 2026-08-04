import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTx, mockDbSelect, mockHeaders } = vi.hoisted(() => ({
  mockTx: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: () => ({ from: () => ({ where: () => q([]) }) }),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: "o1" }]) }) }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      rollback: () => {},
    };
    return fn(tx);
  }),
  mockDbSelect: vi.fn(),
  mockHeaders: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.1" })),
}));

function q(rows: unknown[]) {
  return Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows) });
}

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: mockTx,
    select: mockDbSelect,
    update: vi.fn().mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) }),
  },
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireStaffSession: vi.fn().mockResolvedValue({ staffId: "s1", role: "owner" as const }),
  };
});

vi.mock("@/lib/pricing-server", () => ({
  recalculateCartServerSide: vi.fn().mockResolvedValue({
    lineItems: [{ productId: "p1", quantity: 1, unitPrice: "15.00", lineTotal: 1500 }],
    subtotal: 1500,
    modifierLookup: new Map(),
  }),
}));

import { placeCustomerOrder } from "@/app/order/actions";
import { updateOrderStatus } from "@/app/(pos)/kitchen/actions";
import { requireStaffSession } from "@/lib/auth";
import { AuthError } from "@/lib/auth";
import { resetThrottle } from "@/lib/rate-limit";

describe("placeCustomerOrder", () => {
  beforeEach(() => {
    resetThrottle("order:203.0.113.1");
    mockHeaders.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.1" }));
  });

  it("rejects empty cart", async () => {
    const r = await placeCustomerOrder({
      cartItems: [],
      customerName: "Ali",
      idempotencyKey: "k1",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty customer name", async () => {
    const r = await placeCustomerOrder({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: 1 }],
      customerName: "  ",
      idempotencyKey: "k2",
    });
    expect(r.success).toBe(false);
  });

  it("rejects missing idempotency key", async () => {
    const r = await placeCustomerOrder({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: 1 }],
      customerName: "Ali",
      idempotencyKey: "",
    });
    expect(r.success).toBe(false);
  });

  it("succeeds for valid input", async () => {
    const r = await placeCustomerOrder({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: 1 }],
      customerName: "Ali",
      idempotencyKey: "k3",
    });
    expect(r.success).toBe(true);
  });

  it("duplicate idempotencyKey returns the existing order, not a new one", async () => {
    // First call — mockTx creates order "o1"
    const r1 = await placeCustomerOrder({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: 1 }],
      customerName: "Ali",
      idempotencyKey: "dup-customer-key",
    });
    expect(r1.success).toBe(true);

    // Second call: the idempotency check in executeCheckout does
    //   .select(...).from(orders).where(eq(...)).limit(1)
    // and the existing helper q() returns Promise.resolve(rows) with .limit().
    // Override mockTx for the second call so the idempotency check
    // returns [existing] rather than [].
    mockTx.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        // where() returns q(...) which has .limit() → Promise.resolve(existing)
        select: () => ({
          from: () => ({
            where: () => q([{ id: "o1", orderNumber: "POS-EXISTING", total: "15.00" }]),
          }),
        }),
        insert: () => ({
          values: () => ({ returning: () => Promise.resolve([{ id: "o2" }]) }),
        }),
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
        rollback: () => {},
      };
      return fn(tx);
    });

    const r2 = await placeCustomerOrder({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: 1 }],
      customerName: "Ali",
      idempotencyKey: "dup-customer-key",
    });
    expect(r2.success).toBe(true);
    if (r2.success) {
      expect(r2.orderNumber).toBe("POS-EXISTING");
      expect(r2.total).toBe("15.00");
    }
  });
});

// ── Gap #1: placeCustomerOrder rate-limit wiring (WEB-SEC-001) ──
// The checkThrottle unit test proves the limiter works; these tests
// prove the *call site* actually invokes it and respects its verdict.
// Without them, removing the throttle call in actions.ts would go
// unnoticed by any test.

describe("placeCustomerOrder — IP rate-limit wiring", () => {
  const validInput = {
    cartItems: [{ productId: "p1", modifierIds: [], quantity: 1 }],
    customerName: "Ali",
    idempotencyKey: "throttle-key",
  };

  beforeEach(() => {
    // Each test gets a fresh throttle bucket via a unique IP, so tests
    // are independent of each other and of the describe block above.
    mockHeaders.mockResolvedValue(
      new Headers({ "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 254) + 1}` }),
    );
  });

  it("allows the first 10 calls from one IP", async () => {
    const ip = "198.51.100.10";
    mockHeaders.mockResolvedValue(new Headers({ "x-forwarded-for": ip }));
    resetThrottle(`order:${ip}`);

    for (let i = 0; i < 10; i++) {
      const r = await placeCustomerOrder({ ...validInput, idempotencyKey: `k-${i}` });
      expect(r.success).toBe(true);
    }
  });

  it("rejects the 11th call from the same IP with a retry message", async () => {
    const ip = "198.51.100.20";
    mockHeaders.mockResolvedValue(new Headers({ "x-forwarded-for": ip }));
    resetThrottle(`order:${ip}`);

    for (let i = 0; i < 10; i++) {
      await placeCustomerOrder({ ...validInput, idempotencyKey: `k2-${i}` });
    }
    const r = await placeCustomerOrder({ ...validInput, idempotencyKey: "k2-eleven" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toContain("ثانية");
    }
  });

  it("throttle is keyed by IP — a second IP is unaffected by the first's exhaustion", async () => {
    const ip1 = "198.51.100.30";
    const ip2 = "198.51.100.31";
    resetThrottle(`order:${ip1}`);
    resetThrottle(`order:${ip2}`);

    // Exhaust IP 1
    mockHeaders.mockResolvedValue(new Headers({ "x-forwarded-for": ip1 }));
    for (let i = 0; i < 10; i++) {
      await placeCustomerOrder({ ...validInput, idempotencyKey: `ip1-${i}` });
    }
    const blocked = await placeCustomerOrder({ ...validInput, idempotencyKey: "ip1-blocked" });
    expect(blocked.success).toBe(false);

    // IP 2 should still be allowed
    mockHeaders.mockResolvedValue(new Headers({ "x-forwarded-for": ip2 }));
    const allowed = await placeCustomerOrder({ ...validInput, idempotencyKey: "ip2-first" });
    expect(allowed.success).toBe(true);
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    const ip = "198.51.100.40";
    mockHeaders.mockResolvedValue(new Headers({ "x-real-ip": ip }));
    resetThrottle(`order:${ip}`);

    const r = await placeCustomerOrder({ ...validInput, idempotencyKey: "realip-1" });
    expect(r.success).toBe(true);
  });

  it('falls back to "unknown" bucket when no IP header is present', async () => {
    mockHeaders.mockResolvedValue(new Headers());
    resetThrottle("order:unknown");

    const r = await placeCustomerOrder({ ...validInput, idempotencyKey: "nohdr-1" });
    expect(r.success).toBe(true);
  });
});

describe("updateOrderStatus", () => {
  it("requires a staff session", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(new AuthError("no", "NO_SESSION"));
    await expect(updateOrderStatus("o1", "preparing")).rejects.toThrow();
  });

  it("rejects invalid transitions (received -> ready)", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ status: "received" }]) }) }),
    } as never);
    const r = await updateOrderStatus("o1", "ready");
    expect(r.success).toBe(false);
    expect(r.error).toContain("Cannot transition");
  });

  it("allows valid transitions (received -> preparing)", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ status: "received" }]) }) }),
    } as never);
    const r = await updateOrderStatus("o1", "preparing");
    expect(r.success).toBe(true);
  });
});
