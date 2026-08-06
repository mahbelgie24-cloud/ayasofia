/**
 * G1 — the ONE hard stock rule is ZERO recipe/modifier ingredient overlap,
 * regardless of group type. An ingredient-linked option in a multi/optional
 * group is a legitimate additive topping and must be ACCEPTED; an overlap in
 * ANY group type must be REJECTED. (The demo-seed side of the rule is covered
 * by seed-stock-semantics.test.ts.)
 */
import { describe, it, expect } from "vitest";
import { validateRealMenu, type RealMenu } from "@/scripts/ingest-real-menu";

interface ModOption {
  name_ar: string;
  deltaILS?: number;
  ingredientQty?: { ingredient: string; qty: number };
}

function menu({
  recipeIngredient,
  linkIngredient,
  groupType,
  groupRequired,
}: {
  recipeIngredient: string;
  linkIngredient: string;
  groupType: "single" | "multi";
  groupRequired: boolean;
}): RealMenu {
  const ingredientNames = [recipeIngredient, linkIngredient];
  const option: ModOption = {
    name_ar: "إضافة/بديل",
    deltaILS: 2,
    ingredientQty: { ingredient: linkIngredient, qty: 50 },
  };
  return {
    branch: { slug: "qalqilya", name_ar: "أياسوفيا" },
    ingredients: ingredientNames.map((n) => ({ name_ar: n, unit: "ml" })),
    categories: [{ key: "tea", name_ar: "شاي", sort: 1 }],
    products: [
      {
        name_ar: "ميليك تي",
        priceILS: 15,
        category: "tea",
        modifierGroups: [
          {
            type: groupType,
            name_ar: "المجموعة",
            required: groupRequired,
            max: groupType === "multi" ? 3 : null,
            options: [option],
          },
        ],
        recipe: [{ ingredient: recipeIngredient, qty: 200 }],
      },
    ],
  };
}

describe("ingest validation — unified zero-overlap rule (G1)", () => {
  it("ACCEPTS an ingredient-linked option in a multi, optional group (no overlap)", () => {
    const input = menu({
      recipeIngredient: "شاي أسود",
      linkIngredient: "لؤلؤ التابيوكا",
      groupType: "multi",
      groupRequired: false,
    });
    const { errors, warnings } = validateRealMenu(input);
    expect(errors).toEqual([]);
    // Non-blocking authoring warning may still surface for a non-required group.
    expect(warnings.length).toBeGreaterThanOrEqual(0);
  });

  it("REJECTS overlap when the linked group is a multi, optional group", () => {
    const input = menu({
      recipeIngredient: "لؤلؤ التابيوكا",
      linkIngredient: "لؤلؤ التابيوكا",
      groupType: "multi",
      groupRequired: false,
    });
    const { errors } = validateRealMenu(input);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("تكرار"))).toBe(true);
  });

  it("REJECTS overlap when the linked group is a single, required group", () => {
    const input = menu({
      recipeIngredient: "حليب شوفان",
      linkIngredient: "حليب شوفان",
      groupType: "single",
      groupRequired: true,
    });
    const { errors } = validateRealMenu(input);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("تكرار"))).toBe(true);
  });
});
