-- Enable Row-Level Security on every table (spec §12 — all writes go through
-- Next.js Server Actions with DATABASE_URL, bypassing RLS by design).
-- Only orders and order_items get a SELECT policy for the authenticated role
-- so Supabase Realtime can stream live orders to /kitchen without a server proxy.

alter table branches enable row level security;
alter table staff enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table modifier_groups enable row level security;
alter table modifiers enable row level security;
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table inventory_moves enable row level security;
alter table suppliers enable row level security;
alter table purchases enable row level security;
alter table shifts enable row level security;
alter table settings enable row level security;

-- /kitchen needs to subscribe to live orders via Supabase Realtime.
-- This policy allows any authenticated staff member to read the queue.
create policy "staff can read live orders"
on orders for select
to authenticated
using (true);

-- Order items are fetched alongside their parent order for display.
create policy "staff can read order items"
on order_items for select
to authenticated
using (true);
