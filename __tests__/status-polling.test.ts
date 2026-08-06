/**
 * T-B1 — getOrderStatus hardening.
 *
 * A malformed orderId is rejected before any DB work; a throttled caller is
 * returned null; the access-token gate still holds.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "10.0.0.1" })),
}));

const { mockDbSelect, mockCheckThrottle } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockCheckThrottle: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { select: mockDbSelect },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkThrottle: mockCheckThrottle,
}));

import { getOrderStatus } from "@/app/order/status/[orderId]/actions";

const UUID = "11111111-2222-4333-8444-555555555555";

function selectChain(rows: unknown[]) {
  const thenable = Object.assign(Promise.resolve(rows), {
    limit: () => Promise.resolve(rows),
  });
  return { from: () => ({ where: () => thenable }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckThrottle.mockReturnValue({ allowed: true });
});

describe("getOrderStatus hardening (T-B1)", () => {
  it("rejects a malformed orderId without querying the DB", async () => {
    const r = await getOrderStatus("not-a-uuid", "token");
    expect(r).toBeNull();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it("returns null (via throttle) when the caller exceeded the cap", async () => {
    mockCheckThrottle.mockReturnValue({ allowed: false, retryAfterMs: 1000 });
    const r = await getOrderStatus(UUID, "token");
    expect(r).toBeNull();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it("returns the status for a valid order + correct token", async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([{ status: "preparing" }]));
    const r = await getOrderStatus(UUID, "tok-123");
    expect(r).toEqual({ status: "preparing" });
    expect(mockCheckThrottle).toHaveBeenCalledWith(
      `order-status:10.0.0.1:${UUID}`,
      expect.objectContaining({ max: 90 }),
    );
  });

  it("returns null for a valid orderId but wrong/missing token", async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([]));
    const r = await getOrderStatus(UUID, "wrong-token");
    expect(r).toBeNull();
  });
});
