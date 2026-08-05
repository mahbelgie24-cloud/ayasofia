import { db } from "@/lib/db";
import { orders, orderItems, products, tables } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { calculateLineTotal, formatPrice } from "@/lib/pricing";
import { extractModifierDeltas } from "@/lib/receipt";
import { isFeatureEnabled, FEATURE_DIGITAL_MENU } from "@/lib/features";
import { FeatureOff } from "@/components/digital-menu/feature-off";
import { DMStatusClient } from "./dm-status-client";

export const dynamic = "force-dynamic";

export default async function DMStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchSlug: string; orderId: string }>;
  searchParams: Promise<{ accessToken?: string | string[] }>;
}) {
  const { branchSlug, orderId } = await params;
  const { accessToken } = await searchParams;
  const token = Array.isArray(accessToken) ? accessToken[0] : accessToken;
  const active = await isFeatureEnabled(FEATURE_DIGITAL_MENU);
  if (!active) return <FeatureOff />;

  // P2-SEC-1: gate the public digital-menu status page on the access token.
  if (!token) notFound();

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.accessToken, token)))
    .limit(1);
  if (!order) notFound();

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  const prodIds = [...new Set(items.map((i) => i.productId))];
  const prodRows =
    prodIds.length > 0
      ? await db
          .select({ id: products.id, nameAr: products.nameAr })
          .from(products)
          .where(inArray(products.id, prodIds))
      : [];
  const prodMap = new Map(prodRows.map((p) => [p.id, p.nameAr]));

  let tableCode: string | null = null;
  if (order.tableId) {
    const [t] = await db
      .select({ code: tables.code })
      .from(tables)
      .where(eq(tables.id, order.tableId))
      .limit(1);
    tableCode = t?.code ?? null;
  }

  const data = {
    branchSlug,
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total,
    tableCode,
    channel: order.channel,
    deliveryFee: order.deliveryFee,
    items: items.map((item) => {
      const snapshot = item.selectedModifiers as
        | Array<{ modifierId?: string; nameAr?: string; nameEn?: string; priceDelta?: string }>
        | string[]
        | null;
      const modifierNames = Array.isArray(snapshot)
        ? snapshot
            .map((m) => (typeof m === "object" ? m.nameAr : null))
            .filter((n): n is string => Boolean(n))
        : [];
      return {
        productNameAr: prodMap.get(item.productId) ?? item.productId,
        quantity: item.quantity,
        modifierNames,
        notes: item.notes ?? null,
        lineTotal: formatPrice(
          calculateLineTotal(
            item.unitPrice,
            extractModifierDeltas(item.selectedModifiers),
            item.quantity,
          ),
        ),
      };
    }),
  };

  return <DMStatusClient orderId={orderId} accessToken={token} data={data} />;
}
