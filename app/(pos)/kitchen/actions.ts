"use server";

import { db } from "@/lib/db";
import { orders, orderItems, products } from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { requireStaffSession } from "@/lib/auth";

export interface ActiveKitchenOrder {
  id: string;
  orderNumber: string;
  channel: string;
  status: string;
  total: string;
  createdAt: string;
  items: Array<{ productNameAr: string; quantity: number }>;
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

  return rows.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt?.toISOString() ?? "",
    items: allItems
      .filter((i) => i.orderId === order.id)
      .map((i) => ({
        productNameAr: prodMap.get(i.productId) ?? i.productId,
        quantity: i.quantity,
      })),
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
