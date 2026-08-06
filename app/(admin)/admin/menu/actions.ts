"use server";

import { requireStaffSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  categories,
  products,
  modifierGroups,
  modifiers,
  recipes,
  ingredients,
  priceChanges,
  staff,
  branches,
} from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { toScaledInt, formatPrice } from "@/lib/pricing";
import { invalidatePublicCatalog } from "@/lib/db/queries";

/**
 * Normalise a user-entered price (string) into a canonical
 * numeric-as-string at scale 2 — the money-representation contract in
 * spec §12.  A raw JS float must never touch a price; callers send the
 * raw input value as a string and we parse it into integer minor units
 * here.  Returns null when the input is not a valid amount.
 */
function sanitizePrice(input: string | undefined | null): string | null {
  if (input === undefined || input === null) return null;
  const trimmed = input.trim();
  if (trimmed === "") return null;
  // toScaledInt returns 0 for garbage — distinguish real zero from noise.
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return formatPrice(toScaledInt(trimmed, 2));
}

// ── Categories ──

/**
 * Invalidate the public catalog cache for EVERY branch (C2). Menu mutations
 * are not scoped to a branch (single-branch shop mid-term), and a product/
 * modifier change can appear on any branch's catalog, so we clear all slugs.
 * Safe: invalidating a cache key that isn't present is a no-op.
 */
async function invalidateAllPublicCatalogs(): Promise<void> {
  const rows = await db.select({ slug: branches.slug }).from(branches);
  for (const b of rows) invalidatePublicCatalog(b.slug);
}

export async function createCategory(input: {
  nameAr: string;
  nameEn: string;
  sortOrder?: number;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  if (!input.nameAr.trim() || !input.nameEn.trim()) {
    return { success: false, error: "الاسم مطلوب بالعربية والإنجليزية" };
  }
  await db.insert(categories).values({
    nameAr: input.nameAr.trim(),
    nameEn: input.nameEn.trim(),
    sortOrder: input.sortOrder ?? 0,
  });
  await invalidateAllPublicCatalogs();
  return { success: true };
}

export async function updateCategory(input: {
  id: string;
  nameAr?: string;
  nameEn?: string;
  sortOrder?: number;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  const data: Record<string, unknown> = {};
  if (input.nameAr !== undefined) data.nameAr = input.nameAr.trim();
  if (input.nameEn !== undefined) data.nameEn = input.nameEn.trim();
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (Object.keys(data).length === 0) {
    return { success: false, error: "لا توجد تغييرات" };
  }
  await db.update(categories).set(data).where(eq(categories.id, input.id));
  await invalidateAllPublicCatalogs();
  return { success: true };
}

export async function deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  const [hasProducts] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.categoryId, id));
  if (hasProducts && hasProducts.count > 0) {
    return { success: false, error: "لا يمكن حذف فئة تحتوي على منتجات. انقل المنتجات أولاً." };
  }
  await db.delete(categories).where(eq(categories.id, id));
  await invalidateAllPublicCatalogs();
  return { success: true };
}

// ── Products ──

export async function createProduct(input: {
  categoryId: string;
  nameAr: string;
  nameEn: string;
  basePrice: string;
  imageUrl?: string;
  trackInventory?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  if (!input.nameAr.trim() || !input.nameEn.trim() || !input.categoryId) {
    return { success: false, error: "جميع الحقول المطلوبة فارغة" };
  }
  const price = sanitizePrice(input.basePrice);
  if (price === null || toScaledInt(price, 2) <= 0) {
    return { success: false, error: "السعر يجب أن يكون أكبر من صفر" };
  }
  await db.insert(products).values({
    categoryId: input.categoryId,
    nameAr: input.nameAr.trim(),
    nameEn: input.nameEn.trim(),
    basePrice: price,
    imageUrl: input.imageUrl || null,
    isAvailable: true,
    trackInventory: input.trackInventory ?? true,
  });
  await invalidateAllPublicCatalogs();
  return { success: true };
}

export async function updateProduct(input: {
  id: string;
  nameAr?: string;
  nameEn?: string;
  basePrice?: string;
  categoryId?: string;
  imageUrl?: string;
  isAvailable?: boolean;
  trackInventory?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { staffId } = await requireStaffSession("manager");
  const data: Record<string, unknown> = {};
  if (input.nameAr !== undefined) data.nameAr = input.nameAr.trim();
  if (input.nameEn !== undefined) data.nameEn = input.nameEn.trim();
  if (input.basePrice !== undefined) {
    const price = sanitizePrice(input.basePrice);
    if (price === null || toScaledInt(price, 2) <= 0) {
      return { success: false, error: "السعر يجب أن يكون أكبر من صفر" };
    }
    data.basePrice = price;
  }
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl || null;
  if (input.isAvailable !== undefined) data.isAvailable = input.isAvailable;
  if (input.trackInventory !== undefined) data.trackInventory = input.trackInventory;
  if (Object.keys(data).length === 0) {
    return { success: false, error: "لا توجد تغييرات" };
  }

  // Spec §12: audit log on every price adjustment (WEB-SEC-006).
  if (input.basePrice !== undefined) {
    const [existing] = await db
      .select({ basePrice: products.basePrice })
      .from(products)
      .where(eq(products.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: "المنتج غير موجود" };
    }

    const newPrice = data.basePrice as string;

    if (existing.basePrice !== newPrice) {
      await db.transaction(async (tx) => {
        await tx.update(products).set(data).where(eq(products.id, input.id));
        await tx.insert(priceChanges).values({
          entityType: "product",
          entityId: input.id,
          field: "base_price",
          oldValue: existing.basePrice,
          newValue: newPrice,
          changedBy: staffId,
        });
      });
      await invalidateAllPublicCatalogs();
      return { success: true };
    }
  }

  await db.update(products).set(data).where(eq(products.id, input.id));
  await invalidateAllPublicCatalogs();
  return { success: true };
}

export async function toggleProductAvailable(
  id: string,
  available: boolean,
): Promise<{ success: boolean }> {
  await requireStaffSession("manager");
  await db.update(products).set({ isAvailable: available }).where(eq(products.id, id));
  await invalidateAllPublicCatalogs();
  return { success: true };
}

// ── Modifier Groups + Modifiers ──

export async function createModifierGroup(input: {
  productId: string;
  name: string;
  type: "single" | "multi";
  isRequired: boolean;
}): Promise<{ success: boolean; groupId?: string; error?: string }> {
  await requireStaffSession("manager");
  if (!input.name.trim()) return { success: false, error: "اسم المجموعة مطلوب" };
  const [group] = await db
    .insert(modifierGroups)
    .values({
      productId: input.productId,
      name: input.name.trim(),
      type: input.type,
      isRequired: input.isRequired,
    })
    .returning({ id: modifierGroups.id });
  await invalidateAllPublicCatalogs();
  return { success: true, groupId: group!.id };
}

export async function updateModifierGroup(input: {
  id: string;
  name?: string;
  type?: "single" | "multi";
  isRequired?: boolean;
  maxSelections?: number | null;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.type !== undefined) data.type = input.type;
  if (input.isRequired !== undefined) data.isRequired = input.isRequired;
  if (input.maxSelections !== undefined) {
    if (input.type === "multi" && input.maxSelections != null && input.maxSelections < 1) {
      return { success: false, error: "الحد الأقصى يجب أن يكون 1 أو أكثر" };
    }
    data.maxSelections = input.maxSelections;
  }
  if (Object.keys(data).length === 0) return { success: false, error: "لا توجد تغييرات" };
  await db.update(modifierGroups).set(data).where(eq(modifierGroups.id, input.id));
  await invalidateAllPublicCatalogs();
  return { success: true };
}

export async function deleteModifierGroup(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  await db.delete(modifierGroups).where(eq(modifierGroups.id, id));
  await invalidateAllPublicCatalogs();
  return { success: true };
}

export async function createModifier(input: {
  groupId: string;
  nameAr: string;
  name: string;
  priceDelta?: string;
  ingredientId?: string | null;
  ingredientQty?: string;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  if (!input.nameAr.trim() || !input.name.trim()) {
    return { success: false, error: "الاسم مطلوب" };
  }
  const delta = sanitizePrice(input.priceDelta ?? "0") ?? "0.00";
  const qty = sanitizePrice(input.ingredientQty ?? undefined);
  if (input.ingredientId && qty === null) {
    return { success: false, error: "الكمية المرتبطة بالمكون غير صالحة" };
  }
  await db.insert(modifiers).values({
    groupId: input.groupId,
    nameAr: input.nameAr.trim(),
    name: input.name.trim(),
    priceDelta: delta,
    ingredientId: input.ingredientId || null,
    ingredientQty: input.ingredientId && qty !== null ? qty : null,
  });
  await invalidateAllPublicCatalogs();
  return { success: true };
}

export async function updateModifier(input: {
  id: string;
  nameAr?: string;
  name?: string;
  priceDelta?: string;
  ingredientId?: string | null;
  ingredientQty?: string;
  clearIngredient?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { staffId } = await requireStaffSession("manager");
  const data: Record<string, unknown> = {};
  if (input.nameAr !== undefined) data.nameAr = input.nameAr.trim();
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.priceDelta !== undefined) {
    const delta = sanitizePrice(input.priceDelta);
    if (delta === null) return { success: false, error: "قيمة السعر غير صالحة" };
    data.priceDelta = delta;
  }
  if (input.clearIngredient) {
    data.ingredientId = null;
    data.ingredientQty = null;
  } else if (input.ingredientId !== undefined) {
    const qty = sanitizePrice(input.ingredientQty ?? undefined);
    if (qty === null) return { success: false, error: "الكمية المرتبطة بالمكون غير صالحة" };
    data.ingredientId = input.ingredientId || null;
    data.ingredientQty = input.ingredientId ? qty : null;
  }
  if (Object.keys(data).length === 0) return { success: false, error: "لا توجد تغييرات" };

  // Spec §12: audit log on every price adjustment (WEB-SEC-006).
  if (input.priceDelta !== undefined) {
    const [existing] = await db
      .select({ priceDelta: modifiers.priceDelta })
      .from(modifiers)
      .where(eq(modifiers.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: "المعدّل غير موجود" };
    }

    const newDelta = data.priceDelta as string;

    if (existing.priceDelta !== newDelta) {
      await db.transaction(async (tx) => {
        await tx.update(modifiers).set(data).where(eq(modifiers.id, input.id));
        await tx.insert(priceChanges).values({
          entityType: "modifier",
          entityId: input.id,
          field: "price_delta",
          oldValue: existing.priceDelta,
          newValue: newDelta,
          changedBy: staffId,
        });
      });
      await invalidateAllPublicCatalogs();
      return { success: true };
    }
  }

  await db.update(modifiers).set(data).where(eq(modifiers.id, input.id));
  await invalidateAllPublicCatalogs();
  return { success: true };
}

export async function deleteModifier(id: string): Promise<{ success: boolean }> {
  await requireStaffSession("manager");
  await db.delete(modifiers).where(eq(modifiers.id, id));
  await invalidateAllPublicCatalogs();
  return { success: true };
}

// ── Recipes ──

export async function saveRecipe(input: {
  productId: string;
  ingredientId: string;
  quantityUsed: string;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  const qty = sanitizePrice(input.quantityUsed);
  if (qty === null || toScaledInt(qty, 2) <= 0) {
    return { success: false, error: "الكمية يجب أن تكون أكبر من صفر" };
  }

  const [existing] = await db
    .select({ productId: recipes.productId, ingredientId: recipes.ingredientId })
    .from(recipes)
    .where(
      sql`${recipes.productId} = ${input.productId} AND ${recipes.ingredientId} = ${input.ingredientId}`,
    )
    .limit(1);

  if (existing) {
    await db
      .update(recipes)
      .set({ quantityUsed: qty })
      .where(
        sql`${recipes.productId} = ${input.productId} AND ${recipes.ingredientId} = ${input.ingredientId}`,
      );
  } else {
    await db.insert(recipes).values({
      productId: input.productId,
      ingredientId: input.ingredientId,
      quantityUsed: qty,
    });
  }
  await invalidateAllPublicCatalogs();
  return { success: true };
}

export async function deleteRecipe(
  productId: string,
  ingredientId: string,
): Promise<{ success: boolean }> {
  await requireStaffSession("manager");
  await db
    .delete(recipes)
    .where(sql`${recipes.productId} = ${productId} AND ${recipes.ingredientId} = ${ingredientId}`);
  await invalidateAllPublicCatalogs();
  return { success: true };
}

// ── Full menu fetch (reused from existing getMenuForPOS but with all products) ──

export async function getFullMenuForAdmin(): Promise<{
  categories: Array<{
    id: string;
    nameAr: string;
    nameEn: string;
    sortOrder: number;
    products: Array<{
      id: string;
      nameAr: string;
      nameEn: string;
      basePrice: string;
      imageUrl: string | null;
      isAvailable: boolean;
      trackInventory: boolean;
      modifierGroups: Array<{
        id: string;
        name: string;
        type: "single" | "multi";
        isRequired: boolean;
        maxSelections: number | null;
        modifiers: Array<{
          id: string;
          nameAr: string;
          name: string;
          priceDelta: string;
          ingredientId: string | null;
          ingredientQty: string | null;
        }>;
      }>;
      recipes: Array<{
        ingredientId: string;
        ingredientName: string;
        quantityUsed: string;
      }>;
    }>;
  }>;
  ingredients: Array<{ id: string; name: string; unit: string }>;
}> {
  await requireStaffSession("manager");

  const catRows = await db.query.categories.findMany({
    orderBy: (cats, { asc }) => [asc(cats.sortOrder)],
    with: {
      products: {
        orderBy: (prods, { asc }) => [asc(prods.nameEn)],
        with: {
          modifierGroups: {
            with: {
              modifiers: true,
            },
          },
        },
      },
    },
  });

  const allRecipes = await db.select().from(recipes);
  const allIngredients = await db
    .select({ id: ingredients.id, name: ingredients.name, unit: ingredients.unit })
    .from(ingredients);

  const ingredientNameMap = new Map(allIngredients.map((i) => [i.id, i.name]));

  return {
    categories: catRows.map((cat) => ({
      id: cat.id,
      nameAr: cat.nameAr,
      nameEn: cat.nameEn,
      sortOrder: cat.sortOrder,
      products: cat.products.map((prod) => {
        const prodRecipes = allRecipes.filter((r) => r.productId === prod.id);
        return {
          id: prod.id,
          nameAr: prod.nameAr,
          nameEn: prod.nameEn,
          basePrice: prod.basePrice,
          imageUrl: prod.imageUrl,
          isAvailable: prod.isAvailable,
          trackInventory: prod.trackInventory,
          modifierGroups: prod.modifierGroups.map((mg) => ({
            id: mg.id,
            name: mg.name,
            type: mg.type,
            isRequired: mg.isRequired,
            maxSelections: mg.maxSelections,
            modifiers: mg.modifiers.map((m) => ({
              id: m.id,
              nameAr: m.nameAr,
              name: m.name,
              priceDelta: m.priceDelta,
              ingredientId: m.ingredientId,
              ingredientQty: m.ingredientQty,
            })),
          })),
          recipes: prodRecipes.map((r) => ({
            ingredientId: r.ingredientId,
            ingredientName: ingredientNameMap.get(r.ingredientId) ?? r.ingredientId,
            quantityUsed: r.quantityUsed,
          })),
        };
      }),
    })),
    ingredients: allIngredients,
  };
}

// ── Price-change audit log (spec §12, WEB-SEC-006) ──

export interface PriceChangeEntry {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string;
  newValue: string;
  staffName: string | null;
  createdAt: string;
}

export async function getPriceChangeAudit(limit = 50): Promise<PriceChangeEntry[]> {
  await requireStaffSession("manager");

  const rows = await db
    .select({
      id: priceChanges.id,
      entityType: priceChanges.entityType,
      entityId: priceChanges.entityId,
      field: priceChanges.field,
      oldValue: priceChanges.oldValue,
      newValue: priceChanges.newValue,
      staffName: staff.name,
      createdAt: priceChanges.createdAt,
    })
    .from(priceChanges)
    .leftJoin(staff, eq(priceChanges.changedBy, staff.id))
    .orderBy(desc(priceChanges.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    field: r.field,
    oldValue: r.oldValue,
    newValue: r.newValue,
    staffName: r.staffName,
    createdAt: r.createdAt.toISOString(),
  }));
}
