# Discovery Report — Ayasofia Sweet

|             |                                                        |
| ----------- | ------------------------------------------------------ |
| **التاريخ** | 2026-08-08                                             |
| **النوع**   | Full-project discovery & status                        |
| **النطاق**  | Read-only — no code changed                            |
| **المرجع**  | `docs/technical-spec.md` (source of truth), Phases 1–6 |

No code was modified or fixed during this session. Every finding below is
evidence-backed with `file:line` references or verbatim terminal output.

---

## 1. Executive summary

The project is a Next.js 16 (App Router) + Supabase + Drizzle modular monolith
that has progressed through Phases 1–4 plus a large portion of Phase 5
(security hardening) and a substantial "marathon" of trust-gate, a11y,
performance, and feature work beyond the original roadmap. Unit + integration
suites are green (335 passed, 2 skipped) and lint/typecheck are clean. The
**Playwright e2e suite is almost entirely red** (8 passed / 31 failed): nearly
every staff-authenticated test fails at the PIN login step with a generic
"Something went wrong", and the two `/m` customer tests fail on their own
reasons. The root launch blocker is not code quality but **data + environment
readiness**: the live database still runs the placeholder demo menu, the tax
rate is still `0`, no real menu has been ingested, and the e2e environment
cannot authenticate a staff session. A real, previously-flagged service-worker
stale-cache bug on `/pos` was **not** fixed — the `page.goBack()` test
workaround remains. No Vercel/Cloudflare deployment config exists in the repo
beyond CI workflow files.

---

## 2. Part B — raw command outputs (verbatim)

### `npm run lint`

```
> ayasofia@0.1.0 lint
> eslint
```

Clean, zero output, exit 0.

### `npm run typecheck`

```
> ayasofia@0.1.0 typecheck
> tsc --noEmit
```

Clean, zero output, exit 0.

### `npm run test`

```
 RUN  v4.1.10 /home/max/Projects/ayasofia

 ✓ __tests__/offline-queue.test.ts (8 tests) 39ms
 ✓ __tests__/security-headers.test.ts (30 tests) 84ms
 ✓ __tests__/receipt.test.ts (20 tests) 59ms
 ✓ __tests__/a11y.test.ts (1 test) 40ms
 ✓ __tests__/idempotency.test.ts (9 tests) 25ms
 ✓ __tests__/checkout.test.ts (12 tests) 19ms
 ✓ __tests__/price-audit.test.ts (11 tests) 23ms
 ✓ __tests__/phase3-actions.test.ts (13 tests) 15ms
 ✓ __tests__/smoke.test.ts (8 tests) 1160ms
 ✓ __tests__/rate-limit.test.ts (13 tests) 17ms
 ✓ __tests__/pricing.test.ts (47 tests) 17ms
 ✓ __tests__/cache.test.ts (4 tests) 14ms
 ✓ __tests__/upsell.test.ts (10 tests) 7ms
 ✓ __tests__/modifier-validation.test.ts (9 tests) 10ms
 ✓ __tests__/wifi-actions.test.ts (8 tests) 14ms
 ✓ __tests__/phase4-actions.test.ts (23 tests) 20ms
 ✓ __tests__/rbac-margins.test.ts (4 tests) 13ms
 ✓ __tests__/image-url.test.ts (7 tests) 8ms
 ✓ __tests__/login-actions.test.ts (3 tests) 6ms
 ✓ __tests__/shifts.test.ts (13 tests) 15ms
 ✓ __tests__/captive-portal.test.ts (4 tests) 9ms
 ✓ __tests__/receipt-data.test.ts (5 tests) 11ms
 ✓ __tests__/inventory-actions.test.ts (13 tests) 9ms
 ✓ __tests__/cleanup.test.ts (14 tests) 7ms
 ✓ __tests__/payments.test.ts (3 tests) 4ms
 ✓ __tests__/seed-stock-semantics.test.ts (3 tests | 1 skipped) 4ms
 ✓ __tests__/status-polling.test.ts (4 tests) 16ms
 ✓ __tests__/delivery.test.ts (8 tests) 8ms
 ✓ __tests__/order-retirement.test.ts (3 tests) 5ms
 ✓ __tests__/real-menu-validation.test.ts (3 tests) 6ms
 ↓ __tests__/ingest-archive.integration.test.ts (1 test | 1 skipped)
 ✓ __tests__/flags-off.test.ts (2 tests) 3ms
 ... (integration suites) ...
 ✓ __tests__/phase3.integration.test.ts (2 tests) 26434ms

 Test Files  42 passed | 1 skipped (43)
      Tests  335 passed | 2 skipped (337)
   Start at  00:30:18
   Duration  28.43s
```

**Pass/fail/skip:** 335 passed, 0 failed, 2 skipped (across 42 passed / 1
skipped files). The 2 skipped are `seed-stock-semantics.test.ts` (1) and
`ingest-archive.integration.test.ts` (1).

### `npx vitest run --coverage`

```
 MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'
```

Coverage **could not be produced** — `@vitest/coverage-v8` is not installed
(`ls node_modules/@vitest/` shows no `coverage-v8`; confirmed MISSING). No
branch/line numbers exist to report. This is an environment gap, not a
mislabeled metric. `vitest.config.mts` defines no `coverage` block either.

### `npx playwright test` (full e2e suite)

```
[globalSetup] Snapshot saved: 30 ingredients, ts=null

Running 39 tests using 5 workers

  8 passed (7.1m)
  31 failed
```

**Passing (8):**

- a11y error toast (2.2s)
- a11y warning toast (775ms)
- a11y toast auto-dismisses (5.8s)
- design-review-after login (4.1s)
- design-review login (4.1s)
- design-review-after order — browsing (6.6s)
- design-review order — browsing (6.5s)
- customer-flow /wifi one-tap connect (6.0s)

**Failing (31):** full list in Part D §2. The dominant failure is
`loginWithPin` timing out at `e2e/helpers.ts:29`
(`waitForSelector("text=بابل تي")`) because the PIN login itself returns an
error alert "Something went wrong" (verified in the page snapshot of
`a11y-A11y-…-chromium/error-context.md`).

### `npm audit`

```
esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server and read the response
fix available via `npm audit fix --force`
Will install drizzle-kit@0.18.1, which is a breaking change
node_modules/@esbuild-kit/core-utils/node_modules/esbuild
  ...

nanoid  <3.3.17
Severity: high
nanoid: custom generators can loop indefinitely when size is zero
fix available via `npm audit fix`
node_modules/nanoid

5 vulnerabilities (4 moderate, 1 high)
```

5 vulnerabilities total: 4 moderate (esbuild dev-server chain via drizzle-kit
transitive dep) + 1 high (nanoid). The `--force` fix for esbuild is a breaking
drizzle-kit downgrade; the nanoid fix is a plain `npm audit fix`.

### `git status`

```
On branch main
Your branch is ahead of 'origin/main' by 99 commits.
  (use "git push" to publish your local commits)

nothing to commit, working tree clean
```

Working tree is **clean**. No modified or untracked files. Local `main` is 99
commits ahead of `origin/main`.

---

## 3. Part C — Phase-by-phase DoD verification

| Phase                                        | Verdict                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — Discovery**                            | **Partially done**                 | Real-menu ingestion tooling exists (`scripts/ingest-real-menu.ts`, `docs/real-menu-guide.md`, `docs/real-menu-template.json`) and is tested (3 `real-menu-validation` tests + `ingest-archive` integration), but the live DB still holds the **demo** menu (see Part D §7). DoD requires a spreadsheet of real seed data "ready to load" — the tool is ready, the data is not.                                                               |
| **1 — Core POS**                             | **Done (code), not verified live** | PIN login, menu browsing, modifiers, cart, totals, order persistence all implemented and unit/integration-tested. Spec DoD is "20 consecutive real sales with zero calc errors" — the e2e test implementing exactly this (`e2e/pos-checkout.spec.ts:129` "20 varied sales with exact totals") **currently fails** because staff login fails in this environment. So the DoD is met in code but not demonstrated end-to-end here.             |
| **2 — Inventory Wired In**                   | **Done (code)**                    | Recipes → automatic deduction implemented in `lib/checkout-core.ts:272-333` (base recipe + modifier-linked ingredients). Deduction covered by `phase3.integration.test.ts` ("deducts ingredient stock for a linked topping modifier") and `inventory.integration.test.ts`. Spec DoD "10 identical drinks deduct exactly the expected quantities" is covered by the `pos-checkout.spec.ts:158` e2e test, which also currently fails on login. |
| **3 — Drive-Thru + Customer Ordering + KDS** | **Done (code)**                    | `/drive-thru` and `/order`/`/m` exist; `/kitchen` uses server-side refetch + Realtime trigger (`lib/checkout-core.ts`, `app/(pos)/kitchen/actions.ts`). Channel tags implemented. Spec DoD (order from a phone off the in-store network appears on KDS in <3s) is a live-network test not run here; design-review e2e routes for `/drive-thru` and `/kitchen` both fail on login.                                                            |
| **4 — Reporting**                            | **Done (code)**                    | Sales summary, best sellers, margins (`getProductMargins`), Z-report (`getZReport`), dashboard summary all in `app/(admin)/admin/reports/actions.ts`; covered by `phase4-actions.test.ts` (23 tests) and `reports-cancelled.integration.test.ts`. Spec DoD "Z-report matches a manual cash count exactly" is a manual reconciliation not verified here.                                                                                      |
| **5 — Hardening**                            | **Partially done**                 | Security hardening largely complete: RLS, RBAC, rate limiting, CSP/headers, Sentry, anonymous-user cleanup workflow, offline queue (SW + IndexedDB), bundle budget, PIN lockout. Explicitly **not done**: the mandatory **one-week parallel run** (spec §13, non-negotiable), offline-mode e2e testing against live infra, and the **real menu ingestion** into the live DB.                                                                 |
| **6 — Candidate enhancements**               | **Not started (as MVP)**           | Per spec these are post-launch (loyalty, shareable order card, digital DT menu board, online payments). No code. Correct state.                                                                                                                                                                                                                                                                                                              |

---

## 4. Part D — the eight open threads

### D1. Service-worker stale-redirect bug — **NOT fixed; workaround remains**

`public/sw.js` has **never been modified** since it was created in commit
`8bc7aca` ("feat(offline): IndexedDB order queue + service worker"). `git log
--all -- public/sw.js` shows exactly one commit. The current `sw.js` still:

- caches `/pos` and `/order` in `APP_SHELL` (`public/sw.js:16`),
- applies **stale-while-revalidate to all document requests** for every route
  (`public/sw.js:54-55`), with **no exclusion of authenticated routes** from
  SW caching.

The `page.goBack()` workaround **still exists** at `e2e/pos-checkout.spec.ts:151`,
added in commit `329b1f5` whose message explicitly says it "replace[s]
page.goto('/pos') with page.goBack() after checkout to avoid service-worker
stale-while-revalidate cache trap". So the caching strategy was **worked around
in the test, not fixed in the SW**. The real fix (excluding authenticated
routes from SW caching entirely) was not implemented.

### D2. All currently failing/skipped e2e tests, with actual errors

39 tests total: **8 passed / 31 failed / 0 skipped** (no `test.skip`/`test.fixme`
in the specs). The 31 failures:

**PIN-login failures** — all fail at `e2e/helpers.ts:29`
(`waitForSelector("text=بابل تي")`) after the login page shows an alert
"Something went wrong" (page snapshot captured in the a11y error-context):

- `e2e/a11y.spec.ts:79` — "quantity and remove buttons meet 44×44px minimum"
- `e2e/pos-checkout.spec.ts:129` — "20 varied sales with exact totals"
- `e2e/pos-checkout.spec.ts:158` — "selling 3 Classic Milk Teas deducts correct stock"
- `e2e/pos-checkout.spec.ts:172` — "two concurrent checkout attempts produce exactly one order"
- `e2e/design-review.spec.ts` + `design-review-after.spec.ts` — all screenshots
  that call `loginWithPin`: pos empty, pos populated cart with open modifier
  sheet, pos mobile, drive-thru, kitchen with orders, admin dashboard,
  admin inventory, admin reports, admin menu, admin staff, admin settings
  (22 tests total across the two specs).

**customer-flow `/m` happy path** — `e2e/customer-flow.spec.ts:16`:
`locator.click: Test timeout… waiting for getByRole('button', { name:
/إتمام|اطلب|تأكيد الطلب/ })`. The snapshot shows the **modifier sheet stack is
left open** (product card still `[active]`), so the submit/order button never
appears. This is a test-authoring gap (it clicks a product, then looks for the
order button without closing/confirming the modifier sheet), not a product bug.

**design-review order — cart open / order status** (both specs, 4 tests) —
`locator.click: waiting for getByRole('button', { name: 'إضافة إلى السلة' })`
(`e2e/helpers.ts:52`). Same root: the additive flow never reaches the add
button (modifier sheet interaction). These two specs still drive the retired
`/order` route (`e2e/design-review.spec.ts:112,116,127`) which now 308-redirects
to `/m/{slug}` (T-A2), so they are stale relative to the `/order` retirement.

**Root cause of the login failures (evidence):** the live Supabase `staff`
table has exactly one row — `Owner`, role `owner`, `active` — and its
`pin_hash` **does verify against PIN `1111`** (I ran `timingSafeEqual` against
the stored hash in the live DB: `PIN 1111 match= true`). The failure is
therefore not PIN mismatch; it is in the auth flow itself — the login page
renders the "Something went wrong" alert, which `app/login/actions.ts` returns
only on the staff-fetch error path (`actions.ts:85`) or the
`updateUserById` error path (`actions.ts:109`). Combined with the fact that the
anon public catalog did load products in the `/m` test, the likely culprit is
the staff session promotion step (`supabase.auth.admin.updateUserById`) failing
against the live project's service-role key/config. I did not dig deeper into
the network/service-role config because that is environment, not code.

### D3. `Brand/` directory — **does not exist untracked; `docs/brand/` is tracked**

There is no `Brand/` or `brand/` directory in the repo root (`find . -maxdepth
2 -iname "Brand*"` returns nothing outside node_modules; no untracked dir in
`git status`). The relevant dir is **`docs/brand/`**, which is **fully tracked**
(6 icon SVGs under `docs/brand/icons/`; `git ls-files docs/brand/` lists them).
`docs/brand/` is not gitignored. So the item is resolved: tracked, committed,
no undecided state.

### D4. Hosting — **still Vercel-by-spec; no Cloudflare/OpenNext migration started**

- `next.config.ts` is a plain Next config (images allowlist + security headers +
  Sentry wrapper); no `@opennextjs/cloudflare` wrapper.
- `grep -rl "opennextjs"` across the repo: **no references**.
- **No `wrangler.toml`** (`ls wrangler.toml` → "no wrangler.toml").
- No `vercel.json`, no `.vercel/` dir.
- `.github/workflows/` has only `ci.yml`, `e2e.yml`, `release.yml`,
  `cleanup-anonymous.yml` — deploy steps reference placeholders, not a
  specific host.
- `docs/technical-spec.md:105` still lists **Vercel** as the hosting choice;
  `docs/reports/phase4-closure-addendum.md:98` references "قيم Supabase/Vercel
  الإنتاجية".

Conclusion: still Vercel-per-spec; Cloudflare migration has not begun in any
form.

### D5. Rate limiting — **still in-memory**

`lib/rate-limit.ts` uses two in-memory `Map`s (`attempts` line 22, `throttleMap`
line 88) with no durable store. The file's own header acknowledges the
serverless cold-start caveat and tracks "a durable Upstash/DB-backed limiter…
as WEB-SEC-004" (`lib/rate-limit.ts:76`). No Upstash dependency in
`package.json`; no `@upstash` anywhere. **Still in-memory.**

### D6. Tax rate — **still `0`**

Live DB query result (verbatim): `SETTINGS: [{"key":"currency","value":"ILS"},
{"key":"tax_rate","value":"0"}]`. The seed defines `{ key: "tax_rate",
value: "0" }` at `db/seed-data.ts:1073`. The 17% figure appears only as a
documentation note in `docs/reports/phase4-closure-addendum.md:95` ("tax_rate
الافتراضي 17% يحتاج تأكيد") — the actual stored value is **0**, unchanged.

### D7. Real menu data — **not loaded; demo menu still live**

Live DB query results: `PRODUCTS: [{"count":23}]`, `CATEGORIES: [{"count":7}]`,
`INGREDIENTS: [{"count":30}]`, `BRANCHES: [{"name":"Ayasofia Qalqilya",
"slug":"qalqilya"}]`, `ORDERS: [{"count":0}]`. These counts match the demo seed
(23 products, 7 categories, 30 ingredients in `db/seed-data.ts`). There is no
`docs/real-menu.json` (it's gitignored per `.gitignore` `/docs/real-menu.json`,
and absent). The ingestion script exists and is tested but has **not been run
against the live DB**. The placeholder bubble-tea/dessert demo menu is still
what seeds the live database.

### D8. Staging Supabase project — **no evidence of a second project**

`.env.local` points at a single Supabase project
(`postgres.hdptsbfzjhmzvfyouhlg**@aws-0-ap-northeast-1.pooler.supabase.com`).
`.env.example` describes one URL/key set (no staging/prod split). The CI
`e2e.yml` references a single set of secrets (`SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and calls it "the staging
database" — one shared project. No `.env.staging`, no second project reference
in any workflow. **One shared Supabase project for everything.**

---

## 5. Part E — fresh-eyes review

### E1. RLS — only 2 of 20 tables have any policy

`db/schema.ts` has **20** `.enableRLS()` calls but only **2** `pgPolicy`
definitions: `orders` ("staff can read live orders", `schema.ts:232`) and
`order_items` ("staff can read order items", `schema.ts:264`). Every other
table (staff, products, ingredients, recipes, settings, price_changes, shifts,
wifi_sessions, today_suggestion, upsell_rules, etc.) has `enableRLS()` with
**no policy**, which in Supabase means **deny-all for the authenticated/anon
roles**. This is "safe-by-denial" but functionally means the anon/authenticated
PostgREST surface cannot read anything. The app sidesteps this by reading
through `lib/db/index.ts` (a direct `node-postgres` Pool with the DB
credentials) which **bypasses RLS entirely**, and by using the service-role
client server-side. Net effect: RLS is effectively **not the enforcement
layer** for any app read/write; authorization rests entirely on
`requireStaffSession`. This is architecturally coherent with the CLAUDE.md
"server-side enforcement" doctrine, but it means the RLS policies are more
decorative than load-bearing for a direct-DB read path. Worth an explicit note
rather than a silent assumption. (I did not audit the SQL in
`db/migrations/0001/0003/0004` for the exact policy text.)

### E2. `requireStaffSession()` — first line in every staff-mutating action; exceptions are the documented ones

Verified call sites: `requireStaffSession` is the first statement in every
admin action under `app/(admin)/admin/{inventory,reports,menu,staff,settings,
digital-menu,wifi}/actions.ts`, in `lib/shifts.ts` (openShift/closeShift/
getOpenShift), and in `app/(pos)/{pos,kitchen}/actions.ts`. Role minima are
applied correctly (owner for staff/settings, manager for inventory/reports/
menu/digital-menu/wifi, none for POS/kitchen).

Actions that **do not** call it are exactly the three documented public
surfaces:

1. `verifyStaffPin` — `app/login/actions.ts:27` (the auth gate; documented in
   CLAUDE.md).
2. `placeCustomerOrder` — `app/order/actions.ts:36` (public self-order; the
   second documented exception).
3. `placeDigitalMenuOrder` + `getDigitalMenuData` + `getUpsellSuggestions` +
   `getOrderStatus` + the wifi public actions (`authorizeGuest`, `endWifiSession`,
   `getSplashSettings`, `getWifiSuggestion`) — these are **additional public
   endpoints** not named in CLAUDE.md's "only exceptions" list, but they are
   deliberately public (feature-flag gated, IP-throttled, no staff involved),
   so they are consistent with the documented intent rather than an
   undocumented leak. I flag the doc gap: CLAUDE.md:38-47 names only two
   exceptions while the code has ~8 public actions; the two named are the
   auth-gate and the legacy self-order, but the newer digital-menu/wifi public
   actions are not listed there.

### E3. Secret handling

- Service-role key only used server-side via `lib/supabase/service.ts`
  (documented "never expose").
- `.env.local` is gitignored and untracked (confirmed NOT in `git ls-files`).
- `docs/data/demo-seed-data.xlsx` has mode `-rw-------` (owner-only).
- Minor hygiene: `.env.local` still contains `NEXT_PUBLIC_APP_CURRENCY`, which
  commit `4920417` (T-B17) removed as "dead" — a leftover line in a gitignored
  file, harmless but stale. The commit removed it from code and
  `.env.example`; the working `.env.local` copy was not cleaned.

### E4. Money arithmetic — all pricing paths go through `lib/pricing.ts`

- `lib/checkout-core.ts` uses `toMinorUnits`, integer agorot math, and
  `(n/100).toFixed(2)` only at the write/display boundary (lines 191, 201-203,
  221, 292, 318). Tax = `Math.round(subtotal * taxRateMinor / 10000)` — integer.
- `lib/pricing-server.ts` uses `calculateLineTotal` (integer).
- Reports margin uses `toScaledInt(…, 4)` for `cost_per_unit` and integer
  scaling (`reports/actions.ts:208-210`); Z-report and dashboard use
  `toMinorUnits` + `addMinor` (`reports/actions.ts:246-253, 296-319`).
- `lib/shifts.ts` uses `toMinorUnits` for discrepancy (`shifts.ts:97-101`).
- **Exceptions / warnings:**
  - `app/(admin)/admin/inventory/actions.ts:47,100` — `deltaStr =
quantity.toFixed(2)` where `quantity` is a bare JS `number` from the
    client (`logPurchase`/`logWaste`). This is stock quantity, not a price, so
    it's outside the price rule, but **no server-side float→string guard** is
    applied — a float `quantity` (e.g. `1.005`) would be truncated by
    `toFixed(2)` before write. Lower-stakes than price, and quantity is
    validated `> 0` but not integer-mandated.
  - `lib/pricing.ts:110` `agorotToPercent` uses `parseFloat((agorot/100)
.toFixed(1))` — a display-only percentage helper; acceptable.
  - `app/(admin)/admin/reports/actions.ts:216` `marginPercent` uses
    `parseFloat((marginAgorot/priceAgorot*100).toFixed(1))` — display-only
    percent, acceptable.
  - No raw float price arithmetic found in the checkout or pricing path.

### E5. Dead code / TODO / FIXME / console.log

- **TODO / FIXME / XXX:** **zero matches** across `*.ts/*.tsx/*.js/*.mjs`
  (excluding node_modules/.next).
- **console.log:** all matches are in non-production tooling — `db/seed.ts`
  (seed progress), `scripts/*.ts` (CLI output for cleanup/ingest/reset), and
  `e2e/global-setup.ts` / `e2e/global-teardown.ts` (suite harness). **No
  stray debug `console.log` in app/lib code.**
- `console.error`/`console.warn` remain in `lib/checkout-core.ts:180,370`
  (legit error logging) and `inventory/actions.ts:77,119` (legit).
- KNOWN_ISSUES.md documents deliberate INFO-level debt: dead `orders.discount`
  column, in-process catalog cache (P2-PERF-2), wifi salt fallback (P1-M10),
  bundle-budget proxy (T-C2), observability proxy (T-D3).

---

## 6. Prioritized list of what blocks a real launch

1. **Load the real menu into the live DB** — the demo seed is still what
   serves sales; ingest `docs/real-menu.json` via `scripts/ingest-real-menu.ts`
   (spec DoD Phase 0). Without it the system sells the wrong catalog.
2. **Confirm and set the tax rate** — still `0` (`db/seed-data.ts:1073`).
   Cashiers would under-charge tax on every sale until a real rate is set.
3. **Complete the mandatory one-week parallel run** (spec §13 Phase 5,
   non-negotiable for a system handling daily revenue) alongside the current
   manual process.
4. **Fix the staff-login failure in the e2e environment** — every
   staff-authenticated e2e test dies at the login alert; until the service-role
   session-promotion path works against the live project, phase 1/2/3 DoD
   e2e tests cannot be demonstrated and the owner can't even log into the POS
   in that environment.
5. **Fix (or definitively ship) the service-worker stale-cache bug on `/pos`**
   — still worked around by `page.goBack()` in the test; the SW still caches
   authenticated routes. Do the real fix: exclude auth routes from SW caching.
6. **Confirm payment methods + receipt printer** (spec §16) — settings still
   say "Cash, Card" and "Not yet confirmed"; Phase 1 cash handling depends on
   the owner's answers.
7. **Resolve the 5 `npm audit` vulnerabilities** — 1 high (nanoid) + 4 moderate
   (esbuild dev chain); the `--force` fix is a breaking drizzle-kit change, so
   it needs a deliberate decision, not automation.
8. **Decide staging/prod split** — one shared Supabase project for everything
   (D8) means e2e runs against the same data a real launch would touch; a
   separate staging project is needed before the parallel run.
9. **Document the newer public server action exceptions** in CLAUDE.md (D/E2)
   and remove the stale `NEXT_PUBLIC_APP_CURRENCY` line from `.env.local`
   (E3) — both trivial hygiene.

---

## 7. Final `git log --oneline` output

```
1de87bd chore(data): pre-destructive backup guard (G3); document ops runbook + accepted deviations
934d558 test(data): ingest archive branch, isolated scratch DB; expose ingestIntoDb; fix recipe-keep FK (G2)
48e100d fix(data): unify stock rule to zero-overlap only; drop single+required gate (G1)
114b16b feat(data): real-menu ingestion script (validate, zero-overlap, transactional, replace-demo) + stock-semantics guard
4dba156 docs(real-menu): template + Arabic ingestion guide + image drop folder
91c027a feat(data): products.description_ar (migration 0012) + local reset recipe
8197f50 docs: marathon report
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
2785e21 fix(auth): restrict saveWifiSetting writes to wifi.* allowlist (P1-M11)
5b90fd2 fix(idempotency): derive per-submit key from session + cart fingerprint (P1-M2)
09de405 fix(cache): invalidate public catalog on every admin menu mutation (P1-M1)
2637d14 feat(wifi): wire admin-editable splash copy into the guest splash (P1-M6)
11a2aad perf(docs): raise production pooler connection_limit to 10 (P2-PERF-3)
5b439bd ci(ops): seed gate — make fresh Postgres Supabase-shaped for integration tests (P2-OPS-1)
edf4a82 fix(security): per-order accessToken gate for public status pages (P2-SEC-1)
a47443a test: flag-off drill — typed errors when public actions gated off (C9)
df72086 fix(a11y/perf): WCAG AA contrast on brand-red surfaces; cache feature-flag reads + invalidate on save (C3)
8ebd8c4 fix(data): remove base-recipe tapioca overlap for Brown Sugar teas; add zero-overlap seed semantics test
3a232c6 docs: API contract for digital-menu + wifi server actions
a8ab5aa docs: welcome wifi captive portal module guide (C5, WF-04..06)
406e9fd docs: digital-menu module guide with C7 scan-logging Backlog decision (C7)
4a2bdd4 fix(test): M2 modifier-deduction test double-counted recipe ingredient; document C8 rollback TRUNCATE limitation
01cf346 docs: document feature flags, module guides links, env vars
694e94f test: digital-menu/wifi/cache/delivery/upsell/payments/captive-portal suites + M2 test cleanups (C4, C10)
27bd099 feat(ui): digital-menu + wifi-portal public/admin modules, POS/kitchen/order integrations (C1-C6)
f2a4372 feat(lib): cache, feature flags, captive-portal, delivery, upsell, payments, modifier-validation, IP throttle (C1-C6)
6c06879 feat(db): modifier→ingredient link, digital-menu/wifi tables, seed data (C1, C4)
329b1f5 design-review: fix 5 visual/functional bugs and e2e blocker
d3cff43 feat(design): step 6 — extend spring easing to all interactive transitions
0dcd2b9 docs(design): step 4 — document elevation system in spec §11.4
0d9d383 fix(design): step 2 — normalize ad-hoc font sizes to type scale
b0a4626 fix(design): step 1 — replace Tailwind default palette classes with brand tokens
7cb28d0 feat(design-review): step 0 — baseline screenshot capture
1483a0b fix(test-isolation): give logPurchase/logWaste each their own ingredient row
314f886 test(a11y): add grep-clean alert, Playwright toast a11y, and bounding-box tests
5aac790 chore(hygiene): comment out dead NEXT_PUBLIC_APP_TAX_RATE in .env.example
b99813b fix(a11y): ensure cart quantity/remove buttons meet 44px touch target (WCAG 2.5.5)
08a5eb5 refactor(a11y): replace all 8 native alert() with useToast().error()
41349df feat(a11y): accessible toast component (WCAG 2.2 AA)
5f7c02c chore(deps): npm audit fix — resolve hono ReDoS (GHSA-8j4g-w8fx-2239)
44faa1d perf(R-09): add orders indexes for range-scan queries
438ee4b fix(SEC-003): Z-report totalSales excludes cancelled orders
9a5c1a7 fix(SEC-001): validate cart quantity server-side before any DB write
38cc8bc chore: gitignore cleanup
02897dd ops: anonymous cleanup workflow — weekly dry-run + manual execute
caf6dc5 fix: eliminate parseFloat in shift discrepancy (A2 extension)
e055fde security: RBAC on getInventoryOptions + auth cleanup note
5ca01fa fix(WEB-DATA-002): receipt line totals drop modifier deltas
2a7933b fix(WEB-DATA-001): 4-decimal cost precision in margin reports
f49b3fc security: price-change audit log (WEB-SEC-006, spec §12)
3a2d24c security: rate limiting + public endpoint IP throttle (WEB-SEC-001)
c423af7 a11y: accessible Sheet dialog + focus/touch/ARIA polish (WCAG 2.2 AA)
8bc7aca feat(offline): IndexedDB order queue + service worker (spec §12)
c6f8776 observability: Sentry with PII scrubbing (spec §5, §12)
61ba964 security: CSP + security response headers (OWASP ASVS §14.4)
7ba9c2c chore(deps): add Sentry, Dexie, fake-indexeddb; bump Next.js
219dd2a security(B2): anonymous Supabase Auth user cleanup job
ab13b9a refactor(A4): complete shared POS cart refactor — all three consumers use usePOSCart
e069e50 docs: Phase 4 closure addendum — honest accounting of what was actually done
8b7f391 security(B1): add rate limiting + lockout on PIN login
4b62b70 feat(A6+A7): /admin/settings page + Drive-Thru sortOrder hardening
0dab85e fix(A5): wire tax calculation from settings table
35e17dc refactor(A4): extract shared POS cart logic into usePOSCart hook
41b239a fix(A3): replace Math.random() with crypto.randomUUID() for order numbers
7f2db29 fix(A2): eliminate parseFloat on money in all read/report/receipt paths
a9c5e8f fix(A1): adopt useRef-based idempotencyKey pattern in Customer Self-Order
f4c0bcb docs: document shift-reuse decision, add manager RBAC boundary test
f710b1d fix: resolve all task-introduced ESLint warnings, rewrite shift integration tests with honest skip
8fe1537 test(phase4): comprehensive tests for reports, staff, menu, RBAC, PIN uniqueness
1e8e22d feat(admin): menu management + staff management with PIN uniqueness
ae7e25c feat(reports): daily/weekly sales, best sellers, margins, Z-report
182be9d test(shifts): add unit + integration tests for shift lifecycle
5b94cac feat(shifts): wire shift open/close lifecycle into login and POS
8603245 docs: formal Phase 3 closure report
5283b3a feat: close Phase 3 — align KDS to server-side refetch, optimize order status polling
103984c chore(db): load env from .env.local in drizzle config, add pg driver
113f754 feat(auth): add requireStaffSession server-side authorization guard
9753eaa feat: brand identity alignment, RTL support, route protection, and test coverage
fcc8f39 docs: flag anon user cleanup as known deferred item
295b4c3 docs: document PIN uniqueness requirement in spec and CLAUDE.md
5435787 feat(db): express RLS natively in Drizzle schema DSL
8e77346 docs: document staff PIN login flow in CLAUDE.md and test plan
ae95147 feat(auth): add endStaffSession utility for shift-change cleanup
e8ee8ea feat(auth): replace permissive RLS policies with JWT claim check
cbf4af3 feat(auth): add verifyStaffPin server action with service-role client
c890798 feat(auth): add PIN pad component with anonymous sign-in flow
46abac5 feat(db): add auth_user_id column to staff table
633c7e3 chore: pin Node.js to >=20 via .nvmrc and engines field
9cf7684 ci: add Dependabot for weekly npm and GitHub Actions updates
4417a23 chore(assets): replace placeholder SVGs with brand icons
f799269 docs: rewrite AGENTS.md and CLAUDE.md with project-specific rules
1310d19 feat(ui): add brand color tokens as Tailwind v4 @theme
8587741 feat(db): enable row-level security on all tables
73333ba feat: add database schema, CI pipeline, and project documentation
81d2aaa chore: initial project scaffold from technical spec
```
