#!/usr/bin/env tsx
/**
 * Ingest the shop's REAL menu from a filled data file (default
 * `docs/real-menu.json`, or pass a path as argv[2]).
 *
 * Replaces the DEMO catalog (products / categories / modifiers / recipes /
 * ingredients) with the real one, while PRESERVING staff, settings, tables and
 * order history. Order history stays readable because order_items carries its
 * own name/price snapshot — referenced products are archived (hidden) rather
 * than hard-deleted when orders exist.
 *
 * Guarantees:
 *  - every price is validated > 0 and converted to integer minor units
 *    (agorot) via the shared money helpers — no raw float touches a price,
 *  - zero recipe/modifier ingredient overlap is enforced (spec §8.4); an
 *    option that consumes an ingredient must sit in a `single`+`required` group,
 *  - referenced image files must exist under public/menu/,
 *  - all writes run in ONE transaction and are idempotent; ANY violation REFUSES
 *    to commit (the DB is untouched) and prints the exact errors.
 *
 * Usage:
 *   npx tsx scripts/ingest-real-menu.ts [path-to-json]
 * Docs: docs/real-menu-guide.md · Template: docs/real-menu-template.json
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import {
  branches,
  categories,
  products,
  modifierGroups,
  modifiers,
  ingredients,
  recipes,
  tables,
  orderItems,
  inventoryMoves,
} from "@/db/schema";
import { toMinorUnits, formatPrice } from "@/lib/pricing";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ── Typed input ────────────────────────────────────────────────────────────
interface ModOption {
  name_ar: string;
  deltaILS?: number;
  ingredientQty?: { ingredient: string; qty: number };
}
interface ModGroup {
  type: "single" | "multi";
  name_ar: string;
  required?: boolean;
  max?: number | null;
  options: ModOption[];
}
interface RecipeLine {
  ingredient: string;
  qty: number;
}
interface ProductIn {
  name_ar: string;
  desc_ar?: string;
  priceILS: number;
  category: string;
  imageFile?: string;
  modifierGroups?: ModGroup[];
  recipe?: RecipeLine[];
}
export interface RealMenu {
  branch?: { slug?: string; name_ar?: string };
  ingredients?: Array<{ name_ar: string; unit: string; currentStock?: number; reorderAt?: number }>;
  categories?: Array<{ key: string; name_ar: string; sort?: number }>;
  products?: ProductIn[];
  tables?: Array<{ code: string }>;
}

// ── Validation helpers ─────────────────────────────────────────────────────
const IMAGE_DIR = resolve(process.cwd(), "public", "menu");
const ALLOWED_UNITS = new Set(["ml", "g", "piece"]);

function slugifyAr(input: string): string {
  const map: Record<string, string> = {
    ا: "a",
    ب: "b",
    ت: "t",
    ث: "th",
    ج: "j",
    ح: "h",
    خ: "kh",
    د: "d",
    ذ: "dh",
    ر: "r",
    ز: "z",
    س: "s",
    ش: "sh",
    ص: "s",
    ض: "d",
    ط: "t",
    ظ: "z",
    ع: "a",
    غ: "gh",
    ف: "f",
    ق: "q",
    ك: "k",
    ل: "l",
    م: "m",
    ن: "n",
    ه: "h",
    و: "w",
    ي: "y",
    ة: "h",
    آ: "a",
    أ: "a",
    إ: "e",
    ء: "",
  };
  const latin = input
    .split("")
    .map((ch) => map[ch] ?? "")
    .join("");
  const slug = latin
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || "";
}

let seq = 0;
function enName(ar: string, prefix: string): string {
  const slug = slugifyAr(ar);
  if (slug) return slug;
  seq += 1;
  return `${prefix}-${seq.toString().padStart(3, "0")}`;
}

function moneyString(n: number, label: string, errors: string[]): string | null {
  if (!Number.isFinite(n)) {
    errors.push(`${label}: قيمة غير رقمية`);
    return null;
  }
  const agorot = toMinorUnits(String(n));
  if (agorot <= 0) {
    errors.push(`${label}: يجب أن يكون السعر أكبر من صفر (وصلت: ${n})`);
    return null;
  }
  return formatPrice(agorot);
}

// Modifier deltas may legitimately be ₪0 (e.g. the "regular" default option).
function deltaString(n: number, label: string, errors: string[]): string | null {
  if (!Number.isFinite(n)) {
    errors.push(`${label}: قيمة غير رقمية`);
    return null;
  }
  return formatPrice(toMinorUnits(String(n)));
}

function qtyString(n: number, label: string, errors: string[]): string | null {
  if (!Number.isFinite(n) || n <= 0) {
    errors.push(`${label}: يجب أن تكون الكمية رقمًا موجبًا`);
    return null;
  }
  return n.toFixed(2);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const dataPath = process.argv[2] ?? "docs/real-menu.json";
  const abs = resolve(process.cwd(), dataPath);

  let raw: string;
  try {
    raw = readFileSync(abs, "utf-8");
  } catch {
    console.error(`❌ لا يوجد ملف بيانات في: ${abs}`);
    console.error(`   انسخ docs/real-menu-template.json إلى docs/real-menu.json واملأه.`);
    process.exit(1);
  }

  let input: RealMenu;
  try {
    input = JSON.parse(raw) as RealMenu;
  } catch (e) {
    console.error("❌ الملف ليس JSON صالح:", (e as Error).message);
    process.exit(1);
  }

  const errors: string[] = [];
  const ingredientsIn = input.ingredients ?? [];
  const categoriesIn = input.categories ?? [];
  const productsIn = input.products ?? [];
  const tablesIn = input.tables ?? [];

  // unique ingredient names
  const ingNames = new Set<string>();
  for (const ing of ingredientsIn) {
    if (!ing.name_ar || !ALLOWED_UNITS.has(ing.unit)) {
      errors.push(`خامة غير صالحة (الاسم/الوحدة): ${JSON.stringify(ing)}`);
    } else if (ingNames.has(ing.name_ar)) {
      errors.push(`خامة مكررة: "${ing.name_ar}"`);
    } else {
      ingNames.add(ing.name_ar);
    }
    if (ing.currentStock != null && (!Number.isFinite(ing.currentStock) || ing.currentStock < 0)) {
      errors.push(`رصيد غير صالح للخامة "${ing.name_ar}"`);
    }
    if (ing.reorderAt != null && (!Number.isFinite(ing.reorderAt) || ing.reorderAt < 0)) {
      errors.push(`حدّ إعادة طلب غير صالح للخامة "${ing.name_ar}"`);
    }
  }

  // unique category keys
  const catKeys = new Set<string>();
  const catIdByName = new Map<string, string>(); // key -> name_ar
  for (const cat of categoriesIn) {
    if (!cat.key || !cat.name_ar) {
      errors.push(`فئة غير صالحة: ${JSON.stringify(cat)}`);
    } else if (catKeys.has(cat.key)) {
      errors.push(`فئة بمفتاح مكرر: "${cat.key}"`);
    } else {
      catKeys.add(cat.key);
      catIdByName.set(cat.key, cat.name_ar);
    }
  }

  // unique product names + per-product validation
  const prodNames = new Set<string>();
  for (const p of productsIn) {
    if (!p.name_ar) {
      errors.push("منتج بدون اسم (name_ar)");
      continue;
    }
    if (prodNames.has(p.name_ar)) {
      errors.push(`منتج مكرر: "${p.name_ar}"`);
      continue;
    }
    prodNames.add(p.name_ar);

    moneyString(p.priceILS, `منتج "${p.name_ar}" السعر`, errors);

    if (!catIdByName.has(p.category)) {
      errors.push(`منتج "${p.name_ar}" يشير لفئة غير موجودة: "${p.category}"`);
    }

    if (p.imageFile) {
      if (basename(p.imageFile) !== p.imageFile) {
        errors.push(`منتج "${p.name_ar}": imageFile لا يجوز أن يحتوي مسارًا — ${p.imageFile}`);
      } else {
        try {
          readFileSync(resolve(IMAGE_DIR, p.imageFile));
        } catch {
          errors.push(`منتج "${p.name_ar}": الصورة غير موجودة في public/menu/ (${p.imageFile})`);
        }
      }
    }

    // modifier groups
    const groupNames = new Set<string>();
    const linkedIngredients = new Set<string>();
    for (const g of p.modifierGroups ?? []) {
      if (g.type !== "single" && g.type !== "multi") {
        errors.push(`منتج "${p.name_ar}": نوع مجموعة غير صالح "${g.type}"`);
      }
      if (!g.name_ar) {
        errors.push(`منتج "${p.name_ar}": مجموعة بدون اسم`);
      } else if (groupNames.has(g.name_ar)) {
        errors.push(`منتج "${p.name_ar}": مجموعة مكررة "${g.name_ar}"`);
      } else {
        groupNames.add(g.name_ar);
      }
      if (g.type === "multi" && g.max != null && g.max < 1) {
        errors.push(`منتج "${p.name_ar}"/"${g.name_ar}": max يجب أن يكون ≥ 1 لهذه المجموعة`);
      }
      const optNames = new Set<string>();
      for (const o of g.options ?? []) {
        if (!o.name_ar) {
          errors.push(`منتج "${p.name_ar}"/"${g.name_ar}": خيار بدون اسم`);
        } else if (optNames.has(o.name_ar)) {
          errors.push(`خيار مكرر في "${g.name_ar}": "${o.name_ar}"`);
        } else {
          optNames.add(o.name_ar);
        }
        if (o.deltaILS != null) {
          deltaString(o.deltaILS, `خيار "${o.name_ar}" زيادة السعر`, errors);
        }
        if (o.ingredientQty) {
          const q = o.ingredientQty;
          linkedIngredients.add(q.ingredient);
          if (!ingNames.has(q.ingredient)) {
            errors.push(`خيار "${o.name_ar}": خامة غير موجودة "${q.ingredient}"`);
          }
          qtyString(q.qty, `خيار "${o.name_ar}" الكمية`, errors);
          // Swappable ingredients LIVE ONLY in single+required groups (spec §8.4).
          if (g.type !== "single" || g.required !== true) {
            errors.push(
              `خيار "${o.name_ar}" يستهلك خامة ("${q.ingredient}") لكن مجموعته ليست single+required`,
            );
          }
        }
      }
    }

    // recipe + zero-overlap
    const recipeIngs = new Set<string>();
    for (const r of p.recipe ?? []) {
      if (!ingNames.has(r.ingredient)) {
        errors.push(`منتج "${p.name_ar}": خامة وصفة غير موجودة "${r.ingredient}"`);
      }
      qtyString(r.qty, `منتج "${p.name_ar}" وصفة "${r.ingredient}"`, errors);
      recipeIngs.add(r.ingredient);
    }
    for (const linked of linkedIngredients) {
      if (recipeIngs.has(linked)) {
        errors.push(
          `منتج "${p.name_ar}": خامة "${linked}" موجودة في الوصفة وفي خيار معدِّل — تكرار محظور (spec §8.4)`,
        );
      }
    }
  }

  // tables
  const tableCodes = new Set<string>();
  for (const t of tablesIn) {
    if (!t.code) errors.push("طاولة بدون رمز (code)");
    else if (tableCodes.has(t.code)) errors.push(`طاولة مكررة: "${t.code}"`);
    else tableCodes.add(t.code);
  }

  if (errors.length > 0) {
    console.error(
      `\n❌ رُفض الالتزام — ${errors.length} مخالفة (لم يُغيّر أي شيء في قاعدة البيانات):\n`,
    );
    errors.forEach((e) => console.error(`  - ${e}`));
    console.error(`\nأصلح المشاكل أعلاه ثم أعد التشغيل. الدليل: docs/real-menu-guide.md`);
    process.exit(1);
  }

  console.log(
    `✅ التحقق نجح: خامات=${ingredientsIn.length} فئات=${categoriesIn.length} منتجات=${productsIn.length} طاولات=${tablesIn.length}`,
  );

  const summary = {
    ingredientsInserted: 0,
    categoriesInserted: 0,
    productsInserted: 0,
    groupsInserted: 0,
    optionsInserted: 0,
    recipesInserted: 0,
    tablesInserted: 0,
    archivedProducts: 0,
  };

  try {
    await db.transaction(async (tx) => {
      // Which catalog rows are still referenced by historical orders?
      const refProductRows = await tx
        .select({ id: orderItems.productId })
        .from(orderItems)
        .groupBy(orderItems.productId);
      const refIngredientRows = await tx
        .select({ id: inventoryMoves.ingredientId })
        .from(inventoryMoves)
        .where(sql`${inventoryMoves.refOrderId} is not null`)
        .groupBy(inventoryMoves.ingredientId);
      const refProductIds = new Set(refProductRows.map((r) => r.id));
      const refIngredientIds = new Set(refIngredientRows.map((r) => r.id));

      // ── Replace the demo catalog ───────────────────────────────────────
      await tx.delete(modifiers);
      await tx.delete(modifierGroups);
      // Recipes that reference anything we are about to delete are dropped.
      if (refProductIds.size === 0 && refIngredientIds.size === 0) {
        await tx.delete(recipes);
      } else {
        const allRecipes = await tx.select().from(recipes);
        for (const r of allRecipes) {
          const keep = refProductIds.has(r.productId) || refIngredientIds.has(r.ingredientId);
          if (!keep) {
            await tx
              .delete(recipes)
              .where(
                sql`${recipes.productId}=${r.productId} AND ${recipes.ingredientId}=${r.ingredientId}`,
              );
          }
        }
      }

      if (refProductIds.size === 0) {
        await tx.delete(products);
      } else {
        // Archive (hide) products referenced by history; delete the rest.
        const allProds = await tx.select({ id: products.id }).from(products);
        for (const pp of allProds) {
          if (refProductIds.has(pp.id)) {
            await tx
              .update(products)
              .set({ isAvailable: false })
              .where(sql`${products.id}=${pp.id}`);
            summary.archivedProducts++;
          } else {
            await tx.delete(products).where(sql`${products.id}=${pp.id}`);
          }
        }
      }

      if (refIngredientIds.size === 0) {
        await tx.delete(ingredients);
      } else {
        const allIngs = await tx.select({ id: ingredients.id }).from(ingredients);
        for (const ig of allIngs) {
          if (!refIngredientIds.has(ig.id)) {
            await tx.delete(ingredients).where(sql`${ingredients.id}=${ig.id}`);
          }
        }
      }

      // Drop demo categories that are now empty (keep ones still used).
      const usedCatIds = await tx
        .select({ categoryId: products.categoryId })
        .from(products)
        .groupBy(products.categoryId);
      const usedCatSet = new Set(usedCatIds.map((c) => c.categoryId));
      const allCats = await tx.select({ id: categories.id }).from(categories);
      for (const c of allCats) {
        if (!usedCatSet.has(c.id)) await tx.delete(categories).where(sql`${categories.id}=${c.id}`);
      }

      // ── Branch ─────────────────────────────────────────────────────────
      const slug = input.branch?.slug?.trim() || "qalqilya";
      let branchRows = await tx
        .select()
        .from(branches)
        .where(sql`${branches.slug}=${slug}`)
        .limit(1);
      if (branchRows.length === 0) {
        await tx.insert(branches).values({
          name: input.branch?.name_ar?.trim() || slug,
          slug,
        });
        branchRows = await tx
          .select()
          .from(branches)
          .where(sql`${branches.slug}=${slug}`)
          .limit(1);
      }
      const branchId = branchRows[0]!.id;

      // ── Categories ─────────────────────────────────────────────────────
      const catIdMap = new Map<string, string>();
      for (const cat of categoriesIn) {
        const [ins] = await tx
          .insert(categories)
          .values({ nameAr: cat.name_ar, nameEn: cat.key, sortOrder: cat.sort ?? 0 })
          .returning({ id: categories.id });
        catIdMap.set(cat.key, ins.id);
        summary.categoriesInserted++;
      }

      // ── Ingredients ────────────────────────────────────────────────────
      const ingIdMap = new Map<string, string>();
      for (const ing of ingredientsIn) {
        // idempotent: re-use an existing ingredient with the same name_ar
        const existing = await tx
          .select({ id: ingredients.id })
          .from(ingredients)
          .where(sql`${ingredients.name}=${ing.name_ar}`)
          .limit(1);
        if (existing.length > 0) {
          ingIdMap.set(ing.name_ar, existing[0].id);
          continue;
        }
        const [ins] = await tx
          .insert(ingredients)
          .values({
            name: ing.name_ar,
            unit: ing.unit,
            currentStock: String(ing.currentStock ?? 0),
            reorderThreshold: String(ing.reorderAt ?? 0),
            costPerUnit: "0",
          })
          .returning({ id: ingredients.id });
        ingIdMap.set(ing.name_ar, ins.id);
        summary.ingredientsInserted++;
      }

      // ── Products + modifier groups/options + recipes ───────────────────
      for (const p of productsIn) {
        const categoryId = catIdMap.get(p.category)!;
        const priceStr = formatPrice(toMinorUnits(String(p.priceILS)));

        // idempotent: skip if an active product with this name already exists
        const dup = await tx
          .select({ id: products.id, isAvailable: products.isAvailable })
          .from(products)
          .where(sql`${products.nameAr}=${p.name_ar}`)
          .limit(1);
        if (dup.length > 0 && dup[0].isAvailable) continue;

        const [prod] = await tx
          .insert(products)
          .values({
            nameAr: p.name_ar,
            nameEn: enName(p.name_ar, "product"),
            categoryId,
            basePrice: priceStr,
            imageUrl: p.imageFile ? `/menu/${p.imageFile}` : null,
            descriptionAr: p.desc_ar?.trim() || null,
            isAvailable: true,
            trackInventory: true,
          })
          .returning({ id: products.id });
        summary.productsInserted++;

        for (const g of p.modifierGroups ?? []) {
          const [group] = await tx
            .insert(modifierGroups)
            .values({
              productId: prod.id,
              name: enName(g.name_ar, "group"),
              type: g.type,
              isRequired: g.required === true,
              maxSelections: g.type === "multi" ? (g.max ?? null) : null,
            })
            .returning({ id: modifierGroups.id });
          summary.groupsInserted++;

          for (const o of g.options ?? []) {
            const linked = o.ingredientQty;
            await tx.insert(modifiers).values({
              groupId: group.id,
              nameAr: o.name_ar,
              name: enName(o.name_ar, "opt"),
              priceDelta: formatPrice(toMinorUnits(String(o.deltaILS ?? 0))),
              ingredientId:
                linked && ingIdMap.has(linked.ingredient) ? ingIdMap.get(linked.ingredient)! : null,
              ingredientQty:
                linked && ingIdMap.has(linked.ingredient) ? linked.qty.toFixed(2) : null,
            });
            summary.optionsInserted++;
          }
        }

        for (const r of p.recipe ?? []) {
          await tx
            .insert(recipes)
            .values({
              productId: prod.id,
              ingredientId: ingIdMap.get(r.ingredient)!,
              quantityUsed: r.qty.toFixed(2),
            })
            .onConflictDoNothing();
          summary.recipesInserted++;
        }
      }

      // ── Tables (get-or-create by code) ────────────────────────────────
      for (const t of tablesIn) {
        const existing = await tx
          .select()
          .from(tables)
          .where(sql`${tables.code}=${t.code}`)
          .limit(1);
        if (existing.length === 0) {
          await tx.insert(tables).values({ branchId, code: t.code, qrToken: randomUUID() });
          summary.tablesInserted++;
        }
      }
    });

    console.log(`\n✅ تم استيراد القائمة الحقيقية بنجاح والالتزام بها:\n`);
    console.log(`  الخامات:        ${summary.ingredientsInserted}`);
    console.log(`  الفئات:         ${summary.categoriesInserted}`);
    console.log(`  المنتجات:       ${summary.productsInserted}`);
    console.log(`  مجموعات معدِّل: ${summary.groupsInserted}`);
    console.log(`  خيارات معدِّل:  ${summary.optionsInserted}`);
    console.log(`  الوصفات:        ${summary.recipesInserted}`);
    console.log(`  الطاولات:       ${summary.tablesInserted}`);
    if (summary.archivedProducts > 0) {
      console.log(`  منتجات مؤرشفة (مرتبطة بطلبات): ${summary.archivedProducts}`);
    }
    console.log(`\nتم الحفاظ على: الموظفين، الإعدادات، الطاولات الحالية، سجلّ الطلبات.`);
  } catch (err) {
    console.error("\n❌ فشل الالتزام — تم تراجع المعاملة بالكامل (لم تُحفظ أي تغييرات):");
    console.error("   ", (err as Error).message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
