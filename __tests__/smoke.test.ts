import { describe, it, expect } from "vitest";

describe("project scaffold", () => {
  it("boots without import errors", () => {
    // Smoke test: verifies the test runner and TS config are wired correctly.
    expect(true).toBe(true);
  });

  it.todo(
    "PIN login: signInAnonymously + verifyStaffPin sets staff_id JWT claim"
  );
  it.todo(
    "PIN login: invalid PIN returns generic error, no staff_id claim on JWT"
  );
  it.todo(
    "RLS: unverified anon session sees zero orders (no staff_id in JWT)"
  );
  it.todo(
    "RLS: verified session sees live orders (staff_id JWT claim present)"
  );
  it.todo(
    "Session cleanup: endStaffSession signs out, next signInAnonymously is fresh"
  );
});
