"use server";

import { db } from "@/lib/db";
import { orders } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// P2-SEC-1: the polling endpoint must prove ownership via the access token
// before returning status. A missing/wrong token behaves identically to a
// missing order — no existence leak.
export async function getOrderStatus(
  orderId: string,
  accessToken: string,
): Promise<{ status: string } | null> {
  const [order] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.accessToken, accessToken)))
    .limit(1);

  if (!order) return null;
  return { status: order.status };
}
