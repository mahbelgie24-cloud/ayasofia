/**
 * T-B5 + H4 — verifyStaffPin must derive the target user from the server
 * session (never the forged client id), and must read the staff directory via
 * the direct DATABASE_URL pool (H4: the service-role PostgREST client has no
 * schema grants in this Supabase project, so the old service-role `select from
 * staff` failed with "permission denied for schema public").
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "1.2.3.4" })),
}));

const { mockGetUser, mockService } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockService: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockService,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  checkThrottle: vi.fn().mockReturnValue({ allowed: true }),
  recordFailedAttempt: vi.fn().mockReturnValue({ locked: false, waitMs: 0 }),
  resetAttempts: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  verifyPin: vi.fn().mockReturnValue(true),
}));

// H4: staff is read via the direct db pool. Capture the active-staff rows and
// the persisted auth_user_id update.
const { mockStaffRows, mockDbUpdate } = vi.hoisted(() => ({
  mockStaffRows: vi.fn(),
  mockDbUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => {
  // Drizzle chains: staff lookup is `select().from().where()` (no .limit()),
  // the shift lookup is `select().from().where().limit()`.
  const whereThenable = () => {
    const q: {
      then: (resolve: (v: unknown) => unknown) => Promise<unknown>;
      limit: () => Promise<never[]>;
    } = {
      then: (resolve) => Promise.resolve(resolve(mockStaffRows())),
      limit: () => Promise.resolve([]),
    };
    return q;
  };
  return {
    db: {
      select: () => ({ from: () => ({ where: () => whereThenable() }) }),
      update: () => ({ set: () => ({ where: mockDbUpdate }) }),
    },
  };
});

import { verifyStaffPin } from "@/app/login/actions";

function makeService() {
  const updateUserById = vi.fn().mockResolvedValue({ error: null });
  const service = {
    auth: { admin: { updateUserById } },
  };
  return { service, updateUserById };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyStaffPin uses the server session + direct pool (T-B5, H4)", () => {
  it("rejects a forged client anonUserId that differs from the session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "real-session-user" } }, error: null });
    const { service, updateUserById } = makeService();
    mockService.mockReturnValue(service);

    const r = await verifyStaffPin("1234", "attacker-controlled-id");
    expect(r.success).toBe(false);
    expect((r as { error: string }).error).toBe("Session mismatch");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("returns Not authenticated when there is no server session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("no user") });
    const r = await verifyStaffPin("1234", "ignored");
    expect(r.success).toBe(false);
    expect((r as { error: string }).error).toBe("Not authenticated");
  });

  it("promotes ONLY the server-session user on a correct PIN", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "real-session-user" } }, error: null });
    mockStaffRows.mockResolvedValue([
      { id: "real-staff", pinHash: "salt:hash", role: "owner", active: true },
    ]);
    const { service, updateUserById } = makeService();
    mockService.mockReturnValue(service);

    const r = await verifyStaffPin("1234", "real-session-user");
    expect(r.success).toBe(true);
    expect(updateUserById).toHaveBeenCalledWith("real-session-user", {
      app_metadata: { staff_id: "real-staff", role: "owner" },
    });
  });
});
