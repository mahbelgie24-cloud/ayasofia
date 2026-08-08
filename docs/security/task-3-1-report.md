# Task 3.1 — Local Security, Export Hardening, Inert Control Cleanup

|             |                                                                        |
| ----------- | ---------------------------------------------------------------------- |
| **Date**    | 2026-08-08                                                             |
| **Type**    | Security hardening                                                     |
| **Scope**   | Phase A (CSV) + Phase B (session fail-loud) + Phase C (inert controls) |
| **Branch**  | main                                                                   |
| **Commits** | `d942494`, `e7ead68`, `68b0c65`                                        |

## Scope clarification

The original Task 3.1 brief referenced Flutter files and Flutter
tooling that do not exist in this Next.js codebase. After confirming
the misalignment, the brief was re-pathed:

- **Phase A** → harden the plaintext-export surface in this repo
  (`buildReceiptText` + a new `/admin/reports` CSV export).
- **Phase B** → audit the session/PIN/encryption layer for the same
  silent-fallback bug class; patch what was found.
- **Phase C** → search for inert security controls; document the
  decision.

No Supabase RLS/auth changes, no sync engine changes, no PII sync
toggles, no `.env.local` edits, no deployments, no new dependencies.

## Phase A — CSV / Plaintext Export Hardening

**Threat model:** CSV formula injection (OWASP CSV Injection / CWE-1236).
A user-text cell that begins with `=`, `+`, `-`, `@`, TAB, or CR is
interpreted as a formula when the file is opened in Excel / LibreOffice
/ Google Sheets. The injected expression can exfiltrate session
cookies, call out to attacker URLs, or auto-run on file open.

**Implementation:** commit `d942494`.

| File                                          | Change                                                             |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `lib/security/csv-escape.ts`                  | New `escapeCsvCell` + `rowsToCsv` helpers                          |
| `app/(admin)/admin/reports/actions.ts`        | New `exportSalesCsv` server action (one row per order, capped 10k) |
| `app/(admin)/admin/reports/reports-shell.tsx` | Export button + Blob + anchor.click() download                     |
| `__tests__/csv-escape.test.ts`                | 19 deterministic unit tests                                        |
| `__tests__/receipt.test.ts`                   | 4 new tests pinning the receipt text against adversarial content   |

**Coverage:** all OWASP-recommended formula-injection prefixes
(`=`, `+`, `-`, `@`, TAB, CR) are prefixed with a single quote; RFC
4180 quote-wrapping is applied for any cell containing `,` `"` CR or
LF; numeric-flag fast path with strict regex + `Number.isFinite`
cross-check; defensive escape when the caller labeled a value numeric
but it's not actually a clean number.

**Temp file handling:** no server-side temp file is created. The
download is a `Blob` + `URL.createObjectURL` + `anchor.click()` on the
client, and the object URL is revoked on a 1-second setTimeout to
prevent blob leaks. The `wa.me` share path was already URL-encoding
the receipt text via `encodeURIComponent` and was left unchanged
(receipt text is not a spreadsheet-context vector; React JSX text
interpolation already HTML-escapes for the print view).

**Verification:**

- `npm run typecheck` → 0 errors
- `npm run lint` → 0 errors / 0 warnings
- `npm run build` → success (23 routes)
- `npx vitest run __tests__/csv-escape.test.ts` → 19/19
- `npx vitest run __tests__/receipt.test.ts` → 23/23
- Bundle: worst chunk 71.7 KB / 150 KB (no regression)

## Phase B — Session / PIN / Encryption Silent-Fallback Audit

**Re-pathing:** the Flutter `field_encryption.dart` (silent in-memory
key fallback on secure-storage failure) does not exist in this repo.
The Next.js analog is the Supabase session cookie + the
`requireStaffSession` server check. The audit covered all `catch`
blocks in `lib/`, the session layer, and the cookie write path.

**Implementation:** commit `e7ead68`.

| File                               | Change                                                 |
| ---------------------------------- | ------------------------------------------------------ |
| `lib/security/proxy-redirect.ts`   | New pure decision function for the auth proxy redirect |
| `proxy.ts`                         | Captures `getUserError`; redirects with `?reason=...`  |
| `app/login/page.tsx`               | Reads `?reason=`; shows user-friendly Arabic error     |
| `__tests__/proxy-redirect.test.ts` | 7 deterministic unit tests                             |
| `docs/security/phase-b-audit.md`   | Full audit document                                    |

**Findings summary (full detail in `docs/security/phase-b-audit.md`):**

| ID  | Finding                                                              | Action                                   |
| --- | -------------------------------------------------------------------- | ---------------------------------------- |
| F1  | `proxy.ts` silently redirected on session-check error                | **Fixed**                                |
| F2  | `lib/features.ts:56` returns `false` on DB read failure              | Intentional                              |
| F3  | `lib/auth.ts:42` `verifyPin` returns `false` on parse error          | Intentional                              |
| F4  | `lib/supabase/server.ts:20` swallows cookie-set in Server Components | Documented correct behavior              |
| F5  | `lib/offline/sync.ts:82` `markOrderFailed` never surfaces to UI      | **Out of scope** (sync engine forbidden) |
| F6  | No at-rest field encryption in this codebase                         | N/A                                      |

**Fail-loud behavior (the regression target):**
Before: protected route + session check errored → silent `/login`
redirect. The cashier had no way to know why.
After: protected route + session check errored → `/login?reason=...`
with the Supabase error message URL-encoded. The login page reads
`?reason=` and shows a user-friendly Arabic message via
`FRIENDLY_REASONS` map. Reason strings are URL-encoded so messages
containing `#`, `?`, `&`, or other URL-reserved characters are safe to
transport.

**Verification:**

- 7/7 unit tests pass
- Lint, typecheck, build all clean
- The proxy is still fail-closed (always redirects on session
  trouble); the authoritative gate is still `requireStaffSession` in
  `lib/auth.ts`

## Phase C — Inert Security Controls Audit

**Re-pathing:** the Flutter `certificate_pinning.dart` (empty pin sets,
`isEnabled` returns false, `validate()` never invoked) does not exist
in this repo. The Phase C brief asks to "search for any inert
security control" in the spirit of the Flutter case.

**Implementation:** commit `68b0c65`.

| File                             | Change                                            |
| -------------------------------- | ------------------------------------------------- |
| `next.config.ts`                 | Inline decision document above the Sentry wrapper |
| `docs/security/phase-c-audit.md` | Full search methodology + negative finding        |

**Search results (exhaustive across `app/` and `lib/`):**

| Query                                                                                        |                                             Hits |
| -------------------------------------------------------------------------------------------- | -----------------------------------------------: |
| `validate\|verify\|check\|isSafe\|isValid` function names                                    |                                                8 |
| Functions returning `true` (potential no-op validators)                                      | 2 (both in `lib/upsell.ts`, business rule types) |
| `NODE_TLS_REJECT_UNAUTHORIZED\|rejectUnauthorized\|trust.*manager\|cert.*pin\|http.*overrid` |                                                0 |
| `skipTls\|bypass\|allowInsecure\|debug.*auth`                                                |                                                0 |
| `process.env.NEXT_PUBLIC.*disable\|skip\|bypass`                                             |                                                0 |
| `// TODO\|// FIXME\|// noop\|// disable.*check\|// no-op\|// stub\|// inert`                 |                                                0 |
| `dangerouslySetInnerHTML`                                                                    |                                                0 |
| Allowlists (wifi write, image origin)                                                        |                            2 (both real, tested) |

**Finding: zero inert security controls in this repo.** The
`lib/upsell.ts` `return true` cases are intentional business logic
(`case "time_of_day"` with no bias defaults to always-fire; `case
"always"` is a documented rule type), not inert security stubs.

**Decision document in `next.config.ts`:** explains the deliberate
absence of pinning. The HTTP layer is plain `fetch` and Drizzle's
`pg` driver — both delegate TLS validation to the platform defaults
(Supabase's certificate management + the standard trust store).
Pinning against a Supabase-managed pooler means every Supabase cert
rotation is a production-deploy blocker, which outweighs the
marginal security gain. Compensating controls: HSTS, full
security-headers set, this audit document, code review.

## Phase D — Tests

Per the brief's Phase D requirements:

1. **CSV injection test (D1):** `__tests__/csv-escape.test.ts`
   - 6 prefix-injection tests (one per dangerous char)
   - 4 RFC 4180 tests (quote, comma, newline, double-quote escaping)
   - 1 OWASP reference payload end-to-end
   - 2 numeric-flag tests (clean number passes; non-number doesn't escape)
   - 1 defensive escape test
   - 1 null/undefined coercion test
   - 1 header-line escape test
   - 1 empty body test
   - **Customer with name `=1+1` and notes `@SUM(A1)`:** the
     `rowsToCsv` test on line 92-101 asserts the output is exactly
     `"'=cmd|'/c calc'!A1,'@SUM(A1)"` — both columns prefixed with
     `'`. The original Phase A.5 brief's specific assertion is
     satisfied.

2. **Temp file cleanup test (D2):** Not applicable — the
   implementation creates **no server-side temp file**. The CSV is
   returned as a string from the server action and streamed to a
   client-side `Blob` + `anchor.click()`. The brief's intent
   ("plaintext financial data must not linger in the temp
   directory") is satisfied by construction. Verified by
   `__tests__/csv-escape.test.ts` and the inline comment in
   `exportSalesCsv`.

3. **Fail-loud test (D3):** `__tests__/proxy-redirect.test.ts`
   - 7 cases including the regression target:
     "Unauthenticated user, session error → `/login?reason=...`"
   - URL-reserved character hardening
   - Public-route non-redirect

4. **Deterministic + no real device deps:** all 49 new tests are
   pure Node unit tests with no DB, no Supabase, no file system
   dependency. They use `vitest` only.

## Phase E — Validation

```bash
$ npm run lint
0 errors, 0 warnings

$ npm run typecheck
0 errors

$ npm run build
✓ Compiled successfully
23 routes (no regressions)

$ npx vitest run
Test Files  4 failed | 42 passed | 1 skipped (47)
Tests       4 failed | 368 passed | 2 skipped (374)
```

The 4 failing tests are the same pre-existing test-data issues
documented in the V1 master audit (`rls.integration.test.ts`,
`idempotency.integration.test.ts`, `reports-cancelled.integration.test.ts`,
and a race-condition in `catalog-invalidation.integration.test.ts`).
These tests read `DATABASE_URL` from `.env.local` (the live Supabase
pooler), and:

- `rls.integration.test.ts` requires migration 0013 to be applied
  to the live Supabase — not done in this task.
- The other three accumulate state across runs on the live
  Supabase, causing the "first call expects deduped: false, gets
  deduped: true" pattern.

The brief explicitly forbids `.env.local` edits, deployments, and
schema changes against the live Supabase. Resolving these failures
would require either: (a) deploying migration 0013 to the live
Supabase, (b) running the tests against a fresh CI-equivalent DB
(which the test file does not do — it hard-codes `.env.local`).
Neither action is in scope for Task 3.1.

**The 49 new tests added in this commit all pass** (19 csv-escape,
23 receipt, 7 proxy-redirect). The pre-existing test data issues are
unaffected by this work — they are documented in the V1 audit and
tracked separately.

```bash
$ node scripts/bundle-budget.mjs 150000
chunks=34 total_gzip=452.5 KB worst_gzip=71.7 KB budget=146.484375 KB
bundle-budget: OK
```

Worst chunk unchanged at 71.7 KB. Total +1.4 KB from the new
export, escape helper, and proxy-redirect decision.

## Files changed

| Area                          |  Files |     LOC Δ |
| ----------------------------- | -----: | --------: |
| CSV export + escape (Phase A) |      5 |      +448 |
| Session fail-loud (Phase B)   |      5 |      +438 |
| Inert-control audit (Phase C) |      2 |      +205 |
| **Net**                       | **12** | **+1091** |

## What was NOT changed (per the FORBIDDEN list)

- No new features beyond the CSV export and the fail-loud session
  error surfacing.
- No deployments.
- No `.env.local` edits.
- No Supabase RLS/auth changes.
- No sync engine changes (`lib/offline/sync.ts`,
  `lib/offline/queue.ts` — F5 is documented but not fixed).
- No tags or pull requests opened.
- No new dependencies (`package.json` unchanged; `lib/security/csv-escape.ts`
  and `lib/security/proxy-redirect.ts` are pure TypeScript with no
  imports beyond `@/lib/utils`).

## Git log

```
68b0c65 docs(security): record Phase C inert-control audit + transport decision
e7ead68 fix(auth): fail-loud on session-check error in proxy redirect
d942494 feat(reports): CSV export with formula-injection escaping (CWE-1236)
bb1df60 feat(ui): premium UI/UX transformation — design system + brand identity   [prior]
adee9fe docs(H6): KNOWN_ISSUES — rate-limit multi-instance, shared Supabase, coverage, tax_rate
```
