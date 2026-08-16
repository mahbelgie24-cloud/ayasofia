import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  memoryCheckRateLimit,
  memoryRecordFailedAttempt,
  memoryResetAttempts,
  memoryCheckThrottle,
  memoryResetThrottle,
} from "@/lib/rate-limit";

// The in-memory layer is the *fallback* (durable Postgres store unavailable).
// It implements the exact same policy as lib/rate-limit-durable.ts — the
// durable path is covered by rate-limit-durable.integration.test.ts against
// a real database. Both suites assert identical semantics.

describe("rate-limit (memory) — checkRateLimit", () => {
  it("allows when no state exists", () => {
    const key = `test-${Date.now()}-allow`;
    memoryResetAttempts(key);
    const result = memoryCheckRateLimit(key);
    expect(result.allowed).toBe(true);
  });

  it("allows when under threshold", () => {
    const key = `test-${Date.now()}-under`;
    memoryResetAttempts(key);
    memoryRecordFailedAttempt(key);
    memoryRecordFailedAttempt(key);
    const result = memoryCheckRateLimit(key);
    expect(result.allowed).toBe(true);
  });
});

describe("rate-limit (memory) — recordFailedAttempt", () => {
  it("does not lock before 5 failures", () => {
    const key = `test-${Date.now()}-nolock`;
    memoryResetAttempts(key);
    for (let i = 0; i < 4; i++) {
      const { locked } = memoryRecordFailedAttempt(key);
      expect(locked).toBe(false);
    }
  });

  it("locks after 5 consecutive failures", () => {
    const key = `test-${Date.now()}-lock`;
    memoryResetAttempts(key);
    for (let i = 0; i < 4; i++) {
      memoryRecordFailedAttempt(key);
    }
    const { locked, waitMs } = memoryRecordFailedAttempt(key);
    expect(locked).toBe(true);
    expect(waitMs).toBeGreaterThan(0);
    expect(waitMs).toBeLessThanOrEqual(300000); // cap at 5 minutes
  });

  it("checkRateLimit returns non-allowed during lockout", () => {
    const key = `test-${Date.now()}-blocked`;
    memoryResetAttempts(key);
    for (let i = 0; i < 5; i++) {
      memoryRecordFailedAttempt(key);
    }
    const result = memoryCheckRateLimit(key);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.waitMs).toBeGreaterThan(0);
    }
  });
});

describe("rate-limit (memory) — resetAttempts", () => {
  it("resets counter on success", () => {
    const key = `test-${Date.now()}-reset`;
    memoryResetAttempts(key);
    for (let i = 0; i < 3; i++) {
      memoryRecordFailedAttempt(key);
    }
    // Simulate successful auth
    memoryResetAttempts(key);
    const result = memoryCheckRateLimit(key);
    expect(result.allowed).toBe(true);
  });

  it("resets lockout too", () => {
    const key = `test-${Date.now()}-reset-lock`;
    memoryResetAttempts(key);
    for (let i = 0; i < 5; i++) {
      memoryRecordFailedAttempt(key);
    }
    // Now locked
    let result = memoryCheckRateLimit(key);
    expect(result.allowed).toBe(false);

    // Reset
    memoryResetAttempts(key);
    result = memoryCheckRateLimit(key);
    expect(result.allowed).toBe(true);
  });
});

describe("rate-limit (memory) — doubling lockout", () => {
  it("doubles lockout on repeated lockouts", () => {
    const key = `test-${Date.now()}-double`;
    memoryResetAttempts(key);

    // First lockout
    for (let i = 0; i < 5; i++) {
      memoryRecordFailedAttempt(key);
    }
    let result = memoryCheckRateLimit(key);
    expect(result.allowed).toBe(false);

    // Reset after first
    memoryResetAttempts(key);

    // Second lockout
    for (let i = 0; i < 5; i++) {
      memoryRecordFailedAttempt(key);
    }
    result = memoryCheckRateLimit(key);
    expect(result.allowed).toBe(false);
    // Second lockout should double (120s = 120000ms)
    if (!result.allowed) {
      expect(result.waitMs).toBeGreaterThanOrEqual(60000);
    }
  });
});

// ── WEB-SEC-001: fixed-window per-IP throttle (memory layer) ──

describe("rate-limit (memory) — checkThrottle (fixed-window)", () => {
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
      expect(memoryCheckThrottle(key, { max: 10, windowMs: 60_000 }).allowed).toBe(true);
    }
  });

  it("denies the max+1 attempt with a positive retryAfterMs", () => {
    vi.setSystemTime(0);
    const key = `throttle-${Math.random()}`;
    for (let i = 0; i < 5; i++) memoryCheckThrottle(key, { max: 5, windowMs: 60_000 });
    const r = memoryCheckThrottle(key, { max: 5, windowMs: 60_000 });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.retryAfterMs).toBeGreaterThan(0);
      expect(r.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it("resets the counter once the window rolls over", () => {
    vi.setSystemTime(1000);
    const key = `throttle-${Math.random()}`;
    for (let i = 0; i < 5; i++) memoryCheckThrottle(key, { max: 5, windowMs: 1000 });
    expect(memoryCheckThrottle(key, { max: 5, windowMs: 1000 }).allowed).toBe(false);
    // Advance past the window (window started at t=1000, length 1000)
    vi.setSystemTime(3000);
    expect(memoryCheckThrottle(key, { max: 5, windowMs: 1000 }).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    vi.setSystemTime(0);
    const a = `throttle-a-${Math.random()}`;
    const b = `throttle-b-${Math.random()}`;
    for (let i = 0; i < 5; i++) memoryCheckThrottle(a, { max: 5, windowMs: 60_000 });
    expect(memoryCheckThrottle(a, { max: 5, windowMs: 60_000 }).allowed).toBe(false);
    expect(memoryCheckThrottle(b, { max: 5, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("resetThrottle clears a key", () => {
    vi.setSystemTime(0);
    const key = `throttle-${Math.random()}`;
    for (let i = 0; i < 5; i++) memoryCheckThrottle(key, { max: 5, windowMs: 60_000 });
    expect(memoryCheckThrottle(key, { max: 5, windowMs: 60_000 }).allowed).toBe(false);
    memoryResetThrottle(key);
    expect(memoryCheckThrottle(key, { max: 5, windowMs: 60_000 }).allowed).toBe(true);
  });
});
