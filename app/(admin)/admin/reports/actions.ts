"use server";

import { requireStaffSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems, products, recipes, ingredients, shifts, staff } from "@/db/schema";
import { and, gte, lte, desc, inArray, ne, isNull, sql } from "drizzle-orm";
import { toMinorUnits, toScaledInt, formatPrice, addMinor, multiplyMinor } from "@/lib/pricing";

export interface SalesSummary {
  totalRevenue: string;
  orderCount: number;
  byChannel: Record<string, { count: number; revenue: string }>;
  // FR-DM-15: digital adoption — orders/revenue split by entry surface.
  bySource: Record<string, { count: number; revenue: string }>;
}

export interface BestSeller {
  productId: string;
  nameAr: string;
  nameEn: string;
  quantitySold: number;
  totalRevenue: string;
}

export interface ProductMargin {
  productId: string;
  nameAr: string;
  nameEn: string;
  basePrice: string;
  ingredientCost: string;
  margin: string;
  marginPercent: string;
}

export interface ZReportShift {
  id: string;
  staffName: string | null;
  openedAt: string;
  closedAt: string | null;
  openingCash: string;
  closingCash: string | null;
  totalSales: string | null;
  discrepancy: string | null;
}

export async function getSalesSummary(startDate: string, endDate: string): Promise<SalesSummary> {
  await requireStaffSession("manager");

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const rows = await db
    .select({
      channel: orders.channel,
      source: orders.source,
      total: orders.total,
    })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, start),
        lte(orders.createdAt, end),
        // P1-M13: cancelled orders are not revenue — exclude them from the
        // sales summary so totals match what was actually collected.
        ne(orders.status, "cancelled"),
      ),
    );

  let totalRevenueAgorot = 0;
  const byChannel: Record<string, { count: number; revenueAgorot: number }> = {};
  const bySource: Record<string, { count: number; revenueAgorot: number }> = {};

  for (const row of rows) {
    const agorot = toMinorUnits(row.total);
    totalRevenueAgorot = addMinor(totalRevenueAgorot, agorot);
    if (!byChannel[row.channel]) {
      byChannel[row.channel] = { count: 0, revenueAgorot: 0 };
    }
    byChannel[row.channel].count += 1;
    byChannel[row.channel].revenueAgorot = addMinor(byChannel[row.channel].revenueAgorot, agorot);

    const src = row.source ?? "POS";
    if (!bySource[src]) bySource[src] = { count: 0, revenueAgorot: 0 };
    bySource[src].count += 1;
    bySource[src].revenueAgorot = addMinor(bySource[src].revenueAgorot, agorot);
  }

  const channelResult: Record<string, { count: number; revenue: string }> = {};
  for (const [ch, data] of Object.entries(byChannel)) {
    channelResult[ch] = { count: data.count, revenue: formatPrice(data.revenueAgorot) };
  }
  const sourceResult: Record<string, { count: number; revenue: string }> = {};
  for (const [src, data] of Object.entries(bySource)) {
    sourceResult[src] = { count: data.count, revenue: formatPrice(data.revenueAgorot) };
  }

  return {
    totalRevenue: formatPrice(totalRevenueAgorot),
    orderCount: rows.length,
    byChannel: channelResult,
    bySource: sourceResult,
  };
}

export async function getBestSellers(startDate: string, endDate: string): Promise<BestSeller[]> {
  await requireStaffSession("manager");

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const orderIds = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, start),
        lte(orders.createdAt, end),
        // P1-M13: a cancelled order never completed, so its items must not
        // count toward best sellers. This also keeps getDashboardSummary's
        // topSellers aligned with its own (cancelled-excluded) revenue filter.
        ne(orders.status, "cancelled"),
      ),
    );

  if (orderIds.length === 0) return [];

  const ids = orderIds.map((r) => r.id);

  const items = await db
    .select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, ids));

  const productIds = [...new Set(items.map((i) => i.productId))];
  const productRows = await db
    .select({ id: products.id, nameAr: products.nameAr, nameEn: products.nameEn })
    .from(products)
    .where(inArray(products.id, productIds));
  const nameMap = new Map(productRows.map((p) => [p.id, { ar: p.nameAr, en: p.nameEn }]));

  const byProduct = new Map<string, { quantity: number; revenueAgorot: number }>();

  for (const item of items) {
    const entry = byProduct.get(item.productId) ?? { quantity: 0, revenueAgorot: 0 };
    entry.quantity += item.quantity;
    entry.revenueAgorot = addMinor(
      entry.revenueAgorot,
      multiplyMinor(toMinorUnits(item.unitPrice), item.quantity),
    );
    byProduct.set(item.productId, entry);
  }

  const sorted = [...byProduct.entries()]
    .map(([productId, data]) => ({
      productId,
      nameAr: nameMap.get(productId)?.ar ?? productId,
      nameEn: nameMap.get(productId)?.en ?? productId,
      quantitySold: data.quantity,
      totalRevenue: formatPrice(data.revenueAgorot),
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold);

  return sorted;
}

export async function getProductMargins(): Promise<ProductMargin[]> {
  await requireStaffSession("manager");

  const allProducts = await db
    .select({
      id: products.id,
      nameAr: products.nameAr,
      nameEn: products.nameEn,
      basePrice: products.basePrice,
    })
    .from(products);

  const allRecipes = await db.select().from(recipes);
  const ingredientIds = [...new Set(allRecipes.map((r) => r.ingredientId))];
  const ingredientRows =
    ingredientIds.length > 0
      ? await db
          .select({ id: ingredients.id, costPerUnit: ingredients.costPerUnit })
          .from(ingredients)
          .where(inArray(ingredients.id, ingredientIds))
      : [];
  const costMap = new Map(ingredientRows.map((i) => [i.id, i.costPerUnit]));

  return allProducts.map((product) => {
    const productRecipes = allRecipes.filter((r) => r.productId === product.id);

    let ingredientCostAgorot = 0;
    for (const rec of productRecipes) {
      // cost_per_unit is numeric(10,4) — must be parsed at scale 4 so
      // sub-agorot costs (e.g. ₪0.0050) are not truncated to zero
      // (WEB-DATA-001).  quantityUsed is numeric(12,2) → scale 2.
      //
      // cost4       = cost_per_unit × 10^4   (units of ₪0.0001)
      // qty2        = quantity       × 10^2   (units of 0.01 unit)
      // product     = cost4 × qty2             (units of ₪10^-6)
      // ÷ 10^4 → agorot (₪0.01).  No floats, no precision loss.
      const cost4 = toScaledInt(costMap.get(rec.ingredientId) ?? "0", 4);
      const qty2 = toScaledInt(rec.quantityUsed, 2);
      ingredientCostAgorot = addMinor(ingredientCostAgorot, Math.round((cost4 * qty2) / 10000));
    }

    const priceAgorot = toMinorUnits(product.basePrice);
    const marginAgorot = priceAgorot - ingredientCostAgorot;
    const marginPercent =
      priceAgorot > 0 ? parseFloat(((marginAgorot / priceAgorot) * 100).toFixed(1)) : 0;

    return {
      productId: product.id,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      basePrice: product.basePrice,
      ingredientCost: formatPrice(ingredientCostAgorot),
      margin: formatPrice(marginAgorot),
      marginPercent: marginPercent.toFixed(1),
    };
  });
}

export async function getZReport(): Promise<ZReportShift[]> {
  await requireStaffSession("manager");

  const shiftRows = await db.select().from(shifts).orderBy(desc(shifts.openedAt)).limit(50);

  const staffIds = [...new Set(shiftRows.map((s) => s.staffId))];
  const staffRows =
    staffIds.length > 0
      ? await db
          .select({ id: staff.id, name: staff.name })
          .from(staff)
          .where(inArray(staff.id, staffIds))
      : [];
  const staffMap = new Map(staffRows.map((s) => [s.id, s.name]));

  return shiftRows.map((shift) => {
    const openingAgorot = toMinorUnits(shift.openingCash);
    const closingAgorot = shift.closingCash ? toMinorUnits(shift.closingCash) : null;
    const salesAgorot = shift.totalSales ? toMinorUnits(shift.totalSales) : null;

    let discrepancy: string | null = null;
    if (closingAgorot !== null && salesAgorot !== null) {
      const diffAgorot = closingAgorot - openingAgorot - salesAgorot;
      discrepancy = formatPrice(diffAgorot);
    }

    return {
      id: shift.id,
      staffName: staffMap.get(shift.staffId) ?? null,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() ?? null,
      openingCash: shift.openingCash,
      closingCash: shift.closingCash ?? null,
      totalSales: shift.totalSales ?? null,
      discrepancy,
    };
  });
}

export interface DashboardSummary {
  todayRevenue: string;
  todayOrderCount: number;
  averageOrder: string;
  lowStockCount: number;
  openShiftCount: number;
  topSellers: BestSeller[];
}

/**
 * Compact KPIs for the owner dashboard (`/admin`).  Separate from the
 * dated range queries — this intentionally aggregates across distinct
 * windows, so it reads its own data rather than composing partials
 * (single source of truth per number shown).
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  await requireStaffSession("manager");

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const todayOrders = await db
    .select({ total: orders.total })
    .from(orders)
    .where(and(gte(orders.createdAt, startOfToday), ne(orders.status, "cancelled")));

  let revenueAgorot = 0;
  for (const row of todayOrders) {
    revenueAgorot = addMinor(revenueAgorot, toMinorUnits(row.total));
  }

  const [lowStock] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ingredients)
    .where(sql`${ingredients.currentStock} <= ${ingredients.reorderThreshold}`);

  const [openShifts] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shifts)
    .where(isNull(shifts.closedAt));

  const topSellers = await getBestSellers(
    startOfToday.toISOString().slice(0, 10),
    now.toISOString().slice(0, 10),
  );

  // T-B9: average in minor units (agorot) with integer-scaled division — no
  // float `revenue / count / 100` that loses precision at scale.
  const averageOrderAgorot =
    todayOrders.length > 0 ? Math.round((revenueAgorot * 100) / todayOrders.length) / 100 : 0;

  return {
    todayRevenue: formatPrice(revenueAgorot),
    todayOrderCount: todayOrders.length,
    averageOrder: formatPrice(averageOrderAgorot),
    lowStockCount: lowStock?.count ?? 0,
    openShiftCount: openShifts?.count ?? 0,
    topSellers: topSellers.slice(0, 5),
  };
}
