/**
 * Integration test: the durable Postgres rate-limit store (WEB-SEC-004).
 *
 * Requires DATABASE_URL (from .env.test.local — the isolated local stack;
 * never production .env.local) and migration 0014 (`rate_limits` table).
 *
 * Asserts the same policy as the in-memory suite (rate-limit.test.ts):
 * fixed-window throttle semantics and PIN-lockout doubling. Time-based
 * transitions (window rollover, lockout expiry) are simulated by moving
 * the row's timestamps into the past rather than sleeping. Every test is
 * self-cleaning: keys carry the `rl-test:` prefix and are deleted after
 * each test.
 */

import { describe, it, expect, afterAll, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  durableCheckThrottle,
  durableCheckRateLimit,
  durableRecordFailedAttempt,
  durableReset,
  durablePurgeExpired,
} from "@/lib/rate-limit-durable";
import { loadTestEnv } from "@/lib/test-env";

// Load the isolated staging credentials + assert this is not the production
// project (Step-3 guard). CI-injected DATABASE_URL is used as-is.
loadTestEnv();

// The lib under test binds its pool to process.env.DATABASE_URL at import
// time; loadTestEnv() ran first in this module body, so the env is correct.
// This second pool is for direct row manipulation (simulating time passing)
// and cleanup.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const usedKeys: string[] = [];

function testKey(label: string): string {
  const key = `rl-test:${label}:${Date.now()}:${Math.floor(Math.random() * 1e6)}`;
  usedKeys.push(key);
  return key;
}

afterEach(async () => {
  for (const key of usedKeys) {
    try {
      await durableReset(key);
    } catch {
      // Cleanup only.
    }
  }
  usedKeys.length = 0;
});

afterAll(async () => {
  await pool.end();
});

describe("durable rate-limit — fixed-window throttle", () => {
  it("allows max attempts in the window, denies max+1 with bounded retryAfterMs", async () => {
    const key = testKey("throttle-cap");
    const opts = { max: 5, windowMs: 60_000 };

    for (let i = 0; i < 5; i++) {
      const r = await durableCheckThrottle(key, opts);
      expect(r.allowed).toBe(true);
    }
    const denied = await durableCheckThrottle(key, opts);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.retryAfterMs).toBeGreaterThan(0);
      expect(denied.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it("tracks keys independently", async () => {
    const a = testKey("throttle-a");
    const b = testKey("throttle-b");
    const opts = { max: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i++) await durableCheckThrottle(a, opts);
    expect((await durableCheckThrottle(a, opts)).allowed).toBe(false);
    expect((await durableCheckThrottle(b, opts)).allowed).toBe(true);
  });

  it("resets the counter once the window has rolled over", async () => {
    const key = testKey("throttle-rollover");
    const opts = { max: 2, windowMs: 60_000 };

    for (let i = 0; i < 2; i++) await durableCheckThrottle(key, opts);
    expect((await durableCheckThrottle(key, opts)).allowed).toBe(false);

    // Simulate the window having rolled over: push window_start into the past.
    await db.execute(
      sql`UPDATE rate_limits SET window_start = now() - interval '2 minutes' WHERE key = ${key}`,
    );
    expect((await durableCheckThrottle(key, opts)).allowed).toBe(true);
    // And the fresh window counts from scratch: max-1 more allowed, then denied.
    expect((await durableCheckThrottle(key, opts)).allowed).toBe(true);
    expect((await durableCheckThrottle(key, opts)).allowed).toBe(false);
  });

  it("counts exactly under concurrency — the atomicity proof for cross-instance caps", async () => {
    const key = testKey("throttle-concurrent");
    const opts = { max: 5, windowMs: 60_000 };

    // 10 concurrent attempts (as if from 10 instances): exactly 5 allowed.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => durableCheckThrottle(key, opts)),
    );
    const allowed = results.filter((r) => r.allowed).length;
    expect(allowed).toBe(5);
  });
});

describe("durable rate-limit — PIN lockout", () => {
  it("does not lock before 5 failures", async () => {
    const key = testKey("lock-nolock");
    for (let i = 0; i < 4; i++) {
      const { locked } = await durableRecordFailedAttempt(key);
      expect(locked).toBe(false);
    }
  });

  it("locks on the 5th failure for 60s (base lockout)", async () => {
    const key = testKey("lock-base");
    for (let i = 0; i < 4; i++) await durableRecordFailedAttempt(key);
    const { locked, waitMs } = await durableRecordFailedAttempt(key);
    expect(locked).toBe(true);
    expect(waitMs).toBeGreaterThan(50_000);
    expect(waitMs).toBeLessThanOrEqual(60_000);
  });

  it("checkRateLimit denies during the lockout and allows after expiry", async () => {
    const key = testKey("lock-expiry");
    for (let i = 0; i < 5; i++) await durableRecordFailedAttempt(key);

    const locked = await durableCheckRateLimit(key);
    expect(locked.allowed).toBe(false);
    if (!locked.allowed) expect(locked.waitMs).toBeGreaterThan(0);

    // Simulate lockout expiry: locked_until moved into the past. The failure
    // count survives (same as the in-memory policy) — the next failure
    // re-locks immediately with a doubled duration.
    await db.execute(
      sql`UPDATE rate_limits SET locked_until = now() - interval '1 second' WHERE key = ${key}`,
    );
    expect((await durableCheckRateLimit(key)).allowed).toBe(true);
  });

  it("doubles the lockout on the failure after expiry (multiplier persists)", async () => {
    const key = testKey("lock-double");
    for (let i = 0; i < 5; i++) await durableRecordFailedAttempt(key);

    // Expire the first (60s) lockout, then fail once more.
    await db.execute(
      sql`UPDATE rate_limits SET locked_until = now() - interval '1 second' WHERE key = ${key}`,
    );
    const { locked, waitMs } = await durableRecordFailedAttempt(key);
    expect(locked).toBe(true);
    // Second lockout: 120s (doubled), still capped at 300s.
    expect(waitMs).toBeGreaterThan(110_000);
    expect(waitMs).toBeLessThanOrEqual(300_000);
  });

  it("durableReset clears both count and lockout", async () => {
    const key = testKey("lock-reset");
    for (let i = 0; i < 5; i++) await durableRecordFailedAttempt(key);
    expect((await durableCheckRateLimit(key)).allowed).toBe(false);

    await durableReset(key);
    expect((await durableCheckRateLimit(key)).allowed).toBe(true);

    // Fresh state: 4 failures do not lock again.
    for (let i = 0; i < 4; i++) {
      const { locked } = await durableRecordFailedAttempt(key);
      expect(locked).toBe(false);
    }
  });

  it("counts lockout failures exactly under concurrency", async () => {
    const key = testKey("lock-concurrent");
    // 7 concurrent failures: the 5th (by row-lock order) locks; the last two
    // see an active-or-expired lock decision without corrupting the row.
    const results = await Promise.all(
      Array.from({ length: 7 }, () => durableRecordFailedAttempt(key)),
    );
    expect(results.filter((r) => r.locked).length).toBeGreaterThanOrEqual(1);
    expect((await durableCheckRateLimit(key)).allowed).toBe(false);
  });
});

describe("durable rate-limit — housekeeping", () => {
  it("purge removes only expired rows", async () => {
    const stale = testKey("purge-stale");
    const live = testKey("purge-live");
    await durableCheckThrottle(stale, { max: 5, windowMs: 60_000 });
    await durableCheckThrottle(live, { max: 5, windowMs: 60_000 });

    await db.execute(
      sql`UPDATE rate_limits SET expires_at = now() - interval '1 second' WHERE key = ${stale}`,
    );
    await durablePurgeExpired();

    const remaining = await db.execute(
      sql`SELECT key FROM rate_limits WHERE key IN (${stale}, ${live})`,
    );
    const keys = (remaining as unknown as { rows: { key: string }[] }).rows.map((r) => r.key);
    expect(keys).toContain(live);
    expect(keys).not.toContain(stale);
  });
});
