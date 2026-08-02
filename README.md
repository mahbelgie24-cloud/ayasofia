# Ayasofia Sweet — Ordering, Inventory & POS Platform

Internal operations system for **Ayasofia Sweet** (Qalqilya) — Taiwanese bubble tea and Japanese/Korean desserts. Covers point-of-sale, Drive-Thru, customer self-ordering, inventory, and reporting.

Full specification: [`docs/technical-spec.md`](./docs/technical-spec.md) — read it before touching the code. Everything below assumes that document as context.

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
app/            Next.js routes: /pos, /kitchen, /drive-thru, /order/[qrId], /admin
components/     Shared UI (components/ui = shadcn/ui)
db/             Drizzle schema + migrations
docs/           Specification, Phase 0 data workbooks, brand assets
lib/            Utilities, Supabase client, auth helpers
public/         Static assets (icons, images)
```

## Before going live

Do not use this codebase for real sales until:
1. `docs/phase0-data-template.xlsx` has been filled with the **real** menu and loaded (not the demo seed data).
2. The Phase 5 hardening checklist in the spec (offline testing, backups, security pass) is complete.
3. A one-week parallel run alongside the manual process has finished — spec §13, non-negotiable.
