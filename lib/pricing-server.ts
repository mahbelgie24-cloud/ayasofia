/**
 * Server-side pricing functions — database access required.
 * Must NEVER be imported in a Client Component.
 */

import { db } from "@/lib/db";
import { products, modifiers } from "@/db/schema";
import { inArray } from "drizzle-orm";
import {
  calculateLineTotal,
  type CartItemForServer,
  type SelectedModifier,
  type ServerLineResult,
  type ServerCartResult,
  type ModifierSnapshot,
} from "./pricing";

export type { CartItemForServer, ServerLineResult, ServerCartResult, ModifierSnapshot };

/**
 * Server-side cart recomputation — never trust client-supplied totals.
 *
 * Looks up current product and modifier prices from the database
 * and recalculates the cart total independently.  If the
 * server-computed total differs from what the client displayed,
 * proceed with the server's number — log the mismatch, don't
 * silently trust the browser.
 *
 * @param items  Cart items with product IDs, modifier IDs, and quantities
 * @returns  Recalculated line items and subtotal in minor units
 */
export async function recalculateCartServerSide(
  items: CartItemForServer[],
): Promise<ServerCartResult> {
  if (items.length === 0) {
    return { lineItems: [], subtotal: 0, modifierLookup: new Map() };
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const allModIds = [...new Set(items.flatMap((i) => i.modifierIds))];

  const [productRows, modifierRows] = await Promise.all([
    db
      .select({ id: products.id, basePrice: products.basePrice })
      .from(products)
      .where(inArray(products.id, productIds)),
    allModIds.length > 0
      ? db
          .select({
            id: modifiers.id,
            nameAr: modifiers.nameAr,
            name: modifiers.name,
            priceDelta: modifiers.priceDelta,
          })
          .from(modifiers)
          .where(inArray(modifiers.id, allModIds))
      : Promise.resolve([]),
  ]);

  const productPriceMap = new Map(productRows.map((p) => [p.id, p.basePrice]));
  const modifierDeltaMap = new Map(modifierRows.map((m) => [m.id, m.priceDelta]));
  const modifierLookup = new Map(
    modifierRows.map((m) => [
      m.id,
      { modifierId: m.id, nameAr: m.nameAr, nameEn: m.name, priceDelta: m.priceDelta },
    ]),
  );

  const lineItems: ServerLineResult[] = [];
  let subtotal = 0;

  for (const item of items) {
    const base = productPriceMap.get(item.productId);
    if (!base) continue;

    const modDeltas: SelectedModifier[] = [];
    for (const mid of item.modifierIds) {
      const delta = modifierDeltaMap.get(mid);
      if (delta) {
        modDeltas.push({ priceDelta: delta });
      }
    }

    const lineTotal = calculateLineTotal(base, modDeltas, item.quantity);
    subtotal += lineTotal;

    lineItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: base,
      lineTotal,
    });
  }

  return { lineItems, subtotal, modifierLookup };
}
