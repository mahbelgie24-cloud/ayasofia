#!/usr/bin/env tsx
/**
 * One-time seed script — inserts placeholder data from db/seed-data.ts.
 * Idempotent: skips rows that already exist (matched by unique name).
 *
 * Usage:
 *   npx tsx db/seed.ts
 *
 * Requires DATABASE_URL in environment (loaded via drizzle.config.ts).
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, sql, count } from "drizzle-orm";
import {
  seedCategories,
  seedProducts,
  seedModifiers,
  seedIngredients,
  seedRecipes,
  seedSettings,
  seedStaff,
} from "./seed-data";
import {
  categories,
  products,
  modifierGroups,
  modifiers,
  ingredients,
  recipes,
  settings,
  staff,
  orders,
} from "./schema";
import { hashPin } from "../lib/auth";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

async function seed() {
  console.log("\n🌱 Seeding database...\n");

  // Safety guard: refuse to truncate if real order data exists.
  // This correctly distinguishes "still pre-launch, safe to reseed"
  // from "live and irreversible."
  const [{ cnt }] = await db.select({ cnt: count() }).from(orders);
  if (cnt > 0) {
    console.error(
      "❌ Refusing to truncate — real order data exists. " +
        "This script is only safe when the orders table is empty. " +
        `Found ${cnt} row(s) in orders.`,
    );
    process.exit(1);
  }

  // Truncate all tables (reverse FK order) for a clean re-seed.
  await db.execute(
    sql`TRUNCATE TABLE recipes, inventory_moves, purchases, suppliers, order_items, orders, modifiers, modifier_groups, products, categories, ingredients, shifts, settings, staff CASCADE`,
  );
  console.log("🧹 All tables truncated.\n");

  // --- Staff ---
  let staffCount = 0;
  for (const s of seedStaff) {
    const existing = await db.select().from(staff).where(eq(staff.name, s.name)).limit(1);

    if (existing.length === 0) {
      await db.insert(staff).values({
        name: s.name,
        role: s.role,
        pinHash: hashPin(s.pin),
      });
      staffCount++;
    }
  }
  const totalStaff = await db.select({ count: sql<number>`count(*)` }).from(staff);
  console.log(`👤 Staff: ${staffCount} inserted, ${totalStaff[0].count} total`);

  // --- Categories ---
  let catCount = 0;
  for (const cat of seedCategories) {
    const existing = await db
      .select()
      .from(categories)
      .where(eq(categories.nameEn, cat.nameEn))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(categories).values({
        nameAr: cat.nameAr,
        nameEn: cat.nameEn,
        sortOrder: cat.sortOrder,
      });
      catCount++;
    }
  }
  const totalCats = await db.select({ count: sql<number>`count(*)` }).from(categories);
  console.log(`📁 Categories: ${catCount} inserted, ${totalCats[0].count} total`);

  // --- Products ---
  let prodCount = 0;
  const productIdMap = new Map<string, string>();

  for (const prod of seedProducts) {
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.nameEn, prod.nameEn))
      .limit(1);

    if (existing.length === 0) {
      const cat = await db
        .select()
        .from(categories)
        .where(eq(categories.nameEn, prod.categoryEn))
        .limit(1);

      await db.insert(products).values({
        nameAr: prod.nameAr,
        nameEn: prod.nameEn,
        categoryId: cat[0]!.id,
        basePrice: prod.basePrice.toString(),
        imageUrl: `/icons/${prod.image}`,
        isAvailable: true,
        trackInventory: true,
      });

      const inserted = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.nameEn, prod.nameEn))
        .limit(1);

      productIdMap.set(prod.nameEn, inserted[0]!.id);
      prodCount++;
    } else {
      productIdMap.set(prod.nameEn, existing[0]!.id);
    }
  }
  const totalProds = await db.select({ count: sql<number>`count(*)` }).from(products);
  console.log(`📦 Products: ${prodCount} inserted, ${totalProds[0].count} total`);

  // --- Modifier Groups + Modifiers ---
  let groupCount = 0;
  let modCount = 0;
  const groupIdMap = new Map<string, string>();

  for (const mg of seedModifiers) {
    const productId = productIdMap.get(mg.productEn);
    if (!productId) continue;

    const groupKey = `${mg.productEn}::${mg.group}`;
    const existing = await db
      .select()
      .from(modifierGroups)
      .where(
        sql`${modifierGroups.productId} = ${productId} AND ${modifierGroups.name} = ${mg.group}`,
      )
      .limit(1);

    let groupId: string;
    if (existing.length === 0) {
      await db.insert(modifierGroups).values({
        productId,
        name: mg.group,
        type: mg.type,
        isRequired: mg.required,
      });

      const inserted = await db
        .select({ id: modifierGroups.id })
        .from(modifierGroups)
        .where(
          sql`${modifierGroups.productId} = ${productId} AND ${modifierGroups.name} = ${mg.group}`,
        )
        .limit(1);

      groupId = inserted[0]!.id;
      groupCount++;
    } else {
      groupId = existing[0]!.id;
    }

    groupIdMap.set(groupKey, groupId);

    // Modifiers
    for (const opt of mg.options) {
      const modExists = await db
        .select()
        .from(modifiers)
        .where(sql`${modifiers.groupId} = ${groupId} AND ${modifiers.name} = ${opt.name}`)
        .limit(1);

      if (modExists.length === 0) {
        await db.insert(modifiers).values({
          groupId,
          nameAr: (opt as { nameAr?: string; name: string }).nameAr ?? opt.name,
          name: opt.name,
          priceDelta: opt.delta.toString(),
        });
        modCount++;
      }
    }
  }

  const totalGroups = await db.select({ count: sql<number>`count(*)` }).from(modifierGroups);
  const totalMods = await db.select({ count: sql<number>`count(*)` }).from(modifiers);
  console.log(`🏷️  Modifier Groups: ${groupCount} inserted, ${totalGroups[0].count} total`);
  console.log(`🏷️  Modifiers: ${modCount} inserted, ${totalMods[0].count} total`);

  // --- Ingredients ---
  let ingCount = 0;
  const ingredientIdMap = new Map<string, string>();

  for (const ing of seedIngredients) {
    const existing = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.name, ing.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(ingredients).values({
        name: ing.name,
        unit: ing.unit,
        currentStock: ing.stock.toString(),
        reorderThreshold: ing.reorder.toString(),
        costPerUnit: ing.cost.toString(),
      });

      const inserted = await db
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(eq(ingredients.name, ing.name))
        .limit(1);

      ingredientIdMap.set(ing.name, inserted[0]!.id);
      ingCount++;
    } else {
      ingredientIdMap.set(ing.name, existing[0]!.id);
    }
  }
  const totalIngs = await db.select({ count: sql<number>`count(*)` }).from(ingredients);
  console.log(`🧪 Ingredients: ${ingCount} inserted, ${totalIngs[0].count} total`);

  // --- Recipes ---
  let recipeCount = 0;
  for (const recipe of seedRecipes) {
    const productId = productIdMap.get(recipe.productEn);
    const ingredientId = ingredientIdMap.get(recipe.ingredient);
    if (!productId || !ingredientId) continue;

    const existing = await db
      .select()
      .from(recipes)
      .where(sql`${recipes.productId} = ${productId} AND ${recipes.ingredientId} = ${ingredientId}`)
      .limit(1);

    if (existing.length === 0) {
      await db.insert(recipes).values({
        productId,
        ingredientId,
        quantityUsed: recipe.qty.toString(),
      });
      recipeCount++;
    }
  }
  const totalRecipes = await db.select({ count: sql<number>`count(*)` }).from(recipes);
  console.log(`📖 Recipes: ${recipeCount} inserted, ${totalRecipes[0].count} total`);

  // --- Settings ---
  let settingsCount = 0;
  for (const setting of seedSettings) {
    const existing = await db.select().from(settings).where(eq(settings.key, setting.key)).limit(1);

    if (existing.length === 0) {
      await db.insert(settings).values({
        key: setting.key,
        value: setting.value,
      });
      settingsCount++;
    }
  }
  const totalSettings = await db.select({ count: sql<number>`count(*)` }).from(settings);
  console.log(`⚙️  Settings: ${settingsCount} inserted, ${totalSettings[0].count} total`);

  console.log("\n✅ Seed complete!\n");
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
