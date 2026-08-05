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

export function parseFlag(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function flagKey(name: string): string {
  return `feature.${name}`;
}

/** Read a single feature flag from the settings table. */
export async function isFeatureEnabled(name: string): Promise<boolean> {
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
}

export const FEATURE_DIGITAL_MENU = "digital_menu";
export const FEATURE_WIFI_PORTAL = "wifi_portal";
