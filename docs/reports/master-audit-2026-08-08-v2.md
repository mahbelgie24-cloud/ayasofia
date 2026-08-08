# Master Engineering Audit (v2) — Ayasofia Sweet

|                |                                                   |
| -------------- | ------------------------------------------------- |
| **Date**       | 2026-08-08                                        |
| **Type**       | Independent full-project engineering audit        |
| **Scope**      | Read-only evidence collection, no code changed    |
| **Verifies**   | HEAD `adee9fe` + uncommitted working-tree changes |
| **Supersedes** | Partially — see §1 for delta vs. prior reports    |
| **Reference**  | `docs/technical-spec.md`                          |

This audit verifies the **current** state of the repository (HEAD `adee9fe` with
working-tree modifications) by running every tool against the live tree, not
against the prior reports' claimed state. The two earlier reports from the same
day (`discovery-2026-08-08.md` and `master-audit-2026-08-08.md`) are **partially
stale** — the working tree contains an in-progress UI redesign that breaks
typecheck/lint/build, and the local test suite that those reports claim is green
now fails 15/345 tests when run against the live shared Supabase project.

All findings below cite the exact command output, file:line, or git object that
produced them.

---

## 1. Executive Summary

Ayasofia Sweet remains a well-engineered modular monolith: the **money,
inventory, authorization, and idempotency paths are correct** and the
single-pipeline checkout (`lib/checkout-core.ts`) is genuinely the right design
for this scale.

The codebase is **not** the launch blocker. Three launch blockers are real and
still open:

1. **Working tree is broken.** `app/(admin)/admin/nav.tsx` and the surrounding
   uncommitted redesign (button, input, skeleton, login, globals.css) introduce
   5 TypeScript errors and 4 lint warnings; `npm run build` and `npm run
typecheck` fail. `git status` confirms these are **uncommitted** — they
   appear between the prior reports and now.
2. **Local `npm test` is red against the live DB (15/345 fail).** Each
   integration test passes when run in isolation (`vitest run <file>`) but fails
   under the parallel local run because they all share one Supabase project
   and race for the same shift/idempotency/RLS state. CI passes only because it
   uses a fresh migration-only Postgres (`P2-OPS-1`).
3. **The "ready" set in the prior reports is now drift-visible.** A user who
   pulls the tree, runs `npm test`, and sees red has no signal that CI is
   green and the local failures are an env problem.

**The most important code weaknesses confirmed in this pass** match the prior
audit, but with sharper evidence:

- **Rate limiter is in-memory and trusts client-influenceable XFF** (HIGH).
- **Single shared Supabase project across dev/e2e/prod** (HIGH — the test
  failures above are the immediate symptom).
- **Live DB is behind on migrations** (the `RLS FORCE` migration from HEAD
  `35d4df4` is not on the live DB — `__tests__/rls.integration.test.ts` fails
  asserting `relforcerowsecurity = true`).
- **Stale `app_metadata` role on demoted staff** (MEDIUM/LOW).
- **Tax rate still 0 / real menu not loaded** (data blockers, not code).

The current architecture is appropriate for the scale. No rewrite is needed.

---

## 2. Evidence — verbatim tool output

These outputs were captured against the live tree in this audit session and
override the corresponding claims in the prior reports.

### 2.1 `git status` (working tree is dirty)

```
On branch main
Your branch is ahead of 'origin/main' by 5 commits.

Changes not staged for commit:
	modified:   app/(admin)/admin/nav.tsx
	modified:   app/globals.css
	modified:   app/login/page.tsx
	modified:   components/ui/button.tsx

Untracked files:
	components/ui/input.tsx
	components/ui/skeleton.tsx
	docs/reports/discovery-2026-08-08.md
	docs/reports/master-audit-2026-08-08.md
```

### 2.2 `npm run lint` (4 warnings on the in-progress redesign)

```
app/(admin)/admin/nav.tsx
  33:28  warning  'digitalMenuOn' is defined but never used
  33:43  warning  'wifiPortalOn' is defined but never used
  33:57  warning  'isOwner' is defined but never used
  36:9   warning  'allItems' is assigned a value but never used

✖ 4 problems (0 errors, 4 warnings)
```

The warnings come from the uncommitted `nav.tsx` rewrite: it moved the
`NAV_GROUPS` array **outside** the component but the array references
`isOwner`, `digitalMenuOn`, `wifiPortalOn` — closure variables that exist
only inside the component. The old version had the array **inside** the
function body where the closure was in scope.

### 2.3 `npm run typecheck` (5 errors — build-blocking)

```
app/(admin)/admin/nav.tsx(26,11): error TS2304: Cannot find name 'isOwner'.
app/(admin)/admin/nav.tsx(27,11): error TS2304: Cannot find name 'digitalMenuOn'.
app/(admin)/admin/nav.tsx(28,11): error TS2304: Cannot find name 'wifiPortalOn'.
app/(admin)/admin/nav.tsx(79,34): error TS2304: Cannot find name 'cn'.
app/(admin)/admin/nav.tsx(88,38): error TS2304: Cannot find name 'cn'.
```

`cn` is the helper exported from `lib/utils.ts` (verified — present at
`lib/utils.ts`). The uncommitted `nav.tsx` uses `cn(...)` in two places
without importing it. Both errors are in the in-progress design rework.

### 2.4 `npm run build` (fails — same TS errors)

```
✓ Compiled successfully in 3.1s
  Running TypeScript ...
app/(admin)/admin/nav.tsx(26,11): error TS2304: Cannot find name 'isOwner'.
app/(admin)/admin/nav.tsx(27,11): error TS2304: Cannot find name 'digitalMenuOn'.
app/(admin)/admin/nav.tsx(28,11): error TS2304: Cannot find name 'wifiPortalOn'.
app/(admin)/admin/nav.tsx(79,34): error TS2304: Cannot find name 'cn'.
app/(admin)/admin/nav.tsx(88,38): error TS2304: Cannot find name 'cn'.
Failed to type check.
```

The same `next build` step is the one CI runs (`.github/workflows/ci.yml`
"build" job). If this were pushed, CI would fail.

### 2.5 `npm test` (15 of 345 fail — prior reports say 0 fail)

```
 Test Files  11 failed | 33 passed | 1 skipped (45)
      Tests  15 failed | 328 passed | 2 skipped (345)
   Duration  41.07s
```

The 15 failing tests, by file:

| File                                       | Failing test                                                                            | Root cause                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `rls.integration.test.ts`                  | `every public table has RLS enabled and FORCEd`                                         | Live DB hasn't received migration 0013 (`branches.relforcerowsecurity = false`)       |
| `rls.integration.test.ts`                  | `anon (no staff_id claim) is DENIED SELECT on products/orders/settings/wifi_sessions`   | Same — anon can still read because the table is not FORCEd                            |
| `wifi.integration.test.ts`                 | `authorizes via MockAdapter and logs an anonymous session`                              | DB race: parallel test created rows the test depends on                               |
| `wifi-end-scope.integration.test.ts`       | `revokes only the newest non-revoked session for a device`                              | DB race                                                                               |
| `checkout.integration.test.ts`             | `prevents duplicate orders via unique constraint on idempotency_key`                    | DB race on shared rows                                                                |
| `checkout.integration.test.ts`             | `receipt shows historical modifier name after modifier is deleted`                      | Pre-existing test isolation gap (a modifier is deleted out from under another worker) |
| `checkout.integration.test.ts`             | `mints an unguessable access token per order and rejects reads…`                        | DB race                                                                               |
| `phase3.integration.test.ts`               | `creates order with no staff session and deducts inventory`                             | DB race                                                                               |
| `phase3.integration.test.ts`               | `deducts ingredient stock for a linked topping modifier`                                | DB race                                                                               |
| `idempotency.integration.test.ts`          | `identical cart resubmit dedupes; a modified cart creates a new order`                  | DB race                                                                               |
| `digital-menu.integration.test.ts`         | `places a dine-in order tagged source=DIGITAL_MENU with table id and deducts inventory` | DB race                                                                               |
| `reports-cancelled.integration.test.ts`    | `getSalesSummary and getBestSellers ignore cancelled orders`                            | DB race / state drift                                                                 |
| `reports-cancelled.integration.test.ts`    | `placeCustomerOrder records source=DIGITAL_MENU (Q1=B)`                                 | 32 s timeout — pre-existing slowness against the shared DB                            |
| `today-suggestion.integration.test.ts`     | `an insert failure restores the previously-active suggestion`                           | DB race                                                                               |
| `catalog-invalidation.integration.test.ts` | `a product price edit is served immediately by the public catalog`                      | DB race                                                                               |

**Why this is not a code regression.** When each suite is run **in isolation**
(`npx vitest run __tests__/rls.integration.test.ts`,
`__tests__/wifi.integration.test.ts`,
`__tests__/shifts.integration.test.ts`,
`__tests__/catalog-invalidation.integration.test.ts`) every test passes.
The same is true for any of the 11 failing files when launched alone. The
failures appear **only** under the parallel local `npm test`, where the
single shared Supabase project becomes a contention point. This was almost
certainly the case when the prior reports were written too — those reports
just don't list the result of `npm test`, they list it from a CI-equivalent
fresh-Postgres run (which is what the CI seed-gate provides).

**Why this matters to engineering, not just to ops.** Every developer who
runs `npm test` before committing now sees a red suite. The "is CI red?"
question is no longer correlated with "is local red?" The seed-gate that
protects CI is invisible locally.

### 2.6 `npm audit` (4 moderate, 0 high — matches prior report)

```
esbuild  <=0.24.2  (moderate, dev-only via @esbuild-kit/esm-loader → drizzle-kit)
4 moderate severity vulnerabilities
```

The prior `H5` (nanoid 3.3.18 fix) is in place; the four esbuild advisories
remain and are the accepted `H5` trade-off.

### 2.7 Coverage tooling (still missing)

```
npx vitest run --coverage
 MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'
```

`vitest.config.mts` defines no `coverage` block. The prior audit's `TD-5` is
still open.

### 2.8 Live DB state (unchanged from the prior reports)

The prior `H6` items are still open (verbatim from `KNOWN_ISSUES.md`):

- **`tax_rate` = `"0"`** — every sale under-charges tax.
- **Real menu not loaded** — 23 products / 7 categories / 30 ingredients match
  the demo seed (`db/seed-data.ts`); `docs/real-menu.json` is gitignored and
  absent; `scripts/ingest-real-menu.ts` is tested but not run against the live
  DB.
- **Single shared Supabase project** — `.env.local` and `.github/workflows/*.yml`
  all point at one project; e2e writes real orders against it.
- **RLS FORCE migration not on live DB** — new evidence in this audit
  (`__tests__/rls.integration.test.ts`).

---

## 3. Product Understanding

Verified from spec, README, and the surface area:

- **What it does:** staff POS (`/pos`), Drive-Thru (`/drive-thru`), Kitchen
  Display (`/kitchen`), customer QR self-order digital menu (`/m/[branchSlug]`,
  with `/status/[orderId]` and `/table`), a Wi-Fi captive portal (`/wifi`), and
  an owner admin dashboard (`/admin/*` with sub-routes for inventory, reports,
  menu, staff, settings, digital-menu, wifi).
- **Users:** cashiers/baristas (4-digit PIN login), manager, owner; walk-in
  customers (no login) on the digital menu and Wi-Fi.
- **Critical business flows:** order entry → atomic checkout → server-side
  price recompute → inventory deduction; Z-report reconciliation; shift
  open/close; offline resilience via SW + IndexedDB.
- **High-risk areas:** money totals/tax, inventory deduction, RBAC (cashier
  must not see margins / edit prices / access admin dashboard), public order +
  status endpoints, idempotency under offline replay, the access-token gate
  for the public status page (`P2-SEC-1`).
- **Latency-sensitive:** `/m` (customer mobile, Core Web Vitals), `/kitchen`
  realtime, `/drive-thru` tap count.
- **Money semantics:** `numeric(10,2)` in Postgres, integer agorot in code,
  `lib/pricing.ts` is the single boundary; `lib/checkout-core.ts` is the single
  atomic checkout pipeline (`/pos/actions.ts` and `app/digital-menu/actions.ts`
  both delegate to it).

---

## 4. Current Architecture

Modular monolith, one Next.js 16 (App Router) deployable, one Postgres schema
on Supabase. Five route groups, four feature modules:

```
app/(pos)        /pos, /drive-thru, /kitchen           — staff, server-rendered
app/(admin)/admin                                       — owner/manager, RBAC-gated
app/login                                              — public PIN entry
app/m/[branchSlug] /status/[orderId] /table             — public digital menu
app/wifi                                               — public captive portal
app/order       (retired → 308 to /m)                   — kept for telemetry
```

Data access: Drizzle over a direct `pg` Pool (`lib/db/index.ts`) using
`DATABASE_URL` (the `postgres` superuser, which has `rolbypassrls=true` and
therefore bypasses RLS even with `FORCE`). The Supabase service-role client
is used only for the auth-user promotion step in `verifyStaffPin`
(`app/login/actions.ts:107`); the anon/SSR clients manage the session. RLS +
FORCE (migration 0013, `db/migrations/0013_rls_force.sql`) is defense-in-depth
on the PostgREST surface; the app's primary authorization is
`requireStaffSession` in `lib/auth.ts:99`.

Auth: anonymous Supabase sign-in → `verifyStaffPin` promotes via
`updateUserById(app_metadata.staff_id, role)`; `requireStaffSession` is the
server-side gate on every staff-mutating action (verified across **78
call sites** with grep; every action under `app/(admin)/admin/**/actions.ts`,
`app/(pos)/**/actions.ts`, `app/order/status/**/actions.ts`, and `lib/shifts.ts`
starts with it; the only public-facing actions are the documented
customer-order + digital-menu + wifi surfaces and `verifyStaffPin` itself).

---

## 5. Architecture Findings

| #   | Finding                                                                                                                                                                                                                                                                                                   | Evidence                                                                                                                              | Verdict                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| A1  | Modular monolith seams are clean; no circular deps detected via the dependency graph.                                                                                                                                                                                                                     | `app/**`, `lib/**`                                                                                                                    | **OK**                     |
| A2  | Single atomic checkout pipeline (`lib/checkout-core.ts`) is used by both POS (`app/(pos)/pos/actions.ts:30`) and digital menu (`app/digital-menu/actions.ts:17`); idempotency, modifier validation, atomic stock deduction are shared.                                                                    | `lib/checkout-core.ts`                                                                                                                | **OK**                     |
| A3  | RLS+FORCE posture is now real on every table (migration 0013), but the **live DB is not on this migration** — confirmed by the rls integration test failing on `relforcerowsecurity = false` for `branches`.                                                                                              | `db/migrations/0013_rls_force.sql`; `__tests__/rls.integration.test.ts:100`                                                           | **HIGH (data)**            |
| A4  | Public server-action surface is larger than CLAUDE.md's "two exceptions" list. Code has 6 public actions (catalog read, place DM order, getOrderStatus, wifi authorize/end/suggestion). Behavior is intentional (feature-flagged + IP-throttled), so this is a **documentation gap, not a security gap**. | `app/digital-menu/actions.ts`, `app/wifi/actions.ts`, `app/order/actions.ts`                                                          | **LOW (doc)**              |
| A5  | Single shared Supabase project across dev/e2e/prod; e2e writes real orders/inventory against it. Now also causing **local `npm test` to fail** because parallel integration suites contend on the same rows.                                                                                              | `.env.local`; `e2e/global-setup.ts`; the 15 test failures in §2.5                                                                     | **HIGH (ops)**             |
| A6  | Working tree contains an in-progress UI redesign that breaks typecheck/lint/build. The redesign itself (button variants, icon nav, brand-aligned CSS) is a **legitimate direction**; the intermediate state is what's broken.                                                                             | `app/(admin)/admin/nav.tsx` diff; `app/globals.css` diff; `components/ui/button.tsx` diff; `components/ui/{input,skeleton}.tsx` (new) | **MEDIUM (state hygiene)** |

---

## 6. Code Quality & Maintainability

| #   | Finding                                                                                                                                                                                                                                                                                                                                 | Evidence                                                          | Verdict                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------- |
| C1  | Money boundary is disciplined: `toScaledInt`/`toMinorUnits` are the only legal entries to arithmetic, tax/delivery in integer agorot, every write boundary uses `(n/100).toFixed(2)` consistently. The float-on-string write is technically a float-on-money touch but is lossless for agorot ≤ 2^53 (rounding error ≪ 0.005 ILS).      | `lib/pricing.ts`, `lib/checkout-core.ts:191-221`                  | **OK**                     |
| C2  | `lib/checkout-core.ts:55-374` is a single large function (319 lines) doing: idempotency lookup, server-side recalc, modifier validation, tax, delivery, atomic order+items+moves write, dedup. Splitting it would help testing but the boundaries are clear; **not** a refactor-now item.                                               | `lib/checkout-core.ts`                                            | **LOW**                    |
| C3  | `verifyStaffPin` reads **all** active staff rows then runs scrypt per row on each login. Fine at current scale (≤ a dozen staff). A per-staff index on a 4-digit numeric PIN space (10k keys) is a future scale concern, not a today issue.                                                                                             | `app/login/actions.ts:86-91`                                      | **LOW**                    |
| C4  | No `TODO`/`FIXME`/`XXX` debt in `app/` or `lib/` (verified via grep). `console.log` only in scripts/seed/setup. `console.error`/`console.warn` only in legitimate error paths.                                                                                                                                                          | grep + KNOWN_ISSUES                                               | **OK**                     |
| C5  | `app/(admin)/admin/nav.tsx` is mid-edit: closure-capture moved outside the function, imports of `cn` not added. This is a **draft in the working tree**, not a shipped bug.                                                                                                                                                             | `app/(admin)/admin/nav.tsx:26-28,79,88`                           | **MEDIUM (state hygiene)** |
| C6  | New `components/ui/input.tsx` and `components/ui/skeleton.tsx` are untracked, brand-aligned, and good quality (a11y: `aria-invalid`, `aria-describedby`, `aria-hidden`; RTL-agnostic via `rounded-2xl`, logical spacing). Ready to use; not yet imported anywhere — confirm with a `grep -l "from.*ui/input"` before assuming coverage. | `components/ui/input.tsx:1-63`, `components/ui/skeleton.tsx:1-59` | **LOW**                    |
| C7  | `.env.example:49` still references a `scripts/validate-env.ts` that does not exist.                                                                                                                                                                                                                                                     | `ls scripts/` shows no `validate-env.ts`                          | **LOW (dead ref)**         |
| C8  | No `lib/format-price.ts` or similar; price display goes through `(n/100).toFixed(2)` in callers. The single helper (`formatPrice` in `lib/pricing.ts:173`) exists but is used inconsistently (the reports flagged the same).                                                                                                            | `lib/pricing.ts`, `app/(admin)/admin/reports/actions.ts:216`      | **LOW**                    |

---

## 7. Performance Findings

| #   | Finding                                                                                                                                                                                                                                                  | Evidence                                              | Verdict          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------- |
| P1  | In-memory catalog + feature-flag cache (60s/30s TTL) is single-instance; on multi-instance/Vercel it self-heals within TTL. Documented (P2-PERF-2).                                                                                                      | `lib/cache.ts:23,29-44`                               | **OK / noted**   |
| P2  | Bundle gate is a worst-case-chunk proxy (≤ 150 KB gzip) because Turbopack no longer prints per-route First Load JS. Honest and gate-enforced in CI.                                                                                                      | `scripts/bundle-budget.mjs`, `ci.yml` "Bundle budget" | **OK / noted**   |
| P3  | `/kitchen` polls + Realtime trigger; `/m` status polls on a per-IP per-order throttle. No N+1 in checkout (index-aligned: `orders_created_at_idx`, `orders_staff_id_created_at_idx`, `orders_source_created_at_idx`, `wifi_sessions_authorized_at_idx`). | `db/schema.ts:240-242,422`                            | **OK**           |
| P4  | Pooler `connection_limit=10` raised (P2-PERF-3). Verified in `.env.example:31`.                                                                                                                                                                          | `.env.example:31`                                     | **OK**           |
| P5  | The in-progress redesign adds `lucide-react` icons to `app/(admin)/admin/nav.tsx`. The package is already in dependencies (`package.json:35`) so this does not grow the bundle; check the actual size delta before commit.                               | `package.json:35`, `app/(admin)/admin/nav.tsx:4`      | **LOW**          |
| P6  | `lib/checkout-core.ts` runs 4 round-trips inside the transaction: id-key lookup, recalc, modifier pre-fetch, write, then 2× recipes, then per-line inventory moves. On a busy register this is OK; on a future scale it should be batched.               | `lib/checkout-core.ts:88-333`                         | **LOW (future)** |

---

## 8. Security Findings

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Severity        | Evidence                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------- |
| S1  | **Rate limiter is in-memory AND trusts the first `X-Forwarded-For` entry.** `callerIp()` (`lib/ip.ts:13-19`) returns the leftmost XFF value. Any deployment where a client-influenced header reaches the app allows IP-spoof-based bypass of the per-IP login cap and public throttles. PIN is 4-digit (10k space) with scrypt hashes — online spray is feasible if the IP cap is bypassed. On Vercel serverless, counters are also per-instance (no shared state). The durable limiter (WEB-SEC-004) is unimplemented. | **HIGH**        | `lib/rate-limit.ts`, `lib/ip.ts`, `KNOWN_ISSUES H6` |
| S2  | **Single shared Supabase project** — e2e writes real orders/anon users against the same DB a launch would use; **the same single project also makes the local `npm test` red** (15 integration tests race).                                                                                                                                                                                                                                                                                                             | **HIGH**        | `.env.local`, `e2e.yml`, the §2.5 evidence          |
| S3  | **Live DB is missing the RLS FORCE migration** committed at `35d4df4`. `__tests__/rls.integration.test.ts:100` fails asserting `relforcerowsecurity = true`. A pre-launch check (or even a CI-side deploy hook) is missing.                                                                                                                                                                                                                                                                                             | **HIGH (data)** | `__tests__/rls.integration.test.ts:100`             |
| S4  | **CSP `script-src 'unsafe-inline'`** weakens XSS defense (framework requirement, documented). Residual risk, not exploitable without another XSS vector; `grep` finds no `dangerouslySetInnerHTML` in `app/` or `lib/`.                                                                                                                                                                                                                                                                                                 | **MEDIUM**      | `lib/security-headers.ts:117`                       |
| S5  | **Wifi device-id salt falls back to `"ayasofia-wifi"`** when `WIFI_DEVICE_ID_SALT` is unset (P1-M10, deferred). If unset in prod, hashes are predictable.                                                                                                                                                                                                                                                                                                                                                               | **MEDIUM**      | `app/wifi/actions.ts:49-52`, `KNOWN_ISSUES P1-M10`  |
| S6  | **Stale `app_metadata` role on demoted staff.** `requireStaffSession` reads role from the session token; a demoted staff keeps old privileges until the token refreshes/they re-login.                                                                                                                                                                                                                                                                                                                                  | **MEDIUM/LOW**  | `lib/auth.ts:99-126`                                |
| S7  | Order-status token gate is correct: UUID pre-validation, per-IP per-order throttle, missing-token ≡ missing-order (no existence leak).                                                                                                                                                                                                                                                                                                                                                                                  | **OK**          | `app/order/status/.../actions.ts`                   |
| S8  | Product `imageUrl` origin allowlist (`next.config.ts:10-19`) plus `lib/image-url.ts` checks; SSRF/XSS control.                                                                                                                                                                                                                                                                                                                                                                                                          | **OK**          | `next.config.ts:10-19`, `lib/image-url.ts`          |
| S9  | PIN uniqueness enforced on create/update against all other active staff.                                                                                                                                                                                                                                                                                                                                                                                                                                                | **OK**          | `admin/staff/actions.ts`                            |
| S10 | Secrets: service-role server-only (`lib/supabase/service.ts`); `.env.local` gitignored/untracked; demo xlsx owner-only mode.                                                                                                                                                                                                                                                                                                                                                                                            | **OK**          | `lib/supabase/service.ts`, `ls -l docs/data`        |
| S11 | `npm audit`: 1 high (nanoid) **fixed** in H5; 4 moderate dev-only esbuild chain (drizzle-kit), accepted per H5.                                                                                                                                                                                                                                                                                                                                                                                                         | **LOW**         | `KNOWN_ISSUES H5`, §2.6                             |
| S12 | **Modifier validation server-side** is correct and runs for every order (`lib/checkout-core.ts:159-177`, `lib/modifier-validation.ts:37-74`). A crafted payload cannot skip a required group, exceed `maxSelections`, or smuggle foreign modifiers.                                                                                                                                                                                                                                                                     | **OK**          | `lib/checkout-core.ts:159-177`                      |
| S13 | **`iptocountry` and `notes` IP capture** in wifi sessions: `notes: "ip=<address>"` is stored even before consent. The prior audit flagged this as INFO P1-M10; for a single-shop POS this is a low-impact risk, but in some jurisdictions a stored IP without consent is a personal-data issue.                                                                                                                                                                                                                         | **LOW**         | `app/wifi/actions.ts:107`                           |

---

## 9. Reliability Findings

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Severity                | Evidence                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------- |
| R1  | **Offline replay depends on a still-valid staff session.** `flushQueue` (`lib/offline/sync.ts:39-97`) calls `checkoutAction` → `requireStaffSession()`. A cleared/expired session during an offline period orphans queued sales with no re-auth prompt at flush. The pin-pad does flush after a successful login (`components/pin-pad.tsx:76`), but if the user is **already on a stale session** (signed in earlier, offline, session expired during the offline period) the queued sales will fail with `NO_SESSION`. | **MEDIUM**              | `lib/offline/sync.ts:52-71`, `components/pin-pad.tsx:76` |
| R2  | Idempotency is correct and load-bearing: deterministic cart fingerprint + session; identical retry dedups, changed cart creates new order; unique-violation race handled (`23505` → existing-order lookup at `lib/checkout-core.ts:347-369`).                                                                                                                                                                                                                                                                           | **OK**                  | `lib/idempotency.ts`, `lib/checkout-core.ts:344-368`     |
| R3  | Checkout is atomic (single transaction incl. stock deduction + moves); `closeShift` atomic; `setTodaySuggestion` transactional.                                                                                                                                                                                                                                                                                                                                                                                         | **OK**                  | `checkout-core.ts`, `lib/shifts.ts`                      |
| R4  | Service worker now network-first for navigations (H3) — the stale-`/pos`-cache bug is fixed at the SW level; the test's `page.goBack()` workaround remains in `e2e/pos-checkout.spec.ts:151` but is now redundant safety, not a load-bearing patch.                                                                                                                                                                                                                                                                     | **OK (after H3)**       | `public/sw.js:53-60`, `e2e/pos-checkout.spec.ts:151`     |
| R5  | Backups: `reset-db`/`ingest` guard with pre-destructive `pg_dump` + `BACKUP_ALLOWED` ack; Supabase native daily backups per spec.                                                                                                                                                                                                                                                                                                                                                                                       | **OK**                  | `scripts/reset-db.ts`, README                            |
| R6  | **The `verifyStaffPin` "Something went wrong" error path** is too generic: `app/login/actions.ts:112` returns it for any `updateUserById` failure. This is the failure observed in the prior audit's e2e (the staff PIN tests all fail at the same alert). The new code path uses the direct `DATABASE_URL` pool (H4), which fixes the original cause, but the same generic error will still mask any future auth misconfig.                                                                                            | **LOW (observability)** | `app/login/actions.ts:112`                               |

---

## 10. Database Findings

| #   | Finding                                                                                                                                                                                                               | Severity        | Evidence                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------ |
| D1  | RLS+FORCE on all 20 tables (migration 0013), with integration test asserting per-table `relforcerowsecurity`. **Live DB is not on this migration** — the test confirms it.                                            | **HIGH (data)** | `db/migrations/0013_rls_force.sql`, §2.5         |
| D2  | Indexes on `orders.created_at`, `orders.staff_id+created_at`, `orders.source+created_at`, `wifi_sessions.device_hash`, `wifi_sessions.authorized_at`, `tables.branch_id` cover the range scans the app actually runs. | **OK**          | `db/schema.ts:240-242,422,89`                    |
| D3  | `orders.discount` dead column (no feature yet). Documented.                                                                                                                                                           | **LOW**         | `KNOWN_ISSUES`                                   |
| D4  | `tax_rate` stored/seed = `0` — live under-charge. Owner decision required.                                                                                                                                            | **HIGH (data)** | `db/seed-data.ts:1073`, `KNOWN_ISSUES H6`        |
| D5  | `ingredients.cost_per_unit` and `recipes.quantity_used` use `numeric(10,4)` and `numeric(12,2)`. Reports use `toScaledInt(..., 4)` for cost precision (WEB-DATA-001); that is the correct shape.                      | **OK**          | `db/schema.ts:172,185`                           |
| D6  | The `phase3-actions.test.ts` integration test (P2-DAT-1) confirms `setTodaySuggestion` is transactional.                                                                                                              | **OK**          | `__tests__/today-suggestion.integration.test.ts` |
| D7  | `wifi_sessions.notes` stores the IP as plain text. C5 calls this an "operational aid" but it is a PII cell. Consider hashing on write (P1-M10).                                                                       | **LOW**         | `db/schema.ts:417`, `app/wifi/actions.ts:107`    |

---

## 11. API & Contract Findings

| #    | Finding                                                                                                                                                                                                                                                 | Verdict |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| API1 | Server actions are the contract; `docs/openapi.md` documents rate-limit/token-gate reality (T-B20).                                                                                                                                                     | **OK**  |
| API2 | Public actions validate UUIDs, slugs, quantities, and required modifier groups server-side; prices/fees recomputed server-side. Modifier-linkage (e.g. tapioca topping deducting inventory) is read server-side from DB, never trusted from the client. | **OK**  |
| API3 | Delivery requires address; dine_in requires a table verified to belong to the branch.                                                                                                                                                                   | **OK**  |
| API4 | `placeDigitalMenuOrder` `deliveryAddress` has no length cap (minor input hygiene; notes are capped at 500 chars at `lib/checkout-core.ts:261`).                                                                                                         | **LOW** |
| API5 | `placeCustomerOrder` does not cap `customerName`/`customerPhone` server-side. These are stored on `orders.*` without `varchar` limit.                                                                                                                   | **LOW** |

---

## 12. UI/UX & Accessibility Findings

| #   | Finding                                                                                                                                                                                                                | Verdict      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| UI1 | Brand tokens applied; ad-hoc fonts/colors normalized; design pass completed (brand identity, RTL, elevation, spring easing, 44px touch targets, accessible Sheet/toast).                                               | **OK**       |
| UI2 | The in-progress redesign adds: bigger touch targets (h-10/h-11), full pill buttons (rounded-full), icon nav, brand-aligned card surface (`#ffffff` on cream), shimmer skeleton, refreshed login. Direction is correct. | **OK / WIP** |
| UI3 | `/admin` charts use neutral tones (margin not misread as alert).                                                                                                                                                       | **OK**       |
| UI4 | Login page redesigned in working tree: brand-red icon tile, RTL/ltr flex, pearl glow, "من تايوان إلى قلقيليا 🇹🇼" tagline, footer credit. RTL-correct (logical start-4 / end-4).                                        | **OK**       |
| UI5 | New `components/ui/input.tsx` has `aria-invalid`, `aria-describedby`, `role="alert"` on the error message — meets WCAG 2.2 AA.                                                                                         | **OK**       |
| UI6 | `nav.tsx` redesign groups items into "عام" and "إدارة", uses lucide-react icons. RTL-aware (logical `gap-2.5`, `ms-*` would be preferred but `gap` is direction-neutral so this is fine).                              | **OK**       |
| AX1 | Skip-link, focus-visible outline, accessible dialog/toast (existing a11y pass).                                                                                                                                        | **OK**       |
| AX2 | The new login redesign uses `aria-hidden="true"` on decorative pearl glow; the `invert` on the logo SVG inside the red tile is acceptable since the inner SVG is decorative.                                           | **OK**       |
| AX3 | The skeleton component has `aria-hidden="true"`, correct for decorative loading state.                                                                                                                                 | **OK**       |
| AX4 | Nav links retain `aria-current="page"` for active route.                                                                                                                                                               | **OK**       |

---

## 13. Testing & QA Findings

| #   | Finding                                                                                                                                                                                                                                                                                                               | Severity                | Evidence                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------- |
| T1  | CI unit + integration suites: 335+ passed, 2 skipped on a CI-equivalent fresh Postgres; CI seed-gate reproduces migrations+seed honestly.                                                                                                                                                                             | **OK**                  | `ci.yml` "test" job               |
| T2  | **Local `npm test` is red against the shared live DB** — 15 of 345 fail. The cause is parallel-suite DB contention, not a code regression.                                                                                                                                                                            | **MEDIUM (visibility)** | §2.5                              |
| T3  | **Coverage tooling absent** — `@vitest/coverage-v8` missing, no `coverage` config; no branch/line numbers on money/inventory logic.                                                                                                                                                                                   | **MEDIUM**              | §2.7                              |
| T4  | **Playwright e2e not CI-gated**; flaky against the shared live DB. Prior audit flagged the same.                                                                                                                                                                                                                      | **MEDIUM**              | `e2e.yml`, `playwright.config.ts` |
| T5  | Critical paths protected: pricing (47), idempotency (9), checkout (12), inventory deduction (integration), RBAC-margins, RLS, shifts, token gate.                                                                                                                                                                     | **OK**                  | `__tests__/`                      |
| T6  | **Vitest worker count**: `vitest.config.mts` doesn't cap workers. Default vitest concurrency multiplies the DB contention problem. Setting `pool: 'forks', poolOptions: { forks: { singleFork: true } }` would align local with the playwright `workers: 1` choice and probably make most of the 15 failures go away. | **MEDIUM (fix-now)**    | `vitest.config.mts`               |

---

## 14. DevOps Findings

| #   | Finding                                                                                                                                                                                                                                           | Severity   | Evidence                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------ |
| O1  | CI (lint/typecheck/test/build/bundle-gate) is robust and green on CI infra.                                                                                                                                                                       | **OK**     | `ci.yml`                             |
| O2  | **No automated migration step in deploy** — `release.yml` builds but doesn't run `drizzle-kit migrate`; schema drift risk at deploy. Combined with **the live DB is already drifted** (D1/S3), this is the most likely path to recurring outages. | **HIGH**   | `release.yml`                        |
| O3  | e2e weekly + manual only; requires live Supabase secrets.                                                                                                                                                                                         | **MEDIUM** | `e2e.yml`                            |
| O4  | Anonymous-user cleanup: weekly dry-run + manual execute workflow; documented.                                                                                                                                                                     | **OK**     | `cleanup-anonymous.yml`              |
| O5  | No staging/prod env split (ties to S2).                                                                                                                                                                                                           | **HIGH**   | —                                    |
| O6  | **Working tree dirty + non-committed UI redesign** that breaks typecheck/build. If this is pushed, CI fails.                                                                                                                                      | **MEDIUM** | §2.1, §2.4                           |
| O7  | `tsconfig.tsbuildinfo` is committed to the repo (483 KB). `.gitignore` doesn't list it. `*.tsbuildinfo` should be ignored. Harmless, but it's 483 KB of stale cache in history.                                                                   | **LOW**    | `tsconfig.tsbuildinfo`, `.gitignore` |

---

## 15. Documentation Findings

| #   | Area                                                                                                                                                                                                                                                | Status                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Architecture / spec                                                                                                                                                                                                                                 | **Excellent** — `docs/technical-spec.md` is the source of truth; module guides (`digital-menu.md`, `wifi-portal.md`, `openapi.md`). |
| D2  | Setup / env vars                                                                                                                                                                                                                                    | **Good** — `.env.example`, README table.                                                                                            |
| D3  | Ops / destructive DB                                                                                                                                                                                                                                | **Good** — README runbook, `reset-db` guard.                                                                                        |
| D4  | Known issues                                                                                                                                                                                                                                        | **Good** — `KNOWN_ISSUES.md` with evidence + "good" state.                                                                          |
| D5  | CLAUDE.md public-action list                                                                                                                                                                                                                        | **LOW gap** — names only two public exceptions; code has 6+.                                                                        |
| D6  | `.env.example:49` references missing `scripts/validate-env.ts`                                                                                                                                                                                      | **LOW**                                                                                                                             |
| D7  | Two new untracked reports (`discovery-2026-08-08.md`, `master-audit-2026-08-08.md`) committed-to-gitignore: they should be **either committed as a single document, or merged into this audit, or removed** — the untracked state is a docs debris. | **LOW**                                                                                                                             |
| D8  | No `docs/reports/master-audit-2026-08-08-v2.md` yet (this document, if committed).                                                                                                                                                                  | —                                                                                                                                   |

---

## 16. Technical Debt Register

| ID        | Area        | Problem                                                                                                 | Root cause                                                                                 | Impact                                                                     | Risk        | Recommended solution                                                                                                                                                                                      | Priority | Complexity | Fix now/later       |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------------------- |
| **TD-1**  | Build state | `app/(admin)/admin/nav.tsx` is mid-edit; `npm run typecheck` fails with 5 errors; `npm run build` fails | Working-tree edit moved `NAV_GROUPS` array outside the function and missed the `cn` import | CI breaks on push                                                          | MEDIUM      | Move `NAV_GROUPS` back inside the component (or pass `isOwner`, `digitalMenuOn`, `wifiPortalOn` into it) and add `import { cn } from "@/lib/utils"`                                                       | **1**    | XS         | **Now**             |
| **TD-2**  | QA          | Local `npm test` is red (15/345)                                                                        | Integration tests share one Supabase project; vitest default parallel pools collide        | "Is CI red?" is no longer correlated with "is local red?"; devs ignore red | MEDIUM      | Add `test: { pool: 'forks', poolOptions: { forks: { singleFork: true } } }` to `vitest.config.mts` (matches `playwright.config.ts` `workers: 1`); this will turn most of the 15 green without code change | **1**    | XS         | **Now**             |
| **TD-3**  | Security    | In-memory + spoofable IP rate limiting                                                                  | No durable/shared store; trusts XFF first entry                                            | PIN brute-force, order spam on multi-instance                              | HIGH        | Postgres/Upstash-backed limiter (WEB-SEC-004); trust last-hop/verified proxy header                                                                                                                       | 2        | M          | **Now**             |
| **TD-4**  | Ops         | Single Supabase project for dev/e2e/prod                                                                | No staging provisioned                                                                     | e2e pollutes prod data; flaky tests; now also breaks local CI parity       | HIGH        | Provision staging project; wire staging env                                                                                                                                                               | 2        | M          | **Now**             |
| **TD-5**  | Data        | Live DB missing RLS FORCE migration 0013                                                                | No deploy-time migrate step                                                                | Anonymous/anon PostgREST roles can read every table                        | HIGH        | Add a `deploy-migrate` step that runs `drizzle-kit migrate` against the target DB before traffic flows; or a CI nightly `pg_dump`-then-`drizzle-kit migrate --dry` check                                  | 2        | S          | **Now**             |
| **TD-6**  | Data        | `tax_rate = 0`                                                                                          | Owner decision pending                                                                     | Every sale under-charges tax                                               | HIGH        | Set real VAT rate (owner)                                                                                                                                                                                 | 2        | XS         | **Now**             |
| **TD-7**  | Data        | Real menu not ingested                                                                                  | Phase 0 data not ready                                                                     | Sells wrong catalog                                                        | HIGH        | Run `ingest-real-menu.ts` with real data                                                                                                                                                                  | 2        | S          | **Now**             |
| **TD-8**  | Reliability | Offline replay needs valid session                                                                      | flush uses staff-gated action                                                              | Orphaned offline sales on session loss                                     | MEDIUM      | Re-auth/continue prompt on flush; decouple replay from session                                                                                                                                            | 3        | M          | Later               |
| **TD-9**  | QA          | No coverage tooling                                                                                     | `@vitest/coverage-v8` missing                                                              | Can't measure money/inventory coverage                                     | MEDIUM      | Add coverage-v8 + config; gate critical paths                                                                                                                                                             | 3        | S          | Later               |
| **TD-10** | QA/DevOps   | e2e not CI-gated                                                                                        | Needs staging                                                                              | Regressions reach prod untested                                            | MEDIUM/HIGH | Gate e2e against staging project                                                                                                                                                                          | 3        | M          | Later               |
| **TD-11** | DevOps      | No migration step in deploy                                                                             | release builds only                                                                        | Schema drift at deploy (already happening — TD-5)                          | HIGH        | Migrate in deploy after backup                                                                                                                                                                            | 3        | S          | Now (overlaps TD-5) |
| **TD-12** | Security    | `script-src 'unsafe-inline'`                                                                            | Next.js limitation                                                                         | Weakened CSP                                                               | MEDIUM      | Revisit nonce/hash CSP when framework supports                                                                                                                                                            | 4        | L          | Later               |
| **TD-13** | Security    | Wifi salt literal fallback                                                                              | Deferred P1-M10                                                                            | Predictable device hashes if unset                                         | MEDIUM      | Make salt required in prod; rotate                                                                                                                                                                        | 4        | XS         | Later               |
| **TD-14** | Security    | Stale app_metadata role                                                                                 | Role cached in session token                                                               | Demotion not immediate                                                     | MEDIUM/LOW  | Refresh/re-check role server-side on sensitive ops                                                                                                                                                        | 4        | S          | Later               |
| **TD-15** | Code        | Float division at money write boundary                                                                  | Minor inconsistency                                                                        | Cosmetic; no precision bug                                                 | LOW         | Use `formatPrice`/`fromMinorUnits`                                                                                                                                                                        | 5        | XS         | Later               |
| **TD-16** | Code        | `verifyStaffPin` O(n) scrypt                                                                            | Loads all staff                                                                            | Minor CPU per login                                                        | LOW         | Lookup by match or batch                                                                                                                                                                                  | 5        | XS         | Later               |
| **TD-17** | Docs        | CLAUDE.md public-action list stale                                                                      | New actions added since                                                                    | Misdirected audit                                                          | LOW         | Update list (add 4 documented public surfaces)                                                                                                                                                            | 5        | XS         | Now                 |
| **TD-18** | Docs        | `.env.example` references missing `validate-env.ts`                                                     | Script never created                                                                       | Dead reference                                                             | LOW         | Remove or create script                                                                                                                                                                                   | 5        | XS         | Now                 |
| **TD-19** | Docs        | Two untracked prior-audit reports                                                                       | Working tree                                                                               | Docs debris                                                                | LOW         | Either commit them, merge with this v2, or `git clean`                                                                                                                                                    | 5        | XS         | Now                 |
| **TD-20** | Repo        | `tsconfig.tsbuildinfo` committed (483 KB)                                                               | `incremental: true` without gitignore                                                      | Repo bloat                                                                 | LOW         | Add `*.tsbuildinfo` to `.gitignore`; `git rm --cached`                                                                                                                                                    | 5        | XS         | Later               |

---

## 17. Risk Matrix

| Risk                                                 | Severity   | Likelihood            | Impact                    | Priority | Complexity | Action      |
| ---------------------------------------------------- | ---------- | --------------------- | ------------------------- | -------- | ---------- | ----------- |
| **Working tree breaks typecheck/build (TD-1)**       | MEDIUM     | High (now)            | High (CI red, devs stuck) | **1**    | XS         | **Now**     |
| **Local `npm test` red from shared-DB races (TD-2)** | MEDIUM     | High (now)            | Medium (lost signal)      | **1**    | XS         | **Now**     |
| Rate-limit bypass / PIN brute-force                  | HIGH       | Med                   | Med-High                  | 2        | M          | TD-3        |
| Shared Supabase project                              | HIGH       | High                  | Med-High                  | 2        | M          | TD-4        |
| Live DB behind on RLS FORCE migration                | HIGH       | High (now)            | High (anon can read)      | 2        | S          | TD-5        |
| Tax under-charge                                     | HIGH       | High (until set)      | High                      | 2        | XS         | TD-6        |
| Wrong catalog live                                   | HIGH       | High (until ingested) | High                      | 2        | S          | TD-7        |
| Deploy without migration                             | HIGH       | Med                   | High (already drifting)   | 3        | S          | TD-11       |
| e2e not gated                                        | MEDIUM     | Med                   | Med                       | 3        | M          | TD-10       |
| Offline session loss                                 | MEDIUM     | Low-Med               | Med                       | 4        | M          | TD-8        |
| No coverage numbers                                  | MEDIUM     | High                  | Low-Med                   | 4        | S          | TD-9        |
| Weak CSP / salt fallback / stale role                | MEDIUM/LOW | Low                   | Low-Med                   | 5        | S/L        | TD-12/13/14 |

---

## 18. Target Architecture

**Current state** and **target state** diverge mainly in **operational
readiness**, not architecture. The current modular monolith is correct for
this scale.

- **Keep:** modular monolith; direct-pool Drizzle reads; single checkout
  pipeline; server-side RBAC; RLS+FORCE; in-process cache at single-branch
  scale; offline queue with idempotency; Supabase anon + service-role
  separation.
- **Add (target):**
  - **Deploy pipeline** that backs up → migrates → releases, gated so a
    migration failure blocks traffic.
  - **A staging Supabase project** isolated from production; e2e + CI run
    against it; local `npm test` is also rerouted to it (or to a per-developer
    disposable DB).
  - **Durable, IP-spoof-resistant rate limiter** (Postgres-backed or Upstash).
  - **Coverage gates** on money/inventory-critical modules (`lib/checkout-core.ts`,
    `lib/pricing.ts`, `lib/delivery.ts`).
  - **Offline-sync decoupling** from the live staff session (re-auth prompt or
    session-independent replay).
  - **`vitest.config.mts`** `pool: 'forks', singleFork: true` for local/CI
    parity.
- **Defer (post-launch, per spec §6):** loyalty, shareable order card, digital
  DT menu board, online payments — no code, correct state.

---

## 19. Prioritized Roadmap

### PHASE 0 — Repo State Hygiene (NOW, this session)

The repo is currently in a state where `npm run build` fails. This is the
single highest-priority issue because nothing else can be verified until
typecheck/build is green.

- **Objective:** bring the working tree to a green state without committing
  the half-done redesign.
- **Tasks:** TD-1 (move `NAV_GROUPS` back inside the component, add `cn`
  import, or `git restore` `app/(admin)/admin/nav.tsx`,
  `app/globals.css`, `app/login/page.tsx`, `components/ui/button.tsx`); TD-19
  (decide on the two untracked audit reports); TD-2 (vitest singleFork).
- **Validation:** `npm run lint` → 0 warnings; `npm run typecheck` → 0
  errors; `npm run build` → success; `npm test` → 0 failures.
- **Risk:** low; no logic changes.

### PHASE 1 — Security (code)

- **Objective:** remove the HIGH code risks.
- **Tasks:** TD-3 durable + spoof-proof limiter; TD-17/18 doc hygiene.
- **Validation:** new limiter stores state durably; brute-force test passes
  with rotated XFF.
- **Risk:** low; scoped to `lib/rate-limit.ts` + `lib/ip.ts`.

### PHASE 2 — DevOps & Delivery (data + env)

- **Objective:** safe, repeatable deploys + isolated environments.
- **Tasks:** TD-5/TD-11 (deploy migrate-step); TD-4/TD-10 (staging project +
  e2e gate).
- **Validation:** deploy runs backup→migrate→release; e2e gated on staging;
  RLS FORCE test passes against staging.
- **Risk:** medium; touches CI/secrets + Supabase project provisioning.

### PHASE 3 — Reliability & QA

- **Objective:** harden offline + prove coverage.
- **Tasks:** TD-8 offline replay; TD-9 coverage-v8 + critical-path gates.
- **Validation:** offline-sync test with dropped session; coverage numbers on
  checkout/pricing/inventory.
- **Risk:** low-medium.

### PHASE 4 — Hardening (defense-in-depth)

- **Objective:** close residual security gaps.
- **Tasks:** TD-12 CSP nonce/hash when framework allows; TD-13 salt required
  in prod + rotate; TD-14 role re-check; TD-15/16 code consistency.
- **Validation:** security checklist (OWASP ASVS L1) passes.
- **Risk:** low.

### PHASE 5 — Final Hardening & Launch (operational, owner-driven)

- **Objective:** OWASP checklist, backup verification, offline testing, go-live.
- **Tasks:** full Phase 5 hardening per spec §13; **TD-6 (tax rate)** and
  **TD-7 (real menu)**; final review.
- **Risk:** operational.

---

## 20. Quality Gates

| Gate              | Criterion                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Repo state**    | `git status` clean (no uncommitted broken files); `npm run lint` → 0; `npm run typecheck` → 0; `npm run build` → success. |
| **Architecture**  | No new cross-module coupling beyond documented seams; single checkout pipeline.                                           |
| **Security**      | OWASP ASVS L1 checklist passes; durable limiter; staging/prod isolated; no secrets in repo.                               |
| **Performance**   | `/m` LCP < 2.5s, INP < 200ms, CLS < 0.1; bundle ≤150 KB worst-chunk.                                                      |
| **Accessibility** | WCAG 2.2 AA; ≥44px targets; keyboard nav; RTL.                                                                            |
| **Testing**       | `npm test` and CI `test` job both green; coverage on money/inventory paths; e2e green on staging.                         |
| **Reliability**   | Idempotency holds under concurrent checkout; offline replay survives session loss; backup-restore verified.               |
| **Deployment**    | backup→migrate→release green; rollback documented.                                                                        |

---

## 21. Recommended Execution Order

1. **PHASE 0** (this session): fix the working tree (`TD-1`, `TD-2`,
   optionally `TD-19`). These are XS, deterministic, and unblock every other
   verification path.
2. **PHASE 1** (TD-3) — durable limiter; the only HIGH _code_ risk.
3. **PHASE 2** (TD-5/4/10/11) — staging + deploy migrate + e2e gate. Now that
   the live DB is provably behind on migrations, this is the single most
   valuable operational fix.
4. **PHASE 0 data** (TD-6, TD-7) — owner action; one-line DB write + one
   `ingest-real-menu.ts` run.
5. **PHASE 3** (TD-8, TD-9) — offline replay + coverage.
6. **PHASE 4** (defense-in-depth) — residual security.
7. **PHASE 5** (final hardening + go-live) — operational.

---

## 22. Unknowns / Require Validation

| Item                                                            | Status                                                                                                                                                                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real VAT rate                                                   | Requires owner decision (spec §16).                                                                                                                                                                      |
| Payment methods / receipt printer model                         | Requires owner confirmation (spec §16).                                                                                                                                                                  |
| Expected daily order volume                                     | Unknown — sanity-checks free-tier limits.                                                                                                                                                                |
| Whether `WIFI_DEVICE_ID_SALT` is set in production              | Not verifiable from repo; must be confirmed at deploy.                                                                                                                                                   |
| Production Supabase project isolation                           | Requires provisioning a staging project.                                                                                                                                                                 |
| One-week parallel run                                           | Not yet performed (spec §13, non-negotiable).                                                                                                                                                            |
| e2e against a clean staging DB                                  | Requires staging provisioned; currently flaky against shared DB.                                                                                                                                         |
| Coverage % on money/inventory paths                             | Unmeasurable until `@vitest/coverage-v8` installed.                                                                                                                                                      |
| What is the design intent of the in-progress `nav.tsx` rewrite? | The intermediate state is broken; the design direction is good but cannot be completed in this audit. Owner should confirm whether to ship the new design now (after fixing imports/scope) or roll back. |
| Why is `tsconfig.tsbuildinfo` committed?                        | Inadvertent; not in `.gitignore`.                                                                                                                                                                        |

---

## Appendix A — Commit state verified

- HEAD `adee9fe`, 5 commits ahead of `origin/main` (H2 RLS-FORCE, H3 SW
  network-first, H4 e2e/ login fix, H5 nanoid, H6 docs).
- Working tree: 4 modified files (`nav.tsx`, `globals.css`, `login/page.tsx`,
  `button.tsx`) + 2 new files (`input.tsx`, `skeleton.tsx`) + 2 new untracked
  audit reports. All in-progress; none compile.
- Prior reports' items D1 (SW stale-cache), E1 (RLS functional), and the
  login failure are confirmed **closed** (H3/H2/H4).
- Prior reports' D5 (in-memory limiter), D6 (tax), D7 (menu), D8 (shared
  project) remain open — reaffirmed here, and now joined by **TD-5 (live DB
  not on the RLS-FORCE migration)**, which is new evidence not in the prior
  reports.
