import { db } from "@/lib/db";
import { orders, orderItems, products } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { calculateLineTotal, formatPrice } from "@/lib/pricing";
import { extractModifierDeltas } from "@/lib/receipt";
import { OrderStatusClient } from "./status-client";

interface Props {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ accessToken?: string | string[] }>;
}

export default async function OrderStatusPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const { accessToken } = await searchParams;
  const token = Array.isArray(accessToken) ? accessToken[0] : accessToken;

  // P2-SEC-1: the public self-order status page is gated by the unguessable
  // access token minted at checkout. A missing or wrong token is identical
  // to a 404 — we do not leak whether the order exists.
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

  const data = {
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt?.toISOString() ?? "",
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

  return <OrderStatusClient orderId={orderId} accessToken={token} data={data} />;
}
