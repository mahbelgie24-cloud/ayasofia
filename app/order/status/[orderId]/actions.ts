"use server";

import { db } from "@/lib/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getOrderStatus(orderId: string): Promise<{ status: string } | null> {
  const [order] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return null;
  return { status: order.status };
}
