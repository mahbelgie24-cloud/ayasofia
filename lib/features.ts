/**
 * Feature flags (C9). Backed by the existing `settings` key/value table —
 * no new dependency, consistent with the codebase's config approach.
 *
 * Keys (settings): `feature.digital_menu`, `feature.wifi_portal`.
 * Values are "1"/"true" to enable; anything else (or absent) = off.
 *
 * When a flag is off:
 *   - public pages render a branded fallback (not a 404),
 *   - public server actions return a typed error,
 *   - admin nav items hide.
 *
 * Server-only (reads Postgres). Use `isFeatureEnabled` in Server Components
 * and Server Actions; the public UI reads the resolved flag from the page.
 * NOTE: no `"use server"` directive here — this module exports non-async
 * helpers (parseFlag, constants) which server-action modules forbid; it is
 * imported only from server contexts.
 */

import { db } from "@/lib/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cached, invalidateByPrefix } from "@/lib/cache";

export function parseFlag(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function flagKey(name: string): string {
  return `feature.${name}`;
}

/**
 * Feature flags are read on every public page/action render. Caching the
 * read in-process (30s TTL) removes a per-request Postgres round-trip from
 * the critical path — the dominant cost on a remote Supabase pooler. The
 * view lags an admin toggle by at most TTL; `invalidateFeatureFlag` is
 * called by admin settings writes to apply it immediately (C2 pattern).
 */
const FEATURE_FLAG_TTL_MS = 30_000;

/** Read a single feature flag from the settings table. */
export async function isFeatureEnabled(name: string): Promise<boolean> {
  return cached(
    `feature:${name}`,
    async () => {
      try {
        const [row] = await db
          .select({ value: settings.value })
          .from(settings)
          .where(eq(settings.key, flagKey(name)))
          .limit(1);
        return parseFlag(row?.value);
      } catch {
        // Config read failure defaults to OFF — safer to withhold a public
        // surface than to expose it when its backing flag can't be read.
        return false;
      }
    },
    FEATURE_FLAG_TTL_MS,
  );
}

/** Drop all cached feature-flag reads (call after an admin settings write). */
export function invalidateFeatureFlags(): void {
  invalidateByPrefix("feature:");
}

export const FEATURE_DIGITAL_MENU = "digital_menu";
export const FEATURE_WIFI_PORTAL = "wifi_portal";
