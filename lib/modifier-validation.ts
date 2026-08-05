/**
 * Server-side modifier selection validation (FR-DM-13).
 *
 * Pure — no DB, so it can be unit-tested in isolation. The checkout
 * pipeline runs this for EVERY order (POS + digital menu) so a crafted
 * request cannot skip a required modifier group, exceed a multi-group's
 * max selections, or smuggle modifiers that don't belong to a product.
 */

export interface ModifierOptionSpec {
  id: string;
}

export interface ModifierGroupSpec {
  id: string;
  type: "single" | "multi";
  isRequired: boolean;
  /** Cap for `multi` groups; null = unlimited. Ignored for `single`. */
  maxSelections: number | null;
  modifiers: ModifierOptionSpec[];
}

export interface ModifierSelectionViolation {
  groupId: string;
  groupName?: string;
  reason:
    | "required_not_selected"
    | "max_selections_exceeded"
    | "unknown_modifier"
    | "single_multiple_selected";
}

/**
 * Validate a set of selected modifier IDs against a product's modifier
 * groups. Returns a list of violations (empty = valid).
 */
export function validateModifierSelection(
  groups: ModifierGroupSpec[],
  selectedModifierIds: string[],
): ModifierSelectionViolation[] {
  const violations: ModifierSelectionViolation[] = [];
  const selectedSet = new Set(selectedModifierIds);

  // A selected id that belongs to NO group of this product is a protocol
  // violation. Checked once against the union of all the product's
  // modifier ids (not per-group — a valid modifier in group A must not be
  // flagged against group B).
  const allGroupModIds = new Set(groups.flatMap((g) => g.modifiers.map((m) => m.id)));
  const foreignIds = selectedModifierIds.filter((id) => !allGroupModIds.has(id));
  if (foreignIds.length > 0) {
    violations.push({ groupId: "", reason: "unknown_modifier" });
  }

  for (const group of groups) {
    const pickedInGroup = group.modifiers.filter((m) => selectedSet.has(m.id));

    if (group.isRequired && pickedInGroup.length === 0) {
      violations.push({ groupId: group.id, reason: "required_not_selected" });
    }

    if (group.type === "single" && pickedInGroup.length > 1) {
      violations.push({ groupId: group.id, reason: "single_multiple_selected" });
    }

    if (
      group.type === "multi" &&
      group.maxSelections != null &&
      pickedInGroup.length > group.maxSelections
    ) {
      violations.push({ groupId: group.id, reason: "max_selections_exceeded" });
    }
  }

  return violations;
}
