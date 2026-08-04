CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_staff_id_created_at_idx" ON "orders" USING btree ("staff_id","created_at");