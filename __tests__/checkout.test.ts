import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRecalc, mockTx, mockDbSelect } = vi.hoisted(() => ({
  mockRecalc: vi.fn().mockResolvedValue({
    lineItems: [{ productId: "p1", quantity: 1, unitPrice: "15.00", lineTotal: 1500 }],
    subtotal: 1500,
    modifierLookup: new Map(),
  }),
  mockTx: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireStaffSession: vi.fn().mockResolvedValue({ staffId: "staff-001", role: "owner" as const }),
  hashPin: () => "mock-hash",
  verifyPin: () => true,
  AuthError: class extends Error {},
}));

vi.mock("@/lib/pricing-server", () => ({
  recalculateCartServerSide: mockRecalc,
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: mockTx,
    select: () => ({
      from: () => ({
        where: () => q(mockDbSelect()),
      }),
    }),
  },
}));

import { checkout } from "@/app/(pos)/pos/actions";
import { requireStaffSession } from "@/lib/auth";

function q(rows: unknown[] = []) {
  return Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows) });
}

function makeTx(overrides: {
  existingOrder?: { id: string; orderNumber: string; total: string } | null;
  orderId?: string;
}) {
  const { existingOrder, orderId = "order-001" } = overrides;
  const existing = existingOrder === undefined ? null : existingOrder;
  return {
    select: () => ({
      from: () => ({
        where: () => q(existing ? [existing] : []),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: orderId }]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    rollback: () => {},
  };
}

describe("checkout — idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an empty cart", async () => {
    const result = await checkout({
      cartItems: [],
      idempotencyKey: "key-1",
      paymentMethod: "cash",
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Cart is empty");
  });

  it("rejects a missing idempotency key", async () => {
    const result = await checkout({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: 1 }],
      idempotencyKey: "",
      paymentMethod: "cash",
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Missing idempotency key");
  });

  it("requires a staff session", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(new Error("no session"));
    await expect(
      checkout({
        cartItems: [{ productId: "p1", modifierIds: [], quantity: 1 }],
        idempotencyKey: "key-2",
        paymentMethod: "cash",
      }),
    ).rejects.toThrow();
  });
});

describe("checkout — server-side recomputation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx({})));
  });

  it("calls recalculateCartServerSide with correct arguments", async () => {
    await checkout({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: 1 }],
      idempotencyKey: "key-srv-1",
      paymentMethod: "cash",
    });

    expect(mockRecalc).toHaveBeenCalledWith(
      [{ productId: "p1", modifierIds: [], quantity: 1 }],
      expect.anything(), // T-B8: now passed the checkout transaction
    );
  });

  it("returns correct total from server recomputation", async () => {
    mockRecalc.mockResolvedValue({
      lineItems: [
        { productId: "p1", quantity: 2, unitPrice: "15.00", lineTotal: 3000 },
        { productId: "p2", quantity: 1, unitPrice: "20.00", lineTotal: 2000 },
      ],
      subtotal: 5000,
      modifierLookup: new Map(),
    });

    const result = await checkout({
      cartItems: [
        { productId: "p1", modifierIds: [], quantity: 2 },
        { productId: "p2", modifierIds: [], quantity: 1 },
      ],
      idempotencyKey: "key-srv-2",
      paymentMethod: "cash",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.total).toBe("50.00");
    }
  });
});

describe("checkout — duplicate idempotency key", () => {
  it("returns the existing order without calling recalculate", async () => {
    vi.clearAllMocks();
    const existing = { id: "order-existing", orderNumber: "POS-1", total: "15.00" };
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(makeTx({ existingOrder: existing })),
    );

    const result = await checkout({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: 1 }],
      idempotencyKey: "key-dup-1",
      paymentMethod: "cash",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.orderId).toBe("order-existing");
      expect(result.orderNumber).toBe("POS-1");
      expect(result.total).toBe("15.00");
    }
    expect(mockRecalc).not.toHaveBeenCalled();
  });
});

describe("checkout — atomic rollback", () => {
  it("handles transaction errors gracefully", async () => {
    vi.clearAllMocks();
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx({})));
    mockRecalc.mockRejectedValue(new Error("DB failure"));

    const result = await checkout({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: 1 }],
      idempotencyKey: "key-rollback-1",
      paymentMethod: "cash",
    });

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain("Transaction failed");
  });
});

describe("checkout — concurrent idempotency key collision", () => {
  it("recovers from unique-constraint violation on insert", async () => {
    vi.clearAllMocks();
    mockRecalc.mockResolvedValue({
      lineItems: [{ productId: "p1", quantity: 1, unitPrice: "15.00", lineTotal: 1500 }],
      subtotal: 1500,
      modifierLookup: new Map(),
    });
    mockDbSelect.mockReturnValue([]);

    const collisionOrder = { id: "collision-order", orderNumber: "POS-RACE", total: "15.00" };
    let selectCount = 0;

    const collisionTx = {
      select: () => ({
        from: () => ({
          where: () => {
            selectCount++;
            // First call: idempotency check → empty
            return q(selectCount === 1 ? [] : [collisionOrder]);
          },
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: () => {
            const err = new Error("duplicate key value violates unique constraint") as Error & {
              code: string;
            };
            err.code = "23505";
            throw err;
          },
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
      rollback: () => {},
    };

    mockTx.mockImplementation(async (fn: (tx: typeof collisionTx) => Promise<unknown>) =>
      fn(collisionTx),
    );

    // The outer catch will call db.select().from().where() — set it to
    // return the collision order so the recovery succeeds.
    mockDbSelect.mockReturnValue([collisionOrder]);

    const result = await checkout({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: 1 }],
      idempotencyKey: "key-collision-1",
      paymentMethod: "cash",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.orderId).toBe("collision-order");
      expect(result.orderNumber).toBe("POS-RACE");
    }
    expect(mockRecalc).toHaveBeenCalled();
  });
});

describe("checkout — quantity validation (SEC-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx({})));
  });

  it("rejects quantity: 0", async () => {
    const result = await checkout({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: 0 }],
      idempotencyKey: "key-q-0",
      paymentMethod: "cash",
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/invalid quantity/i);
    expect(mockTx).not.toHaveBeenCalled();
  });

  it("rejects quantity: -1", async () => {
    const result = await checkout({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: -1 }],
      idempotencyKey: "key-q-neg",
      paymentMethod: "cash",
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/invalid quantity/i);
    expect(mockTx).not.toHaveBeenCalled();
  });

  it("rejects quantity: 1.5 (fractional)", async () => {
    const result = await checkout({
      cartItems: [{ productId: "p1", modifierIds: [], quantity: 1.5 }],
      idempotencyKey: "key-q-frac",
      paymentMethod: "cash",
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/invalid quantity/i);
    expect(mockTx).not.toHaveBeenCalled();
  });

  it("rejects when any productId is unknown (post-recalc length mismatch)", async () => {
    // recalc returns fewer lineItems than cartItems submitted —
    // the unknown product was silently skipped
    mockRecalc.mockResolvedValueOnce({
      lineItems: [{ productId: "p1", quantity: 1, unitPrice: "15.00", lineTotal: 1500 }],
      subtotal: 1500,
      modifierLookup: new Map(),
    });

    const result = await checkout({
      cartItems: [
        { productId: "p1", modifierIds: [], quantity: 1 },
        { productId: "unknown-product", modifierIds: [], quantity: 1 },
      ],
      idempotencyKey: "key-unknown",
      paymentMethod: "cash",
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/could not be found/i);
  });
});
