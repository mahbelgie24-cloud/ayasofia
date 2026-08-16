"use server";

import { db } from "@/lib/db";
import { orders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { callerIp } from "@/lib/ip";
import { checkThrottle } from "@/lib/rate-limit";
import { captureThrottled } from "@/lib/observability";

// P2-SEC-1: the polling endpoint must prove ownership via the access token
// before returning status. A missing/wrong token behaves identically to a
// missing order — no existence leak.
//
// T-B1: hardened against abuse — the orderId is UUID-validated before any
// query (a malformed id returns null without touching Postgres), and each
// source IP is throttled per order. Clients poll every ~5s (~12/min), so the
// generous cap absorbs polling + a burst while capping a script.
const STATUS_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STATUS_THROTTLE = { max: 90, windowMs: 60_000 };

export async function getOrderStatus(
  orderId: string,
  accessToken: string,
): Promise<{ status: string } | null> {
  if (!STATUS_UUID_RE.test(orderId)) return null;

  const ip = await callerIp();
  const throttle = await checkThrottle(`order-status:${ip}:${orderId}`, STATUS_THROTTLE);
  if (!throttle.allowed) {
    captureThrottled("getOrderStatus", `order-status:${ip}:${orderId}`);
    return null;
  }

  const [order] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.accessToken, accessToken)))
    .limit(1);

  if (!order) return null;
  return { status: order.status };
}
