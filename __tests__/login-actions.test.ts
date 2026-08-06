/**
 * T-B5 — verifyStaffPin must derive the target user from the server session,
 * never from the client-supplied anonUserId. A forged id is rejected.
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
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
  },
}));

import { verifyStaffPin } from "@/app/login/actions";

function makeService() {
  const updateUserById = vi.fn().mockResolvedValue({ error: null });
  const staffUpdate = vi.fn().mockResolvedValue({ error: null });
  const service = {
    auth: { admin: { updateUserById } },
    from: vi.fn().mockImplementation((table: string) =>
      table === "staff"
        ? {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: "real-staff", pin_hash: "salt:hash", role: "owner" }],
                error: null,
              }),
            }),
            update: vi.fn().mockReturnValue({ eq: staffUpdate }),
          }
        : { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) },
    ),
  };
  return { service, updateUserById, staffUpdate };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyStaffPin uses the server session (T-B5)", () => {
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
    const { service, updateUserById, staffUpdate } = makeService();
    mockService.mockReturnValue(service);

    const r = await verifyStaffPin("1234", "real-session-user");
    expect(r.success).toBe(true);
    expect(updateUserById).toHaveBeenCalledWith("real-session-user", {
      app_metadata: { staff_id: "real-staff", role: "owner" },
    });
    expect(staffUpdate).toHaveBeenCalled();
  });
});
