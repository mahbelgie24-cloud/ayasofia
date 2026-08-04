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
 * Convert a numeric-as-string to an integer in 10^`scale` minor units
 * without ANY floating-point arithmetic — string manipulation only
 * (parseInt on the major/fractional parts), so values like "0.10" or
 * "0.0050" are never exposed to JS float precision loss.
 *
 * `scale` = number of decimal places to preserve:
 *   - scale 2 → agorot (standard money unit; `toMinorUnits` uses this)
 *   - scale 4 → 1/10000-shekel, used for `ingredients.cost_per_unit`
 *     which is numeric(10,4).  Without this, a sub-agorot unit cost
 *     such as ₪0.0050 collapses to 0 in margin reports (WEB-DATA-001).
 *
 * Values carrying more decimals than `scale` are TRUNCATED.  This is
 * the correct, contract-locked behaviour for scale 2 (asserted in
 * pricing.test.ts) and acceptable for scale 4 since the column itself
 * caps at 4 decimals.  Negative values are supported.
 *
 * `majorInt * 10^scale` stays within Number.MAX_SAFE_INTEGER for the
 * precisions used here (numeric(10,4), numeric(12,2)).
 */
export function toScaledInt(numericStr: string, scale = 2): number {
  if (!numericStr || typeof numericStr !== "string") return 0;

  const trimmed = numericStr.trim();
  if (trimmed === "" || trimmed === "." || trimmed === "-" || trimmed === "-.") return 0;

  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [major = "0", frac = ""] = abs.split(".");

  const majorInt = parseInt(major, 10);
  if (!isFinite(majorInt)) return 0;

  const fracPadded = frac.slice(0, scale).padEnd(scale, "0");
  const fracInt = parseInt(fracPadded, 10);
  if (!isFinite(fracInt)) return 0;

  const value = majorInt * Math.pow(10, scale) + fracInt;
  return negative ? -value : value;
}

/**
 * Convert a numeric-as-string (e.g. "15.00", "-3.50") to integer
 * minor units (agorot).  Thin wrapper over `toScaledInt(…, 2)` —
 * the 2-decimal contract is unchanged (prices are numeric(10,2)).
 *
 * Exported so UI display layers can use it instead of ad-hoc
 * `parseFloat(x) * 100`.
 */
export function toMinorUnits(numericStr: string): number {
  return toScaledInt(numericStr, 2);
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
