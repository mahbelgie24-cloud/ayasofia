"use server";

/**
 * Digital menu — admin actions (FR-DM-08, C2).
 *
 * All RBAC: requireStaffSession("manager"). Every mutation that changes
 * what guests see (tables, suggestion, upsell rules) invalidates the
 * public catalog cache directly — no event bus in this codebase, so
 * invalidation is synchronous in-process (see lib/cache.ts).
 */

import { requireStaffSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { tables, branches, todaySuggestion, upsellRules, products, modifiers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { invalidatePublicCatalog } from "@/lib/db/queries";
import { getActiveUpsellRules } from "@/lib/db/queries";

// ── Tables + printable QR (FR-DM-10) ──

export interface AdminTable {
  id: string;
  code: string;
  qrToken: string;
  active: boolean;
  branchName: string;
}

export async function getTables(): Promise<AdminTable[]> {
  await requireStaffSession("manager");
  const rows = await db
    .select({
      id: tables.id,
      code: tables.code,
      qrToken: tables.qrToken,
      active: tables.active,
      branchName: branches.name,
    })
    .from(tables)
    .innerJoin(branches, eq(tables.branchId, branches.id))
    .orderBy(tables.code);
  return rows;
}

/** Resolve the (single) branch id, creating it from settings if absent. */
async function firstBranchId(): Promise<string> {
  const [branch] = await db.select({ id: branches.id }).from(branches).limit(1);
  if (branch) return branch.id;
  const slugBase = "qalqilya";
  const [created] = await db
    .insert(branches)
    .values({ name: "Ayasofia Qalqilya", slug: slugBase })
    .returning({ id: branches.id });
  return created.id;
}

/** Branch slug for building table-QR URLs on the admin screen. */
export async function getPrimaryBranchSlug(): Promise<string | null> {
  await requireStaffSession("manager");
  const [branch] = await db.select({ slug: branches.slug }).from(branches).limit(1);
  return branch?.slug ?? null;
}

export async function createTable(input: {
  code: string;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  const code = input.code.trim();
  if (!code) return { success: false, error: "اسم الطاولة مطلوب" };
  if (code.length > 20) return { success: false, error: "اسم الطاولة طويل جدًا" };

  const branchId = await firstBranchId();

  const existing = await db
    .select({ id: tables.id })
    .from(tables)
    .where(eq(tables.code, code))
    .limit(1);
  if (existing.length > 0) return { success: false, error: "توجد طاولة بهذا الاسم" };

  await db.insert(tables).values({ branchId, code, qrToken: randomUUID() });

  const [branch] = await db
    .select({ slug: branches.slug })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  if (branch) invalidatePublicCatalog(branch.slug);
  return { success: true };
}

export async function toggleTable(input: {
  id: string;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  const rows = await db
    .select({ id: tables.id, active: tables.active, branchId: tables.branchId })
    .from(tables)
    .where(eq(tables.id, input.id))
    .limit(1);
  const t = rows[0];
  if (!t) return { success: false, error: "الطاولة غير موجودة" };
  await db.update(tables).set({ active: !t.active }).where(eq(tables.id, input.id));

  const [branch] = await db
    .select({ slug: branches.slug })
    .from(branches)
    .where(eq(branches.id, t.branchId))
    .limit(1);
  if (branch) invalidatePublicCatalog(branch.slug);
  return { success: true };
}

export async function regenerateTableQr(input: {
  id: string;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  const rows = await db
    .select({ id: tables.id, branchId: tables.branchId })
    .from(tables)
    .where(eq(tables.id, input.id))
    .limit(1);
  const t = rows[0];
  if (!t) return { success: false, error: "الطاولة غير موجودة" };
  await db.update(tables).set({ qrToken: randomUUID() }).where(eq(tables.id, input.id));

  const [branch] = await db
    .select({ slug: branches.slug })
    .from(branches)
    .where(eq(branches.id, t.branchId))
    .limit(1);
  if (branch) invalidatePublicCatalog(branch.slug);
  return { success: true };
}

// ── Today's suggestion (FR-DM-08 / WF-06 shared entity) ──

export interface SuggestionInput {
  productId: string;
  titleAr?: string;
  descriptionAr?: string;
}

export async function setTodaySuggestion(
  input: SuggestionInput,
): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  if (!input.productId) return { success: false, error: "اختر منتجًا" };

  // Deactivate any existing suggestion, then insert the new active one.
  await db
    .update(todaySuggestion)
    .set({ isActive: false })
    .where(eq(todaySuggestion.isActive, true));

  await db.insert(todaySuggestion).values({
    productId: input.productId,
    titleAr: input.titleAr?.trim() || null,
    descriptionAr: input.descriptionAr?.trim() || null,
    isActive: true,
  });

  invalidateAllCatalogCache();
  return { success: true };
}

export async function clearTodaySuggestion(): Promise<{ success: boolean }> {
  await requireStaffSession("manager");
  await db
    .update(todaySuggestion)
    .set({ isActive: false })
    .where(eq(todaySuggestion.isActive, true));
  invalidateAllCatalogCache();
  return { success: true };
}

export async function getCurrentSuggestion(): Promise<{
  productId: string | null;
  titleAr: string | null;
  descriptionAr: string | null;
}> {
  await requireStaffSession("manager");
  const [row] = await db
    .select({
      productId: todaySuggestion.productId,
      titleAr: todaySuggestion.titleAr,
      descriptionAr: todaySuggestion.descriptionAr,
    })
    .from(todaySuggestion)
    .where(eq(todaySuggestion.isActive, true))
    .orderBy(desc(todaySuggestion.updatedAt))
    .limit(1);
  return row ?? { productId: null, titleAr: null, descriptionAr: null };
}

export async function getProductsForSuggestion(): Promise<Array<{ id: string; nameAr: string }>> {
  await requireStaffSession("manager");
  const rows = await db.select({ id: products.id, nameAr: products.nameAr }).from(products);
  return rows;
}

// ── Upsell rules (FR-DM-16) ──

export async function getAdminUpsellRules(): Promise<UpsellRuleRow[]> {
  await requireStaffSession("manager");
  const rows = await db.select().from(upsellRules).orderBy(desc(upsellRules.priority));
  return rows.map((r) => ({
    id: r.id,
    condition: r.condition,
    triggerValue: r.triggerValue,
    suggestionProductId: r.suggestionProductId,
    suggestionModifierId: r.suggestionModifierId,
    priority: r.priority,
    isActive: r.isActive,
  }));
}

export interface UpsellRuleRow {
  id: string;
  condition: string;
  triggerValue: string;
  suggestionProductId: string | null;
  suggestionModifierId: string | null;
  priority: number;
  isActive: boolean;
}

const VALID_CONDITIONS = new Set([
  "cart_has_product_category",
  "cart_without_modifier",
  "cart_below_threshold",
  "time_of_day",
  "always",
]);

export async function createUpsellRule(input: {
  condition: string;
  triggerValue: string;
  suggestionProductId: string | null;
  suggestionModifierId: string | null;
  priority: number;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  if (!VALID_CONDITIONS.has(input.condition)) {
    return { success: false, error: "شرط غير صالح" };
  }
  if (!input.suggestionProductId && !input.suggestionModifierId) {
    return { success: false, error: "حدد منتجًا أو معدّلًا كاقتراح" };
  }
  // triggerValue must be valid JSON for non-fixed conditions.
  if (input.condition !== "always") {
    try {
      JSON.parse(input.triggerValue || "{}");
    } catch {
      return { success: false, error: "قيمة التحفيز يجب أن تكون JSON صالح" };
    }
  }
  await db.insert(upsellRules).values({
    condition: input.condition,
    triggerValue: input.triggerValue || "{}",
    suggestionProductId: input.suggestionProductId || null,
    suggestionModifierId: input.suggestionModifierId || null,
    priority: Math.trunc(input.priority) || 0,
    isActive: true,
  });
  invalidateAllCatalogCache();
  return { success: true };
}

export async function toggleUpsellRule(input: {
  id: string;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  const rows = await db
    .select({ id: upsellRules.id, isActive: upsellRules.isActive })
    .from(upsellRules)
    .where(eq(upsellRules.id, input.id))
    .limit(1);
  const r = rows[0];
  if (!r) return { success: false, error: "القاعدة غير موجودة" };
  await db.update(upsellRules).set({ isActive: !r.isActive }).where(eq(upsellRules.id, input.id));
  invalidateAllCatalogCache();
  return { success: true };
}

export async function deleteUpsellRule(input: { id: string }): Promise<{ success: boolean }> {
  await requireStaffSession("manager");
  await db.delete(upsellRules).where(eq(upsellRules.id, input.id));
  invalidateAllCatalogCache();
  return { success: true };
}

/** Load products + modifiers so the upsell admin can pick suggestions. */
export async function getUpsellCatalog(): Promise<{
  products: Array<{ id: string; nameAr: string }>;
  modifiers: Array<{ id: string; nameAr: string }>;
}> {
  await requireStaffSession("manager");
  const [p, m] = await Promise.all([
    db.select({ id: products.id, nameAr: products.nameAr }).from(products),
    db.select({ id: modifiers.id, nameAr: modifiers.nameAr }).from(modifiers),
  ]);
  return { products: p, modifiers: m };
}

/** Invalidate the public catalog for every branch (all slugs). */
async function invalidateAllCatalogCache(): Promise<void> {
  const branchesList = await db.select({ slug: branches.slug }).from(branches);
  for (const b of branchesList) invalidatePublicCatalog(b.slug);
}

export { getActiveUpsellRules };
