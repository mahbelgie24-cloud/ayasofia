# Phase C Audit — Inert Security Controls Search

**Scope:** re-pathing of the Flutter `certificate_pinning.dart` /
`pinning_http_overrides.dart` brief to the Next.js Ayasofia Sweet
codebase. The Flutter files do not exist in this repo; the brief
asks me to "search for any inert security control (e.g. a no-op
validator, a trust manager that always returns true, a debug
kill-switch that disables TLS checks, a never-called interceptor)".

## What was searched

The Flutter pinning pattern was: empty pin sets, `isEnabled`
returns false, `validate()` never invoked, `HttpOverrides.global`
never applied. In a Next.js stack the equivalents are:

| Flutter pattern                           | Next.js analog                                     | Where it would live |
| ----------------------------------------- | -------------------------------------------------- | ------------------- |
| `HttpOverrides.global`                    | `next.config.ts` `headers()` / custom fetch client | `next.config.ts`    |
| `validate()` never called                 | Security-shaped function whose body is dead        | `lib/security-*`    |
| Always-true trust manager                 | Always-true validator / always-pass allowlist      | `lib/**`            |
| Empty pin set / `isEnabled` returns false | Empty allowlist + env-gated kill-switch            | `lib/**`            |
| Debug kill-switch (e.g. `kDebugMode`)     | Env flag that disables a check                     | `lib/**`, `app/**`  |
| `REJECT_UNAUTHORIZED=0`                   | `process.env.NODE_TLS_REJECT_UNAUTHORIZED=0`       | anywhere            |

## Findings

### Search results

I ran the following queries against the entire `app/` and `lib/`
trees:

```
grep "validate|verify|check|isSafe|isValid"  → 8 matches
grep "  return true;"                          → 2 matches (both in lib/upsell.ts)
grep "NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized|trust.*manager|cert.*pin|http.*overrid"
                                                → 0 matches
grep "skipTls|bypass|allowInsecure|debug.*auth"
                                                → 0 matches (only prose comments)
grep "process.env.NEXT_PUBLIC.*disable|skip|bypass|allow"
                                                → 0 matches
grep "// TODO|// FIXME|// noop|// disable.*check|// no-op|// stub|// inert"
                                                → 0 matches
grep "dangerouslySetInnerHTML"                → 0 matches (verified earlier)
grep "ALLOW.*LIST|allowlist|whitelist|trustedOrigins"
                                                → 2 matches, both real (wifi write allowlist, image origin allowlist)
```

### F1 — `lib/upsell.ts:96,99` returns `true` for `time_of_day` and `always` rule types ✅ INTENTIONAL

```ts
case "time_of_day": {
  const bias = t.bias as "hot" | "cold" | undefined;
  if (bias === "hot") return ctx.hour >= 11 && ctx.hour <= 19;
  if (bias === "cold") return ctx.hour < 11 || ctx.hour > 19;
  return true; // (line 96) no bias → always fire
}
case "always":
  return true; // (line 99) by-design: the "always" rule type
```

These are **business logic**, not security controls. The `case
"always"` is a documented rule type for "fire this upsell on every
cart." The `case "time_of_day"` fallback for missing bias is
intentional (treat as "no time restriction"). Both are real
evaluation logic, not inert stubs. **No change.**

### F2 — `next.config.ts` transport security posture ✅ DOCUMENTED INLINE

The Next.js `headers()` callback applies `securityHeaders()` to every
route. The returned headers include HSTS, CSP, X-Frame-Options,
Referrer-Policy, Permissions-Policy, and X-Content-Type-Options. This
is real, runs in every request, and is test-covered by
`__tests__/security-headers.test.ts`. **Not inert.**

There is no certificate pinning, no `HttpOverrides` global
overrides, no `next.config.ts` `experimental.https` or transport
disabler, no `process.env.NODE_TLS_REJECT_UNAUTHORIZED` reference.
The HTTP layer is plain `fetch` (Next.js runtime) and Drizzle's `pg`
driver (server-side). Both delegate TLS validation to the platform
defaults (Node.js + the system trust store).

**This commit adds an inline decision document in `next.config.ts`**
explaining the deliberate absence of pinning — see the
"Transport security decision" comment block. The comment covers
the why (operational cost vs marginal security gain), the what
(relying on Supabase's certificate management + the standard trust
store), and the compensating controls (HSTS, security headers,
secure SDLC, this audit document).

### F3 — `lib/image-url.ts:14` and `app/(admin)/admin/wifi/actions.ts:27` allowlists ✅ REAL

Both are real, tight allowlists with documented test cases
(`__tests__/image-url.test.ts` and the wifi admin integration tests).
Neither is empty, neither is bypassed, neither has an `isEnabled`
flag that returns false. **Not inert.**

### F4 — `lib/auth.ts:33,43` returns `false` for malformed input ✅ INTENTIONAL

```ts
if (!saltHex || !hashHex) return false;  // line 33
// ...
} catch {
  return false;  // line 43
}
```

These are fail-closed PIN verification responses, not inert
checks. A malformed hash matches no PIN. The caller gets a typed
boolean and the rate-limit counters increment correctly. **Not
inert; not a debug kill-switch.**

### F5 — `lib/features.ts:56` returns `false` on DB read failure ✅ SAFE-DIRECTION

(See Phase B audit F2 — same finding, restated here for
completeness.) The feature flag defaults to OFF when the backing
config cannot be read. Safe-direction fail-closed, not a security
control. **No change.**

### F6 — `lib/supabase/server.ts:20` swallows cookie-set error in Server Components ✅ DOCUMENTED CORRECT BEHAVIOR

```ts
setAll(cookiesToSet, headers) {
  try {
    for (const { name, value, options } of cookiesToSet) {
      cookieStore.set(name, value, options);
    }
  } catch {
    // Cookie set can fail in a Server Component — that route
    // should be using Middleware instead.
  }
}
```

The comment correctly identifies the cause (Server Components cannot
write cookies) and the correct mitigation (use middleware or a
Server Action). The `@supabase/ssr` library itself wraps `setAll`
in a try/catch because Server Component cookie writes throw. The
comment is documented; the behavior is correct. **Not inert.**

## Decision document

This commit adds an inline decision block to `next.config.ts`
above the Sentry wrapper. The block:

1. States the negative finding (no pinning was ever implemented;
   no inert TLS-bypass exists in the repo).
2. Explains the why (operational risk of pinning against a
   Supabase-managed pooler; reliance on Supabase's own
   certificate management).
3. Lists the compensating controls (HSTS, security headers, this
   audit document, code review).
4. Refers to this audit document for the full search methodology.

## Files changed in this commit

- `next.config.ts` — added inline decision document above the
  Sentry wrapper; no behavior change.
- `docs/security/phase-c-audit.md` (this file) — records the
  search and the negative finding.

## What was NOT changed (intentionally)

- `next.config.ts` `headers()` — already applies the full
  security-headers set; no change.
- `lib/security-headers.ts` — already enforces prod-only HSTS
  preload, dev-mode HMR exceptions documented in the CSP comment;
  no change.
- `lib/image-url.ts` and `app/(admin)/admin/wifi/actions.ts` — real
  allowlists, no change.
- `lib/upsell.ts` — business-logic `return true` is correct
  rule-type semantics, not a security control, no change.
- `lib/auth.ts` — `verifyPin` returns `false` on parse error is
  fail-closed and the caller reacts correctly, no change.

## Open follow-ups (out of scope)

- If Supabase moves off its managed certs to a private CA, the
  `lib/db/index.ts` pg driver would need a custom `ssl: { ca: ... }`
  option. Not currently needed.
- If the codebase ever ships a separate mobile app talking to the
  same API, real SPKI pinning becomes appropriate there. Not
  relevant for the web app.
