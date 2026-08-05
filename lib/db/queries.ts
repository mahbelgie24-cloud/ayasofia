import { db } from "./index";
import {
  categories,
  orders,
  orderItems,
  products,
  staff,
  settings,
  tables,
  branches,
  todaySuggestion,
  upsellRules,
} from "@/db/schema";
import { asc, eq, inArray, and, ne, lte, gte, desc, or, isNull } from "drizzle-orm";
import { calculateLineTotal, formatPrice } from "@/lib/pricing";
import { extractModifierDeltas } from "@/lib/receipt";
import { cached, invalidateByPrefix } from "@/lib/cache";
import type { UpsellRule } from "@/lib/upsell";

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
  /** Max selections for a `multi` group (null = unlimited). FR-DM-12. */
  maxSelections: number | null;
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
        maxSelections: mg.maxSelections,
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

// ─────────────────────────────────────────────────────────────────────────
// Digital menu — public catalog & supporting lookups (FR-DM-02/10/11, C2)
// ─────────────────────────────────────────────────────────────────────────

export interface PublicProduct extends POSProduct {
  categoryId: string;
  nameEn: string;
}

export interface PublicCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  products: PublicProduct[];
}

export interface PublicSuggestion {
  productId: string;
  nameAr: string;
  basePrice: string;
  imageUrl: string | null;
  titleAr: string | null;
  descriptionAr: string | null;
}

export interface PublicBestSeller {
  productId: string;
  nameAr: string;
  nameEn: string;
  imageUrl: string | null;
  quantitySold: number;
}

export interface PublicMenuData {
  branch: { id: string; name: string; slug: string };
  categories: PublicCategory[];
  todaySuggestion: PublicSuggestion | null;
  bestSellers: PublicBestSeller[];
}

const CATALOG_TTL_MS = 60_000;
const BEST_SELLER_WINDOW_DAYS = 30;
const BEST_SELLER_LIMIT = 5;

/** Invalidate the public catalog cache for a branch (C2, direct invalidation). */
export function invalidatePublicCatalog(slug: string): void {
  invalidateByPrefix(`catalog:${slug}`);
}

/** Resolve a branch by its URL slug — 404-style null when missing. */
export async function resolveBranchBySlug(
  slug: string,
): Promise<{ id: string; name: string } | null> {
  const [branch] = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(eq(branches.slug, slug))
    .limit(1);
  return branch ?? null;
}

/**
 * Resolve a QR-scanned table by its UNIQUE QR token (UUID, never a
 * sequential id — FR-DM-10). Returns the human-facing code (e.g. "T3")
 * plus the owning branch slug so the kitchen ticket can show the table.
 */
export async function resolveTableByQrToken(
  qrToken: string,
): Promise<{ id: string; code: string; branchSlug: string; branchName: string } | null> {
  const rows = await db
    .select({
      id: tables.id,
      code: tables.code,
      branchSlug: branches.slug,
      branchName: branches.name,
    })
    .from(tables)
    .innerJoin(branches, eq(tables.branchId, branches.id))
    .where(and(eq(tables.qrToken, qrToken), eq(tables.active, true)))
    .limit(1);
  return rows[0] ?? null;
}

/** The live "اقتراح اليوم" for the branch (shared with wifi portal, WF-06). */
async function getTodaySuggestion(): Promise<PublicSuggestion | null> {
  const now = new Date();
  const conditions: ReturnType<typeof eq>[] = [
    eq(todaySuggestion.isActive, true),
    eq(products.isAvailable, true),
  ];
  const startsAtAny = or(isNull(todaySuggestion.startsAt), lte(todaySuggestion.startsAt, now));
  const endsAtAny = or(isNull(todaySuggestion.endsAt), gte(todaySuggestion.endsAt, now));
  if (startsAtAny) conditions.push(startsAtAny as never);
  if (endsAtAny) conditions.push(endsAtAny as never);

  const rows = await db
    .select({
      id: todaySuggestion.id,
      productId: todaySuggestion.productId,
      titleAr: todaySuggestion.titleAr,
      descriptionAr: todaySuggestion.descriptionAr,
      productNameAr: products.nameAr,
      basePrice: products.basePrice,
      imageUrl: products.imageUrl,
    })
    .from(todaySuggestion)
    .innerJoin(products, eq(todaySuggestion.productId, products.id))
    .where(and(...conditions))
    .orderBy(desc(todaySuggestion.updatedAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    productId: row.productId,
    nameAr: row.productNameAr,
    basePrice: row.basePrice,
    imageUrl: row.imageUrl,
    titleAr: row.titleAr,
    descriptionAr: row.descriptionAr,
  };
}

/** Best sellers over the window — quantity sold, cancelled orders excluded. */
async function getBestSellersForMenu(): Promise<PublicBestSeller[]> {
  const since = new Date();
  since.setDate(since.getDate() - BEST_SELLER_WINDOW_DAYS);
  const sinceIso = since.toISOString();

  const rows = await db
    .select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      nameAr: products.nameAr,
      nameEn: products.nameEn,
      imageUrl: products.imageUrl,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(and(gte(orders.createdAt, new Date(sinceIso)), ne(orders.status, "cancelled")))
    .orderBy(desc(products.nameEn));

  const byId = new Map<string, PublicBestSeller>();
  for (const r of rows) {
    const cur = byId.get(r.productId) ?? {
      productId: r.productId,
      nameAr: r.nameAr,
      nameEn: r.nameEn,
      imageUrl: r.imageUrl,
      quantitySold: 0,
    };
    cur.quantitySold += r.quantity;
    byId.set(r.productId, cur);
  }
  return [...byId.values()]
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, BEST_SELLER_LIMIT);
}

/**
 * Full public menu payload for `/m/{branchSlug}`. Serves ONLY published +
 * available products (FR-DM-11). Cached 60s per branch; invalidated
 * directly on admin mutations (C2).
 */
export async function getPublicCatalog(branchSlug: string): Promise<PublicMenuData | null> {
  return cached(
    `catalog:${branchSlug}`,
    async () => {
      const branch = await resolveBranchBySlug(branchSlug);
      if (!branch) return null;

      const catRows = await db.query.categories.findMany({
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

      return {
        branch: { id: branch.id, name: branch.name, slug: branchSlug },
        categories: catRows.map((cat) => ({
          id: cat.id,
          nameAr: cat.nameAr,
          nameEn: cat.nameEn,
          sortOrder: cat.sortOrder,
          products: cat.products.map((p) => ({
            id: p.id,
            categoryId: cat.id,
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
              maxSelections: mg.maxSelections,
              modifiers: mg.modifiers.map((m) => ({
                id: m.id,
                nameAr: m.nameAr,
                name: m.name,
                priceDelta: m.priceDelta,
              })),
            })),
          })),
        })),
        todaySuggestion: await getTodaySuggestion(),
        bestSellers: await getBestSellersForMenu(),
      };
    },
    CATALOG_TTL_MS,
  );
}

/** Active upsell rules, for the menu server action to evaluate per-cart (FR-DM-16). */
export async function getActiveUpsellRules(): Promise<UpsellRule[]> {
  const rows = await db
    .select({
      id: upsellRules.id,
      condition: upsellRules.condition,
      triggerValue: upsellRules.triggerValue,
      suggestionProductId: upsellRules.suggestionProductId,
      suggestionModifierId: upsellRules.suggestionModifierId,
      priority: upsellRules.priority,
      isActive: upsellRules.isActive,
    })
    .from(upsellRules)
    .where(eq(upsellRules.isActive, true));
  return rows;
}

/**
 * Today's suggestion for the wifi post-connect screen (shared entity with
 * the digital menu, WF-06). Includes the branch slug so the portal can link
 * straight to the menu ("تصفّح القائمة").
 */
export async function getTodaySuggestionForWifi(): Promise<
  (PublicSuggestion & { branchSlug: string | null }) | null
> {
  const suggestion = await getTodaySuggestion();
  if (!suggestion) return null;

  const [branch] = await db.select({ slug: branches.slug }).from(branches).limit(1);
  return { ...suggestion, branchSlug: branch?.slug ?? null };
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
  /** Table code (e.g. "T3") for dine-in digital-menu orders (C1). */
  tableCode?: string | null;
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

  // Table code for dine-in digital-menu orders (C1).
  let tableCode: string | null = null;
  if (order.tableId) {
    const [t] = await db
      .select({ code: tables.code })
      .from(tables)
      .where(eq(tables.id, order.tableId))
      .limit(1);
    tableCode = t?.code ?? null;
  }

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
    tableCode,
    subtotal: order.subtotal,
    tax: order.tax,
    discount: order.discount,
    total: order.total,
    createdAt: order.createdAt?.toISOString() ?? "",
    items: receiptItems,
  };
}
