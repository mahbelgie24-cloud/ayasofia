# FINAL COMPREHENSIVE AUDIT — Ayasofia Sweet

|               |                                                                                       |
| ------------- | ------------------------------------------------------------------------------------- |
| **Date**      | 2026-08-14                                                                            |
| **Type**      | Second full independent audit (post-fixes, post-UI-transformation)                    |
| **Verifies**  | HEAD `410dc01` + uncommitted worktree brand-assets pass (WT-DRIFT)                    |
| **Mode**      | Phased → AUTONOMOUS (no stops); read-only                                             |
| **Reference** | `docs/technical-spec.md`, prior reports (all treated as untrusted input until proven) |

> This document is authored incrementally across the audit phases and finalized
> at Phase 5. Findings cite `file:line` and/or measured tool output.

## Amendment A1 — WT-DRIFT inventory (uncommitted brand-assets pass)

`git status` vs HEAD `410dc01`: **17 commits ahead of `origin/main`**, plus a
large uncommitted working-tree pass. Confirmed **lint/typecheck/test-green**
(all baselines in the table above ran against the working tree) and
**token-consistent** (no hex colors outside `globals.css` tokens; the 5 hex
values introduced in the `globals.css` diff — `#dc0000 #f5efea #faf6f3
#ff2a26 #ff6b6b` — are all within the existing brand scale; `manifest.ts` +
`pearl-field.tsx` use exact tokens `#DC0000 #2B1D1D #FAF6F3`).

**SHOULD BE COMMITTED as its own conventional commit before launch** (OPS-1).

### New code/asset files (untracked)

| File                                                    | Purpose                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `scripts/build-brand-assets.mjs`                        | regenerates every asset from canonical SVG                                                         |
| `scripts/capture-brand-assets-proof.mjs`                | Playwright proof of served favicons/manifest                                                       |
| `scripts/capture-headers.mjs`                           | header-consistency audit script                                                                    |
| `components/ui/pearl-field.tsx`                         | brand 6-dot motif (grid/trail/scatter/loading/row variants + PearlDivider)                         |
| `app/manifest.ts`                                       | typed PWA manifest (`MetadataRoute.Manifest`)                                                      |
| `app/apple-icon.png`, `app/icon1.png`, `app/icon2.png`  | iOS 180, PWA 192, PWA 512 icons                                                                    |
| `app/favicon.ico`                                       | multi-size ICO fallback                                                                            |
| `app/opengraph-image.png`                               | 1200×630 social card                                                                               |
| `public/favicon.svg`, `public/icons/mark-canonical.svg` | canonical vector mark                                                                              |
| `docs/design-review/**` (many png/md/report artifacts)  | design-review evidence (creative-pass, header-check, brand-assets-proof, assets-pass-step0 report) |

### Modified (tracked) — 58 files, ~1250 added / ~500 removed LOC

`app/globals.css` (+298), `components/ui/logo.tsx` (+139), the three admin
shell files, `drive-thru-shell.tsx`, `kitchen-shell.tsx`, wifi splash/connect,
`global-error.tsx`, `dm-status-client.tsx`, several `ui/` primitives
(button/card/empty-state/icon-badge/page-header/sheet/stat/toast), `app/layout.tsx`,
`app/page.tsx`, `feature-off.tsx`, and regenerated `docs/design-review/**` PNGs.
`app/icon.svg` deleted (superseded by favicon.svg/ico).

**Recommendation:** one conventional commit, e.g. `feat(brand): favicon/manifest/icons + pearl motif + header polish`. No production-risk content.

## Amendment A2 — Production config gaps (read-only facts, no prod queries)

From `.env.local` + `.env.example` + docs only:

| Item                           | State                                                                                                                                                              | Launch-gate classification                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `DATABASE_URL` in `.env.local` | `connection_limit=1` (dev). `.env.example` documents `=10` for production (P2-PERF-3) but this is **not** the shipped value                                        | **HUMAN/CONFIG** — set `=10` in prod                |
| Migrations 0010–0013 on prod   | **UNVERIFIED** (no prod query allowed). Local stack confirmed 0013 applied. `accessToken` (0010), `wifi index` (0011), `description_ar` (0012), `RLS FORCE` (0013) | **HUMAN/CONFIG** — apply via backup→migrate runbook |
| Supabase project               | `.env.local` = shared `hdptsbfzjhmzvfyouhlg`; e2e/local now isolated via local stack + `STAGING_*` secrets; **no separate staging project provisioned**            | **HUMAN/CONFIG**                                    |
| `WIFI_DEVICE_ID_SALT`          | **NOT set** in `.env.local` → runtime fallback `"ayasofia-wifi"` (KNOWN_ISSUES P1-M10)                                                                             | **HUMAN/CONFIG** — set real value in prod           |
| `CAPTIVE_PORTAL_ADAPTER`       | unset → default `mock`; mikrotik/unifi are stubs                                                                                                                   | **HUMAN/CONFIG** — router adapter decision          |
| `tax_rate`                     | seed = `"0"` (`db/seed-data.ts:1073`)                                                                                                                              | **HUMAN/CONFIG** — owner decision                   |
| Real menu                      | not ingested; demo seed live on dev DB                                                                                                                             | **HUMAN/CONFIG** — `ingest-real-menu.ts`            |
| Origin push                    | `origin/main..HEAD` = **17 commits unpushed** (measured)                                                                                                           | **HUMAN/CONFIG**                                    |
| `.env.local` hygiene           | stale `NEXT_PUBLIC_APP_CURRENCY` line remains (T-B17 removed it from code)                                                                                         | **HUMAN/CONFIG** — remove                           |

## Phase 1 — Fix-Regression Matrix

Legend: ✅ fixed & present · ⚠️ still open / partial · ➕ improved since prior audit.
"test-backed" cites the suite that guards it. bb1df60 (UI transformation) regression
column: the **39/39 e2e + 372 unit/integration** run gives strong evidence the UI pass
did not regress selectors, token gates, or invalidation.

| ID              | Issue                                                   | Status                                                                              | Evidence (current code)                                                                             | Regression risk (bb1df60)                      | Test coverage                              |
| --------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| C1              | Money boundary integer minor-units                      | ✅                                                                                  | `lib/pricing.ts:35-54` string-only; `checkout-core.ts:191-221` integer math                         | None (pricing untouched by UI)                 | pricing (47), checkout                     |
| C2/TD-12        | Float `(n/100).toFixed(2)` at write boundary            | ⚠️ still open (accepted M/S, lossless ≤2^53)                                        | `checkout-core.ts:191,203,221`                                                                      | None                                           | pricing                                    |
| C3/TD-13        | `verifyStaffPin` O(n) scrypt                            | ⚠️ open (LOW, scale-ok)                                                             | `app/login/actions.ts:86-91`                                                                        | None                                           | —                                          |
| C5/TD-15        | `.env.example:49` → `scripts/validate-env.ts` dead ref  | ⚠️ open                                                                             | `.env.example:49`; file absent                                                                      | None                                           | —                                          |
| P1/P2-PERF-2    | In-memory catalog/flag cache single-instance            | ✅ accepted (INFO)                                                                  | `lib/cache.ts`, KNOWN_ISSUES                                                                        | None                                           | cache (4)                                  |
| P2/T-C2         | Bundle gate worst-chunk proxy ≤150 KB                   | ✅                                                                                  | `scripts/bundle-budget.mjs`; re-measured **71.7 KB**                                                | UI grew total to 471 KB but worst chunk stable | CI `build` job gate                        |
| P4/P2-PERF-3    | connection_limit=10 (prod)                              | ⚠️ doc only; `.env.local`=1                                                         | `.env.example:31`                                                                                   | None                                           | —                                          |
| S1/TD-1         | In-memory + XFF-spoofable limiter                       | ⚠️ **open (HIGH code)**                                                             | `lib/rate-limit.ts` `Map`s; `lib/ip.ts:16` first XFF                                                | None                                           | rate-limit (13)                            |
| S2/TD-2         | Single shared Supabase                                  | ➕ **mitigated** for e2e/local (local stack + STAGING_*); prod staging still absent | local stack `54322`; `e2e.yml` STAGING_*; `.env.local` shared                                       | None                                           | —                                          |
| S3/TD-9         | CSP `script-src 'unsafe-inline'`                        | ⚠️ open (residual, documented)                                                      | `lib/security-headers.ts:117`                                                                       | None                                           | security-headers (30)                      |
| S4/TD-10        | Wifi salt literal fallback                              | ⚠️ open (P1-M10 deferred)                                                           | `app/wifi/actions.ts:50`                                                                            | None                                           | —                                          |
| S5/TD-11        | Stale app_metadata role                                 | ⚠️ open (M/L)                                                                       | `lib/auth.ts:111-123`                                                                               | None                                           | rbac-margins (4)                           |
| S6              | Order-status token gate                                 | ✅                                                                                  | `app/order/status/[orderId]/actions.ts:25-41` UUID pre-validation + throttle + accessToken equality | None                                           | status-polling, integration                |
| S7/T-B6         | imageUrl origin allowlist                               | ✅                                                                                  | `next.config.ts`, `lib/image-url.ts`                                                                | None                                           | image-url (7)                              |
| S8/T-PIN-unique | PIN uniqueness                                          | ✅                                                                                  | `app/(admin)/admin/staff/actions.ts`                                                                | None                                           | phase4 staff                               |
| S10/H5          | nanoid high severity                                    | ✅ fixed                                                                            | `npm audit` 0 high; 4 moderate dev-only esbuild                                                     | None                                           | —                                          |
| S11             | Modifier validation server-side                         | ✅                                                                                  | `checkout-core.ts:159-177`, `lib/modifier-validation.ts`                                            | None                                           | modifier-validation (9)                    |
| R1/TD-8         | Offline replay needs valid session                      | ⚠️ **open (M)**                                                                     | `lib/offline/sync.ts:65` uses staff action                                                          | None                                           | offline-queue (8)                          |
| R2/P1-M2        | Idempotency deterministic fingerprint                   | ✅                                                                                  | `lib/idempotency.ts:34-62`; e2e concurrency test                                                    | None                                           | idempotency (9); e2e #38/39                |
| R3/T-B7         | checkout/shift atomic; setTodaySuggestion transactional | ✅                                                                                  | `checkout-core.ts:87-343`; `shifts.ts:64-90`                                                        | None                                           | checkout, shifts, today-suggestion         |
| R4/H3           | SW network-first navigations                            | ✅                                                                                  | `public/sw.js:78-81,99-112`; e2e page.goBack removed                                                | None                                           | sw-strategy (5)                            |
| D1/H2           | RLS FORCE all tables                                    | ✅                                                                                  | `0013_rls_force.sql`; verified `t/t` all 20 (local)                                                 | None                                           | rls.integration (3)                        |
| D2              | indexes on range scans                                  | ✅                                                                                  | `db/schema.ts`                                                                                      | None                                           | —                                          |
| D3              | dead `orders.discount`                                  | ⚠️ accepted/INFO                                                                    | KNOWN_ISSUES                                                                                        | None                                           | —                                          |
| D4/TD-3         | tax_rate=0                                              | ⚠️ **open (data)**                                                                  | `db/seed-data.ts:1073`                                                                              | None                                           | —                                          |
| D5              | no DB-level limiter table                               | ⚠️ open (ties S1)                                                                   | —                                                                                                   | None                                           | —                                          |
| P1-M1           | catalog invalidation on menu mutation                   | ✅                                                                                  | 24 call sites; `menu/actions.ts:45-47`                                                              | None                                           | catalog-invalidation.integration           |
| P1-M6           | splash copy wired end-to-end                            | ✅                                                                                  | `wifi/actions.ts:170-189`; `wifi/page.tsx`                                                          | None                                           | wifi unit/integration                      |
| P1-M10          | wifi salt deferral                                      | ⚠️ open (deferred by design)                                                        | KNOWN_ISSUES                                                                                        | None                                           | —                                          |
| P1-M11          | wifi settings write allowlist                           | ✅                                                                                  | `wifi/actions.ts:27,45-47`                                                                          | None                                           | wifi-actions (8)                           |
| P2-SEC-1        | order accessToken gate                                  | ✅                                                                                  | `0010`, `order/status/actions`                                                                      | None                                           | token-gate integration                     |
| P2-DAT-1        | today-suggestion transactional                          | ✅                                                                                  | `setTodaySuggestion` in transaction                                                                 | None                                           | today-suggestion.integration               |
| P2-OPS-1        | CI seed gate fresh Postgres                             | ✅                                                                                  | `.github/workflows/ci.yml`                                                                          | None                                           | —                                          |
| S9              | secrets server-only                                     | ✅                                                                                  | `lib/supabase/service.ts`; `.env.local` gitignored                                                  | None                                           | —                                          |
| API4/5          | delivery address / customer name no length cap          | ⚠️ open (LOW)                                                                       | `placeDigitalMenuOrder`, `placeCustomerOrder`                                                       | None                                           | —                                          |
| G1              | ingest zero-overlap rule                                | ✅                                                                                  | `ingest-real-menu.ts:288-301`                                                                       | None                                           | seed-stock-semantics, real-menu-validation |
| G2              | ingest archive-when-orders-exist                        | ✅                                                                                  | `ingest-real-menu.ts:445-476`                                                                       | None                                           | ingest-archive.integration                 |
| G3              | pre-destructive backup guard                            | ✅                                                                                  | `reset-db.ts`, `scripts/lib/backup.ts`                                                              | None                                           | —                                          |
| UI1-4 / AX1-3   | brand tokens, RTL, 44px, toast a11y                     | ✅                                                                                  | `globals.css` tokens; `button.tsx h-11`; `toast.tsx`; e2e a11y                                      | **covered by 39/39 e2e**                       | a11y.spec                                  |
| T3/TD-6         | e2e not CI-gated, flaky                                 | ➕ **greatly improved** — 39/39 green on isolated local stack                       | `playwright.config.ts` workers:1 + local stack                                                      | n/a                                            | full e2e                                   |
| T2/TD-5         | coverage tooling missing                                | ⚠️ **open (M)**                                                                     | no `@vitest/coverage-v8`                                                                            | None                                           | —                                          |
| O2/TD-7         | no migration step in deploy                             | ⚠️ **open**                                                                         | `release.yml` builds only                                                                           | None                                           | —                                          |
| O5              | no staging/prod split (prod)                            | ️⚠️ open for prod; e2e mitigated                                                     | `.env.local` shared                                                                                 | None                                           | —                                          |
| A2              | public action doc gap (CLAUDE.md)                       | ⚠️ open (LOW doc)                                                                   | CLAUDE.md lists 2; code has ~8 public                                                               | None                                           | —                                          |

### bb1df60-specific regression checks (A3)

- **a11y attributes survived:** `role="alert"` present (`pin-pad.tsx:133,172`,
  `form-field.tsx:48`, `wifi-splash.tsx:128`); 44px targets `min-h-11`/`size-11`
  (`toast.tsx:198`, `button.tsx:34,41`). e2e `a11y.spec.ts` passes.
- **e2e selectors aligned:** pin-pad `'رقم X'` selector + add-to-cart + toast
  selectors all pass in the 39/39 run (incl. post-bb1df60 selectors noted in commit `d25c07d`).
- **token gates intact:** P2-SEC-1 status gate unchanged; concurrency e2e (#38) proves exactly-one-order.
- **invalidation intact:** 24 `invalidatePublicCatalog` call sites still present post-UI.

## Baseline measurements (Phase 0 — captured this session)

| Baseline                     | Result                                          |
| ---------------------------- | ----------------------------------------------- |
| `npm run lint`               | 0 errors, 0 warnings                            |
| `npm run typecheck`          | 0 errors                                        |
| `npm run build`              | success, 26 routes                              |
| Unit+integration suite       | 372 passed, 2 skipped (47 files)                |
| Integration suite (isolated) | 24 passed, 1 skipped                            |
| E2E (local Supabase stack)   | 39/39 passed (4m 06s), self-cleaning teardown   |
| Bundle budget                | worst 71.7 KB gzip / 150 KB gate → OK           |
| `npm audit`                  | 4 moderate (dev-only esbuild chain), 0 high     |
| Coverage                     | MISSING (`@vitest/coverage-v8`)                 |
| RLS FORCE (migration 0013)   | applied + verified on all 20 tables (local)     |
| Screenshots                  | 11 captured → `docs/reports/final-audit-shots/` |
