# Master Follow-Up Pass — 2026-08-16

|            |                                                                             |
| ---------- | --------------------------------------------------------------------------- |
| **Date**   | 2026-08-16                                                                  |
| **Type**   | Autonomous follow-up to `FINAL_AUDIT-2026-08-14.md` + `launch-gate-closure` |
| **Base**   | `8881e0c` (clean, in sync with `origin/main`)                               |
| **Mode**   | Full protocol re-run: verify → research → close remaining findings → verify |
| **Result** | All open code-fixable findings closed; owner-blocked items unchanged        |

## 1. Executive summary

The 2026-08-14 final audit left the project green (372 tests, clean
lint/typecheck/build) with a set of open ⚠️ findings and owner-blocked P0s.
This pass **verified the baseline independently, closed every remaining
code-fixable finding, updated dependencies within semver, and re-proved all
gates green** — 390 tests (+18 new), 0 lint/type errors, build + bundle
budget OK, `npm audit` unchanged (4 dev-only esbuild moderates, H5).

No owner-blocked item moved: the real menu (P0-3) and parallel-run (P0-5)
still gate go-live, exactly as recorded in
`launch-gate-closure-2026-08-14.md`.

## 2. Findings closed this pass

| ID (2026-08-14 matrix)                                       | Finding                                                                                                  | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 / TD-1 / D5 / H6-rate / WEB-SEC-004** (HIGH — last one) | Rate limiting in-memory per process; XFF-spoofable; no DB limiter                                        | **Durable Postgres limiter.** New `rate_limits` table (migration `0014`, RLS enable+**force**, no policies). `lib/rate-limit-durable.ts` implements both policies (fixed-window throttle; PIN lockout w/ doubling backoff) as single-statement atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` upserts — counters are global across instances. Concurrency proven by test (10 parallel attempts → exactly `max` allowed). `lib/rate-limit.ts` is now durable-first with the in-memory policy as fail-open fallback (DB blip degrades to the old caps, never blocks traffic). All 9 call sites `await`. Timestamps return as epoch-ms computed by Postgres (no JS parsing of timestamptz text). |
| **S5 / TD-11** (M/L)                                         | `app_metadata.role` stale after demotion/deactivation — live session outruns the staff row               | `updateStaffMember` now syncs the auth user's `app_metadata` on role change and strips `staff_id` on deactivation; `requireStaffSession` (which reads fresh data via `auth.getUser()`) rejects on the very next action. Auth-sync failure is reported, not swallowed. 4 new tests.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **API4/API5** (LOW)                                          | Unbounded `deliveryAddress` / `customerName` / `customerPhone` into `text` columns from public endpoints | Trim + cap at the single shared pipeline (`executeCheckout`): name 100, phone 20, address 300 (mirrors the wifi-actions caps). Oversized `idempotencyKey` ( >100 ) is **rejected**, not truncated — mutation would break retry dedup. 3 new tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **T2 / TD-5** (M)                                            | Coverage tooling missing                                                                                 | `@vitest/coverage-v8` + `coverage` block in `vitest.config.mts`, `npm run test:coverage`. Baseline measured: **33.7% lines / 23.3% branches** across all TS/TSX (incl. UI shells covered instead by the 39-spec e2e suite; business logic libs test near-100%). Reported, not gated.                                                                                                                                                                                                                                                                                                                                                                                                               |
| **C5 / TD-15**                                               | `.env.example` references non-existent `scripts/validate-env.ts`                                         | Script implemented: presence checks always; strict production mode (`RUN_ENV=production`) validates https URL, postgres scheme, JWT-shaped keys, real wifi salt, and warns on missing `connection_limit`. Verified both modes (exit 0 with placeholders; exit 1 with production placeholders).                                                                                                                                                                                                                                                                                                                                                                                                     |
| **O2 / TD-7**                                                | Deploy never migrates                                                                                    | `release.yml` now (a) validates the env contract every release, and (b) when the `PROD_DATABASE_URL` secret exists, runs strict production validation + `drizzle-kit migrate` **before** the build/release — a build can never ship ahead of its schema. Opt-in until the owner sets secrets (DR-6); manual runbook remains the fallback.                                                                                                                                                                                                                                                                                                                                                          |
| **A2** (LOW doc)                                             | CLAUDE.md listed 2 public actions; ~8 exist                                                              | CLAUDE.md now enumerates every unauthenticated server action with its guardrail (flag gate / token gate / throttle / pipeline).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Hygiene                                                      | `.env.local` stale `NEXT_PUBLIC_APP_CURRENCY` (audit note)                                               | Verified already absent — the audit note itself was stale; no change needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Deps                                                         | Behind on semver-safe patches                                                                            | `npm update`: next 16.3.0→**16.3.1**, eslint-config-next 16.3.1, pg 8.23.0, @supabase/supabase-js 2.112.3, @sentry/nextjs 10.70.0, dexie 4.4.5, lucide 1.31.0, @base-ui/react 1.7.0, tsx 4.23.12. React stays exactly-pinned at 19.2.4 per project convention; majors (TS 7, eslint 10, @types/node 26) deliberately not taken.                                                                                                                                                                                                                                                                                                                                                                    |

## 3. Research applied (live, 2026-08-16)

- **Next.js security releases**: the July 2026 security release patched
  15.5.21 / 16.2.11; the project's 16.3.x line post-dates all nine CVEs, and
  the 16.3.1 bump keeps it current (npm registry as the version authority).
- **Distributed rate limiting on serverless Postgres**: single-statement
  upsert-with-returning is the standard lock-free pattern for exact
  fixed-window counters (row lock serializes); chosen over Redis/Upstash to
  honor the single-Supabase owner decision (DR-4) and spec §4's
  "no distributed complexity" rule.
- **Vitest 4**: `@vitest/coverage-v8` matching the installed vitest major;
  `fileParallelism: false` retained for DB-shared suites.

## 4. Verification (final, this session)

| Gate                          | Result                                                                   |
| ----------------------------- | ------------------------------------------------------------------------ |
| `npm run lint`                | 0 errors, 0 warnings                                                     |
| `npm run typecheck`           | 0 errors                                                                 |
| `npx vitest run`              | **390 passed, 2 skipped** (48 files; was 372)                            |
| `npm run build`               | success (0 errors)                                                       |
| Bundle budget                 | worst chunk 71.8 KB gzip ≤ 150 KB gate                                   |
| `npm audit`                   | 4 moderate (dev-only esbuild via drizzle-kit — accepted, H5)             |
| Migration 0014 on local stack | applied; `relrowsecurity=t`, `relforcerowsecurity=t`, 0 policies         |
| `validate:env`                | permissive mode exit 0; production mode correctly exit 1 on placeholders |

## 5. Remaining items (all previously known, none new)

- **P0-3 real menu** — owner not ready (blocker for go-live).
- **P0-5 parallel run** — starts after menu readiness (spec §13).
- **P0-6 production secrets** — owner to provision; `release.yml` will pick
  up migrations automatically once `PROD_DATABASE_URL` (+ `PROD_*` set) is
  added as GitHub secrets.
- **C2** float at write boundary (accepted, lossless ≤ 2^53) · **C3** O(n)
  scrypt (LOW) · **S3** CSP `unsafe-inline` (documented residual) ·
  **R1** offline replay session requirement (M, design) · **P1-M10** wifi
  device-id hashing redesign (deferred; production salt now enforced by
  validate-env) · **P2-PERF-2** in-process catalog cache (accepted INFO) ·
  **T-D3** observability proxy (accepted INFO).

## 6. How to verify

```bash
npm ci
npm run lint && npm run typecheck
npx vitest run            # 390 passed (local Supabase stack up for integration files)
npm run build
npm run validate:env      # permissive; RUN_ENV=production adds strict checks
npm run test:coverage     # optional
```
