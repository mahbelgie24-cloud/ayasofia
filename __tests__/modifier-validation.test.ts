import { describe, it, expect } from "vitest";
import { validateModifierSelection, type ModifierGroupSpec } from "@/lib/modifier-validation";

function group(overrides: Partial<ModifierGroupSpec>): ModifierGroupSpec {
  return {
    id: "g1",
    type: "single",
    isRequired: false,
    maxSelections: null,
    modifiers: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
    ...overrides,
  };
}

describe("validateModifierSelection", () => {
  it("accepts a valid single selection", () => {
    const g = group({ type: "single", isRequired: true });
    expect(validateModifierSelection([g], ["m1"])).toEqual([]);
  });

  it("flags a required group with no selection", () => {
    const g = group({ type: "single", isRequired: true });
    const violations = validateModifierSelection([g], []);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toBe("required_not_selected");
  });

  it("allows skipping a non-required group", () => {
    const g = group({ type: "single", isRequired: false });
    expect(validateModifierSelection([g], [])).toEqual([]);
  });

  it("flags multiple selections in a single group", () => {
    const g = group({ type: "single", isRequired: false });
    const violations = validateModifierSelection([g], ["m1", "m2"]);
    expect(violations.some((v) => v.reason === "single_multiple_selected")).toBe(true);
  });

  it("flags exceeding a multi group's max selections", () => {
    const g = group({ type: "multi", maxSelections: 2 });
    const violations = validateModifierSelection([g], ["m1", "m2", "m3"]);
    expect(violations.some((v) => v.reason === "max_selections_exceeded")).toBe(true);
  });

  it("allows a multi group within max", () => {
    const g = group({ type: "multi", maxSelections: 2 });
    expect(validateModifierSelection([g], ["m1", "m2"])).toEqual([]);
  });

  it("treats null maxSelections as unlimited", () => {
    const g = group({ type: "multi", maxSelections: null });
    expect(validateModifierSelection([g], ["m1", "m2", "m3"])).toEqual([]);
  });

  it("flags a modifier id that belongs to no group of the product", () => {
    const g = group({ type: "multi", maxSelections: null });
    const violations = validateModifierSelection([g], ["m1", "foreign"]);
    expect(violations.some((v) => v.reason === "unknown_modifier")).toBe(true);
  });

  it("does NOT flag a modifier that belongs to another group of the same product", () => {
    const g1 = group({ id: "g1", type: "single", isRequired: false });
    const g2 = group({
      id: "g2",
      type: "multi",
      isRequired: false,
      modifiers: [{ id: "m-a" }, { id: "m-b" }],
    });
    const violations = validateModifierSelection([g1, g2], ["m1", "m-a"]);
    // m1 belongs to g1 (no violation); m-a belongs to g2 (no violation).
    expect(violations.some((v) => v.reason === "unknown_modifier")).toBe(false);
  });
});
