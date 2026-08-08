# Master Engineering Audit — Ayasofia Sweet

|            |                                                                    |
| ---------- | ------------------------------------------------------------------ |
| **Date**   | 2026-08-08                                                         |
| **Type**   | Full-project engineering audit                                     |
| **Scope**  | Read-only — no code changed                                        |
| **Output** | Findings, risk matrix, debt register, target architecture, roadmap |

This audit verifies the live repository state (HEAD `adee9fe`, 5 commits ahead of
`origin/main`). It supersedes but builds on the prior
`docs/reports/discovery-2026-08-08.md` — the five commits since that report
(H2–H6) have closed several of its open items. No code was modified.

---

## 1. Executive Summary

Ayasofia Sweet is an unusually well-engineered modular-monolith for its stage.
It is a Next.js 16 (App Router) + TypeScript + PostgreSQL (Supabase) + Drizzle
POS/ordering/inventory platform for a bubble-tea and dessert café. The money,
inventory, authorization, and idempotency paths are handled with genuine
discipline: integer-minor-unit pricing, server-side price recomputation, a
shared atomic checkout pipeline, per-order capability tokens, RLS with FORCE,
server-side RBAC, rate limiting, an offline IndexedDB sync queue, Sentry, and a
CI seed-gate that runs migrations+tests against a fresh Postgres each run.

**The codebase is not the launch blocker.** The launch blockers are **data and
environment readiness**:

1. **The real menu is not loaded** — the live DB still serves the demo catalog.
2. **`tax_rate` is still `0`** — every sale under-charges tax until the owner
   sets a real rate.
3. **There is one shared Supabase project** for local dev, e2e, and future
   production — e2e writes real orders against it, drifting state and polluting
   data.
4. **The mandatory one-week parallel run** (spec §13, Phase 5) has not happened.

The most important **code** weaknesses confirmed in this pass:

- **Rate limiting is in-memory and its IP discriminator is spoofable** (HIGH).
- **e2e is not CI-gated and has no durable coverage tooling** (MEDIUM/HIGH).
- **Deploy pipeline has no automated migration step** (MEDIUM).
- **Offline-sync replay depends on a still-valid staff session** (MEDIUM).
- **Role changes in `app_metadata` don't propagate until session refresh** (MEDIUM/LOW).

Strengths to preserve: the single-pipeline checkout with server-side pricing and
idempotency, the RLS+FORCE posture, the RBAC gate discipline, the money-boundary
discipline, and the CI seed gate.

---

## 2. Product Understanding

- **What it does:** staff POS (`/pos`), Drive-Thru (`/drive-thru`), Kitchen
  Display (`/kitchen`), customer QR self-order digital menu (`/m/[branchSlug]`),
  a Wi-Fi captive portal (`/wifi`), and an owner admin dashboard (menu,
  inventory, reports, staff, settings, digital-menu/wifi config).
- **Users:** cashiers/baristas (PIN login), a manager, and the owner; plus
  walk-in customers (no login) and Wi-Fi guests.
- **Critical business flows:** order entry → checkout → inventory deduction;
  report reconciliation (Z-report); shift open/close; offline resilience.
- **High-risk areas:** money totals/tax, inventory deduction, RBAC (cashier must
  not see margins / edit prices), public order + status endpoints, offline
  replay without double-charge.
- **Monetization/latency-sensitive:** `/m` (customer mobile, Core Web Vitals),
  `/kitchen` realtime, `/drive-thru` tap count.

---

## 3. Current Architecture

- **Pattern:** Modular Monolith — one Next.js deployable, one Postgres schema,
  organized by `app/(pos)`, `app/(admin)`, `app/m`, `app/wifi`, `app/order`.
- **Data access:** Drizzle over a direct `pg` Pool (`lib/db/index.ts`) using
  `DATABASE_URL` (the `postgres` superuser, which bypasses RLS). Supabase
  service-role client used only for auth-user promotion; anon/SSR clients for
  session. RLS+FORCE (migration 0013) is defense-in-depth for the PostgREST
  surface, not the app's primary enforcement layer.
- **Auth:** anonymous Supabase sign-in → `verifyStaffPin` promotes via
  `updateUserById(app_metadata.staff_id, role)`; `requireStaffSession` is the
  server-side gate on every mutating action.
- **Checkout:** single `executeCheckout` in `lib/checkout-core.ts` used by both
  POS and digital menu; server-side recalc, idempotency, transaction, RLS-safe.
- **Realtime:** `/kitchen` via server-side refetch + Supabase Realtime trigger.
- **Offline:** service worker (network-first navigations) + Dexie IndexedDB
  queue + sync engine on reconnect.
- **Observability:** Sentry with PII scrubbing; lightweight breadcrumb/counter
  proxy for throttled/failed checkouts.

---

## 4. Architecture Findings

| #   | Finding                                                                                                                                                                   | Evidence                                                          | Verdict             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------- |
| A1  | Direct-DB pool bypasses RLS; enforcement correctly lives in `requireStaffSession` + per-action gates. Coherent, but RLS is not load-bearing for app reads.                | `lib/db/index.ts`, `verifyStaffPin` switch to direct pool (H4)    | **OK / documented** |
| A2  | Public server-action surface is larger than CLAUDE.md's "two exceptions" list (~8 public actions). Behavior is deliberate (feature-gated, throttled); documentation lags. | CLAUDE.md vs `app/digital-menu/actions.ts`, `app/wifi/actions.ts` | **LOW (doc gap)**   |
| A3  | Single shared Supabase project across dev/e2e/prod.                                                                                                                       | `.env.local`, `e2e.yml`, KNOWN_ISSUES H6                          | **HIGH (ops)**      |
| A4  | Modular monolith seams are clean; no evidence of circular deps or hidden global state (rate-limit Maps and catalog cache are intentional in-process singletons).          | dependency graph                                                  | **OK**              |

---

## 5. Code Quality Findings

| #   | Finding                                                                                                                                                                                                                                                          | Evidence                                         | Verdict               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------- |
| C1  | Money boundary is disciplined: integer agorot, `toScaledInt` string-only conversion, tax/delivery in integer math.                                                                                                                                               | `lib/pricing.ts`, `lib/checkout-core.ts:191-221` | **OK**                |
| C2  | `(subtotal / 100).toFixed(2)` at the write boundary is technically a raw float on a money value. Safe for integer agorot ≤ 2^53 (rounding error ≪ 0.005) but inconsistent with the "no float" doctrine; `formatPrice`/`fromMinorUnits` is the sanctioned helper. | `lib/checkout-core.ts:191,203,221`               | **LOW (consistency)** |
| C3  | `verifyStaffPin` scrypt-verifies **all** active staff hashes on each login (O(n) CPU). Fine at current scale; a per-staff lookup or batching would be cleaner.                                                                                                   | `app/login/actions.ts:86-91`                     | **LOW**               |
| C4  | No TODO/FIXME/console.log debt in app/lib; dead `orders.discount` column documented.                                                                                                                                                                             | grep + KNOWN_ISSUES                              | **OK**                |
| C5  | `.env.example:49` references `scripts/validate-env.ts`, which does not exist.                                                                                                                                                                                    | `ls scripts/`                                    | **LOW (dead ref)**    |

---

## 6. Performance Findings

| #   | Finding                                                                                                                                               | Evidence                                      | Verdict        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------- |
| P1  | In-memory catalog + feature-flag cache (60s/30s TTL) is single-instance; on multi-instance/Vercel it self-heals within TTL. Correct for target scale. | `lib/cache.ts`, KNOWN_ISSUES P2-PERF-2        | **OK / noted** |
| P2  | Bundle gate is a worst-case-chunk proxy (≤150 KB gzip) because Turbopack no longer exposes per-route First Load JS. Font pruned −16%.                 | `scripts/bundle-budget.mjs`, MARATHON T-C1/C2 | **OK / noted** |
| P3  | `/kitchen` polls + Realtime; `/m` status polls on a per-IP per-order throttle. No N+1 in checkout (index-aligned).                                    | `app/order/status`, schema indexes            | **OK**         |
| P4  | No confirmed backend bottleneck at single-branch load; pooler `connection_limit=10` raised.                                                           | README, `.env.example`                        | **OK**         |

---

## 7. Security Findings

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Severity       | Evidence                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------- |
| S1  | **Rate limiter is in-memory AND trusts the first `X-Forwarded-For` entry.** `callerIp()` (`lib/ip.ts:16-18`) returns the leftmost XFF value; on any deployment where a client-influenced header reaches the app, a caller can rotate XFF to defeat the per-IP login cap and public throttles. PIN is 4-digit (10k space) with scrypt stored hashes — online spray is feasible if the IP cap is bypassed. On Vercel serverless, counters are also per-instance. The durable limiter (WEB-SEC-004) is still unimplemented. | **HIGH**       | `lib/rate-limit.ts`, `lib/ip.ts`, KNOWN_ISSUES H6 |
| S2  | **Single shared Supabase project** — e2e writes real orders/anon users against the same DB a launch would use.                                                                                                                                                                                                                                                                                                                                                                                                           | **HIGH**       | `e2e.yml`, `.env.local`, KNOWN_ISSUES H6          |
| S3  | **CSP `script-src 'unsafe-inline'`** weakens XSS defense (framework requirement, documented). Residual risk, not exploitable without another XSS vector; no `dangerouslySetInnerHTML` found.                                                                                                                                                                                                                                                                                                                             | **MEDIUM**     | `lib/security-headers.ts:117`                     |
| S4  | **Wifi device-id salt falls back to a known literal** `"ayasofia-wifi"` when `WIFI_DEVICE_ID_SALT` is unset. Deferred (P1-M10); if unset in prod, hashes are predictable.                                                                                                                                                                                                                                                                                                                                                | **MEDIUM**     | KNOWN_ISSUES P1-M10                               |
| S5  | **Stale `app_metadata` role after re-assignment.** `requireStaffSession` reads role from the session token; a demoted staff keeps old privileges until the token refreshes/they re-login.                                                                                                                                                                                                                                                                                                                                | **MEDIUM/LOW** | `lib/auth.ts:111-123`                             |
| S6  | Order-status token gate is correct: UUID pre-validation, per-IP per-order throttle, missing-token ≡ missing-order (no existence leak).                                                                                                                                                                                                                                                                                                                                                                                   | **OK**         | `app/order/status/.../actions.ts`                 |
| S7  | Product `imageUrl` origin allowlist + `next.config` remotePatterns constrain image loading (SSRF/XSS control).                                                                                                                                                                                                                                                                                                                                                                                                           | **OK**         | T-B6, `next.config.ts`                            |
| S8  | PIN uniqueness enforced on create/update against all other active staff.                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **OK**         | `admin/staff/actions.ts`                          |
| S9  | Secrets: service-role server-only, `.env.local` gitignored/untracked, demo xlsx owner-only mode.                                                                                                                                                                                                                                                                                                                                                                                                                         | **OK**         | `lib/supabase/service.ts`, `ls -l docs/data`      |
| S10 | `npm audit`: 1 high (nanoid) **fixed** (H5); 4 moderate dev-only esbuild chain (drizzle-kit); `--force` fix is a breaking downgrade — accepted.                                                                                                                                                                                                                                                                                                                                                                          | **LOW**        | KNOWN_ISSUES H5                                   |

---

## 8. Reliability Findings

| #   | Finding                                                                                                                                                                                                                                                                                          | Severity   | Evidence                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------- |
| R1  | **Offline replay depends on a still-valid staff session.** `flushQueue` replays via `checkoutAction` → `requireStaffSession()`. Works while the anon/staff session cookie persists, but a cleared/expired session during an offline period orphans queued sales with no re-auth prompt at flush. | **MEDIUM** | `lib/offline/sync.ts:52`, `lib/offline/queue.ts`     |
| R2  | Idempotency is correct and load-bearing: deterministic cart fingerprint + session; identical retry dedups, changed cart creates new order; unique-violation race handled.                                                                                                                        | **OK**     | `lib/idempotency.ts`, `lib/checkout-core.ts:344-368` |
| R3  | Checkout is atomic (single transaction incl. stock deduction + moves); `closeShift` atomic; `setTodaySuggestion` transactional.                                                                                                                                                                  | **OK**     | `checkout-core.ts`, `lib/shifts.ts`                  |
| R4  | Backups: `reset-db`/`ingest` guard with pre-destructive `pg_dump` + `BACKUP_ALLOWED` ack; Supabase native daily backups per spec.                                                                                                                                                                | **OK**     | `scripts/reset-db.ts`, README                        |

---

## 9. Database Findings

| #   | Finding                                                                                                                                                                                     | Severity        | Evidence                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------- |
| D1  | RLS now FORCEd on all 20 tables (default-deny) with an integration test asserting anon-denied and staff-JWT-claim allowed for orders.                                                       | **OK**          | migration 0013, `__tests__/rls.integration.test.ts` |
| D2  | Indexes on `orders.created_at`, `orders.staff_id+created_at`, `orders.source+created_at`, `wifi_sessions.device_hash`, `wifi_sessions.authorized_at`, `tables.branch_id` cover range scans. | **OK**          | `db/schema.ts`                                      |
| D3  | `orders.discount` dead column (no feature yet). Documented.                                                                                                                                 | **LOW**         | KNOWN_ISSUES                                        |
| D4  | `tax_rate` stored/seed = `0` — live under-charge. Owner decision required.                                                                                                                  | **HIGH (data)** | `db/seed-data.ts:1073`, KNOWN_ISSUES H6             |
| D5  | No DB-level rate-limit/shared-cache table yet (ties to S1).                                                                                                                                 | **MEDIUM**      | —                                                   |

---

## 10. API / Contract Findings

| #    | Finding                                                                                                                         | Verdict |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ------- |
| API1 | Server actions are the contract; `docs/openapi.md` documents rate-limit/token-gate reality (updated post-B1/B2).                | **OK**  |
| API2 | Public actions validate UUIDs, slugs, quantities, and required modifier groups server-side; prices/fees recomputed server-side. | **OK**  |
| API3 | Delivery requires address; dine_in requires a table verified to belong to the branch.                                           | **OK**  |
| API4 | `placeDigitalMenuOrder` delivery address has no length cap (minor input hygiene; notes are capped).                             | **LOW** |

---

## 11. UI/UX Findings

Verified via the design-review artifacts (`docs/design-review/before` vs `after`).
The project completed a design pass (brand tokens, typography, RTL, elevation,
spring easing, 44px touch targets, accessible Sheet/toast). The audit scope here
is to document status, not redesign.

| #   | Finding                                                                                          | Verdict |
| --- | ------------------------------------------------------------------------------------------------ | ------- |
| UI1 | Brand tokens (`#DC0000` red, cream, ink, status colors) applied; ad-hoc fonts/colors normalized. | **OK**  |
| UI2 | RTL-first with Arabic/English; logical (`ms-*`) spacing.                                         | **OK**  |
| UI3 | Touch targets ≥44px on POS/admin actions; toast a11y (pause on hover, Escape, keyboard).         | **OK**  |
| UI4 | `/admin` charts use neutral tones (margin not misread as alert).                                 | **OK**  |

---

## 12. Accessibility Findings

| #   | Finding                                                                                                     | Verdict    |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------- |
| AX1 | WCAG 2.2 AA targets: contrast on brand-red surfaces corrected, keyboard nav, accessible dialog/toast, ARIA. | **OK**     |
| AX2 | e2e a11y specs exist (toast, pin-pad, contrast) but are not CI-gated.                                       | **MEDIUM** |

---

## 13. Testing Findings

| #   | Finding                                                                                                                                           | Severity        | Evidence                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------- |
| T1  | Unit + integration suites: 335+ passed, 2 skipped on a CI-equivalent fresh Postgres; CI seed-gate reproduces migrations+seed honestly.            | **OK**          | MARATHON, discovery §2     |
| T2  | **Coverage tooling absent** — `@vitest/coverage-v8` missing, no `coverage` config; no branch/line numbers on money/inventory logic.               | **MEDIUM**      | KNOWN_ISSUES H6            |
| T3  | **Playwright e2e not CI-gated**; flaky against the shared live DB (drifted prices, anon-sign-in throttling).                                      | **MEDIUM/HIGH** | KNOWN_ISSUES, discovery D2 |
| T4  | Critical paths protected: pricing (47), idempotency (9), checkout (12), inventory deduction (integration), RBAC-margins, RLS, shifts, token gate. | **OK**          | `__tests__/`               |

---

## 14. DevOps Findings

| #   | Finding                                                                                                                              | Severity   | Evidence                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------- |
| O1  | CI (lint/typecheck/test/build/bundle-gate) is robust and green.                                                                      | **OK**     | `ci.yml`                |
| O2  | **No automated migration step in deploy** — `release.yml` builds but doesn't run `drizzle-kit migrate`; schema drift risk at deploy. | **MEDIUM** | `release.yml`           |
| O3  | e2e weekly + manual only; requires live Supabase secrets.                                                                            | **MEDIUM** | `e2e.yml`               |
| O4  | Anonymous-user cleanup: weekly dry-run + manual execute workflow; documented.                                                        | **OK**     | `cleanup-anonymous.yml` |
| O5  | No staging/prod env split (ties to S2).                                                                                              | **HIGH**   | —                       |

---

## 15. Documentation Findings

| Area                         | Status                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Architecture / spec          | **Excellent** — `docs/technical-spec.md` is the source of truth; module guides (`digital-menu.md`, `wifi-portal.md`, `openapi.md`). |
| Setup / env vars             | **Good** — `.env.example`, README table.                                                                                            |
| Ops / destructive DB         | **Good** — README runbook, `reset-db` guard.                                                                                        |
| Known issues                 | **Good** — `KNOWN_ISSUES.md` with evidence + "good" state.                                                                          |
| CLAUDE.md public-action list | **LOW gap** — names only two public exceptions; code has ~8.                                                                        |

---

## 16. Technical Debt Register

| ID    | Area        | Problem                                             | Root cause                                        | Impact                                        | Risk        | Recommended solution                                                                | Priority | Complexity | Fix now/later |
| ----- | ----------- | --------------------------------------------------- | ------------------------------------------------- | --------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- | -------- | ---------- | ------------- |
| TD-1  | Security    | In-memory + spoofable IP rate limiting              | No durable/shared store; trusting XFF first entry | PIN brute-force, order spam on multi-instance | HIGH        | Postgres/Upstash-backed limiter (WEB-SEC-004); trust last-hop/verified proxy header | 1        | M          | Now           |
| TD-2  | Ops         | Single Supabase project for dev/e2e/prod            | No staging provisioned                            | e2e pollutes prod data; flaky tests           | HIGH        | Provision staging project; wire staging env                                         | 1        | M          | Now           |
| TD-3  | Data        | `tax_rate = 0`                                      | Owner decision pending                            | Every sale under-charges tax                  | HIGH        | Set real VAT rate (owner)                                                           | 1        | XS         | Now           |
| TD-4  | Data        | Real menu not ingested                              | Phase 0 data not ready                            | Sells wrong catalog                           | HIGH        | Run `ingest-real-menu.ts` with real data                                            | 1        | S          | Now           |
| TD-5  | QA          | No coverage tooling                                 | `@vitest/coverage-v8` missing                     | Can't measure money/inventory coverage        | MEDIUM      | Add coverage-v8 + config; gate critical paths                                       | 3        | S          | Later         |
| TD-6  | QA/DevOps   | e2e not CI-gated                                    | Needs live Supabase + staging                     | Regressions reach prod untested               | MEDIUM/HIGH | Gate e2e against staging project                                                    | 2        | M          | Later         |
| TD-7  | DevOps      | No migration step in deploy                         | release builds only                               | Schema drift at deploy                        | MEDIUM      | Migrate in deploy after backup                                                      | 2        | S          | Later         |
| TD-8  | Reliability | Offline replay needs valid session                  | flush uses staff-gated action                     | Orphaned offline sales on session loss        | MEDIUM      | Re-auth/continue prompt on flush; decouple replay from session                      | 3        | M          | Later         |
| TD-9  | Security    | `script-src 'unsafe-inline'`                        | Next.js limitation                                | Weakened CSP                                  | MEDIUM      | Revisit nonce/hash CSP when framework supports                                      | 4        | L          | Later         |
| TD-10 | Security    | Wifi salt literal fallback                          | Deferred P1-M10                                   | Predictable device hashes if unset            | MEDIUM      | Make salt required in prod; rotate                                                  | 4        | XS         | Later         |
| TD-11 | Security    | Stale app_metadata role                             | Role cached in session token                      | Demotion not immediate                        | MEDIUM/LOW  | Refresh/re-check role server-side on sensitive ops                                  | 4        | S          | Later         |
| TD-12 | Code        | Float division at money write boundary              | Minor inconsistency                               | Cosmetic; no precision bug                    | LOW         | Use `formatPrice`/`fromMinorUnits`                                                  | 5        | XS         | Later         |
| TD-13 | Code        | `verifyStaffPin` O(n) scrypt                        | Loads all staff                                   | Minor CPU per login                           | LOW         | Lookup by match or batch                                                            | 5        | XS         | Later         |
| TD-14 | Docs        | CLAUDE.md public-action list stale                  | New actions added since                           | Misdirected audit                             | LOW         | Update list                                                                         | 5        | XS         | Now           |
| TD-15 | Docs        | `.env.example` references missing `validate-env.ts` | Script never created                              | Dead reference                                | LOW         | Remove or create script                                                             | 5        | XS         | Now           |

---

## 17. Risk Matrix

| Risk                                  | Severity   | Likelihood            | Impact   | Priority | Complexity | Action     |
| ------------------------------------- | ---------- | --------------------- | -------- | -------- | ---------- | ---------- |
| Rate-limit bypass / PIN brute-force   | HIGH       | Med                   | Med-High | 1        | M          | TD-1       |
| Shared Supabase project               | HIGH       | High                  | Med-High | 1        | M          | TD-2       |
| Tax under-charge                      | HIGH       | High (until set)      | High     | 1        | XS         | TD-3       |
| Wrong catalog live                    | HIGH       | High (until ingested) | High     | 1        | S          | TD-4       |
| Deploy without migration              | MEDIUM     | Med                   | Med      | 2        | S          | TD-7       |
| e2e not gated                         | MEDIUM     | Med                   | Med      | 2        | M          | TD-6       |
| Offline session loss                  | MEDIUM     | Low-Med               | Med      | 3        | M          | TD-8       |
| No coverage numbers                   | MEDIUM     | High                  | Low-Med  | 3        | S          | TD-5       |
| Weak CSP / salt fallback / stale role | MEDIUM/LOW | Low                   | Low-Med  | 4        | S/L        | TD-9/10/11 |

---

## 18. Target Architecture (unchanged — current is appropriate)

**CURRENT STATE** and **TARGET STATE** diverge mainly in **operational
readiness**, not architecture:

- **Keep:** modular monolith; direct-pool Drizzle reads; single checkout
  pipeline; server-side RBAC; RLS+FORCE; in-process cache at single-branch
  scale; offline queue with idempotency.
- **Add (target):**
  - Durable, IP-spoof-resistant rate limiter (Postgres-backed or Upstash) —
    removes the multi-instance + spoofing caveats.
  - A **staging Supabase project** isolated from production; e2e + CI run
    against it.
  - A **deploy pipeline** that backs up, migrates, then releases; e2e gated on
    staging.
  - **Coverage gates** on money/inventory-critical modules.
  - **Offline-sync decoupling** from the live staff session (re-auth prompt or
    session-independent replay).
- **Defer (post-launch, per spec §6):** loyalty, shareable order card, digital
  DT menu board, online payments — no code, correct state.

---

## 19. Prioritized Roadmap

### PHASE 0 — Critical Risks (data + environment) — _blocks launch_

- **Objective:** make the system safe to run for real revenue.
- **Tasks:** (1) owner sets real `tax_rate`; (2) complete real menu data and run
  `ingest-real-menu.ts`; (3) provision staging Supabase project and wire env;
  (4) complete the mandatory one-week parallel run (spec §13).
- **Validation:** live DB serves the real catalog; tax correct; e2e green
  against staging; parallel-run checklist signed off.
- **Risk:** none — pure readiness.

### PHASE 1 — Foundation / Security (code)

- **Objective:** remove the code-level HIGH risks.
- **Tasks:** TD-1 durable + spoof-proof limiter; TD-14/15 doc hygiene.
- **Validation:** new limiter stores state durably; brute-force test passes with
  rotated XFF; suites green.
- **Risk:** low; scoped to `lib/rate-limit.ts` + `lib/ip.ts`.

### PHASE 2 — DevOps & Delivery

- **Objective:** safe, repeatable deploys.
- **Tasks:** TD-7 migrate-in-deploy (with backup guard); TD-2/TD-6 staging wiring
  - e2e gate.
- **Validation:** deploy runs backup→migrate→release; e2e gated on staging.
- **Risk:** medium; touches CI/secrets.

### PHASE 3 — Reliability & QA

- **Objective:** harden offline + prove coverage.
- **Tasks:** TD-8 offline replay; TD-5 coverage-v8 + critical-path gates.
- **Validation:** offline-sync test with dropped session; coverage numbers on
  checkout/pricing/inventory.
- **Risk:** low-medium.

### PHASE 4 — Hardening (defense-in-depth)

- **Objective:** close residual security gaps.
- **Tasks:** TD-9 CSP nonce/hash when framework allows; TD-10 salt required in
  prod + rotate; TD-11 role re-check; TD-12/13 code consistency.
- **Validation:** security checklist (OWASP ASVS L1) passes.
- **Risk:** low.

### PHASE 5 — Final hardening & launch

- **Objective:** OWASP checklist, backup verification, offline testing, go-live.
- **Tasks:** full Phase 5 hardening per spec §13; final review.
- **Risk:** operational.

---

## 20. Quality Gates

| Gate              | Criterion                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| **Architecture**  | No new cross-module coupling beyond documented seams; single checkout pipeline.                             |
| **Security**      | OWASP ASVS L1 checklist passes; durable limiter; staging/prod isolated; no secrets in repo.                 |
| **Performance**   | `/m` LCP < 2.5s, INP < 200ms, CLS < 0.1; bundle ≤150 KB worst-chunk.                                        |
| **Accessibility** | WCAG 2.2 AA; ≥44px targets; keyboard nav; RTL.                                                              |
| **Testing**       | Unit+integration green; coverage on money/inventory paths; e2e green on staging.                            |
| **Reliability**   | Idempotency holds under concurrent checkout; offline replay survives session loss; backup-restore verified. |
| **Deployment**    | Backup→migrate→release green; rollback documented.                                                          |

---

## 21. Recommended Execution Order

1. **PHASE 0** (owner-facing data/environment) — these four items are the true
   launch blockers and are prerequisite to everything else.
2. **PHASE 1** (durable limiter) — the only HIGH code risk; small, high-value.
3. **PHASE 2** (deploy/CI + staging) — unblocks reliable release and e2e gating.
4. **PHASE 3** (offline replay + coverage) — resilience + measurability.
5. **PHASE 4** (defense-in-depth) — residual security.
6. **PHASE 5** (hardening + go-live).

---

## 22. Unknowns / Require Validation

| Item                                               | Status                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| Real VAT rate                                      | Requires owner decision (spec §16).                              |
| Payment methods / receipt printer model            | Requires owner confirmation (spec §16).                          |
| Expected daily order volume                        | Unknown — sanity-checks free-tier limits.                        |
| Whether `WIFI_DEVICE_ID_SALT` is set in production | Not verifiable from repo; must be confirmed at deploy.           |
| Production Supabase project isolation              | Requires provisioning a staging project.                         |
| One-week parallel run                              | Not yet performed (spec §13, non-negotiable).                    |
| e2e against a clean staging DB                     | Requires staging provisioned; currently flaky against shared DB. |
| Coverage % on money/inventory paths                | Unmeasurable until `@vitest/coverage-v8` installed.              |

---

## Appendix — Commit state verified

- HEAD `adee9fe`, 5 commits ahead of `origin/main` (H2 RLS-FORCE, H3 SW
  network-first, H4 e2e/ login fix, H5 nanoid, H6 docs).
- The prior discovery report's items D1 (SW stale-cache), E1 (RLS functional),
  and the login failure are now **closed** (H3/H2/H4).
- The prior discovery report's D5 (in-memory limiter), D6 (tax), D7 (menu), D8
  (shared project) remain open — reaffirmed here.
