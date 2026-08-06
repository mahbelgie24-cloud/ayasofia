ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingredients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_moves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "modifier_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "modifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "purchases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shifts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- (P2-OPS-1) 0003 already creates these policies; drop-if-exists keeps this
-- batch idempotent so the whole set applies cleanly on a fresh database.
DROP POLICY IF EXISTS "staff can read order items" ON "order_items";--> statement-breakpoint
DROP POLICY IF EXISTS "staff can read live orders" ON "orders";--> statement-breakpoint
CREATE POLICY "staff can read order items" ON "order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.jwt() -> 'app_metadata' ->> 'staff_id') is not null);--> statement-breakpoint
CREATE POLICY "staff can read live orders" ON "orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.jwt() -> 'app_metadata' ->> 'staff_id') is not null);