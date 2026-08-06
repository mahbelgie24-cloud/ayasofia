"use server";

/**
 * WiFi portal — admin actions (WF-06).
 *
 * RBAC: requireStaffSession("manager"). Splash copy is stored in the
 * settings key/value table; connect stats read from wifi_sessions
 * (anonymous sessions only — guest name/phone are never surfaced).
 */

import { requireStaffSession, RBACError } from "@/lib/auth";
import { db } from "@/lib/db";
import { settings, wifiSessions } from "@/db/schema";
import { invalidateFeatureFlags } from "@/lib/features";
import { eq, gte, count } from "drizzle-orm";

// P1-M11 — WRITE allowlist for the wifi admin action. Only splash/portal copy
// keys under the `wifi.` prefix may be written through this entry point. This
// rejection is deliberate and broad:
//   - `feature.*` keys toggle feature flags and are owner-policy territory —
//     a manager must not flip them through the wifi screen,
//   - owner-only settings (tax_rate, shop_name, currency, ...) also fall
//     outside `wifi.` and are rejected the same way.
// The typed RBACError lets callers/tests react to the policy rejection. This
// gate applies to WRITES ONLY; reads (getWifiSettings, getSplashSettings) are
// unaffected and keep returning wifi.* plus any existing keys.
const WIFI_WRITE_ALLOW = /^wifi\./;

export async function getWifiSettings(): Promise<Record<string, string>> {
  await requireStaffSession("manager");
  const rows = await db.select({ key: settings.key, value: settings.value }).from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function saveWifiSetting(
  key: string,
  value: string,
): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("manager");
  const trimmedKey = key.trim();
  if (!trimmedKey) return { success: false, error: "المفتاح مطلوب" };

  // P1-M11: only `wifi.*` keys are writable here. Everything else — including
  // feature.* and owner-only settings — is rejected with a typed RBACError.
  if (!WIFI_WRITE_ALLOW.test(trimmedKey)) {
    throw new RBACError(`Key "${trimmedKey}" is not a writable wifi setting`);
  }

  const trimmed = value.trim();
  const [existing] = await db
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, trimmedKey))
    .limit(1);
  if (existing) {
    await db.update(settings).set({ value: trimmed }).where(eq(settings.key, trimmedKey));
  } else {
    await db.insert(settings).values({ key: trimmedKey, value: trimmed });
  }
  invalidateFeatureFlags();
  return { success: true };
}

export interface WifiStats {
  totalSessions: number;
  todaySessions: number;
  consented: number;
}

export async function getWifiStats(): Promise<WifiStats> {
  await requireStaffSession("manager");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalRow, todayRow, consentedRow] = await Promise.all([
    db.select({ n: count() }).from(wifiSessions),
    db
      .select({ n: count() })
      .from(wifiSessions)
      .where(gte(wifiSessions.authorizedAt, startOfToday)),
    db.select({ n: count() }).from(wifiSessions).where(eq(wifiSessions.consented, true)),
  ]);

  return {
    totalSessions: totalRow[0]?.n ?? 0,
    todaySessions: todayRow[0]?.n ?? 0,
    consented: consentedRow[0]?.n ?? 0,
  };
}
