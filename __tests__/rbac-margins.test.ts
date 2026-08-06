/**
 * T-B14 — RBAC + margins real-path tests.
 *
 * Unlike phase4-actions.test.ts (which force-resolves roles by mocking
 * requireStaffSession), this file does NOT mock @/lib/auth: it drives the real
 * `requireStaffSession` and therefore the REAL ROLE_RANK gate through a mocked
 * Supabase session, and asserts margins from the SHIPPED getProductMargins
 * rather than a local re-implementation of the math.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}));

// db is mocked so the shipped getProductMargins has deterministic data.
const { mockDbSelect } = vi.hoisted(() => ({ mockDbSelect: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { select: mockDbSelect },
}));

import { requireStaffSession, AuthError } from "@/lib/auth";
import { getProductMargins } from "@/app/(admin)/admin/reports/actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("REAL ROLE_RANK gate (requireStaffSession)", () => {
  it("rejects a cashier from a manager-required action", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "u1", app_metadata: { staff_id: "s1", role: "cashier" } },
      },
      error: null,
    });
    await expect(requireStaffSession("manager")).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects when the session carries no role (NO_STAFF_ID)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: {} } }, error: null });
    await expect(requireStaffSession("manager")).rejects.toBeInstanceOf(AuthError);
  });

  it("allows an owner through a manager-required action", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", app_metadata: { staff_id: "s1", role: "owner" } } },
      error: null,
    });
    const session = await requireStaffSession("manager");
    expect(session).toEqual({ staffId: "s1", role: "owner" });
  });
});

describe("SHIPPED getProductMargins (T-B14)", () => {
  it("computes margin from real product/recipe/ingredient data", async () => {
    // db mock: products, recipes, then ingredients (with where).
    mockDbSelect
      .mockReturnValueOnce({
        from: () => Promise.resolve([{ id: "p1", nameAr: "م", nameEn: "M", basePrice: "15.00" }]),
      })
      .mockReturnValueOnce({
        from: () =>
          Promise.resolve([{ productId: "p1", ingredientId: "i1", quantityUsed: "50.00" }]),
      })
      .mockReturnValueOnce({
        from: () => ({ where: () => Promise.resolve([{ id: "i1", costPerUnit: "0.1000" }]) }),
      });

    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", app_metadata: { staff_id: "s1", role: "owner" } } },
      error: null,
    });

    const margins = await getProductMargins();
    expect(margins).toHaveLength(1);
    expect(margins[0].basePrice).toBe("15.00");
    expect(margins[0].ingredientCost).toBe("5.00"); // 50 × ₪0.10
    expect(margins[0].margin).toBe("10.00");
    expect(margins[0].marginPercent).toBe("66.7");
  });
});
