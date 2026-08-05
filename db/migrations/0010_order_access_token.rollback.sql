-- =============================================================================
-- 0010_order_access_token.rollback.sql — DOWN migration for P2-SEC-1.
-- Apply manually with:  psql "$DATABASE_URL" -f db/migrations/0010_order_access_token.rollback.sql
-- =============================================================================

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_access_token_unique";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "access_token";
