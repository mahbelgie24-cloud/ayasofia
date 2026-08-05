"use server";

/**
 * WiFi portal — admin actions (WF-06).
 *
 * RBAC: requireStaffSession("manager"). Splash copy is stored in the
 * settings key/value table; connect stats read from wifi_sessions
 * (anonymous sessions only — guest name/phone are never surfaced).
 */

import { requireStaffSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { settings, wifiSessions } from "@/db/schema";
import { eq, gte, count } from "drizzle-orm";

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
  if (!key.trim()) return { success: false, error: "المفتاح مطلوب" };
  const trimmed = value.trim();
  const [existing] = await db
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, key.trim()))
    .limit(1);
  if (existing) {
    await db.update(settings).set({ value: trimmed }).where(eq(settings.key, key.trim()));
  } else {
    await db.insert(settings).values({ key: key.trim(), value: trimmed });
  }
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
