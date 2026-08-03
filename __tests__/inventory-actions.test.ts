import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTx } = vi.hoisted(() => ({
  mockTx: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireStaffSession: vi.fn().mockResolvedValue({ staffId: "s1", role: "manager" as const }),
  };
});

vi.mock("@/lib/db", () => ({
  db: { transaction: mockTx },
}));

import { logPurchase, logWaste } from "@/app/(admin)/admin/inventory/actions";
import { requireStaffSession } from "@/lib/auth";
import { AuthError } from "@/lib/auth";

function makeTx() {
  return {
    insert: () => ({ values: () => Promise.resolve() }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    rollback: () => {},
  };
}

describe("logPurchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx()));
  });

  it("rejects empty ingredientId", async () => {
    const r = await logPurchase({ ingredientId: "", quantity: 1, totalCost: 10 });
    expect(r.success).toBe(false);
  });

  it("rejects zero or negative quantity", async () => {
    expect((await logPurchase({ ingredientId: "x", quantity: 0, totalCost: 10 })).success).toBe(
      false,
    );
    expect((await logPurchase({ ingredientId: "x", quantity: -1, totalCost: 10 })).success).toBe(
      false,
    );
  });

  it("succeeds for valid input", async () => {
    const r = await logPurchase({ ingredientId: "x", quantity: 5, totalCost: 50 });
    expect(r.success).toBe(true);
  });

  it("uses correct delta sign (positive) and reason", async () => {
    let capt: Record<string, unknown> | null = null;
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: () => ({
          values: (v: Record<string, unknown>) => {
            capt = v;
            return Promise.resolve();
          },
        }),
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
        rollback: () => {},
      };
      return fn(tx);
    });
    await logPurchase({ ingredientId: "x", quantity: 3.5, totalCost: 20 });
    expect(capt).toBeDefined();
    expect((capt as unknown as { deltaQty: string }).deltaQty).toBe("3.50");
    expect((capt as unknown as { reason: string }).reason).toBe("purchase");
  });

  it("rejects cashier / barista roles (manager+ required)", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(
      new AuthError("Insufficient role", "INSUFFICIENT_ROLE"),
    );
    await expect(logPurchase({ ingredientId: "x", quantity: 1, totalCost: 10 })).rejects.toThrow(
      AuthError,
    );
  });
});

describe("logWaste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx()));
  });

  it("rejects empty ingredientId", async () => {
    const r = await logWaste({ ingredientId: "", quantity: 1 });
    expect(r.success).toBe(false);
  });

  it("rejects zero or negative quantity", async () => {
    expect((await logWaste({ ingredientId: "x", quantity: 0 })).success).toBe(false);
    expect((await logWaste({ ingredientId: "x", quantity: -1 })).success).toBe(false);
  });

  it("succeeds for valid input", async () => {
    const r = await logWaste({ ingredientId: "x", quantity: 5 });
    expect(r.success).toBe(true);
  });

  it("uses correct delta sign (negative) and reason", async () => {
    let capt: Record<string, unknown> | null = null;
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: () => ({
          values: (v: Record<string, unknown>) => {
            capt = v;
            return Promise.resolve();
          },
        }),
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
        rollback: () => {},
      };
      return fn(tx);
    });
    await logWaste({ ingredientId: "x", quantity: 4 });
    expect(capt).toBeDefined();
    expect((capt as unknown as { deltaQty: string }).deltaQty).toBe("-4.00");
    expect((capt as unknown as { reason: string }).reason).toBe("waste");
  });

  it("rejects cashier / barista roles (manager+ required)", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(
      new AuthError("Insufficient role", "INSUFFICIENT_ROLE"),
    );
    await expect(logWaste({ ingredientId: "x", quantity: 1 })).rejects.toThrow(AuthError);
  });
});
