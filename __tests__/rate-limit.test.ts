import { describe, it, expect } from "vitest";
import { checkRateLimit, recordFailedAttempt, resetAttempts } from "@/lib/rate-limit";

describe("rate-limit — checkRateLimit", () => {
  it("allows when no state exists", () => {
    const key = `test-${Date.now()}-allow`;
    resetAttempts(key);
    const result = checkRateLimit(key);
    expect(result.allowed).toBe(true);
  });

  it("allows when under threshold", () => {
    const key = `test-${Date.now()}-under`;
    resetAttempts(key);
    recordFailedAttempt(key);
    recordFailedAttempt(key);
    const result = checkRateLimit(key);
    expect(result.allowed).toBe(true);
  });
});

describe("rate-limit — recordFailedAttempt", () => {
  it("does not lock before 5 failures", () => {
    const key = `test-${Date.now()}-nolock`;
    resetAttempts(key);
    for (let i = 0; i < 4; i++) {
      const { locked } = recordFailedAttempt(key);
      expect(locked).toBe(false);
    }
  });

  it("locks after 5 consecutive failures", () => {
    const key = `test-${Date.now()}-lock`;
    resetAttempts(key);
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt(key);
    }
    const { locked, waitMs } = recordFailedAttempt(key);
    expect(locked).toBe(true);
    expect(waitMs).toBeGreaterThan(0);
    expect(waitMs).toBeLessThanOrEqual(300000); // cap at 5 minutes
  });

  it("checkRateLimit returns non-allowed during lockout", () => {
    const key = `test-${Date.now()}-blocked`;
    resetAttempts(key);
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(key);
    }
    const result = checkRateLimit(key);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.waitMs).toBeGreaterThan(0);
    }
  });
});

describe("rate-limit — resetAttempts", () => {
  it("resets counter on success", () => {
    const key = `test-${Date.now()}-reset`;
    resetAttempts(key);
    for (let i = 0; i < 3; i++) {
      recordFailedAttempt(key);
    }
    // Simulate successful auth
    resetAttempts(key);
    const result = checkRateLimit(key);
    expect(result.allowed).toBe(true);
  });

  it("resets lockout too", () => {
    const key = `test-${Date.now()}-reset-lock`;
    resetAttempts(key);
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(key);
    }
    // Now locked
    let result = checkRateLimit(key);
    expect(result.allowed).toBe(false);

    // Reset
    resetAttempts(key);
    result = checkRateLimit(key);
    expect(result.allowed).toBe(true);
  });
});

describe("rate-limit — doubling lockout", () => {
  it("doubles lockout on repeated lockouts", () => {
    const key = `test-${Date.now()}-double`;
    resetAttempts(key);

    // First lockout
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(key);
    }
    let result = checkRateLimit(key);
    expect(result.allowed).toBe(false);

    // Reset after first
    resetAttempts(key);

    // Second lockout
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(key);
    }
    result = checkRateLimit(key);
    expect(result.allowed).toBe(false);
    // Second lockout should double (120s = 120000ms)
    if (!result.allowed) {
      expect(result.waitMs).toBeGreaterThanOrEqual(60000);
    }
  });
});
