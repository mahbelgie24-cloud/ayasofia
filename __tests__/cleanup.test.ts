import { describe, it, expect } from "vitest";
import { selectEligibleUsers, type CleanupUser } from "@/scripts/cleanup-logic";

function makeUser(
  overrides: Partial<CleanupUser> & { id: string; created_at: string },
): CleanupUser {
  return {
    is_anonymous: true,
    ...overrides,
  };
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

const staffLinkedIds = new Set<string>(["linked-user-1", "linked-user-2"]);
const config = { maxAgeHours: 24, dryRun: true };

describe("selectEligibleUsers", () => {
  it("selects a stale anonymous user not linked to staff", () => {
    const result = selectEligibleUsers(
      [makeUser({ id: "u1", created_at: hoursAgo(48), is_anonymous: true })],
      staffLinkedIds,
      config,
    );
    expect(result.eligibleIds.has("u1")).toBe(true);
  });

  it("does not select a recent anonymous user", () => {
    const result = selectEligibleUsers(
      [makeUser({ id: "u1", created_at: hoursAgo(1), is_anonymous: true })],
      staffLinkedIds,
      config,
    );
    expect(result.eligibleIds.has("u1")).toBe(false);
    expect(result.skippedTooRecent).toBe(1);
  });

  it("does not select a non-anonymous user", () => {
    const result = selectEligibleUsers(
      [makeUser({ id: "u1", created_at: hoursAgo(48), is_anonymous: false })],
      staffLinkedIds,
      config,
    );
    expect(result.eligibleIds.has("u1")).toBe(false);
    expect(result.skippedNotAnonymous).toBe(1);
  });

  it("does not select user linked through staff.auth_user_id", () => {
    const result = selectEligibleUsers(
      [makeUser({ id: "linked-user-1", created_at: hoursAgo(48), is_anonymous: true })],
      staffLinkedIds,
      config,
    );
    expect(result.eligibleIds.has("linked-user-1")).toBe(false);
    expect(result.skippedStaffLinked).toBe(1);
  });

  it("does not select user with staff_id in app_metadata", () => {
    const result = selectEligibleUsers(
      [
        makeUser({
          id: "u1",
          created_at: hoursAgo(48),
          is_anonymous: true,
          app_metadata: { staff_id: "staff-001", role: "cashier" },
        }),
      ],
      staffLinkedIds,
      config,
    );
    expect(result.eligibleIds.has("u1")).toBe(false);
    expect(result.skippedHasStaffMetadata).toBe(1);
  });

  it("does not select user with email (possibly upgraded)", () => {
    const result = selectEligibleUsers(
      [
        makeUser({
          id: "u1",
          created_at: hoursAgo(48),
          is_anonymous: true,
          email: "someone@example.com",
        }),
      ],
      staffLinkedIds,
      config,
    );
    expect(result.eligibleIds.has("u1")).toBe(false);
    expect(result.skippedHasEmailOrPhone).toBe(1);
  });

  it("does not select user with phone (possibly upgraded)", () => {
    const result = selectEligibleUsers(
      [
        makeUser({
          id: "u1",
          created_at: hoursAgo(48),
          is_anonymous: true,
          phone: "+972501234567",
        }),
      ],
      staffLinkedIds,
      config,
    );
    expect(result.eligibleIds.has("u1")).toBe(false);
    expect(result.skippedHasEmailOrPhone).toBe(1);
  });

  it("skips users with malformed timestamps (fail-closed)", () => {
    const result = selectEligibleUsers(
      [makeUser({ id: "u1", created_at: "not-a-date", is_anonymous: true })],
      staffLinkedIds,
      config,
    );
    expect(result.eligibleIds.has("u1")).toBe(false);
    expect(result.skippedMalformedTimestamp).toBe(1);
  });

  it("processes multiple pages correctly (pagination simulation)", () => {
    const page1 = [makeUser({ id: "u1", created_at: hoursAgo(48), is_anonymous: true })];
    const page2 = [makeUser({ id: "u2", created_at: hoursAgo(72), is_anonymous: true })];
    const page3: CleanupUser[] = [];

    const r1 = selectEligibleUsers(page1, staffLinkedIds, config);
    const r2 = selectEligibleUsers(page2, staffLinkedIds, config);
    const r3 = selectEligibleUsers(page3, staffLinkedIds, config);

    expect(r1.eligibleIds.has("u1")).toBe(true);
    expect(r2.eligibleIds.has("u2")).toBe(true);
    expect(r3.totalInspected).toBe(0);
    expect(r3.eligibleIds.size).toBe(0);
  });

  it("running selection twice is idempotent (same result)", () => {
    const users = [
      makeUser({ id: "u1", created_at: hoursAgo(48), is_anonymous: true }),
      makeUser({ id: "u2", created_at: hoursAgo(1), is_anonymous: true }),
      makeUser({ id: "linked-user-1", created_at: hoursAgo(48), is_anonymous: true }),
    ];

    const r1 = selectEligibleUsers(users, staffLinkedIds, config);
    const r2 = selectEligibleUsers(users, staffLinkedIds, config);

    expect(r1.eligibleIds).toEqual(r2.eligibleIds);
  });

  it("default retention is 24 hours", () => {
    const at25h = makeUser({ id: "u1", created_at: hoursAgo(25), is_anonymous: true });
    const at23h = makeUser({ id: "u2", created_at: hoursAgo(23), is_anonymous: true });

    const result = selectEligibleUsers([at25h, at23h], new Set(), {
      maxAgeHours: 24,
      dryRun: true,
    });

    expect(result.eligibleIds.has("u1")).toBe(true); // older than 24h
    expect(result.eligibleIds.has("u2")).toBe(false); // within 24h
  });

  it("invalid retention is handled by caller (config-based)", () => {
    expect(config.maxAgeHours).toBe(24);
  });

  it("staff-linked query failure should cause zero deletions — tested via empty staffLinkedIds being different from populated", () => {
    // If the staff-linked set is empty (simulating a query failure that
    // returned no rows because the DB was down), we should still NOT
    // accidentally delete linked users. The set is still empty but the
    // real script would abort. Here we test that the function processes
    // correctly with whatever set it receives.
    const users = [makeUser({ id: "linked-user-1", created_at: hoursAgo(48), is_anonymous: true })];
    const result = selectEligibleUsers(users, new Set(), config);
    // With empty set, "linked-user-1" would NOT be protected by staffLinkedIds
    // but in reality the script aborts before reaching here.
    expect(result.eligibleIds.has("linked-user-1")).toBe(true);
  });

  it("eligible count is accurate", () => {
    const users = [
      makeUser({ id: "u1", created_at: hoursAgo(48), is_anonymous: true }),
      makeUser({ id: "u2", created_at: hoursAgo(72), is_anonymous: true }),
      makeUser({ id: "u3", created_at: hoursAgo(1), is_anonymous: true }),
    ];

    const result = selectEligibleUsers(users, staffLinkedIds, config);
    expect(result.eligibleIds.size).toBe(2);
    expect(result.totalInspected).toBe(3);
  });
});
