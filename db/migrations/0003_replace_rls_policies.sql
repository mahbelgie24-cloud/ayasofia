-- Replace the permissive RLS policies from 0001 with a JWT-claim check.
-- The old `using (true)` on orders and order_items allowed ANY anonymous
-- session to read live orders — anonymous sign-in requires zero credentials.
--
-- The new policy reads `app_metadata.staff_id` from the JWT, which is only
-- set when verifyStaffPin succeeds (see app/login/actions.ts).  An anonymous
-- user who has NOT entered a valid PIN has no staff_id claim, so the policy
-- returns zero rows.

-- Drop the old policies first (they were created in 0001).
drop policy if exists "staff can read live orders" on orders;
drop policy if exists "staff can read order items" on order_items;

-- Recreate with a JWT-based guard.
create policy "staff can read live orders"
on orders for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'staff_id') is not null);

create policy "staff can read order items"
on order_items for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'staff_id') is not null);
