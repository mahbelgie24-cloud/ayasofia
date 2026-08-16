/**
 * Rate limiting for PIN login attempts and public-endpoint throttles.
 *
 * Two layers:
 *
 * 1. **Durable (primary, WEB-SEC-004)** — counters live in the
 *    `rate_limits` Postgres table (`lib/rate-limit-durable.ts`), so the
 *    caps hold globally across instances. Every check below hits it first
 *    whenever `DATABASE_URL` is configured.
 * 2. **In-memory (fallback)** — if the durable store errors (DB briefly
 *    unreachable), the same policy runs against process memory so a
 *    database blip cannot lock every customer out (fail-open to the
 *    previous single-instance behavior, never fail-closed). The pure
 *    `memory*` functions are exported for unit tests.
 *
 * Policy (identical on both layers):
 *   - Max 5 consecutive failures per user
 *   - 60s lockout on 5th failure
 *   - Doubling lockout on repeated lockouts (60s, 120s, 240s, cap 300s)
 *   - Counter resets on successful authentication
 */

import {
  durableCheckRateLimit,
  durableCheckThrottle,
  durablePurgeExpired,
  durableRecordFailedAttempt,
  durableReset,
} from "@/lib/rate-limit-durable";

export interface ThrottleOptions {
  max: number;
  windowMs: number;
}

// ---------- In-memory fallback layer ----------

interface AttemptState {
  count: number;
  lockedUntil: number | null;
  lockoutMultiplier: number; // how many times we've locked out consecutively
}

const attempts = new Map<string, AttemptState>();

function getLockoutDuration(multiplier: number): number {
  // 60s → 120s → 240s → 300s cap
  return Math.min(60 * Math.pow(2, multiplier), 300) * 1000;
}

export function memoryCheckRateLimit(
  key: string,
): { allowed: false; waitMs: number } | { allowed: true } {
  const state = attempts.get(key);
  if (!state) return { allowed: true };

  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    return { allowed: false, waitMs: state.lockedUntil - Date.now() };
  }

  // Lockout expired — allow retry, keep the count
  return { allowed: true };
}

export function memoryRecordFailedAttempt(key: string): { locked: boolean; waitMs: number } {
  const state = attempts.get(key) ?? { count: 0, lockedUntil: null, lockoutMultiplier: 0 };
  state.count += 1;

  if (state.count >= 5) {
    const duration = getLockoutDuration(state.lockoutMultiplier);
    state.lockedUntil = Date.now() + duration;
    state.lockoutMultiplier += 1;
    attempts.set(key, state);
    return { locked: true, waitMs: duration };
  }

  attempts.set(key, state);
  return { locked: false, waitMs: 0 };
}

export function memoryResetAttempts(key: string): void {
  attempts.delete(key);
}

// ---------- In-memory fixed-window throttle (fallback layer) ----------
//
// Independent from the PIN lockout logic above. Used by public,
// unauthenticated server actions (e.g. customer self-order, spec §12
// exception) to cap abuse from a single source IP.

interface ThrottleState {
  count: number;
  windowStart: number;
}

const throttleMap = new Map<string, ThrottleState>();

/**
 * Fixed-window throttle.  Records an attempt and returns `allowed`,
 * or — once `max` attempts have been made in the current window —
 * returns `retryAfterMs` (ms until the window rolls over and the
 * counter resets).  Opening a new window starts a fresh count.
 */
export function memoryCheckThrottle(
  key: string,
  opts: ThrottleOptions,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  const state = throttleMap.get(key);
  if (!state || now - state.windowStart > opts.windowMs) {
    throttleMap.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  if (state.count >= opts.max) {
    return { allowed: false, retryAfterMs: state.windowStart + opts.windowMs - now };
  }
  state.count += 1;
  return { allowed: true };
}

/** Remove a throttle key (e.g. after a verified legitimate signal). */
export function memoryResetThrottle(key: string): void {
  throttleMap.delete(key);
}

/**
 * Periodically clean up stale fallback entries (older than 30 minutes).
 * Runs every 5 minutes. Durable rows are purged separately (opportunistically,
 * from checkThrottle).
 */
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const cutoff = Date.now() - 30 * 60 * 1000;
      for (const [key, state] of attempts) {
        if (state.lockedUntil && state.lockedUntil < cutoff) {
          attempts.delete(key);
        }
      }
      for (const [key, state] of throttleMap) {
        if (Date.now() - state.windowStart > 30 * 60 * 1000) {
          throttleMap.delete(key);
        }
      }
    },
    5 * 60 * 1000,
  );
}

// ---------- Public API: durable-first, memory fallback ----------
//
// All functions are async — call sites must await. When the durable store
// throws, we log once and fall through to the in-memory layer so a DB
// blip degrades to the old single-instance caps instead of blocking all
// traffic (fail-open, availability over strictness — the documented
// trade-off; see KNOWN_ISSUES).

const durableConfigured = () => Boolean(process.env.DATABASE_URL);

function durableFailed(op: string, err: unknown): void {
  // Single-line, no PII: the key itself may contain an IP address.
  console.warn(`[rate-limit] durable store unavailable for ${op}, falling back to memory`, err);
}

/** Throttle once per ~50 calls opportunistically prunes expired rows. */
async function maybePurge(): Promise<void> {
  if (Math.random() < 0.02) {
    try {
      await durablePurgeExpired();
    } catch {
      // Housekeeping only — swallow.
    }
  }
}

export async function checkRateLimit(
  key: string,
): Promise<{ allowed: false; waitMs: number } | { allowed: true }> {
  if (durableConfigured()) {
    try {
      return await durableCheckRateLimit(key);
    } catch (err) {
      durableFailed("checkRateLimit", err);
    }
  }
  return memoryCheckRateLimit(key);
}

export async function recordFailedAttempt(
  key: string,
): Promise<{ locked: boolean; waitMs: number }> {
  if (durableConfigured()) {
    try {
      return await durableRecordFailedAttempt(key);
    } catch (err) {
      durableFailed("recordFailedAttempt", err);
    }
  }
  return memoryRecordFailedAttempt(key);
}

export async function resetAttempts(key: string): Promise<void> {
  if (durableConfigured()) {
    try {
      await durableReset(key);
    } catch (err) {
      durableFailed("resetAttempts", err);
    }
  }
  memoryResetAttempts(key);
}

export async function checkThrottle(
  key: string,
  opts: ThrottleOptions,
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  if (durableConfigured()) {
    try {
      const result = await durableCheckThrottle(key, opts);
      void maybePurge();
      return result;
    } catch (err) {
      durableFailed("checkThrottle", err);
    }
  }
  return memoryCheckThrottle(key, opts);
}

export async function resetThrottle(key: string): Promise<void> {
  if (durableConfigured()) {
    try {
      await durableReset(key);
    } catch (err) {
      durableFailed("resetThrottle", err);
    }
  }
  memoryResetThrottle(key);
}
