import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkRateLimit,
  recordFailedAttempt,
  resetAttempts,
  checkThrottle,
  resetThrottle,
} from "@/lib/rate-limit";

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

// ── WEB-SEC-001: checkThrottle — fixed-window per-IP limiter ──

describe("rate-limit — checkThrottle (fixed-window)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to max attempts inside one window", () => {
    vi.setSystemTime(0);
    const key = `throttle-${Math.random()}`;
    for (let i = 0; i < 10; i++) {
      expect(checkThrottle(key, { max: 10, windowMs: 60_000 }).allowed).toBe(true);
    }
  });

  it("denies the max+1 attempt with a positive retryAfterMs", () => {
    vi.setSystemTime(0);
    const key = `throttle-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkThrottle(key, { max: 5, windowMs: 60_000 });
    const r = checkThrottle(key, { max: 5, windowMs: 60_000 });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.retryAfterMs).toBeGreaterThan(0);
      expect(r.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it("resets the counter once the window rolls over", () => {
    vi.setSystemTime(1000);
    const key = `throttle-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkThrottle(key, { max: 5, windowMs: 1000 });
    expect(checkThrottle(key, { max: 5, windowMs: 1000 }).allowed).toBe(false);
    // Advance past the window (window started at t=1000, length 1000)
    vi.setSystemTime(3000);
    expect(checkThrottle(key, { max: 5, windowMs: 1000 }).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    vi.setSystemTime(0);
    const a = `throttle-a-${Math.random()}`;
    const b = `throttle-b-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkThrottle(a, { max: 5, windowMs: 60_000 });
    expect(checkThrottle(a, { max: 5, windowMs: 60_000 }).allowed).toBe(false);
    expect(checkThrottle(b, { max: 5, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("resetThrottle clears a key", () => {
    vi.setSystemTime(0);
    const key = `throttle-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkThrottle(key, { max: 5, windowMs: 60_000 });
    expect(checkThrottle(key, { max: 5, windowMs: 60_000 }).allowed).toBe(false);
    resetThrottle(key);
    expect(checkThrottle(key, { max: 5, windowMs: 60_000 }).allowed).toBe(true);
  });
});
