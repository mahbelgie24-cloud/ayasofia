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
} from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";

// ── Categories ──

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
  return { success: true };
}

// ── Products ──

export async function createProduct(input: {
  categoryId: string;
  nameAr: string;
  nameEn: string;
  basePrice: number;
  imageUrl?: string;
  trackInventory?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  if (!input.nameAr.trim() || !input.nameEn.trim() || !input.categoryId) {
    return { success: false, error: "جميع الحقول المطلوبة فارغة" };
  }
  if (input.basePrice <= 0) {
    return { success: false, error: "السعر يجب أن يكون أكبر من صفر" };
  }
  await db.insert(products).values({
    categoryId: input.categoryId,
    nameAr: input.nameAr.trim(),
    nameEn: input.nameEn.trim(),
    basePrice: input.basePrice.toFixed(2),
    imageUrl: input.imageUrl || null,
    isAvailable: true,
    trackInventory: input.trackInventory ?? true,
  });
  return { success: true };
}

export async function updateProduct(input: {
  id: string;
  nameAr?: string;
  nameEn?: string;
  basePrice?: number;
  categoryId?: string;
  imageUrl?: string;
  isAvailable?: boolean;
  trackInventory?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { staffId } = await requireStaffSession("manager");
  const data: Record<string, unknown> = {};
  if (input.nameAr !== undefined) data.nameAr = input.nameAr.trim();
  if (input.nameEn !== undefined) data.nameEn = input.nameEn.trim();
  if (input.basePrice !== undefined) data.basePrice = input.basePrice.toFixed(2);
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl || null;
  if (input.isAvailable !== undefined) data.isAvailable = input.isAvailable;
  if (input.trackInventory !== undefined) data.trackInventory = input.trackInventory;
  if (Object.keys(data).length === 0) {
    return { success: false, error: "لا توجد تغييرات" };
  }

  // Spec §12: audit log on every price adjustment (WEB-SEC-006).
  // When basePrice is changing, fetch the old value and write a
  // price_changes row atomically with the update.  Non-price fields
  // skip the audit path — only price adjustments are logged.
  if (input.basePrice !== undefined) {
    const [existing] = await db
      .select({ basePrice: products.basePrice })
      .from(products)
      .where(eq(products.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: "المنتج غير موجود" };
    }

    const newPrice = input.basePrice.toFixed(2);

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
      return { success: true };
    }
  }

  await db.update(products).set(data).where(eq(products.id, input.id));
  return { success: true };
}

export async function toggleProductAvailable(
  id: string,
  available: boolean,
): Promise<{ success: boolean }> {
  await requireStaffSession("manager");
  await db.update(products).set({ isAvailable: available }).where(eq(products.id, id));
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
  return { success: true, groupId: group!.id };
}

export async function updateModifierGroup(input: {
  id: string;
  name?: string;
  type?: "single" | "multi";
  isRequired?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.type !== undefined) data.type = input.type;
  if (input.isRequired !== undefined) data.isRequired = input.isRequired;
  if (Object.keys(data).length === 0) return { success: false, error: "لا توجد تغييرات" };
  await db.update(modifierGroups).set(data).where(eq(modifierGroups.id, input.id));
  return { success: true };
}

export async function deleteModifierGroup(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  await db.delete(modifierGroups).where(eq(modifierGroups.id, id));
  return { success: true };
}

export async function createModifier(input: {
  groupId: string;
  nameAr: string;
  name: string;
  priceDelta?: number;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  if (!input.nameAr.trim() || !input.name.trim()) {
    return { success: false, error: "الاسم مطلوب" };
  }
  await db.insert(modifiers).values({
    groupId: input.groupId,
    nameAr: input.nameAr.trim(),
    name: input.name.trim(),
    priceDelta: (input.priceDelta ?? 0).toFixed(2),
  });
  return { success: true };
}

export async function updateModifier(input: {
  id: string;
  nameAr?: string;
  name?: string;
  priceDelta?: number;
}): Promise<{ success: boolean; error?: string }> {
  const { staffId } = await requireStaffSession("manager");
  const data: Record<string, unknown> = {};
  if (input.nameAr !== undefined) data.nameAr = input.nameAr.trim();
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.priceDelta !== undefined) data.priceDelta = input.priceDelta.toFixed(2);
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

    const newDelta = input.priceDelta.toFixed(2);

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
      return { success: true };
    }
  }

  await db.update(modifiers).set(data).where(eq(modifiers.id, input.id));
  return { success: true };
}

export async function deleteModifier(id: string): Promise<{ success: boolean }> {
  await requireStaffSession("manager");
  await db.delete(modifiers).where(eq(modifiers.id, id));
  return { success: true };
}

// ── Recipes ──

export async function saveRecipe(input: {
  productId: string;
  ingredientId: string;
  quantityUsed: number;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  if (input.quantityUsed <= 0) return { success: false, error: "الكمية يجب أن تكون أكبر من صفر" };

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
      .set({ quantityUsed: input.quantityUsed.toFixed(2) })
      .where(
        sql`${recipes.productId} = ${input.productId} AND ${recipes.ingredientId} = ${input.ingredientId}`,
      );
  } else {
    await db.insert(recipes).values({
      productId: input.productId,
      ingredientId: input.ingredientId,
      quantityUsed: input.quantityUsed.toFixed(2),
    });
  }
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
        modifiers: Array<{
          id: string;
          nameAr: string;
          name: string;
          priceDelta: string;
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
            modifiers: mg.modifiers.map((m) => ({
              id: m.id,
              nameAr: m.nameAr,
              name: m.name,
              priceDelta: m.priceDelta,
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
