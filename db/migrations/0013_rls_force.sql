-- RLS default-deny hardening (H2).
--
-- Every public table already has `ENABLE ROW LEVEL SECURITY` (migrations
-- 0001/0004/0006/0009). This migration adds `FORCE`, which makes RLS apply
-- even to the table owner. The app's two privileged paths are unaffected:
--   - the direct `DATABASE_URL` pool connects as `postgres` (rolbypassrls=true),
--   - the service-role client connects as `service_role` (rolbypassrls=true).
-- Both bypass RLS regardless of FORCE, so all application reads/writes keep
-- working. Only the unprivileged `anon` / `authenticated` PostgREST roles are
-- denied by default — exactly the deny-by-default posture this task requires.
--
-- The existing staff-JWT SELECT policies on `orders` / `order_items` (migration
-- 0003) are preserved unchanged: they grant `authenticated` readers with a
-- `app_metadata.staff_id` claim access to the live order queue, which is what
-- the /kitchen Realtime subscription needs. No other policy is added.

alter table "branches" force row level security;
alter table "tables" force row level security;
alter table "staff" force row level security;
alter table "categories" force row level security;
alter table "products" force row level security;
alter table "modifier_groups" force row level security;
alter table "modifiers" force row level security;
alter table "ingredients" force row level security;
alter table "recipes" force row level security;
alter table "orders" force row level security;
alter table "order_items" force row level security;
alter table "inventory_moves" force row level security;
alter table "price_changes" force row level security;
alter table "suppliers" force row level security;
alter table "purchases" force row level security;
alter table "shifts" force row level security;
alter table "settings" force row level security;
alter table "today_suggestion" force row level security;
alter table "upsell_rules" force row level security;
alter table "wifi_sessions" force row level security;