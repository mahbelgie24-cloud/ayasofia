/**
 * Pure candidate-selection logic — testable without Supabase.
 * Exported for testing in __tests__/cleanup.test.ts.
 */

export interface CleanupUser {
  id: string;
  is_anonymous?: boolean;
  created_at: string;
  email?: string;
  phone?: string;
  app_metadata?: Record<string, unknown>;
}

export interface CleanupConfig {
  maxAgeHours: number;
  dryRun: boolean;
}

export interface CleanupResult {
  eligibleIds: Set<string>;
  totalInspected: number;
  skippedNotAnonymous: number;
  skippedTooRecent: number;
  skippedStaffLinked: number;
  skippedHasEmailOrPhone: number;
  skippedHasStaffMetadata: number;
  skippedMalformedTimestamp: number;
}

export function selectEligibleUsers(
  users: CleanupUser[],
  staffLinkedIds: Set<string>,
  config: CleanupConfig,
): CleanupResult {
  const cutoff = new Date(Date.now() - config.maxAgeHours * 60 * 60 * 1000);
  const eligibleIds = new Set<string>();

  let skippedNotAnonymous = 0;
  let skippedTooRecent = 0;
  let skippedStaffLinked = 0;
  let skippedHasEmailOrPhone = 0;
  let skippedHasStaffMetadata = 0;
  let skippedMalformedTimestamp = 0;

  for (const user of users) {
    if (user.is_anonymous !== true) {
      skippedNotAnonymous++;
      continue;
    }

    const createdAt = new Date(user.created_at);
    if (isNaN(createdAt.getTime())) {
      skippedMalformedTimestamp++;
      continue;
    }
    if (createdAt >= cutoff) {
      skippedTooRecent++;
      continue;
    }

    if (staffLinkedIds.has(user.id)) {
      skippedStaffLinked++;
      continue;
    }

    const appMeta = user.app_metadata as Record<string, unknown> | undefined;
    if (appMeta && typeof appMeta.staff_id === "string" && appMeta.staff_id.length > 0) {
      skippedHasStaffMetadata++;
      continue;
    }

    if (user.email || user.phone) {
      skippedHasEmailOrPhone++;
      continue;
    }

    eligibleIds.add(user.id);
  }

  return {
    eligibleIds,
    totalInspected: users.length,
    skippedNotAnonymous,
    skippedTooRecent,
    skippedStaffLinked,
    skippedHasEmailOrPhone,
    skippedHasStaffMetadata,
    skippedMalformedTimestamp,
  };
}
