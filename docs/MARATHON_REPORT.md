# Marathon Report — Trust Gate Completion + Quick Wins + Perf/Tests/Docs

Executed autonomously. One commit per task (conventional, `[T-id]`); every
commit kept `lint`, `typecheck`, and targeted tests green; each PHASE boundary
(+ the final run) was verified with the full suite + `npm run build`.

## Result table

| T-id  | Status | Commit         | Note                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | ------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-A2  | DONE   | `16e4bef`      | Retire `/order` → 308 to `/m/{slug}` (default_branch_slug setting → first branch alphabetically); keep token-gated `/order/status`; placeCustomerOrder=deprecated, `source=DIGITAL_MENU`; `ne(cancelled)` on getSalesSummary + getBestSellers (aligns getDashboardSummary.topSellers); backfill **skipped** — `source='POS' AND staff_id IS NULL` = **0 rows**; KNOWN_ISSUES + docs; 308-Location + cancelled-exclusion tests |
| T-A3  | DONE   | `8a053e2`      | `setTodaySuggestion` deactivate+insert wrapped in `db.transaction`; failure-injection test restores prior suggestion                                                                                                                                                                                                                                                                                                          |
| T-B1  | DONE   | `9f39990`      | `getOrderStatus`: UUID pre-validation + per-IP per-order throttle (90/60s); tests                                                                                                                                                                                                                                                                                                                                             |
| T-B2  | DONE   | `9f11ecc`      | Throttle `endWifiSession` (60/60s) + `getWifiSuggestion` (90/60s)                                                                                                                                                                                                                                                                                                                                                             |
| T-B3  | DONE   | (in `b53a63d`) | `endWifiSession` scopes to latest non-revoked session + sets `revokedAt`; integration test. _Committed alongside T-B4 (single `git add -A`)._                                                                                                                                                                                                                                                                                 |
| T-B4  | DONE   | `b53a63d`      | Index `wifi_sessions.authorized_at` (migration 0011)                                                                                                                                                                                                                                                                                                                                                                          |
| T-B5  | DONE   | `c907af9`      | `verifyStaffPin` derives target user from the **server session**, rejects forged client `anonUserId`                                                                                                                                                                                                                                                                                                                          |
| T-B6  | DONE   | `e9bc845`      | `product.imageUrl` origin allowlist (local + Supabase storage); tests                                                                                                                                                                                                                                                                                                                                                         |
| T-B7  | DONE   | `18ebdc8`      | `closeShift` sales-sum + close in one transaction                                                                                                                                                                                                                                                                                                                                                                             |
| T-B8  | DONE   | `e5a709d`      | Pass the checkout `tx` into `recalculateCartServerSide` (consistent pricing reads)                                                                                                                                                                                                                                                                                                                                            |
| T-B9  | DONE   | `d28815a`      | Dashboard `averageOrder` computed in minor units                                                                                                                                                                                                                                                                                                                                                                              |
| T-B10 | DONE   | `18f3ad8`      | ≥44px tap targets: upsell buttons, admin table-row actions, reports tab pills                                                                                                                                                                                                                                                                                                                                                 |
| T-B11 | DONE   | `938440c`      | `mr-1` → `ms-1` (RTL-logical spacing)                                                                                                                                                                                                                                                                                                                                                                                         |
| T-B12 | DONE   | `ed67e0d`      | Toast timer actually stops on hover/focus and resumes; Escape dismisses; keyboard-activatable close                                                                                                                                                                                                                                                                                                                           |
| T-B13 | DONE   | `0605ea0`      | e2e pin-pad a11y selector `'Digit 1'` → `'رقم 1'`                                                                                                                                                                                                                                                                                                                                                                             |
| T-B14 | DONE   | `713c1ab`      | New test drives the REAL `ROLE_RANK` gate + the SHIPPED `getProductMargins` (no local re-impl)                                                                                                                                                                                                                                                                                                                                |
| T-B15 | DONE   | `7465544`      | Hide "الموظفين" nav link from non-owners                                                                                                                                                                                                                                                                                                                                                                                      |
| T-B16 | DONE   | `a04c6fa`      | Remove ineffective `.gitignore` entry for drizzle `_journal.json` (must stay tracked)                                                                                                                                                                                                                                                                                                                                         |
| T-B17 | DONE   | `4920417`      | Remove dead `NEXT_PUBLIC_APP_CURRENCY` (env + code refs)                                                                                                                                                                                                                                                                                                                                                                      |
| T-B18 | DONE   | `a17be3f`      | Gate HSTS `preload` behind production (`buildHSTS(preload)`); tests                                                                                                                                                                                                                                                                                                                                                           |
| T-B19 | DONE   | `9ce8aed`      | `KNOWN_ISSUES.md`: P1-M10, P2-PERF-2, dead `discount`, e2e-not-in-CI, TTFB attribution + T-A2/DAT-1                                                                                                                                                                                                                                                                                                                           |
| T-B20 | DONE   | `c87371e`      | `docs/openapi.md` rate-limit + token-gate reality (post B1/B2)                                                                                                                                                                                                                                                                                                                                                                |
| T-C1  | DONE   | `68a160b`      | Font pruning: shipped woff2 **751 KB → 628 KB (−16%)**; doc numbers                                                                                                                                                                                                                                                                                                                                                           |
| T-C2  | DONE   | `68a160b`      | `scripts/bundle-budget.mjs` + CI step: worst-case chunk ≤150 KB gzip                                                                                                                                                                                                                                                                                                                                                          |
| T-D1  | DONE   | —              | Tests already present from earlier FIXes (endWifiSession scope, cancelled filters, catalog invalidation, token gate) — verified 13 green                                                                                                                                                                                                                                                                                      |
| T-D2  | DONE   | `dacbb48`      | Playwright `e2e/customer-flow.spec.ts` (`/m` order→status-with-token, wifi connect) — local-run, not CI-gated                                                                                                                                                                                                                                                                                                                 |
| T-D3  | DONE   | `e16b8dc`      | Sentry breadcrumbs/counters on throttled + failed checkouts (`lib/observability.ts`)                                                                                                                                                                                                                                                                                                                                          |
| T-E1  | DONE   | `771cc26`      | README architecture + env-var table; openapi order-response drift fix                                                                                                                                                                                                                                                                                                                                                         |

DONE: 28 · SKIPPED: 0 · FAILED: 0

## Suite + build at phase boundaries

- **Phase A** (`16e4bef`, `8a053e2`): suite **309** passed · `npm run build` **OK**
- **Phase B** (`T-B1…T-B20`): suite **332** passed · `npm run build` **OK**
- **Phase C** (`68a160b`): font-pruned build **OK** · `bundle-budget` **OK**
- **Phase D/E** + final: suite **332** passed · build **OK** · budget **OK**

## Bundle numbers (T-C1)

| Metric                           | Before                          | After                             |
| -------------------------------- | ------------------------------- | --------------------------------- |
| Shipped font woff2               | **751 KB** (20 files)           | **628 KB** (20 files) `−16%`      |
| Initial JS `/m`                  | 139 KB (unchanged, <150 target) | 139 KB                            |
| Worst single client chunk (gzip) | —                               | **71.7 KB** (total_gzip 397.5 KB) |

`node scripts/bundle-budget.mjs 150000` → `chunks=34 total_gzip=397.5 KB worst_gzip=71.7 KB budget=146.48 KB → OK`.

## `git log --oneline 2785e21..HEAD`

```
771cc26 [T-E1] refresh README architecture + env table; fix openapi order response
e16b8dc [T-D3] Sentry breadcrumbs/counters on throttled + failed checkouts
dacbb48 [T-D2] e2e customer-flow spec (/m order + wifi connect), local-run, not CI-gated
68a160b [T-C1+T-C2] prune font weights (−16% payload); add 150KB CI bundle-budget gate
c87371e [T-B20] openapi: correct rate-limit + token-gate reality (post B1/B2)
9ce8aed [T-B19] document KNOWN_ISSUES (P1-M10, P2-PERF-2, discount, e2e, TTFB)
a17be3f [T-B18] gate HSTS preload behind production env
4920417 [T-B17] remove dead NEXT_PUBLIC_APP_CURRENCY env var
a04c6fa [T-B16] drop ineffective .gitignore entry for drizzle _journal.json
7465544 [T-B15] hide staff nav link from non-owners
713c1ab [T-B14] test real ROLE_RANK gate + shipped getProductMargins
0605ea0 [T-B13] sync e2e a11y pin-pad selector to رقم 1
ed67e0d [T-B12] toast timer pauses on hover/focus and resumes; Escape to dismiss
938440c [T-B11] use logical ms-1 (RTL-safe) instead of mr-1
18f3ad8 [T-B10] enforce >=44px tap targets on upsell, admin row, reports tabs
d28815a [T-B9] dashboard averageOrder computed in minor units
e5a709d [T-B8] pass checkout tx into recalculateCartServerSide for consistent pricing
18ebdc8 [T-B7] closeShift computes sales + closes atomically in a transaction
e9bc845 [T-B6] product imageUrl origin allowlist (T-B6)
c907af9 [T-B5] verifyStaffPin derives target user from the server session
b53a63d [T-B4] index wifi_sessions.authorized_at
9f11ecc [T-B2] throttle endWifiSession + getWifiSuggestion
9f39990 [T-B1] throttle + UUID-prevalidate getOrderStatus
8a053e2 [T-A3] wrap setTodaySuggestion deactivate+insert in a transaction (P2-DAT-1)
16e4bef [T-A2] retire /order via 308 redirect; exclude cancelled orders from reports; source=DIGITAL_MENU
```

## Remaining risks (INFO-level)

- **Loose DB**, not the CI target: the long-lived dev Supabase has no
  `__drizzle_migrations` ledger and is drifted (e.g. missing `price_changes`).
  All verification ran on a fresh migrated+seeded Postgres (CI-equivalent).
  `npm test` against that dev DB will fail integration tests until it's
  re-migrated from scratch. Documented in KNOWN_ISSUES / README.
- **T-B3/T-B4 shared one commit** (single `git add -A`); tree is clean and
  green, but the commit message names T-B4 only.
- **Bundle-budget gate is a worst-case-chunk proxy** for First Load JS because
  Next 16/Turbopack no longer prints per-route First Load JS — documented.
- **e2e specs are local-run, not CI-gated** (needs live Supabase + feature
  flags on + a seeded branch `qalqilya`); they are authored and documented,
  not executed in CI.

---

MARATHON COMPLETE — DONE: 28, SKIPPED: 0, FAILED: 0
