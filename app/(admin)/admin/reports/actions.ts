"use server";

import { requireStaffSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems, products, recipes, ingredients, shifts, staff } from "@/db/schema";
import { and, gte, lte, desc, inArray } from "drizzle-orm";

export interface SalesSummary {
  totalRevenue: string;
  orderCount: number;
  byChannel: Record<string, { count: number; revenue: string }>;
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
      total: orders.total,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, start), lte(orders.createdAt, end)));

  let totalRevenue = 0;
  const byChannel: Record<string, { count: number; revenue: string }> = {};

  for (const row of rows) {
    totalRevenue += parseFloat(row.total);
    if (!byChannel[row.channel]) {
      byChannel[row.channel] = { count: 0, revenue: "0.00" };
    }
    byChannel[row.channel].count += 1;
    const current = parseFloat(byChannel[row.channel].revenue) + parseFloat(row.total);
    byChannel[row.channel].revenue = current.toFixed(2);
  }

  return {
    totalRevenue: totalRevenue.toFixed(2),
    orderCount: rows.length,
    byChannel,
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
    .where(and(gte(orders.createdAt, start), lte(orders.createdAt, end)));

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

  const byProduct = new Map<string, { quantity: number; revenue: number }>();

  for (const item of items) {
    const entry = byProduct.get(item.productId) ?? { quantity: 0, revenue: 0 };
    entry.quantity += item.quantity;
    entry.revenue += parseFloat(item.unitPrice) * item.quantity;
    byProduct.set(item.productId, entry);
  }

  const sorted = [...byProduct.entries()]
    .map(([productId, data]) => ({
      productId,
      nameAr: nameMap.get(productId)?.ar ?? productId,
      nameEn: nameMap.get(productId)?.en ?? productId,
      quantitySold: data.quantity,
      totalRevenue: data.revenue.toFixed(2),
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

    let ingredientCost = 0;
    for (const rec of productRecipes) {
      const cost = parseFloat(costMap.get(rec.ingredientId) ?? "0");
      ingredientCost += cost * parseFloat(rec.quantityUsed);
    }

    const price = parseFloat(product.basePrice);
    const margin = price - ingredientCost;
    const marginPercent = price > 0 ? (margin / price) * 100 : 0;

    return {
      productId: product.id,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      basePrice: product.basePrice,
      ingredientCost: ingredientCost.toFixed(2),
      margin: margin.toFixed(2),
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
    const opening = parseFloat(shift.openingCash);
    const closing = shift.closingCash ? parseFloat(shift.closingCash) : null;
    const sales = shift.totalSales ? parseFloat(shift.totalSales) : null;

    let discrepancy: string | null = null;
    if (closing !== null && sales !== null) {
      discrepancy = (closing - opening - sales).toFixed(2);
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
