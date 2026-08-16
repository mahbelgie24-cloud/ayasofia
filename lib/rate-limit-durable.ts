/**
 * Postgres-backed rate-limit store (WEB-SEC-004).
 *
 * The in-memory limiter in `lib/rate-limit.ts` keeps its counters per
 * process, so a spray across instances (serverless fan-out) can exceed
 * the caps. This module moves the same two policies — fixed-window
 * throttle and PIN lockout with doubling backoff — into the `rate_limits`
 * table so every instance shares one counter.
 *
 * Every mutation is a single INSERT .. ON CONFLICT DO UPDATE .. RETURNING
 * statement: the row lock the upsert takes serializes concurrent attempts,
 * so the counter is exact under concurrency without an explicit
 * transaction. Timestamps come back as epoch milliseconds computed by
 * Postgres itself (`extract(epoch …) * 1000`) — the raw timestamptz text
 * form is not guaranteed to be parseable by `new Date()`, so we never
 * parse it in JS.
 *
 * Server-only — talks to the database through the direct pool.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type ThrottleResult = { allowed: true } | { allowed: false; retryAfterMs: number };
export type RateLimitResult = { allowed: true } | { allowed: false; waitMs: number };
export type RecordFailureResult = { locked: boolean; waitMs: number };

/** Consecutive failures before a lockout (mirrors the in-memory policy). */
const MAX_FAILURES = 5;
/** Lockout cap in seconds (60 → 120 → 240 → 300). */
const LOCKOUT_CAP_SECONDS = 300;
/** Idle time after which a row may be purged. Windows are ≤ 10 min and
 * lockouts cap at 5 min, so 30 min of inactivity covers both flavors. */
const ROW_TTL_MS = 30 * 60_000;

interface ThrottleRow {
  count: number | string;
  window_start_ms: number | string | null;
  locked_until_ms: number | string | null;
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value);
}

/**
 * Fixed-window throttle. Atomically records one attempt against `key` and
 * returns whether it fits within `max` attempts per `windowMs`. When the
 * window has rolled over the counter resets to 1 inside the same statement.
 */
export async function durableCheckThrottle(
  key: string,
  opts: {
    max: number;
    windowMs: number;
  },
): Promise<ThrottleResult> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - opts.windowMs);
  const expiresAt = new Date(now.getTime() + ROW_TTL_MS);

  const result = (await db.execute(sql`
    INSERT INTO rate_limits AS r (key, count, window_start, expires_at)
    VALUES (${key}, 1, ${now}, ${expiresAt})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN r.window_start IS NULL OR r.window_start <= ${cutoff} THEN 1
        ELSE r.count + 1
      END,
      window_start = CASE
        WHEN r.window_start IS NULL OR r.window_start <= ${cutoff} THEN ${now}
        ELSE r.window_start
      END,
      expires_at = ${expiresAt}
    RETURNING r.count,
      (extract(epoch from r.window_start) * 1000)::bigint AS window_start_ms
  `)) as unknown as { rows: ThrottleRow[] };

  const row = result.rows[0];
  const count = asNumber(row.count) ?? 1;
  if (count <= opts.max) return { allowed: true };

  const windowStart = asNumber(row.window_start_ms) ?? now.getTime();
  const retryAfterMs = Math.max(1, windowStart + opts.windowMs - now.getTime());
  return { allowed: false, retryAfterMs };
}

/**
 * Read-only lockout check: denied while `locked_until` is in the future.
 * An expired lockout allows retries but (like the in-memory policy) does
 * not clear the failure count — the next failure re-locks immediately.
 */
export async function durableCheckRateLimit(key: string): Promise<RateLimitResult> {
  const result = (await db.execute(sql`
    SELECT (extract(epoch from locked_until) * 1000)::bigint AS locked_until_ms
    FROM rate_limits WHERE key = ${key} LIMIT 1
  `)) as unknown as { rows: ThrottleRow[] };

  const lockedUntil = asNumber(result.rows[0]?.locked_until_ms ?? null);
  if (lockedUntil !== null && lockedUntil > Date.now()) {
    return { allowed: false, waitMs: lockedUntil - Date.now() };
  }
  return { allowed: true };
}

/**
 * Record one failed attempt. At MAX_FAILURES consecutive failures the key
 * locks for 60 s, doubling on each subsequent lockout (60 → 120 → 240 →
 * 300 s cap), matching the in-memory policy exactly.
 */
export async function durableRecordFailedAttempt(key: string): Promise<RecordFailureResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ROW_TTL_MS);
  const shouldLock = sql`r.count + 1 >= ${MAX_FAILURES} AND (r.locked_until IS NULL OR r.locked_until <= ${now})`;

  const result = (await db.execute(sql`
    INSERT INTO rate_limits AS r (key, count, lockout_multiplier, expires_at)
    VALUES (${key}, 1, 0, ${expiresAt})
    ON CONFLICT (key) DO UPDATE SET
      count = r.count + 1,
      locked_until = CASE WHEN ${shouldLock}
        THEN ${now}::timestamptz + make_interval(secs => least(60 * power(2, r.lockout_multiplier), ${LOCKOUT_CAP_SECONDS})::int)
        ELSE r.locked_until
      END,
      lockout_multiplier = CASE WHEN ${shouldLock}
        THEN r.lockout_multiplier + 1
        ELSE r.lockout_multiplier
      END,
      expires_at = ${expiresAt}
    RETURNING (extract(epoch from r.locked_until) * 1000)::bigint AS locked_until_ms
  `)) as unknown as { rows: ThrottleRow[] };

  const lockedUntil = asNumber(result.rows[0]?.locked_until_ms ?? null);
  if (lockedUntil !== null && lockedUntil > now.getTime()) {
    return { locked: true, waitMs: lockedUntil - now.getTime() };
  }
  return { locked: false, waitMs: 0 };
}

/** Clear all state for a key (successful auth / verified legitimate signal). */
export async function durableReset(key: string): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limits WHERE key = ${key}`);
}

/** Opportunistic housekeeping — stale rows only, never a hot path. */
export async function durablePurgeExpired(): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limits WHERE expires_at < now()`);
}
