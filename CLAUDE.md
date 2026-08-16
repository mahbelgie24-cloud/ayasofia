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

The **only exceptions** are the deliberately public (unauthenticated) server
actions. Each has its own guardrail in place of a staff session:

| Action                                                                                                  | Guardrail                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `verifyStaffPin` (`app/login/actions.ts`)                                                               | The auth gate itself — anon-user lockout + IP throttle (`lib/rate-limit.ts`), server-derived session identity (T-B5).                          |
| `placeCustomerOrder` (`app/order/actions.ts`)                                                           | Retired surface (308 → digital menu) kept for offline/legacy callers. IP throttle, server-side recomputation, atomic transaction, idempotency. |
| `getDigitalMenuData` / `placeDigitalMenuOrder` / `getUpsellSuggestions` (`app/digital-menu/actions.ts`) | Feature-flag gated, IP throttled, same atomic checkout pipeline + idempotency for orders; all ids UUID-validated server-side.                  |
| `getOrderStatus` (`app/order/status/[orderId]/actions.ts`)                                              | Per-order bearer token (P2-SEC-1) + IP throttle; wrong token is indistinguishable from missing order.                                          |
| `authorizeDevice` / `endWifiSession` / `submitWifiSuggestion` (`app/wifi/actions.ts`)                   | Feature-flag gated, IP throttled, device ids hashed before storage.                                                                            |

Every other server action **must** call `requireStaffSession` first — see
`app/(admin)/admin/**/actions.ts` and `app/(pos)/pos/actions.ts` for the
pattern, and `__tests__/rbac-margins.test.ts` for the enforcement tests.

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
lib/shifts.ts                — openShift() / closeShift() / getOpenShift() (shift lifecycle)
db/schema.ts                 — Drizzle schema (15 tables, all with RLS via .enableRLS())
proxy.ts                     — Route protection (UX redirects only, not auth authority)
```

## Shift lifecycle — reuse decision

On PIN login, if the staff member already has an open shift
(`shifts.closedAt IS NULL`), the session **attaches to that existing
shift** rather than blocking login or forcing a close. `openShift()` is
idempotent — if called while a shift is already open, it returns the
existing shift ID without creating a row.
