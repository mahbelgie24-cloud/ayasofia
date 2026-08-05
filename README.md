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

## Project structure

```
app/            Next.js routes: /pos, /kitchen, /drive-thru, /order/[qrId], /admin, /m/[branchSlug] (digital menu), /wifi (captive portal)
components/     Shared UI (components/ui = shadcn/ui, components/digital-menu, components/wifi)
db/             Drizzle schema + migrations
docs/           Specification, module guides, OpenAPI, Phase 0 data workbooks, brand assets
lib/            Utilities, Supabase client, auth helpers, pricing, delivery, upsell, captive-portal adapter
public/         Static assets (icons, images)
```

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
