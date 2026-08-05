"use server";

import { requireStaffSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { settings } from "@/db/schema";
import { invalidateFeatureFlags } from "@/lib/features";
import { eq } from "drizzle-orm";

export async function getSettings(): Promise<Record<string, string>> {
  await requireStaffSession("owner");
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function saveSetting(
  key: string,
  value: string,
): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("owner");
  if (!key.trim()) return { success: false, error: "المفتاح مطلوب" };

  const [existing] = await db
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, key.trim()))
    .limit(1);

  if (existing) {
    await db.update(settings).set({ value: value.trim() }).where(eq(settings.key, key.trim()));
  } else {
    await db.insert(settings).values({ key: key.trim(), value: value.trim() });
  }
  invalidateFeatureFlags();
  return { success: true };
}
