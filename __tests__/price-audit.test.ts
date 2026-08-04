/**
 * WEB-SEC-006 — price-change audit log tests.
 *
 * Verifies that updateProduct and updateModifier write price_changes
 * rows when a price field changes, skip audit when it doesn't, and
 * that getPriceChangeAudit enforces manager+ RBAC.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbSelect, mockDbUpdate, mockDbInsert, mockTx } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbInsert: vi.fn(),
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
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
    insert: mockDbInsert,
    transaction: mockTx,
  },
}));

import {
  updateProduct,
  updateModifier,
  getPriceChangeAudit,
} from "@/app/(admin)/admin/menu/actions";
import { requireStaffSession } from "@/lib/auth";
import { AuthError } from "@/lib/auth";

/** Build a mock tx that captures insert values for audit verification. */
function makeAuditCapturingTx() {
  let auditRow: Record<string, unknown> | null = null;
  const tx = {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
    insert: vi.fn().mockReturnValue({
      values: (v: Record<string, unknown>) => {
        auditRow = v;
        return Promise.resolve();
      },
    }),
  };
  return { tx, getAuditRow: () => auditRow };
}

/** Chainable select mock: from().where() → thenable-with-limit. */
function selectChain(rows: unknown[], hasLimit = false) {
  const thenable = Object.assign(Promise.resolve(rows), {
    limit: () => Promise.resolve(rows),
  });
  return {
    from: () => (hasLimit ? { where: () => thenable } : { where: () => Promise.resolve(rows) }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  });
});

// ── updateProduct: audit on basePrice change ──

describe("updateProduct — price-change audit log (WEB-SEC-006)", () => {
  it("writes a price_changes row when basePrice changes", async () => {
    // Pre-update fetch returns old price "15.00"
    mockDbSelect.mockReturnValueOnce(selectChain([{ basePrice: "15.00" }], true));

    const { tx, getAuditRow } = makeAuditCapturingTx();
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));

    const result = await updateProduct({ id: "p1", basePrice: 18 });
    expect(result.success).toBe(true);

    const audit = getAuditRow();
    expect(audit).not.toBeNull();
    expect(audit).toMatchObject({
      entityType: "product",
      entityId: "p1",
      field: "base_price",
      oldValue: "15.00",
      newValue: "18.00",
      changedBy: "s1",
    });
  });

  it("does NOT write an audit row when basePrice is unchanged", async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([{ basePrice: "15.00" }], true));

    const { tx, getAuditRow } = makeAuditCapturingTx();
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));

    await updateProduct({ id: "p1", basePrice: 15 });
    // Same price → no transaction, no audit row
    expect(getAuditRow()).toBeNull();
    expect(mockTx).not.toHaveBeenCalled();
  });

  it("does NOT write an audit row when basePrice is not in the update", async () => {
    // Only updating name, not price — no select, no audit
    await updateProduct({ id: "p1", nameAr: " newName " });
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockTx).not.toHaveBeenCalled();
  });

  it("returns error for nonexistent product when basePrice is specified", async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([], true));

    const result = await updateProduct({ id: "nonexistent", basePrice: 20 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("غير موجود");
  });

  it("uses the staffId from requireStaffSession as changedBy", async () => {
    vi.mocked(requireStaffSession).mockResolvedValueOnce({
      staffId: "staff-xyz",
      role: "manager",
    });

    mockDbSelect.mockReturnValueOnce(selectChain([{ basePrice: "10.00" }], true));
    const { tx, getAuditRow } = makeAuditCapturingTx();
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));

    await updateProduct({ id: "p1", basePrice: 12 });
    expect(getAuditRow()?.changedBy).toBe("staff-xyz");
  });
});

// ── updateModifier: audit on priceDelta change ──

describe("updateModifier — price-change audit log (WEB-SEC-006)", () => {
  it("writes a price_changes row when priceDelta changes", async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([{ priceDelta: "2.00" }], true));

    const { tx, getAuditRow } = makeAuditCapturingTx();
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));

    const result = await updateModifier({ id: "m1", priceDelta: 3 });
    expect(result.success).toBe(true);

    const audit = getAuditRow();
    expect(audit).not.toBeNull();
    expect(audit).toMatchObject({
      entityType: "modifier",
      entityId: "m1",
      field: "price_delta",
      oldValue: "2.00",
      newValue: "3.00",
      changedBy: "s1",
    });
  });

  it("does NOT write an audit row when priceDelta is unchanged", async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([{ priceDelta: "2.00" }], true));

    const { tx, getAuditRow } = makeAuditCapturingTx();
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));

    await updateModifier({ id: "m1", priceDelta: 2 });
    expect(getAuditRow()).toBeNull();
    expect(mockTx).not.toHaveBeenCalled();
  });

  it("does NOT write an audit row when priceDelta is not in the update", async () => {
    await updateModifier({ id: "m1", name: "New Name" });
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockTx).not.toHaveBeenCalled();
  });
});

// ── getPriceChangeAudit: RBAC + read ──

describe("getPriceChangeAudit — RBAC and read", () => {
  it("rejects an unauthenticated caller", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(
      new AuthError("No authenticated session", "NO_SESSION"),
    );
    await expect(getPriceChangeAudit()).rejects.toThrow(AuthError);
  });

  it("rejects cashier / barista roles (manager+ required)", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(
      new AuthError("Insufficient role", "INSUFFICIENT_ROLE"),
    );
    await expect(getPriceChangeAudit()).rejects.toThrow(AuthError);
  });

  it("returns audit entries with staff names", async () => {
    const auditRows = [
      {
        id: "a1",
        entityType: "product",
        entityId: "p1",
        field: "base_price",
        oldValue: "15.00",
        newValue: "18.00",
        staffName: "Osama",
        createdAt: new Date("2026-01-01T12:00:00Z"),
      },
    ];
    // The query uses .from(priceChanges).leftJoin(staff, ...).orderBy().limit()
    // Mock: select() → from() → leftJoin() → orderBy() → limit()
    const chain = Object.assign(Promise.resolve(auditRows), {
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(auditRows),
    });
    mockDbSelect.mockReturnValueOnce({ from: () => chain });

    const result = await getPriceChangeAudit();
    expect(result).toHaveLength(1);
    expect(result[0].staffName).toBe("Osama");
    expect(result[0].oldValue).toBe("15.00");
    expect(result[0].newValue).toBe("18.00");
    expect(result[0].createdAt).toBe("2026-01-01T12:00:00.000Z");
  });
});
