import { db } from "./index";
import { categories, orders, orderItems, products, staff, settings } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { calculateLineTotal, formatPrice } from "@/lib/pricing";
import { extractModifierDeltas } from "@/lib/receipt";

export type Modifier = {
  id: string;
  nameAr: string;
  name: string;
  priceDelta: string;
};

export type ModifierGroup = {
  id: string;
  name: string;
  type: "single" | "multi";
  isRequired: boolean;
  modifiers: Modifier[];
};

export type POSProduct = {
  id: string;
  nameAr: string;
  nameEn: string;
  basePrice: string;
  imageUrl: string | null;
  isAvailable: boolean;
  modifierGroups: ModifierGroup[];
};

export type POSCategory = {
  id: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  products: POSProduct[];
};

/**
 * Fetch the full menu with nested modifier groups and modifiers,
 * shaped for direct consumption by the POS UI.
 * Server-only — uses the node-postgres Drizzle client, never
 * callable from the browser.
 */
export async function getMenuForPOS(): Promise<POSCategory[]> {
  const rows = await db.query.categories.findMany({
    orderBy: [asc(categories.sortOrder)],
    with: {
      products: {
        where: (products, { eq }) => eq(products.isAvailable, true),
        orderBy: (products, { asc }) => [asc(products.nameEn)],
        with: {
          modifierGroups: {
            with: {
              modifiers: true,
            },
          },
        },
      },
    },
  });

  return rows.map((cat) => ({
    id: cat.id,
    nameAr: cat.nameAr,
    nameEn: cat.nameEn,
    sortOrder: cat.sortOrder,
    products: cat.products.map((p) => ({
      id: p.id,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      basePrice: p.basePrice,
      imageUrl: p.imageUrl,
      isAvailable: p.isAvailable,
      modifierGroups: p.modifierGroups.map((mg) => ({
        id: mg.id,
        name: mg.name,
        type: mg.type,
        isRequired: mg.isRequired,
        modifiers: mg.modifiers.map((m) => ({
          id: m.id,
          nameAr: m.nameAr,
          name: m.name,
          priceDelta: m.priceDelta,
        })),
      })),
    })),
  }));
}

export interface ReceiptLineItem {
  productNameAr: string;
  productNameEn: string;
  quantity: number;
  unitPrice: string;
  modifierNames: string[];
  lineTotal: string;
}

export interface ReceiptData {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  receiptFooter: string;
  orderNumber: string;
  channel: string;
  paymentMethod: string | null;
  staffName: string | null;
  customerPhone: string | null;
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
  createdAt: string;
  items: ReceiptLineItem[];
}

/**
 * Fetch all data needed to render a receipt for a given order.
 * Resolves modifier IDs stored in order_items.selectedModifiers (JSONB)
 * into human-readable modifier nameAr values.
 */
export async function getReceiptData(orderId: string): Promise<ReceiptData | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  if (!order) return null;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  // Resolve product names
  const allProductIds = [...new Set(items.map((i) => i.productId))];
  const productMap = new Map<string, { nameAr: string; nameEn: string }>();
  if (allProductIds.length > 0) {
    const prodRows = await db
      .select({ id: products.id, nameAr: products.nameAr, nameEn: products.nameEn })
      .from(products)
      .where(inArray(products.id, allProductIds));
    for (const p of prodRows) productMap.set(p.id, { nameAr: p.nameAr, nameEn: p.nameEn });
  }

  // Staff name
  let staffName: string | null = null;
  if (order.staffId) {
    const [s] = await db
      .select({ name: staff.name })
      .from(staff)
      .where(eq(staff.id, order.staffId))
      .limit(1);
    if (s) staffName = s.name;
  }

  // Shop info from settings
  const settingRows = await db.select().from(settings);
  const settingMap = new Map(settingRows.map((s) => [s.key, s.value]));
  const shopName = settingMap.get("shop_name") ?? "Ayasofia Sweet";
  const shopAddress = settingMap.get("shop_address") ?? "";
  const shopPhone = settingMap.get("shop_phone") ?? "";
  const receiptFooter = settingMap.get("receipt_footer") ?? "";

  const receiptItems: ReceiptLineItem[] = items.map((item) => {
    const snapshot = item.selectedModifiers as Array<{
      modifierId?: string;
      nameAr?: string;
      nameEn?: string;
      priceDelta?: string;
    }> | null;
    let modNames: string[];
    if (
      Array.isArray(snapshot) &&
      snapshot.length > 0 &&
      typeof snapshot[0] === "object" &&
      "nameAr" in snapshot[0]
    ) {
      // New format: self-contained snapshot objects
      modNames = snapshot.map((m) => m.nameAr ?? m.modifierId ?? "?");
    } else {
      // Legacy format: plain modifier ID strings
      modNames = ((snapshot as unknown as string[]) ?? []).map((id) => `[${id}]`);
    }
    const prod = productMap.get(item.productId);
    // Recompute the line total server-side from the base price + the
    // modifier price-deltas in the snapshot (WEB-DATA-002).  Passing []
    // here used to drop every modifier delta, so the printed per-line
    // totals did not sum to the printed subtotal.
    const lineTotalAgorot = calculateLineTotal(
      item.unitPrice,
      extractModifierDeltas(snapshot),
      item.quantity,
    );
    return {
      productNameAr: prod?.nameAr ?? item.productId,
      productNameEn: prod?.nameEn ?? item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      modifierNames: modNames,
      lineTotal: formatPrice(lineTotalAgorot),
    };
  });

  return {
    shopName,
    shopAddress,
    shopPhone,
    receiptFooter,
    orderNumber: order.orderNumber,
    channel: order.channel,
    paymentMethod: order.paymentMethod,
    staffName,
    customerPhone: order.customerPhone,
    subtotal: order.subtotal,
    tax: order.tax,
    discount: order.discount,
    total: order.total,
    createdAt: order.createdAt?.toISOString() ?? "",
    items: receiptItems,
  };
}
