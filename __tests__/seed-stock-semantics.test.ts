import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { seedRecipes, seedModifiers, MODIFIER_INGREDIENT_LINKS } from "@/db/seed-data";
import type { RealMenu } from "@/scripts/ingest-real-menu";

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

/**
 * The SAME guard applied to the shop's REAL menu, when it is present locally.
 * The human fills `docs/real-menu.json` (see docs/real-menu-guide.md); CI has no
 * such file and keeps demo seeds, so this block is skipped unless the file
 * exists. Mirrors scripts/ingest-real-menu.ts' enforcement exactly.
 */
const REAL_MENU_PATH = resolve(__dirname, "..", "docs", "real-menu.json");
const realMenuPresent = existsSync(REAL_MENU_PATH);

describe("ingested real menu (when present) — stock semantics", () => {
  const itWhenPresent = realMenuPresent ? it : it.skip;

  itWhenPresent(
    "has no recipe/modifier ingredient overlap; swappables live only in single+required groups",
    () => {
      const menu = JSON.parse(readFileSync(REAL_MENU_PATH, "utf-8")) as RealMenu;
      expect(Array.isArray(menu.ingredients)).toBe(true);
      const ingNames = new Set((menu.ingredients ?? []).map((i) => i.name_ar));

      const violations: Array<{ product: string; issue: string }> = [];

      for (const product of menu.products ?? []) {
        const recipeIngs = new Set((product.recipe ?? []).map((r) => r.ingredient));

        for (const line of product.recipe ?? []) {
          if (!ingNames.has(line.ingredient)) {
            violations.push({
              product: product.name_ar,
              issue: `وصفة تشير لخامة غير موجودة: ${line.ingredient}`,
            });
          }
        }

        for (const group of product.modifierGroups ?? []) {
          for (const option of group.options ?? []) {
            const link = option.ingredientQty;
            if (!link) continue;

            if (!ingNames.has(link.ingredient)) {
              violations.push({
                product: product.name_ar,
                issue: `خيار يربط خامة غير موجودة: ${link.ingredient}`,
              });
            }
            if (group.type !== "single" || group.required !== true) {
              violations.push({
                product: product.name_ar,
                issue: `خيار "${option.name_ar}" يستهلك خامة لكن مجموعته ليست single+required`,
              });
            }
            if (recipeIngs.has(link.ingredient)) {
              violations.push({
                product: product.name_ar,
                issue: `خامة "${link.ingredient}" موجودة في الوصفة وفي خيار معدِّل (تكرار)`,
              });
            }
          }
        }
      }

      expect(violations).toEqual([]);
    },
  );
});
