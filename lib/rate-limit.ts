/**
 * Simple in-memory rate limiter for PIN login attempts.
 *
 * Tracks failed attempts per anonymous user ID. On Vercel serverless
 * deployments, state resets on cold starts — acceptable for a single-
 * branch shop; deployment to a long-running Node process (the typical
 * Next.js server) gives full persistence.
 *
 * Policy:
 *   - Max 5 consecutive failures per user
 *   - 60s lockout on 5th failure
 *   - Doubling lockout on repeated lockouts (60s, 120s, 240s, cap 300s)
 *   - Counter resets on successful authentication
 */

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

export function checkRateLimit(
  key: string,
): { allowed: false; waitMs: number } | { allowed: true } {
  const state = attempts.get(key);
  if (!state) return { allowed: true };

  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    return { allowed: false, waitMs: state.lockedUntil - Date.now() };
  }

  // Lockout expired — allow retry, keep the count
  if (state.lockedUntil && Date.now() >= state.lockedUntil) {
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedAttempt(key: string): { locked: boolean; waitMs: number } {
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

export function resetAttempts(key: string): void {
  attempts.delete(key);
}

// ---------- Generic fixed-window throttle (per-key) ----------
//
// Independent from the PIN lockout logic above.  Used by public,
// unauthenticated server actions (e.g. customer self-order, spec §12
// exception) to cap abuse from a single source IP.
//
// Serverless caveat: state is in-memory and resets on cold starts, so
// a determined attacker fanning requests across many instances can
// exceed the cap.  This is the P0 mitigation (WEB-SEC-001); a durable
// Upstash/DB-backed limiter is tracked as WEB-SEC-004.

interface ThrottleState {
  count: number;
  windowStart: number;
}

export interface ThrottleOptions {
  max: number;
  windowMs: number;
}

const throttleMap = new Map<string, ThrottleState>();

/**
 * Fixed-window throttle.  Records an attempt and returns `allowed`,
 * or — once `max` attempts have been made in the current window —
 * returns `retryAfterMs` (ms until the window rolls over and the
 * counter resets).  Opening a new window starts a fresh count.
 */
export function checkThrottle(
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
export function resetThrottle(key: string): void {
  throttleMap.delete(key);
}

/**
 * Periodically clean up stale entries (older than 30 minutes).
 * Runs every 5 minutes.
 */
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const cutoff = Date.now() - 30 * 60 * 1000;
      // We can't easily track last-update time with this simple map,
      // so clean entries where lockout has long expired
      for (const [key, state] of attempts) {
        if (state.lockedUntil && state.lockedUntil < cutoff) {
          attempts.delete(key);
        }
      }
      // Prune throttle windows that have long since rolled over.
      for (const [key, state] of throttleMap) {
        if (Date.now() - state.windowStart > 30 * 60 * 1000) {
          throttleMap.delete(key);
        }
      }
    },
    5 * 60 * 1000,
  );
}
