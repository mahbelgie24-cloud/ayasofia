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

## Key files (quick reference)

```
lib/auth.ts                  — hashPin / verifyPin (scrypt + constant-time)
lib/auth/session.ts          — endStaffSession (sign-out wrapper)
lib/supabase/client.ts       — browser Supabase client (anon key)
lib/supabase/server.ts       — server Supabase client (anon key)
lib/supabase/service.ts      — server Supabase client (service role — NEVER expose)
app/login/page.tsx           — PIN pad entry screen
app/login/actions.ts         — verifyStaffPin server action
components/pin-pad.tsx       — 4-digit numeric keypad UI
db/schema.ts                 — Drizzle schema (15 tables, all with RLS)
middleware.ts                — Route protection per spec §12
```
