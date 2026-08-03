import { db } from "@/lib/db";
import { orders, orderItems, products } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { calculateLineTotal, formatPrice } from "@/lib/pricing";
import { OrderStatusClient } from "./status-client";

interface Props {
  params: Promise<{ orderId: string }>;
}

export default async function OrderStatusPage({ params }: Props) {
  const { orderId } = await params;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
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
    items: items.map((item) => ({
      productNameAr: prodMap.get(item.productId) ?? item.productId,
      quantity: item.quantity,
      lineTotal: formatPrice(calculateLineTotal(item.unitPrice, [], item.quantity)),
    })),
  };

  return <OrderStatusClient orderId={orderId} data={data} />;
}
