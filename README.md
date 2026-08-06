# Ayasofia Sweet — Ordering, Inventory & POS Platform

Internal operations system for **Ayasofia Sweet** (Qalqilya) — Taiwanese bubble tea and Japanese/Korean desserts. Covers point-of-sale, Drive-Thru, customer self-ordering, inventory, reporting, and two customer-facing modules: an **immersive QR digital menu** and a **welcome Wi-Fi captive portal**.

Full specification: [`docs/technical-spec.md`](./docs/technical-spec.md) — read it before touching the code. Everything below assumes that document as context.

Module guides: [`docs/digital-menu.md`](./docs/digital-menu.md) · [`docs/wifi-portal.md`](./docs/wifi-portal.md) · [`docs/openapi.md`](./docs/openapi.md)

## Stack

Next.js 16 (App Router) · TypeScript · PostgreSQL via Supabase · Drizzle ORM · Tailwind CSS v4 + shadcn/ui · Arabic RTL first-class

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real Supabase values, never commit this file
npm run dev
```

## Database

```bash
npx drizzle-kit generate   # create a migration from db/schema.ts
npx drizzle-kit migrate    # apply migrations to the database
```

Schema source of truth: [`db/schema.ts`](./db/schema.ts), generated from spec §9.

### Local reset recipe

Rebuild a (possibly drifted) database from scratch — re-apply every migration
`0000…0012`, then seed the demo catalog. Call "reset" before ingesting real-menu
data.

```bash
# One command: backup → drop public → migrate → seed.
# Non-ephemeral DBs require a pre-destructive pg_dump (G3) acknowledged via
# BACKUP_ALLOWED=true or --ack-backup; the restore command is printed.
BACKUP_ALLOWED=true npx tsx scripts/reset-db.ts

# Manual equivalent:
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE;" -c "CREATE SCHEMA public;"
node .github/ci-ensure-role.mjs   # plain Docker Postgres only (mints role + auth.jwt)
npx drizzle-kit migrate
npm run db:seed
npx vitest run                    # verify the whole suite
```

> `db:seed` and this reset are **demo-data safe only**: `seed.ts` aborts if any
> `orders` exist. For the real launch menu, feed `docs/real-menu.json` to
> `scripts/ingest-real-menu.ts` instead (see `docs/real-menu-guide.md`).

### Ops runbook — destructive database operations (G3)

Any reset/ingest that mutates a **non-ephemeral** database first produces an
automatic `pg_dump` into the git-ignored `backups/` folder, acknowledged by
`BACKUP_ALLOWED=true` or `--ack-backup`. The ephemeral CI DB never needs one.
Intended sequence (operate defensively):

1. **Backup** — `scripts/reset-db.ts` / `scripts/ingest-real-menu.ts` call
   `ensureBackup()` and refuse to proceed (no DB change) without ack.
2. **Restore-verify** — before trusting any later step, prove the backup restores:
   ```bash
   psql "$TEST_DATABASE_URL" -f backups/dump_<stamp>.sql
   ```
   (plain SQL dump → restore is `psql "$DATABASE_URL" -f <file>`).
3. **Migrate** — re-apply from migration `0000`.
4. **Ingest** — load the real menu only after backup + migrate.

The restore command is printed on every backup.

## Tests & CI seed gate (P2-OPS-1)

The CI `test` job runs the unit **and** integration suites against a **fresh,
migration-only** Postgres 16 service container — no developer's long-lived
database. This is what keeps `drizzle-kit migrate` and the seed data honest:
if a change breaks a fresh install, CI catches it.

To make the vanilla `postgres:16-alpine` image Supabase-shaped (so the RLS
migrations from 0001/0003/0004 can apply), CI runs `.github/ci-ensure-role.mjs`
**before** migrating. It creates:

- the `authenticated` role the policies grant to, and
- the `auth` schema + `auth.jwt()` function the policy `USING` clause calls.

The `test` job then:

```bash
node .github/ci-ensure-role.mjs     # mint role + auth.jwt()
npx drizzle-kit migrate             # apply migrations on the blank DB
npm run db:seed                     # seed menu/inventory the suites depend on
npx vitest run --shard=N/2          # run tests per shard
```

This is **Option 1** (an explicit seed step in CI) rather than per-test
self-seeding — a single seed per shard is cheaper than seeding inside every
integration suite, and it exercises the real `db:seed` path in CI.

To reproduce locally against a blank Docker Postgres:

```bash
docker run --rm -d --name dev-pg -p 5433:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ayasofia_test postgres:16-alpine
export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ayasofia_test
node .github/ci-ensure-role.mjs
npx drizzle-kit migrate
npm run db:seed
# run integration suites without a .env.local present
npx vitest run __tests__/*.integration.test.ts
```

## Project structure

```
app/            Next.js routes: /pos, /drive-thru, /kitchen, /admin (RBAC),
                /m/[branchSlug] (digital menu incl. /status + /table),
                /wifi (captive portal), /order (retired → 308 to /m),
                /order/status/[orderId] (token-gated), /login (PIN)
components/     Shared UI (components/ui = shadcn/ui, components/digital-menu, components/wifi)
db/             Drizzle schema + migrations
docs/           Specification, module guides, OpenAPI, KNOWN_ISSUES, brand assets
e2e/            Playwright specs (local-run, NOT CI-gated)
hooks/          Client hooks (usePOSCart — cart + per-submit idempotency key)
lib/            Utilities: db, Supabase clients, auth (RBAC), pricing,
                idempotency, delivery, upsell, captive-portal adapter,
                security-headers, bundles, rate-limit, observability
scripts/        bundle-budget, cleanup, validation
public/         Static assets (icons, images)
```

## Environment variables

| Variable                                | Required | Purpose                                                        |
| --------------------------------------- | -------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | prod     | Supabase project URL (also the image/storage origin)           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`         | prod     | Public/anon key (browser-safe)                                 |
| `SUPABASE_SERVICE_ROLE_KEY`             | prod     | Server-only admin key — never expose to the browser            |
| `DATABASE_URL`                          | dev/prod | Drizzle/Pool connection string (`connection_limit=10` in prod) |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | optional | Error monitoring                                               |
| `WIFI_DEVICE_ID_SALT`                   | prod     | Salt for hashing wifi device ids (see KNOWN_ISSUES P1-M10)     |
| `CAPTIVE_PORTAL_ADAPTER`                | optional | `mock` (default) \| `mikrotik` \| `unifi`                      |
| `RUN_ENV`                               | optional | `staging` \| `production` (validation)                         |

See [`.env.example`](./.env.example) for comments. `.env.local` is git-ignored and
never committed.

## Feature flags

The digital menu and wifi portal ship behind `settings` flags: `feature.digital_menu`, `feature.wifi_portal`. Set the value to `1` to enable, or leave unset to disable (public pages then show a branded fallback and admin nav items hide). See [`docs/digital-menu.md`](./docs/digital-menu.md).

## Before going live

Do not use this codebase for real sales until:

1. `docs/phase0-data-template.xlsx` has been filled with the **real** menu and loaded (not the demo seed data).
2. The Phase 5 hardening checklist in the spec (offline testing, backups, security pass) is complete.
3. A one-week parallel run alongside the manual process has finished — spec §13, non-negotiable.

### Playwright E2E tests

```bash
npx playwright test
```

E2E tests require a live Supabase project (they create real orders,
inventory moves, and stock changes against the database). Run them
**manually** against the staging database before each deploy until
Phase 5 sets up a proper CI-integrated staging environment. They are
**not** configured in CI yet — adding them to the merge gate would
require Supabase credentials as CI secrets, which should be set up
carefully, not rushed.
