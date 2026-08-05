"use server";

import { db } from "@/lib/db";
import { orders, orderItems, products, tables } from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { requireStaffSession } from "@/lib/auth";

export interface ActiveKitchenOrder {
  id: string;
  orderNumber: string;
  channel: string;
  source: string;
  status: string;
  total: string;
  createdAt: string;
  /** Human table code (e.g. "T3") for source=DIGITAL_MENU dine-in (C1). */
  tableCode: string | null;
  items: Array<{
    productNameAr: string;
    quantity: number;
    modifierNames: string[];
    notes: string | null;
  }>;
}

export async function fetchActiveOrders(): Promise<ActiveKitchenOrder[]> {
  await requireStaffSession();

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.status, "received"))
    .orderBy(asc(orders.createdAt));

  const orderIds = rows.map((r) => r.id);
  if (orderIds.length === 0) return [];

  const allItems = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));

  const prodIds = [...new Set(allItems.map((i) => i.productId))];
  const prodRows = await db
    .select({ id: products.id, nameAr: products.nameAr })
    .from(products)
    .where(inArray(products.id, prodIds));
  const prodMap = new Map(prodRows.map((p) => [p.id, p.nameAr]));

  // Resolve table codes for dine-in digital orders (C1).
  const tableIds = rows.filter((o) => o.tableId).map((o) => o.tableId as string);
  const tableMap = new Map<string, string>();
  if (tableIds.length > 0) {
    const tableRows = await db
      .select({ id: tables.id, code: tables.code })
      .from(tables)
      .where(inArray(tables.id, tableIds));
    for (const t of tableRows) tableMap.set(t.id, t.code);
  }

  return rows.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    source: order.source,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt?.toISOString() ?? "",
    tableCode: order.tableId ? (tableMap.get(order.tableId) ?? null) : null,
    items: allItems
      .filter((i) => i.orderId === order.id)
      .map((i) => {
        const snapshot = i.selectedModifiers as
          | Array<{ modifierId?: string; nameAr?: string; nameEn?: string; priceDelta?: string }>
          | string[]
          | null;
        const modifierNames = Array.isArray(snapshot)
          ? snapshot
              .map((m) => (typeof m === "object" ? m.nameAr : null))
              .filter((n): n is string => Boolean(n))
          : [];
        return {
          productNameAr: prodMap.get(i.productId) ?? i.productId,
          quantity: i.quantity,
          modifierNames,
          notes: i.notes ?? null,
        };
      }),
  }));
}

const VALID_TRANSITIONS: Record<string, string> = {
  received: "preparing",
  preparing: "ready",
  ready: "completed",
};

export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession();

  const [order] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return { success: false, error: "Order not found" };

  const expected = VALID_TRANSITIONS[order.status];
  if (newStatus !== expected) {
    return {
      success: false,
      error: `Cannot transition from ${order.status} to ${newStatus}`,
    };
  }

  await db
    .update(orders)
    .set({ status: newStatus as typeof order.status })
    .where(eq(orders.id, orderId));
  return { success: true };
}
