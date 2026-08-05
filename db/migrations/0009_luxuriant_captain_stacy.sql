CREATE TYPE "public"."order_source" AS ENUM('POS', 'DIGITAL_MENU');--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"code" text NOT NULL,
	"qr_token" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tables_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "today_suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"title_ar" text,
	"description_ar" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "today_suggestion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "upsell_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"condition" text NOT NULL,
	"trigger_value" text DEFAULT '{}' NOT NULL,
	"suggestion_product_id" uuid,
	"suggestion_modifier_id" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "upsell_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wifi_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id_hash" text NOT NULL,
	"consented" boolean DEFAULT false NOT NULL,
	"guest_name" text,
	"guest_phone" text,
	"authorized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"duration_sec" integer,
	"router_session_id" text,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "wifi_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD COLUMN "max_selections" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "source" "order_source" DEFAULT 'POS' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "table_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_fee" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "today_suggestion" ADD CONSTRAINT "today_suggestion_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upsell_rules" ADD CONSTRAINT "upsell_rules_suggestion_product_id_products_id_fk" FOREIGN KEY ("suggestion_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upsell_rules" ADD CONSTRAINT "upsell_rules_suggestion_modifier_id_modifiers_id_fk" FOREIGN KEY ("suggestion_modifier_id") REFERENCES "public"."modifiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tables_branch_id_idx" ON "tables" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "wifi_sessions_device_hash_idx" ON "wifi_sessions" USING btree ("device_id_hash");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_source_created_at_idx" ON "orders" USING btree ("source","created_at");--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_slug_unique" UNIQUE("slug");