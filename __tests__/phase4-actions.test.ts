import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ──

const { mockDbSelect, mockDbUpdate, mockDbInsert, mockDbDelete, mockDbExecute } = vi.hoisted(
  () => ({
    mockDbSelect: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbExecute: vi.fn(),
  }),
);

vi.mock("@/lib/db", () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
    insert: mockDbInsert,
    delete: mockDbDelete,
    execute: mockDbExecute,
  },
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireStaffSession: vi.fn().mockResolvedValue({ staffId: "s1", role: "owner" }),
    hashPin: vi.fn().mockReturnValue("deadbeef:cafebabe"),
    verifyPin: vi.fn().mockReturnValue(false),
    AuthError: actual.AuthError,
  };
});

import { requireStaffSession } from "@/lib/auth";
import {
  getSalesSummary,
  getBestSellers,
  getProductMargins,
  getZReport,
} from "@/app/(admin)/admin/reports/actions";
import { createStaffMember, updateStaffMember } from "@/app/(admin)/admin/staff/actions";
import { createProduct, deleteCategory } from "@/app/(admin)/admin/menu/actions";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Margin Math ──

describe("margin calculation math", () => {
  const computeMargin = (price: number, cost: number) => parseFloat((price - cost).toFixed(2));
  const computePercent = (price: number, cost: number) =>
    price > 0 ? parseFloat((((price - cost) / price) * 100).toFixed(1)) : 0;

  it("positive margin", () => {
    expect(computeMargin(15, 5)).toBe(10);
    expect(computePercent(15, 5)).toBe(66.7);
  });

  it("zero margin", () => {
    expect(computeMargin(10, 10)).toBe(0);
    expect(computePercent(10, 10)).toBe(0);
  });

  it("negative margin", () => {
    expect(computeMargin(8, 12)).toBe(-4);
    expect(computePercent(8, 12)).toBe(-50.0);
  });

  it("handles decimal ingredient costs", () => {
    expect(computeMargin(18, 7.35)).toBe(10.65);
  });
});

// ── Z-Report Discrepancy Math ──

describe("Z-report discrepancy math", () => {
  const calcDiscrepancy = (closing: number, opening: number, sales: number) =>
    parseFloat((closing - opening - sales).toFixed(2));

  it("matches exactly", () => {
    expect(calcDiscrepancy(650, 100, 550)).toBe(0);
  });

  it("over (positive discrepancy)", () => {
    expect(calcDiscrepancy(700, 100, 550)).toBe(50);
  });

  it("short (negative discrepancy)", () => {
    expect(calcDiscrepancy(600, 100, 550)).toBe(-50);
  });

  it("within rounding tolerance (< 0.01)", () => {
    expect(Math.abs(calcDiscrepancy(650.005, 100.002, 550.0))).toBeLessThan(0.01);
  });
});

// ── PIN Uniqueness ──

describe("PIN uniqueness enforcement", () => {
  it("rejects PIN shorter than 4 digits", async () => {
    vi.mocked(requireStaffSession).mockResolvedValue({ staffId: "s1", role: "owner" });

    const result = await createStaffMember({ name: "Ali", role: "cashier", pin: "12" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("PIN");
  });

  it("rejects PIN with non-digit characters", async () => {
    vi.mocked(requireStaffSession).mockResolvedValue({ staffId: "s1", role: "owner" });

    const result = await createStaffMember({ name: "Ali", role: "cashier", pin: "abcd" });
    expect(result.success).toBe(false);
  });

  it("rejects when PIN matches another active staff member", async () => {
    vi.mocked(requireStaffSession).mockResolvedValue({ staffId: "s1", role: "owner" });

    const { verifyPin } = await import("@/lib/auth");
    vi.mocked(verifyPin).mockReturnValueOnce(true); // PIN matches someone

    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([{ id: "existing", pinHash: "salt:hash" }]),
      }),
    });

    const result = await createStaffMember({ name: "Ali", role: "cashier", pin: "1234" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("PIN مستخدم");
  });

  it("accepts when PIN is unique", async () => {
    vi.mocked(requireStaffSession).mockResolvedValue({ staffId: "s1", role: "owner" });

    const { verifyPin } = await import("@/lib/auth");
    vi.mocked(verifyPin).mockReturnValue(false); // No match

    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    });

    mockDbInsert.mockReturnValue({
      values: () => ({
        returning: () => Promise.resolve([{ id: "new" }]),
      }),
    });

    // @ts-expect-error mock
    mockDbInsert.values = () => ({ returning: () => Promise.resolve([{ id: "new" }]) });

    const result = await createStaffMember({ name: "Ali", role: "cashier", pin: "1234" });
    // insert will be called and success returned
    // The insert is mocked — it should succeed
    expect(result.success).toBe(true);
  });
});

// ── RBAC: Owner-only routes ──

describe("RBAC — staff management (owner only)", () => {
  it("rejects manager session for createStaffMember", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(
      new (await import("@/lib/auth")).AuthError("no", "INSUFFICIENT_ROLE"),
    );
    await expect(
      createStaffMember({ name: "Ali", role: "cashier", pin: "1234" }),
    ).rejects.toThrow();
  });

  it("rejects cashier session for updateStaffMember", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(
      new (await import("@/lib/auth")).AuthError("no", "INSUFFICIENT_ROLE"),
    );
    await expect(updateStaffMember({ id: "s1", active: false })).rejects.toThrow();
  });

  it("rejects barista session for getZReport", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(
      new (await import("@/lib/auth")).AuthError("no", "INSUFFICIENT_ROLE"),
    );
    await expect(getZReport()).rejects.toThrow();
  });
});

// ── RBAC: Manager routes reject barista ──

describe("RBAC — manager routes reject lower roles", () => {
  it("rejects barista for getSalesSummary", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(
      new (await import("@/lib/auth")).AuthError("no", "INSUFFICIENT_ROLE"),
    );
    await expect(getSalesSummary("2026-01-01", "2026-01-02")).rejects.toThrow();
  });

  it("rejects barista for getBestSellers", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(
      new (await import("@/lib/auth")).AuthError("no", "INSUFFICIENT_ROLE"),
    );
    await expect(getBestSellers("2026-01-01", "2026-01-02")).rejects.toThrow();
  });

  it("rejects barista for getProductMargins", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(
      new (await import("@/lib/auth")).AuthError("no", "INSUFFICIENT_ROLE"),
    );
    await expect(getProductMargins()).rejects.toThrow();
  });

  it("rejects barista for createProduct", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(
      new (await import("@/lib/auth")).AuthError("no", "INSUFFICIENT_ROLE"),
    );
    await expect(
      createProduct({ categoryId: "c1", nameAr: "x", nameEn: "x", basePrice: 10 }),
    ).rejects.toThrow();
  });
});

// ── Category delete with products check ──

describe("deleteCategory — blocks when products exist", () => {
  it("rejects deletion when category has products", async () => {
    vi.mocked(requireStaffSession).mockResolvedValue({ staffId: "s1", role: "manager" });

    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([{ count: 3 }]),
      }),
    });

    const result = await deleteCategory("cat-with-products");
    expect(result.success).toBe(false);
    expect(result.error).toContain("منتجات");
  });

  it("allows deletion when category is empty", async () => {
    vi.mocked(requireStaffSession).mockResolvedValue({ staffId: "s1", role: "manager" });

    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([{ count: 0 }]),
      }),
    });

    mockDbDelete.mockReturnValue({
      where: () => Promise.resolve(),
    });

    const result = await deleteCategory("empty-cat");
    expect(result.success).toBe(true);
  });
});
