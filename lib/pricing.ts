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

/**
 * Convert a numeric-as-string (e.g. "15.00", "-3.50") to integer
 * minor units (agorot) without ANY floating-point arithmetic.
 * Uses string manipulation only — parseInt on the major/minor parts —
 * so values like "0.10" are never exposed to JS float precision loss.
 *
 * Exported so UI display layers can use it instead of ad-hoc
 * `parseFloat(x) * 100`.
 */
export function toMinorUnits(numericStr: string): number {
  if (!numericStr || typeof numericStr !== "string") return 0;

  const trimmed = numericStr.trim();
  if (trimmed === "" || trimmed === "." || trimmed === "-" || trimmed === "-.") return 0;

  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [major = "0", cents = "00"] = abs.split(".");

  const majorInt = parseInt(major, 10);
  if (!isFinite(majorInt)) return 0;

  const centsPadded = cents.slice(0, 2).padEnd(2, "0");
  const centsInt = parseInt(centsPadded, 10);

  const agorot = majorInt * MINOR_UNIT_MULTIPLIER + centsInt;
  return negative ? -agorot : agorot;
}

function fromMinorUnits(agorot: number): string {
  const negative = agorot < 0;
  const abs = Math.abs(agorot);
  const major = Math.floor(abs / MINOR_UNIT_MULTIPLIER);
  const minor = abs % MINOR_UNIT_MULTIPLIER;
  const minorStr = minor.toString().padStart(2, "0");
  return `${negative ? "-" : ""}${major}.${minorStr}`;
}

/**
 * Add two monetary values in minor units (agorot), returned as agorot.
 */
export function addMinor(a: number, b: number): number {
  return a + b;
}

/**
 * Subtract two monetary values in minor units.
 */
export function subtractMinor(a: number, b: number): number {
  return a - b;
}

/**
 * Multiply a minor-unit value by an integer quantity.
 */
export function multiplyMinor(agorot: number, quantity: number): number {
  return Math.round(agorot * quantity);
}

/**
 * Divide a minor-unit value by an integer divisor, returning agorot.
 */
export function divideMinor(agorot: number, divisor: number): number {
  if (divisor === 0) return 0;
  return Math.round(agorot / divisor);
}

/**
 * Convert a minor-unit value to a percentage (×100, e.g. 0.667 → 66.7).
 */
export function agorotToPercent(agorot: number): number {
  return parseFloat((agorot / MINOR_UNIT_MULTIPLIER).toFixed(1));
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
  modifierLookup: Map<string, ModifierSnapshot>;
}

export function calculateLineTotal(
  basePrice: string,
  selectedModifiers: SelectedModifier[],
  quantity: number,
): number {
  let unitTotal = toMinorUnits(basePrice);

  for (const mod of selectedModifiers) {
    unitTotal = addMinor(unitTotal, toMinorUnits(mod.priceDelta));
  }

  return multiplyMinor(unitTotal, quantity);
}

export function calculateCartTotal(lineItems: LineItem[]): number {
  return lineItems.reduce((sum, item) => addMinor(sum, item.lineTotal), 0);
}

export function formatPrice(agorot: number): string {
  return fromMinorUnits(agorot);
}
