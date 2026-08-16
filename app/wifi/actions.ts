"use server";

/**
 * WiFi captive portal — public server actions (WF-01…06).
 *
 * Privacy (C5):
 *   - the guest device id is stored HASHED, never raw,
 *   - name/phone are written ONLY when the guest explicitly consents,
 *   - zero-field guest access always works (no name/phone required),
 *   - no third-party trackers on the splash.
 *
 * Rate-limited per IP; inputs validated; router calls go through the
 * `CaptivePortalAdapter` (MockAdapter by default, WF-04).
 */

import { createHash } from "node:crypto";
import { checkThrottle } from "@/lib/rate-limit";
import { callerIp } from "@/lib/ip";
import { db } from "@/lib/db";
import { wifiSessions, settings } from "@/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { isFeatureEnabled, FEATURE_WIFI_PORTAL } from "@/lib/features";
import { getAdapter } from "@/lib/captive-portal";
import { getTodaySuggestionForWifi } from "@/lib/db/queries";

const AUTHORIZE_LIMIT = { max: 20, windowMs: 60_000 };
const WIFI_END_LIMIT = { max: 60, windowMs: 60_000 };
const WIFI_SUGGESTION_LIMIT = { max: 90, windowMs: 60_000 };
const SESSION_TTL_SECONDS = 10 * 60; // 10 minutes per authorization

export type WifiAuthorizeResult =
  | { success: true; sessionId: string; expiresAt: string; suggestionAvailable: boolean }
  | { success: false; error: string };

export type WifiSessionEndResult = { success: true } | { success: false; error: string };

function flagOffError(flag: string): { success: false; error: string } {
  return {
    success: false,
    error: `${flag} off`,
  };
}

/**
 * Deterministic hash so repeats from the same device converge to the same
 * hash key (for session logging) WITHOUT storing the raw identifier. Salted
 * with a server-only secret so the hash isn't rainbow-table-able.
 */
function hashDeviceId(raw: string): string {
  const salt = process.env.WIFI_DEVICE_ID_SALT ?? "ayasofia-wifi";
  return createHash("sha256").update(`${salt}:${raw}`).digest("hex").slice(0, 32);
}

/** Validate a device id is a plausible opaque identifier (no injection). */
function validDeviceId(raw: string): boolean {
  return typeof raw === "string" && raw.length >= 4 && raw.length <= 200 && /^[\w.:\-]+$/.test(raw);
}

/**
 * One-tap "اتصال بالإنترنت". Zero-field by default; optional name/phone are
 * persisted ONLY when `consent` is true — otherwise the adapter still
 * authorizes the device (guest access must always work, C5).
 */
export async function authorizeGuest(input: {
  deviceId: string;
  consent?: boolean;
  guestName?: string;
  guestPhone?: string;
}): Promise<WifiAuthorizeResult> {
  const active = await isFeatureEnabled(FEATURE_WIFI_PORTAL);
  if (!active) return flagOffError(FEATURE_WIFI_PORTAL);

  if (!validDeviceId(input.deviceId)) {
    return { success: false, error: "معرّف جهاز غير صالح" };
  }

  const ip = await callerIp();
  const throttle = await checkThrottle(`wifi:${ip}`, AUTHORIZE_LIMIT);
  if (!throttle.allowed) {
    return { success: false, error: "محاولات كثيرة، حاول بعد قليل" };
  }

  const consent = input.consent === true;
  const deviceHash = hashDeviceId(input.deviceId);
  const adapter = getAdapter();
  const ttlSeconds = SESSION_TTL_SECONDS;

  const auth = await adapter.authorizeDevice({ deviceId: deviceHash, ttlSeconds });
  if (!auth.ok || !auth.data) {
    return { success: false, error: auth.error ?? "تعذر ربط الجهاز بالشبكة" };
  }

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  // PII stored ONLY with consent (C5). Never store more than the guest gave.
  const name = consent && input.guestName?.trim() ? input.guestName.trim().slice(0, 100) : null;
  const phone = consent && input.guestPhone?.trim() ? input.guestPhone.trim().slice(0, 20) : null;

  await db.insert(wifiSessions).values({
    deviceIdHash: deviceHash,
    consented: consent,
    guestName: name,
    guestPhone: phone,
    authorizedAt: new Date(),
    expiresAt,
    routerSessionId: auth.data.sessionId,
    notes: `ip=${ip}`,
  });

  return {
    success: true,
    sessionId: auth.data.sessionId,
    expiresAt: expiresAt.toISOString(),
    suggestionAvailable: true,
  };
}

/**
 * Guest leaves the portal — record wall-clock duration so connect stats are
 * honest. Anonymous by default (hashed device id only).
 */
export async function endWifiSession(input: {
  deviceId: string;
  durationSec?: number;
}): Promise<WifiSessionEndResult> {
  const active = await isFeatureEnabled(FEATURE_WIFI_PORTAL);
  if (!active) return flagOffError(FEATURE_WIFI_PORTAL);
  if (!validDeviceId(input.deviceId)) return { success: false, error: "معرّف جهاز غير صالح" };

  // T-B2: throttle the public logout/session-end endpoint per source IP.
  const ip = await callerIp();
  const throttle = await checkThrottle(`wifi-end:${ip}`, WIFI_END_LIMIT);
  if (!throttle.allowed) return { success: false, error: "محاولات كثيرة، حاول بعد قليل" };

  const deviceHash = hashDeviceId(input.deviceId);
  const duration =
    Number.isFinite(input.durationSec) && (input.durationSec ?? 0) > 0
      ? Math.min(Math.round(input.durationSec ?? 0), 86400)
      : null;

  const adapter = getAdapter();
  await adapter.revoke({ deviceId: deviceHash });

  // T-B3: mark the LATEST, still-active session as revoked and (if supplied)
  // its wall-clock duration. Targeting only the newest non-revoked session
  // avoids a stale logout clobbering a newer, still-connected session for the
  // same device.
  const setData: Record<string, unknown> = { revokedAt: new Date() };
  if (duration !== null) setData.durationSec = duration;

  // Select the latest still-active session id, then revoke exactly that row.
  const [target] = await db
    .select({ id: wifiSessions.id })
    .from(wifiSessions)
    .where(and(eq(wifiSessions.deviceIdHash, deviceHash), isNull(wifiSessions.revokedAt)))
    .orderBy(desc(wifiSessions.authorizedAt))
    .limit(1);

  if (target) {
    await db.update(wifiSessions).set(setData).where(eq(wifiSessions.id, target.id));
  }

  return { success: true };
}

/**
 * Read the admin-editable splash copy from settings (P1-M6). Falls back to
 * brand defaults whenever a key is unset so the portal always renders.
 */
export async function getSplashSettings(): Promise<{
  title: string;
  subtitle: string;
  privacyLine: string;
}> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(
      inArray(settings.key, ["wifi.splash_title", "wifi.splash_subtitle", "wifi.privacy_line"]),
    );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    title: map.get("wifi.splash_title") ?? "أياسوفيا ترحّب بك",
    subtitle: map.get("wifi.splash_subtitle") ?? "واي فاي مجاني للضيوف — نسبة السكر على مزاجك 🤍",
    privacyLine:
      map.get("wifi.privacy_line") ??
      "لا نشارك بياناتك مع أي طرف ثالث، ولا نطلب اسمك أو رقمك للاتصال.",
  };
}

/** Today's suggestion for the post-connect screen (shared entity, WF-06). */
export async function getWifiSuggestion(): Promise<{
  success: boolean;
  product: {
    id: string;
    nameAr: string;
    basePrice: string;
    imageUrl: string | null;
    titleAr: string | null;
  } | null;
  branchSlug: string | null;
}> {
  const active = await isFeatureEnabled(FEATURE_WIFI_PORTAL);
  if (!active) return { success: false, product: null, branchSlug: null };

  // T-B2: throttle the public suggestion read per source IP.
  const ip = await callerIp();
  const throttle = await checkThrottle(`wifi-suggestion:${ip}`, WIFI_SUGGESTION_LIMIT);
  if (!throttle.allowed) return { success: false, product: null, branchSlug: null };

  const suggestion = await getTodaySuggestionForWifi();
  return {
    success: true,
    product: suggestion
      ? {
          id: suggestion.productId,
          nameAr: suggestion.nameAr,
          basePrice: suggestion.basePrice,
          imageUrl: suggestion.imageUrl,
          titleAr: suggestion.titleAr,
        }
      : null,
    branchSlug: suggestion?.branchSlug ?? null,
  };
}
