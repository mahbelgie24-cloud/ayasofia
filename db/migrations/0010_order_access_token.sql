-- =============================================================================
-- 0010_order_access_token.sql — per-order public status access token (P2-SEC-1).
-- The anonymous self-order status page must not be readable by anyone who
-- merely guesses/brute-forces an order UUID; ownership is proven by this
-- unguessable token minted at checkout and carried in the status URL.
-- =============================================================================

ALTER TABLE "orders" ADD COLUMN "access_token" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_access_token_unique" UNIQUE("access_token");
