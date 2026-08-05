/**
 * Upsell engine (FR-DM-16) — pure, dependency-free so it is unit-testable
 * without a database.
 *
 * Evaluates active `upsell_rules` against a cart context (what the guest
 * has picked, its subtotal, and the current time) and returns the matched
 * suggestions, ordered by priority (higher first), capped per call.
 *
 * Rules are fetched by the caller (lib/db/queries.ts) and passed in as a
 * plain shape; this module only scores them. Server-side only — never run
 * client-side, and never trust client-supplied "suggestions" as order
 * content (only the guest's actual cart items are charged).
 */

export type UpsellCondition =
  | "cart_has_product_category"
  | "cart_without_modifier"
  | "cart_below_threshold"
  | "time_of_day"
  | "always";

export interface UpsellRule {
  id: string;
  condition: string;
  triggerValue: string; // JSON payload
  suggestionProductId: string | null;
  suggestionModifierId: string | null;
  priority: number;
  isActive: boolean;
}

export interface UpsellProduct {
  id: string;
  categoryId: string | null;
  selectedModifierIds: string[];
}

export interface UpsellCartContext {
  items: UpsellProduct[];
  /** Cart subtotal in integer minor units (agorot). */
  subtotalAgorot: number;
  /** Local hour 0-23 used for time-of-day bias. */
  hour: number;
}

export interface UpsellMatch {
  ruleId: string;
  condition: UpsellCondition;
  priority: number;
  suggestionProductId: string | null;
  suggestionModifierId: string | null;
}

const MAX_SUGGESTIONS = 3;

function isActive(rule: UpsellRule): rule is UpsellRule & { isActive: true } {
  return rule.isActive;
}

function parseTrigger(rule: UpsellRule): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rule.triggerValue);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function hasCategory(ctx: UpsellCartContext, categoryId: string | null): boolean {
  if (!categoryId) return false;
  return ctx.items.some((i) => i.categoryId === categoryId);
}

/** Has any line, in the same modifier group as the target, that includes the target modifier. */
function hasModifier(ctx: UpsellCartContext, modifierId: string | null): boolean {
  if (!modifierId) return false;
  return ctx.items.some((i) => i.selectedModifierIds.includes(modifierId));
}

function ruleMatches(rule: UpsellRule, ctx: UpsellCartContext): boolean {
  const t = parseTrigger(rule);
  switch (rule.condition) {
    case "cart_has_product_category":
      return hasCategory(ctx, (t.categoryId as string | undefined) ?? null);
    case "cart_without_modifier":
      // True when the cart does NOT yet contain the target modifier.
      return !hasModifier(ctx, (t.modifierId as string | undefined) ?? null);
    case "cart_below_threshold": {
      const threshold = Number(t.thresholdAgorot ?? 0);
      return ctx.subtotalAgorot < threshold;
    }
    case "time_of_day": {
      const bias = t.bias as "hot" | "cold" | undefined;
      if (bias === "hot") return ctx.hour >= 11 && ctx.hour <= 19;
      if (bias === "cold") return ctx.hour < 11 || ctx.hour > 19;
      return true;
    }
    case "always":
      return true;
    default:
      return false;
  }
}

/**
 * Evaluate the active rules against the cart context.
 * Returns matches sorted by priority (desc), capped at MAX_SUGGESTIONS.
 */
export function evaluateUpsell(rules: UpsellRule[], ctx: UpsellCartContext): UpsellMatch[] {
  const matches = rules
    .filter(isActive)
    .filter((r) => r.suggestionProductId || r.suggestionModifierId)
    .filter((r) => ruleMatches(r, ctx))
    .map((r) => ({
      ruleId: r.id,
      condition: r.condition as UpsellCondition,
      priority: r.priority,
      suggestionProductId: r.suggestionProductId,
      suggestionModifierId: r.suggestionModifierId,
    }))
    .sort((a, b) => b.priority - a.priority);

  return matches.slice(0, MAX_SUGGESTIONS);
}
