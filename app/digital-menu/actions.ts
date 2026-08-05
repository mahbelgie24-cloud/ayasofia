"use server";

/**
 * Digital menu — public server actions (FR-DM-10…17).
 *
 * No auth (deliberate public exception alongside placeCustomerOrder), but:
 *   - rate-limited per IP (checkThrottle),
 *   - inputs validated (UUID-only product/modifier ids, slug constraints),
 *   - prices + delivery fee recomputed SERVER-side via the shared checkout
 *     pipeline (executeCheckout, source=DIGITAL_MENU),
 *   - modifiers validated server-side (required groups, max selections),
 *   - idempotency key required (spec §12).
 */

import { checkThrottle } from "@/lib/rate-limit";
import { callerIp } from "@/lib/ip";
import { executeCheckout } from "@/lib/checkout-core";
import {
  getPublicCatalog,
  resolveTableByQrToken,
  resolveBranchBySlug,
  getActiveUpsellRules,
} from "@/lib/db/queries";
import { evaluateUpsell, type UpsellCartContext } from "@/lib/upsell";
import { db } from "@/lib/db";
import { products, tables } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { isFeatureEnabled, FEATURE_DIGITAL_MENU } from "@/lib/features";
import type { CartItemForServer } from "@/lib/pricing";
import type { PublicMenuData } from "@/lib/db/queries";

const CATALOG_RATE_LIMIT = { max: 120, windowMs: 60_000 };
const PLACE_ORDER_RATE_LIMIT = { max: 10, windowMs: 60_000 };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Feature flag guard for public actions — typed OFF error (C9). */
function flagOffError(flag: string): { success: false; error: string } {
  return {
    success: false,
    error: `الخدمة غير متاحة حاليًا (feature ${flag} off)`,
  };
}

export type DigitalMenuDataResult =
  | { success: true; data: PublicMenuData; table: { id: string; code: string } | null }
  | { success: false; error: string };

export type MenuOrderResult =
  | {
      success: true;
      orderId: string;
      orderNumber: string;
      total: string;
      accessToken: string;
    }
  | { success: false; error: string };

export type UpsellResult =
  | { success: true; suggestions: Array<{ ruleId: string; productId: string }> }
  | { success: false; error: string };

function validateSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

function validateUuid(v: string): boolean {
  return TOKEN_RE.test(v);
}

/**
 * Load the public catalog for a branch, optionally resolving a QR table
 * token so the guest's table is prefilled (DM-01). Cached 60s per branch.
 */
export async function getDigitalMenuData(
  branchSlug: string,
  tableToken?: string,
): Promise<DigitalMenuDataResult> {
  const active = await isFeatureEnabled(FEATURE_DIGITAL_MENU);
  if (!active) return flagOffError(FEATURE_DIGITAL_MENU);
  if (!validateSlug(branchSlug)) return { success: false, error: "فرع غير صالح" };

  const ip = await callerIp();
  const throttle = checkThrottle(`dm-catalog:${ip}`, CATALOG_RATE_LIMIT);
  if (!throttle.allowed) return { success: false, error: "محاولات كثيرة، حاول بعد قليل" };

  const data = await getPublicCatalog(branchSlug);
  if (!data) return { success: false, error: "الفرع غير موجود" };

  let table: { id: string; code: string } | null = null;
  if (tableToken && validateUuid(tableToken)) {
    const resolved = await resolveTableByQrToken(tableToken);
    if (resolved && resolved.branchSlug === branchSlug) {
      table = { id: resolved.id, code: resolved.code };
    }
  }

  return { success: true, data, table };
}

/**
 * Place a digital-menu order through the SAME atomic checkout pipeline the
 * cashier uses. Channel is dine_in (table prefilled) / takeaway / delivery.
 */
export async function placeDigitalMenuOrder(input: {
  branchSlug: string;
  cartItems: CartItemForServer[];
  idempotencyKey: string;
  orderType: "dine_in" | "takeaway" | "delivery";
  /** Table row id returned by getDigitalMenuData (verified to belong to the branch). */
  tableId?: string | null;
  deliveryAddress?: string;
  customerName?: string;
  customerPhone?: string;
}): Promise<MenuOrderResult> {
  const active = await isFeatureEnabled(FEATURE_DIGITAL_MENU);
  if (!active) return flagOffError(FEATURE_DIGITAL_MENU);

  if (!validateSlug(input.branchSlug)) return { success: false, error: "فرع غير صالح" };
  if (!input.cartItems.length) return { success: false, error: "السلة فارغة" };
  if (!input.idempotencyKey) return { success: false, error: "Missing idempotency key" };
  if (input.orderType === "delivery" && !input.deliveryAddress?.trim()) {
    return { success: false, error: "عنوان التوصيل مطلوب" };
  }
  if (input.orderType === "dine_in" && !input.tableId) {
    return { success: false, error: "رقم الطاولة مطلوب" };
  }

  for (const item of input.cartItems) {
    if (!validateUuid(item.productId)) return { success: false, error: "منتج غير صالح" };
    if (!Array.isArray(item.modifierIds) || item.modifierIds.some((m) => !validateUuid(m))) {
      return { success: false, error: "معدّل غير صالح" };
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      return { success: false, error: "كمية غير صالحة" };
    }
  }
  if (input.tableId && !validateUuid(input.tableId)) {
    return { success: false, error: "طاولة غير صالحة" };
  }

  // Rate limit — public, unauthenticated.
  const ip = await callerIp();
  const throttle = checkThrottle(`dm-order:${ip}`, PLACE_ORDER_RATE_LIMIT);
  if (!throttle.allowed) {
    const secs = Math.ceil(throttle.retryAfterMs / 1000);
    return {
      success: false,
      error: `عدد طلبات كثيرة من هذا الجهاز، يرجى المحاولة بعد ${secs} ثانية`,
    };
  }

  // Branch must exist, and dining tables must belong to it.
  const branch = await resolveBranchBySlug(input.branchSlug);
  if (!branch) return { success: false, error: "الفرع غير موجود" };

  if (input.orderType === "dine_in" && input.tableId) {
    const rows = await db
      .select({ id: tables.id, branchId: tables.branchId, active: tables.active })
      .from(tables)
      .where(eq(tables.id, input.tableId))
      .limit(1);
    const t = rows[0];
    if (!t || t.branchId !== branch.id || !t.active) {
      return { success: false, error: "الطاولة غير موجودة في هذا الفرع" };
    }
  }

  return executeCheckout({
    cartItems: input.cartItems,
    idempotencyKey: input.idempotencyKey,
    paymentMethod: input.orderType === "delivery" ? "cash_on_delivery" : "pay_at_counter",
    channel: input.orderType,
    staffId: null,
    source: "DIGITAL_MENU",
    tableId: input.orderType === "dine_in" ? input.tableId : null,
    deliveryAddress: input.orderType === "delivery" ? input.deliveryAddress : undefined,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
  });
}

/**
 * Evaluate upsell rules against the current cart (FR-DM-16). Prices are
 * recomputed server-side so the threshold rule sees trustworthy numbers.
 */
export async function getUpsellSuggestions(input: {
  cartItems: CartItemForServer[];
  hour?: number;
}): Promise<UpsellResult> {
  const active = await isFeatureEnabled(FEATURE_DIGITAL_MENU);
  if (!active) return flagOffError(FEATURE_DIGITAL_MENU);

  const ip = await callerIp();
  const throttle = checkThrottle(`dm-upsell:${ip}`, CATALOG_RATE_LIMIT);
  if (!throttle.allowed) return { success: false, error: "محاولات كثيرة، حاول بعد قليل" };

  const productIds = [...new Set(input.cartItems.map((c) => c.productId))];
  const categoryMap = new Map<string, string | null>();
  if (productIds.length > 0) {
    const rows = await db
      .select({ id: products.id, categoryId: products.categoryId })
      .from(products)
      .where(inArray(products.id, productIds));
    for (const r of rows) categoryMap.set(r.id, r.categoryId);
  }

  const { recalculateCartServerSide } = await import("@/lib/pricing-server");
  const recalc = await recalculateCartServerSide(input.cartItems);

  const ctx: UpsellCartContext = {
    items: input.cartItems.map((c) => ({
      id: c.productId,
      categoryId: categoryMap.get(c.productId) ?? null,
      selectedModifierIds: c.modifierIds ?? [],
    })),
    subtotalAgorot: recalc.subtotal,
    hour: input.hour ?? new Date().getHours(),
  };

  const rules = await getActiveUpsellRules();
  const matches = evaluateUpsell(rules, ctx);

  return {
    success: true,
    suggestions: matches
      .filter((m) => m.suggestionProductId)
      .map((m) => ({ ruleId: m.ruleId, productId: m.suggestionProductId as string })),
  };
}
