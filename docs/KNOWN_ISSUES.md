# Known Issues & Accepted Deviations

Everything here is deliberate, documented, and an **INFO-level** trade-off —
nothing is a silent foot-gun. Each entry links to the decision and says what
"good" would look like.

## T-A2 — `/order` source backfill skipped (Q1=B)

The `/order` ordering surface was retired via a 308 redirect to the digital
menu (see `docs/digital-menu.md`). Customer-origin orders that were created
through the old `/order` path would have been stored as `source = 'POS'` with
`staff_id = NULL` (POS is the column default), so they can't be told apart from
a genuine cashier walk-up that happened to have no staff link.

**Evidence check (read-only):** `SELECT count(*) FILTER (WHERE source='POS' AND
staff_id IS NULL) FROM orders;` → **0 rows** at retirement time. Because there
were **no** rows on the discriminator, the optional backfill to
`source = 'DIGITAL_MENU'` was **skipped** — there was nothing to migrate, so no
transaction was run. If any such rows appear later, backfill them in a single
transaction (set `source='DIGITAL_MENU'` where `source='POS' AND staff_id IS
NULL`) and rerun reports.

**"Good":** the schema default for `source` existed before the discriminator
was introduced, so very old `/order` orders are indistinguishable by data
alone; a future migration could tag them, but doing so risks mislabeling real
cashier sales, which is worse than leaving them as POS.

## P2-DAT-1 — today-suggestion deactivate+insert is now transactional

Previously `setTodaySuggestion` deactivated all suggestions and then inserted
the new one in two separate statements; an insert failure would leave the
portal with **no** active suggestion. Now both run inside
`db.transaction(...)`, so a failure rolls back the deactivation and the
previously-active suggestion survives (`today-suggestion.integration.test.ts`).

## P1-M10 (deferred) — wifi device-id hashing relies on a fixed secret

Hardware/router integration is pending owner decision, so P1-M10 is explicitly
**deferred** (per the audit) and NOT implemented. Three related INFO notes:

- **Public salt fallback** — `hashDeviceId` uses `process.env.WIFI_DEVICE_ID_SALT`
  and falls back to the literal string `"ayasofia-wifi"` when the value is
  unset. In production this env var is a deploy-time secret; the fallback only
  exists so local/dev works with zero config.
- **Client-supplied device id** — the guest's `deviceId` is hashed server-side
  before storage, but the raw id originates from `crypto.randomUUID()` on the
  client. A determined client can vary it per request (it is per-device random,
  not a strong anti-abuse signal).
- **Unconsented `ip=` note** — `wifi_sessions.notes` records the string
  `ip=<address>` even before consent. This is an operational aid for abuse
  triage; it is not stored in a dedicated PII column, but an IP is arguably
  personal data (C5 tracks consent for name/phone only).

**"Good":** rotate `WIFI_DEVICE_ID_SALT` (re-hash), make the salt required in
production at deploy time, and revisit whether to retain the IP note or move it
to a hashed/generalized form.

## P2-PERF-2 — catalog cache is in-process and single-instance

The public catalog and feature flags are cached **in-memory** (`lib/cache.ts`,
60s / 30s TTL). This is correct for the single long-running Next.js process the
project targets. On a multi-instance/serverless deployment, invalidation is
per-instance: the cache self-heals within the TTL. An event bus / shared store
(Redis/Upstash) would remove the caveat but is not justified at this scale.

## Dead `orders.discount` field

`orders.discount` is a `numeric(10,2) NOT NULL DEFAULT '0'` column; there is no
discount feature yet, so every order writes `"0.00"` and nothing reads it. It is
kept for a future promotional feature. **"Good":** either ship discounts or drop
the column once offline-sync/legacy data no longer needs it.

## Playwright e2e is not CI-gated

`e2e/` needs a live Supabase project (it creates real orders/inventory/stock),
so it is run manually against staging and is excluded from CI (see README).
Do not treat the absence of a CI gate as a test gap — unit + integration suites
(including the token gate, catalog invalidation, and cancelled filters) are CI
covered.

## TTFB numbers are environment-attributed

The TTFB figures in `docs/digital-menu.md` (14 ms warm / 4.4 s cold) were
measured from a **dev machine** to a remote pooler, not a production in-region
host. Treat them as direction, not a production SLA.

## Observability is a lightweight proxy (T-D3)

Throttled and failed checkouts are recorded with Sentry `addBreadcrumb` +
`captureMessage` (lib/observability.ts). This is functional and PII-safe, but it
is **not** full metrics/span instrumentation (no custom transaction spans or
counters). **"Good":** promote to Sentry Metrics / instrumented spans when the
volume justifies it.

## CI bundle gate is a proxy (T-C2)

`scripts/bundle-budget.mjs` gates on the **worst-case single client chunk**
(gzip ≤ 150 KB) because Next 16/Turbopack no longer prints per-route First Load
JS. It catches a runaway per-route import, but it is not a true First-Load-JS
per-route budget. **"Good":** a trace/measurement of `/m` First Load JS at
deploy time once Turbopack restores the metric.

## H5 — esbuild dev-tooling advisory accepted (GHSA-67mh-4wv8-2f99)

`npm audit` reports 4 moderate vulnerabilities via the **dev-only** esbuild
chain pulled by `drizzle-kit` → `@esbuild-kit/esm-loader` →
`@esbuild-kit/core-utils` → `esbuild@0.18.20` (GHSA-67mh-4wv8-2f99: a malicious
website could read responses from a local dev server). The fix that `npm audit`
suggests (`--force`) **downgrades drizzle-kit 0.31.10 → 0.18.1**, a breaking
change, so it was **not** applied. `@esbuild-kit` is abandoned and pins
`~0.18.20`, so an npm `overrides` bump to esbuild 0.25 does not resolve and was
reverted. The vulnerable esbuild is only used by the drizzle-kit CLI at
developer time (never in the shipped Next.js runtime). The **high-severity
nanoid** advisory (GHSA-2v37-7h3g-55p8) was fixed by `npm audit fix` → nanoid
3.3.18. **"Good":** a future drizzle-kit release that drops the
`@esbuild-kit/esm-loader` loader (or upstream esbuild bump) clears all 4.

## H6 — in-memory rate limiting on a multi-instance (Vercel) deployment

`lib/rate-limit.ts` keeps the PIN-login lockout and the public-endpoint abuse
throttle in **process memory** (`Map`s, no shared store). On Vercel's
serverless model each cold instance holds its own counters, so a spray across
instances can exceed the per-instance cap. This is the documented P0
mitigation (WEB-SEC-001); a durable Postgres/Upstash-backed limiter is tracked
as WEB-SEC-004 and is **not** yet implemented. **"Good":** move the counters to
a Postgres table (or Upstash) so the caps are global across instances.

## H6 — single shared Supabase project (no staging/prod split)

All environments — local dev, the e2e suite, and any future production — share
**one** Supabase project (`hdptsbfzjhmzvfyouhlg`, per `.env.local`). The e2e
suite creates real orders/anon users against it, and the long-lived dev DB is
drifted (e.g. product prices no longer match `db/seed-data.ts`). This is why
the e2e exact-total and anonymous-sign-in tests are flaky/red in a long run.
**"Good":** provision a second, disposable **staging** Supabase project for
e2e/CI and keep the shared project for production only (spec §16 / D8).

## H6 — missing coverage tooling

`npx vitest run --coverage` fails with `MISSING DEPENDENCY
@vitest/coverage-v8`; `vitest.config.mts` defines no `coverage` block. There are
no branch/line coverage numbers to report. **"Good":** add
`@vitest/coverage-v8` as a devDependency and a `coverage` config when coverage
is needed.

## H6 — tax_rate currently 0 (pending owner decision)

The live DB and seed both store `settings.tax_rate = "0"`
(`db/seed-data.ts:1073`), so every sale under-charges tax until a real rate is
set. The 17% figure appears only as a documentation note in
`docs/reports/phase4-closure-addendum.md:95` (spec §15 says confirm with the
owner). **Owner action:** set the real VAT rate before go-live.

---

More entries are appended as they are found (see the docs wisdom pass).
