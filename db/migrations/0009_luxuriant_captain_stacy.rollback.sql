-- =============================================================================
-- 0009_luxuriant_captain_stacy.rollback.sql — DOWN migration for the digital
-- menu + wifi portal phase (C8). NOT applied by drizzle-kit (the runner reads
-- only files matching the journal entry tag, e.g. 0009_luxuriant_captain_stacy.sql).
-- Apply manually with:  psql "$DATABASE_URL" -f db/migrations/0009_luxuriant_captain_stacy.rollback.sql
-- Verified up→down→up on a fresh database in Phase 3.
-- =============================================================================

-- Reverse ALL of 0009_luxuriant_captain_stacy.sql in reverse order.

-- Orders: index + FK + columns
DROP INDEX IF EXISTS "orders_source_created_at_idx";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_table_id_tables_id_fk";
ALTER TABLE "orders"
    DROP COLUMN IF EXISTS "table_id",
    DROP COLUMN IF EXISTS "delivery_address",
    DROP COLUMN IF EXISTS "delivery_fee",
    DROP COLUMN IF EXISTS "source";

-- order_items: free-text notes
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "notes";

-- modifier_groups: max_selections cap
ALTER TABLE "modifier_groups" DROP COLUMN IF EXISTS "max_selections";

-- branches: slug unique constraint + column
ALTER TABLE "branches" DROP CONSTRAINT IF EXISTS "branches_slug_unique";
DROP INDEX IF EXISTS "branches_slug_unique";
ALTER TABLE "branches" DROP COLUMN IF EXISTS "slug";

-- New tables (FKs dropped implicitly by dropping referenced tables)
DROP TABLE IF EXISTS "wifi_sessions";
DROP TABLE IF EXISTS "upsell_rules";
DROP TABLE IF EXISTS "today_suggestion";
DROP TABLE IF EXISTS "tables";

-- Enum type
DROP TYPE IF EXISTS "public"."order_source";