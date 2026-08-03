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
