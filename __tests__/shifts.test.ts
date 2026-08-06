import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTx, mockDbSelect } = vi.hoisted(() => ({
  mockTx: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: mockTx,
    select: mockDbSelect,
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireStaffSession: vi.fn().mockResolvedValue({ staffId: "staff-001", role: "owner" }),
}));

function q(rows: unknown[]) {
  return Object.assign(Promise.resolve(rows), {
    limit: () => Promise.resolve(rows),
  });
}

import { openShift, closeShift, getOpenShift } from "@/lib/shifts";
import { requireStaffSession } from "@/lib/auth";

describe("openShift", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new shift when no open shift exists", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => q([]),
      }),
    });

    const insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "shift-new" }]),
      }),
    });

    vi.mocked((await import("@/lib/db")).db.insert).mockImplementation(
      () => insert() as unknown as ReturnType<typeof import("@/lib/db").db.insert>,
    );

    const result = await openShift(100);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.shiftId).toBe("shift-new");
    }
  });

  it("returns existing shift when one is already open", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => q([{ id: "shift-existing" }]),
      }),
    });

    const result = await openShift(50);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.shiftId).toBe("shift-existing");
    }
  });

  it("defaults negative or NaN cash to 0", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => q([]),
      }),
    });

    const insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "shift-zero" }]),
      }),
    });

    vi.mocked((await import("@/lib/db")).db.insert).mockImplementation(
      () => insert() as unknown as ReturnType<typeof import("@/lib/db").db.insert>,
    );

    const result = await openShift(-5);
    expect(result.success).toBe(true);
  });
});

describe("closeShift", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects close when no open shift exists", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => q([]),
      }),
    });

    const result = await closeShift(200);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("لا توجد وردية مفتوحة");
    }
  });

  it("computes totalSales and discrepancy correctly", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        where: () =>
          q([
            {
              id: "shift-1",
              staffId: "staff-001",
              openedAt: new Date("2026-08-04T08:00:00Z"),
              openingCash: "100.00",
              closedAt: null,
              closingCash: null,
              totalSales: null,
            },
          ]),
      }),
    });

    // closeShift now runs the sales sum + close update inside one transaction.
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(q([{ sum: "450.00" }])) }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "shift-1", totalSales: "450.00" }]),
          }),
        }),
      }),
    };
    mockTx.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    const result = await closeShift(555);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.totalSales).toBe("450.00");
      // discrepancy = 555 - 100 - 450 = 5
      expect(result.discrepancy).toBe("5.00");
    }
  });
});

describe("getOpenShift", () => {
  it("returns hasOpen: false when no shift", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => q([]),
      }),
    });

    const result = await getOpenShift();
    expect(result).not.toBeNull();
    expect(result!.hasOpen).toBe(false);
  });

  it("returns shift data when open", async () => {
    const openedAt = new Date("2026-08-04T08:00:00Z");
    mockDbSelect.mockReturnValueOnce({
      from: () => ({
        where: () =>
          q([
            {
              id: "shift-1",
              staffId: "staff-001",
              openedAt,
              openingCash: "100.00",
              closedAt: null,
              closingCash: null,
              totalSales: null,
            },
          ]),
      }),
    });

    const result = await getOpenShift();
    expect(result).not.toBeNull();
    expect(result!.hasOpen).toBe(true);
    expect(result!.openingCash).toBe("100.00");
  });
});

describe("RBAC — shift actions", () => {
  it("requireStaffSession is called for openShift", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(new Error("no session"));
    await expect(openShift(0)).rejects.toThrow();
  });

  it("requireStaffSession is called for closeShift", async () => {
    vi.mocked(requireStaffSession).mockRejectedValueOnce(new Error("no session"));
    await expect(closeShift(0)).rejects.toThrow();
  });
});

describe("Z-report discrepancy math", () => {
  const computeDiscrepancy = (closing: number, opening: number, sales: number) =>
    parseFloat((closing - opening - sales).toFixed(2));

  it("zero discrepancy when cash matches exactly", () => {
    expect(computeDiscrepancy(650, 100, 550)).toBe(0);
  });

  it("positive discrepancy (over)", () => {
    expect(computeDiscrepancy(700, 100, 550)).toBe(50);
  });

  it("negative discrepancy (short)", () => {
    expect(computeDiscrepancy(600, 100, 550)).toBe(-50);
  });

  it("handles decimal values", () => {
    expect(computeDiscrepancy(155.5, 50.25, 100)).toBe(5.25);
  });
});
