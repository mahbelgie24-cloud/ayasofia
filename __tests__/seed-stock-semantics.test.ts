import { describe, it, expect } from "vitest";
import { seedRecipes, seedModifiers, MODIFIER_INGREDIENT_LINKS } from "@/db/seed-data";

/**
 * Stock-semantics guard (spec §8.4): a swappable ingredient must appear
 * EITHER in a product's base recipe OR in a modifier option of that product —
 * NEVER both.  If it did, checkout-core would deduct it additively (recipe
 * quantity + modifier per-serving), double-counting stock on a single sale.
 *
 * This is a pure, data-level test over the seeded catalog; it mirrors the
 * exact wiring seed.ts performs (MODIFIER_INGREDIENT_LINKS × seedModifiers),
 * so a future seed edit that reintroduces an overlap fails CI before any
 * sales data is affected.
 */
describe("seed stock semantics — no recipe/modifier ingredient overlap", () => {
  // ingredient name → linked by which modifier option names
  const modifierLinksPerProduct = new Map<string, Set<string>>();

  for (const mg of seedModifiers) {
    for (const opt of mg.options) {
      const linkedIngredient = MODIFIER_INGREDIENT_LINKS[opt.name];
      if (!linkedIngredient) continue;
      const set = modifierLinksPerProduct.get(mg.productEn) ?? new Set<string>();
      set.add(linkedIngredient[0]);
      modifierLinksPerProduct.set(mg.productEn, set);
    }
  }

  // ingredient name → present in which product recipes
  const recipeIngredientsPerProduct = new Map<string, Set<string>>();
  for (const recipe of seedRecipes) {
    const set = recipeIngredientsPerProduct.get(recipe.productEn) ?? new Set<string>();
    set.add(recipe.ingredient);
    recipeIngredientsPerProduct.set(recipe.productEn, set);
  }

  it("has no ingredient that is BOTH a base-recipe ingredient and a linked topping for the same product", () => {
    const violations: Array<{ product: string; ingredient: string }> = [];

    for (const [product, modifierIngredients] of modifierLinksPerProduct) {
      const recipeIngredients = recipeIngredientsPerProduct.get(product);
      if (!recipeIngredients) continue;
      for (const ingredient of modifierIngredients) {
        if (recipeIngredients.has(ingredient)) {
          violations.push({ product, ingredient });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("exercises at least one modifier→ingredient link so the guard is meaningful", () => {
    let linkedCount = 0;
    for (const set of modifierLinksPerProduct.values()) linkedCount += set.size;
    expect(linkedCount).toBeGreaterThan(0);
  });
});
