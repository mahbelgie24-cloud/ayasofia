/**
 * Pricing utilities — all arithmetic in integer minor units (agorot).
 *
 * Prices arrive from Drizzle as numeric-as-strings (e.g. "15.00").
 * We convert to integer minor units at the boundary, compute, and
 * convert back only for display or before writing to the database.
 * Never let a raw JS float touch a price calculation.
 *
 * This file is safe to import in Client Components — no Node.js
 * dependencies.  Server-only functions live in lib/pricing-server.ts.
 */

const MINOR_UNIT_MULTIPLIER = 100;

function toMinorUnits(numericStr: string): number {
  const parsed = parseFloat(numericStr);
  if (!isFinite(parsed)) return 0;
  return Math.round(parsed * MINOR_UNIT_MULTIPLIER);
}

function fromMinorUnits(agorot: number): string {
  return (agorot / MINOR_UNIT_MULTIPLIER).toFixed(2);
}

export interface SelectedModifier {
  priceDelta: string;
}

export interface LineItem {
  lineTotal: number;
}

export interface CartItemForServer {
  productId: string;
  modifierIds: string[];
  quantity: number;
}

export interface ModifierSnapshot {
  modifierId: string;
  nameAr: string;
  nameEn: string;
  priceDelta: string;
}

export interface ServerLineResult {
  productId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: number;
}

export interface ServerCartResult {
  lineItems: ServerLineResult[];
  subtotal: number;
  /** Full modifier details keyed by modifier ID — for audit-trail snapshots. */
  modifierLookup: Map<string, ModifierSnapshot>;
}

/**
 * Compute the total for a single line in minor units (agorot).
 *
 * @param basePrice  Drizzle numeric-as-string, e.g. "15.00"
 * @param selectedModifiers  Array of modifier deltas, e.g. [{ priceDelta: "2.00" }]
 * @param quantity  Number of units
 * @returns  Total in integer minor units (agorot)
 */
export function calculateLineTotal(
  basePrice: string,
  selectedModifiers: SelectedModifier[],
  quantity: number,
): number {
  let unitTotal = toMinorUnits(basePrice);

  for (const mod of selectedModifiers) {
    unitTotal += toMinorUnits(mod.priceDelta);
  }

  return unitTotal * quantity;
}

/**
 * Sum an array of line totals (in minor units).
 *
 * @param lineItems  Array of { lineTotal } where each total is already in agorot
 * @returns  Cart total in integer minor units (agorot)
 */
export function calculateCartTotal(lineItems: LineItem[]): number {
  return lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
}

/**
 * Format a minor-unit value for display.
 *
 * @param agorot  Integer value in minor units
 * @returns  Display string, e.g. "15.00" or "0.50"
 */
export function formatPrice(agorot: number): string {
  return fromMinorUnits(agorot);
}
