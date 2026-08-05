import { describe, it, expect } from "vitest";
import { evaluateUpsell, type UpsellRule, type UpsellCartContext } from "@/lib/upsell";

function rule(overrides: Partial<UpsellRule>): UpsellRule {
  return {
    id: "r1",
    condition: "always",
    triggerValue: "{}",
    suggestionProductId: "prod-x",
    suggestionModifierId: null,
    priority: 0,
    isActive: true,
    ...overrides,
  };
}

function ctx(overrides: Partial<UpsellCartContext> = {}): UpsellCartContext {
  return {
    items: [],
    subtotalAgorot: 0,
    hour: 14,
    ...overrides,
  };
}

describe("evaluateUpsell", () => {
  it("returns nothing when there are no rules", () => {
    expect(evaluateUpsell([], ctx())).toEqual([]);
  });

  it("ignores inactive rules and rules with no suggestion", () => {
    const rules = [
      rule({ id: "a", isActive: false }),
      rule({ id: "b", suggestionProductId: null, suggestionModifierId: null }),
    ];
    expect(evaluateUpsell(rules, ctx())).toEqual([]);
  });

  it("always rule matches", () => {
    const rules = [rule({ id: "a", condition: "always" })];
    const out = evaluateUpsell(rules, ctx());
    expect(out).toHaveLength(1);
    expect(out[0].ruleId).toBe("a");
  });

  it("cart_has_product_category matches when cart contains the category", () => {
    const rules = [
      rule({
        id: "a",
        condition: "cart_has_product_category",
        triggerValue: JSON.stringify({ categoryId: "cat1" }),
        suggestionProductId: "prod-y",
      }),
    ];
    const out = evaluateUpsell(
      rules,
      ctx({ items: [{ id: "p1", categoryId: "cat1", selectedModifierIds: [] }] }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].suggestionProductId).toBe("prod-y");
  });

  it("cart_has_product_category does not match when category absent", () => {
    const rules = [
      rule({
        id: "a",
        condition: "cart_has_product_category",
        triggerValue: JSON.stringify({ categoryId: "cat1" }),
      }),
    ];
    const out = evaluateUpsell(
      rules,
      ctx({ items: [{ id: "p1", categoryId: "cat2", selectedModifierIds: [] }] }),
    );
    expect(out).toEqual([]);
  });

  it("cart_without_modifier matches when cart lacks the modifier (e.g. no topping)", () => {
    const rules = [
      rule({
        id: "a",
        condition: "cart_without_modifier",
        triggerValue: JSON.stringify({ modifierId: "mod-top" }),
        suggestionProductId: "prod-pearls",
      }),
    ];
    const out = evaluateUpsell(
      rules,
      ctx({ items: [{ id: "p1", categoryId: null, selectedModifierIds: ["mod-size"] }] }),
    );
    expect(out).toHaveLength(1);
  });

  it("cart_without_modifier does NOT match when cart already has the modifier", () => {
    const rules = [
      rule({
        id: "a",
        condition: "cart_without_modifier",
        triggerValue: JSON.stringify({ modifierId: "mod-top" }),
      }),
    ];
    const out = evaluateUpsell(
      rules,
      ctx({ items: [{ id: "p1", categoryId: null, selectedModifierIds: ["mod-top"] }] }),
    );
    expect(out).toEqual([]);
  });

  it("cart_below_threshold matches below the threshold", () => {
    const rules = [
      rule({
        id: "a",
        condition: "cart_below_threshold",
        triggerValue: JSON.stringify({ thresholdAgorot: 5000 }),
        suggestionModifierId: "mod-add-on",
      }),
    ];
    expect(evaluateUpsell(rules, ctx({ subtotalAgorot: 3000 }))).toHaveLength(1);
    expect(evaluateUpsell(rules, ctx({ subtotalAgorot: 6000 }))).toEqual([]);
  });

  it("time_of_day hot bias matches in daytime window only", () => {
    const rules = [
      rule({
        id: "a",
        condition: "time_of_day",
        triggerValue: JSON.stringify({ bias: "hot" }),
      }),
    ];
    expect(evaluateUpsell(rules, ctx({ hour: 14 }))).toHaveLength(1);
    expect(evaluateUpsell(rules, ctx({ hour: 22 }))).toEqual([]);
  });

  it("sorts by priority desc and caps at 3", () => {
    const rules = [
      rule({ id: "low", condition: "always", priority: 1 }),
      rule({ id: "high", condition: "always", priority: 10 }),
      rule({ id: "mid", condition: "always", priority: 5 }),
      rule({ id: "low2", condition: "always", priority: 2 }),
    ];
    const out = evaluateUpsell(rules, ctx());
    expect(out.map((m) => m.ruleId)).toEqual(["high", "mid", "low2"]);
    expect(out).toHaveLength(3);
  });
});
