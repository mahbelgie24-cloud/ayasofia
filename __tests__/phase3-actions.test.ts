import { describe, it, expect, vi } from "vitest";

const { mockTx, mockDbSelect } = vi.hoisted(() => ({
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
}));

function q(rows: unknown[]) {
  return Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows) });
}

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

describe("placeCustomerOrder", () => {
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
