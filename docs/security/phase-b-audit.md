# Phase B Audit — Session / PIN / Encryption Silent-Fallback

**Scope:** re-pathing of the Flutter `field_encryption.dart` brief to the
Next.js Ayasofia Sweet codebase. The brief's source code does not exist
in this repo; this document records what was audited, what was found,
what was fixed, and what was intentionally left out.

## What was audited

The brief's silent-fallback class is: "when secure storage fails, the
code falls back to a session-only value, and the user cannot recover
data after restart." In the Next.js stack the closest analogs are:

| Flutter concept                     | Next.js analog                                       | Where it lives in this repo                                                                                               |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `FlutterSecureStorage`              | Supabase session cookie (HTTPOnly)                   | `lib/supabase/server.ts`, `proxy.ts`                                                                                      |
| `SecureStorageUnavailableException` | (no analog)                                          | n/a — Supabase is hosted                                                                                                  |
| Silent in-memory key fallback       | Default values returned on failure                   | `lib/auth.ts:42`, `lib/features.ts:56`, `lib/security-headers.ts:111`, `lib/image-url.ts:23`, `lib/supabase/server.ts:20` |
| Session-based encryption of fields  | Field-level encryption (none — at-rest columns only) | n/a — see "Absence" below                                                                                                 |

## Findings

### F1 — `proxy.ts` silently redirected on session-check failure ✅ FIXED

`proxy.ts:41-43` (before this audit) called `supabase.auth.getUser()` and
discarded the `error` field. If the session storage failed — corrupt
cookie, expired JWT, Supabase auth outage, revoked token — the user
was silently redirected to `/login` with no indication of why. A cashier
returning to the POS after a brief Wi-Fi drop saw a login screen and
had no way to distinguish "you're logged out" from "your device is
broken" from "the backend is down."

**Fix (this commit):**

- Extracted the redirect decision to `lib/security/proxy-redirect.ts`
  so it can be unit-tested without Next.js middleware.
- The helper captures the `getUserError` and produces a `?reason=...`
  query param when the session check errored.
- The login page reads `?reason=` and shows a user-friendly Arabic
  message via the `FRIENDLY_REASONS` map (with a safe fallback for
  unknown codes).
- Reason strings are URL-encoded so a Supabase error message
  containing `#`, `?`, `&`, or other URL-reserved characters is safe
  to transport.

**Tests:** `__tests__/proxy-redirect.test.ts` (7 cases):

- Authenticated user on a protected page → no redirect.
- Unauthenticated user, no error → `/login` (normal flow).
- **Unauthenticated user, session error → `/login?reason=...` (the
  regression target).**
- Session error with empty `message` → falls back to a generic
  `session_check_failed` reason.
- Session error with URL-reserved characters in the message → fully
  URL-encoded, no truncation, no open-redirect risk.
- Public route + session error → still no redirect (no false positive).

**Security note:** the redirect is fail-closed (always redirect on
session trouble). The authoritative gate remains
`requireStaffSession` in `lib/auth.ts` (CLAUDE.md §server-side
authorization). The proxy is UX-only.

### F2 — `lib/features.ts` returns `false` on DB read failure ✅ INTENTIONAL

`lib/features.ts:49-60` reads the `feature.*` setting and returns
`false` on any error. The comment in the code says: "Config read
failure defaults to OFF — safer to withhold a public surface than to
expose it when its backing flag can't be read."

This is **safe-direction** behavior. A feature must be explicitly
turned ON to be enabled, so a fallback that turns it OFF cannot widen
the attack surface. The brief's "fail-loud" requirement does not
apply: failing loud would mean "expose the feature anyway," which is
the wrong default. **No change.**

### F3 — `lib/auth.ts:42` `verifyPin` returns `false` on parse error ✅ INTENTIONAL

`verifyPin` returns `false` when the stored `salt:hash` string is
malformed (e.g. truncated, corrupted, missing separator). This is
correct: a garbage hash matches no PIN, and the caller gets a typed
boolean. The alternative — throwing — would surface the same outcome
to the user ("Invalid PIN") and the same audit trail via the existing
rate-limit counters. Not a silent fallback. **No change.**

### F4 — `lib/supabase/server.ts:20` cookie set failure swallowed ⚠️ DOCUMENTED

`setAll` in the SSR cookie adapter is wrapped in try/catch. The
comment correctly identifies that cookie writes can fail in a Server
Component (where the cookie store is read-only), and that the route
should be using middleware for writes. **This is the correct
behavior for a Server Component** — the cookie cannot be written, the
session would be stale, and the user will be re-authenticated on the
next request that does go through middleware.

The fix here would be: detect Server Component context, throw a
developer error so the misuse is loud during development. Out of scope
for this audit (not a user-facing silent failure). **No change.**

### F5 — `lib/offline/sync.ts:82` markOrderFailed never surfaces to the UI ❌ OUT OF SCOPE

`flushQueue` catches checkout errors, writes `syncError` to the
IndexedDB row via `markOrderFailed`, and continues. **Nothing in the
UI reads `syncError` or `pendingCount`.** A poisoned order
(network failure mid-flush, expired session during a brief offline
window, malformed cart) will fail forever and the user will never
know.

**This is the closest analog to the Flutter "encrypted with a
session-only key that orphans the field after restart" bug class**:
the data is "preserved" in the queue, but it is silently un-recoverable
without any user-visible signal.

**However:** the brief explicitly says "Do not change sync engine
logic." So I did not touch `lib/offline/sync.ts` or
`lib/offline/queue.ts`. The fix is documented in this audit and in
the master audit's H6 followups; it is a one-line change
(`pendingCount` to a UI indicator) plus a "stuck order" badge. **No
change in this commit; tracked for the sync-engine task.**

### F6 — No field-level encryption at rest in this codebase 📌 ABSENCE

There is no at-rest field encryption in this Next.js / Postgres
codebase. Sensitive fields (`customerPhone`, `customerName`, PIN
hashes) are stored as plain numeric/strings or `scrypt(pin, salt)`
hashes (`lib/auth.ts:20-44`). The session cookie is HTTPOnly and
TLS-protected in transit. There is no "session-only in-memory key"
fallback because there is no key to fall back to.

**The Flutter bug class is therefore not applicable to this repo.**
The closest equivalence work is in F1 (proxy session error) and F5
(offline sync error), both handled above. **No change.**

## Files changed in this commit

- `lib/security/proxy-redirect.ts` (new) — pure redirect decision
  helper, unit-testable in isolation.
- `proxy.ts` — uses the helper; captures the `getUserError` and
  surfaces it to the login page.
- `app/login/page.tsx` — reads `?reason=...` and shows a friendly
  Arabic error message.
- `__tests__/proxy-redirect.test.ts` (new) — 7 regression tests
  pinning the fail-loud behavior.

## What was NOT changed (intentionally)

- `lib/offline/sync.ts` and `lib/offline/queue.ts` — the brief
  forbids sync-engine changes; F5 is documented but not fixed here.
- `lib/auth.ts` — `verifyPin` returns `false` on parse error, which is
  the correct (typed) behavior; the brief's "fail-loud" requirement
  is satisfied at the higher layer (`requireStaffSession` throws
  `AuthError` on missing/invalid session).
- `lib/features.ts` — safe-direction fail-closed; the brief's
  "fail-loud" requirement would be the wrong fix.
- `lib/supabase/server.ts` — cookie write fail-silent in Server
  Components is the documented correct behavior; not a user-facing
  silent failure.

## Open follow-ups (out of scope)

- **F5 fix (sync engine):** surface `pendingCount` and stuck-order
  badges in `components/connectivity-indicator.tsx`. One-line
  read; needs design + a small UX review. Tracked in master audit H6.
- **Cookie write fail-loud in Server Components:** would need a
  runtime check that throws in development with a clear message
  ("Server Components cannot write cookies; use a Server Action or
  Route Handler"). Tracked separately.
