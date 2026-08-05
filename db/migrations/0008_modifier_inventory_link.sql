ALTER TABLE "modifiers" ADD COLUMN "ingredient_id" uuid;--> statement-breakpoint
ALTER TABLE "modifiers" ADD COLUMN "ingredient_qty" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;