@AGENTS.md

# Claude-specific notes

This project targets production use in a single-location specialty dessert
shop (bubble tea, bingsu, croffle). The codebase is a Next.js 16 modular
monolith backed by PostgreSQL via Supabase.

- Review `docs/technical-spec.md` before generating any route or server
  action — the data model, modifier system, and RLS policies are all
  documented there and non-negotiable.
- Prefer Server Components for data-fetching surfaces (/pos, /kitchen,
  /admin) and Client Components only where interactivity requires them.
- Use `npx drizzle-kit generate` for every schema change — never apply
  migrations by hand outside version control.
- All strings in the UI must support Arabic as the primary locale and
  English as secondary. Never hardcode a single-language string without a
  key that bilingual lookup can replace later.
- For the full Staff PIN login flow and RLS enforcement sequence, see
  `AGENTS.md` and `app/login/actions.ts`.

## Server-side authorization — mandatory call site

**Every Server Action** that reads or mutates orders, inventory, margins,
staff records, or shop settings must start with:

```ts
import { requireStaffSession } from "@/lib/auth";
const { staffId, role } = await requireStaffSession(/* minRole? */);
```

`proxy.ts` handles UX-level redirects for convenience only — it is **not**
the security boundary. The authorization enforcement lives in
`requireStaffSession` (in `lib/auth.ts`), which verifies the Supabase JWT
session carries `app_metadata.staff_id` and optionally checks
`ROLE_RANK[role]` against a minimum.

The **only** exceptions are:

- `verifyStaffPin` in `app/login/actions.ts` — it is the auth gate that
  establishes the session in the first place, so it cannot require one
  beforehand.
- `placeCustomerOrder` in `app/order/actions.ts` — this is a deliberately
  public customer-facing endpoint (no staff involved, `staffId` is null
  on the resulting order). It still enforces server-side recomputation,
  atomic transaction, and idempotency — all the same correctness rules as
  `checkout()`, just without the staff-session requirement.

## Key files (quick reference)

```
lib/auth.ts                  — hashPin / verifyPin (scrypt), requireStaffSession (server auth guard)
lib/auth/session.ts          — endStaffSession (sign-out wrapper)
lib/supabase/client.ts       — browser Supabase client (anon key)
lib/supabase/server.ts       — server Supabase client (anon key + cookies)
lib/supabase/service.ts      — server Supabase client (service role — NEVER expose)
app/login/page.tsx           — PIN pad entry screen
app/login/actions.ts         — verifyStaffPin server action (auth gate)
components/pin-pad.tsx       — 4-digit numeric keypad UI
db/schema.ts                 — Drizzle schema (15 tables, all with RLS via .enableRLS())
proxy.ts                     — Route protection (UX redirects only, not auth authority)
```
