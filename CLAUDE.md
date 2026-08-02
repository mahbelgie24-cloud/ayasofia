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

## Staff PIN login flow (verified sessions)

This is the authentication path. Every change to auth must respect this
sequence — it is the only mechanism that gates access to `/pos`, `/kitchen`,
`/drive-thru`, and `/admin`.

1. **Schema linkage.** The `staff` table carries a nullable `auth_user_id`
   column (migration `0002_burly_vulture`). It is set once — on the first
   verified PIN match — and links the staff row to the Supabase auth user
   that owns the anonymous session.

2. **Client-side PIN pad** (`components/pin-pad.tsx`). A 4-digit numeric
   keypad. On submit it calls `supabase.auth.signInAnonymously()` **only**
   inside the submit handler — never on page load, never automatically.
   Doing so elsewhere would grant an unverified session access. The anon
   user ID and entered PIN are forwarded to `verifyStaffPin`.

3. **Server Action** (`app/login/actions.ts` — `verifyStaffPin`). Runs with
   the service-role key (never leaked to the client bundle). It fetches all
   active staff rows, verifies the PIN against stored `scrypt` hashes in
   constant time, and on success calls `supabase.auth.admin.updateUserById`
   to stamp the anonymous user's `app_metadata` with `{staff_id, role}`. It
   also persists `staff.auth_user_id` so the linkage can be audited.

4. **RLS enforcement.** The policies on `orders` and `order_items` (migration
   `0003_replace_rls_policies`) read the JWT claim directly:
   ```sql
   using ((auth.jwt() -> 'app_metadata' ->> 'staff_id') is not null)
   ```
   An anonymous session that has not passed `verifyStaffPin` carries no
   `staff_id` claim and therefore sees zero rows. No PIN = no kitchen queue.

5. **Session cleanup** (`lib/auth/session.ts`). At shift close
   (`shifts.closedAt` — Phase 4), call `endStaffSession()` to sign out the
   anonymous session so the next staff member on this device starts fresh.
   Never let sessions persist across shift changes — that would leak the
   previous staff member's JWT claims and RBAC grants.

**Files involved:**
```
lib/auth.ts                  — hashPin / verifyPin (scrypt + constant-time)
lib/auth/session.ts          — endStaffSession (sign-out wrapper)
lib/supabase/client.ts       — browser Supabase client (anon key)
lib/supabase/server.ts       — server Supabase client (anon key)
lib/supabase/service.ts      — server Supabase client (service role — NEVER expose)
app/login/page.tsx           — PIN pad entry screen
app/login/actions.ts         — verifyStaffPin server action
components/pin-pad.tsx       — 4-digit numeric keypad UI
db/migrations/0002_*.sql     — auth_user_id column addition
db/migrations/0003_*.sql     — JWT-based RLS policy replacement
```
