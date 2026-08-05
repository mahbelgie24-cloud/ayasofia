"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { verifyPin } from "@/lib/auth";
import { db } from "@/lib/db";
import { shifts } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  checkRateLimit,
  checkThrottle,
  recordFailedAttempt,
  resetAttempts,
} from "@/lib/rate-limit";
import { callerIp } from "@/lib/ip";

export type PinResult =
  { success: true; hasOpenShift: boolean } | { success: false; error: string };

// IP-level PIN attempt cap.  The anon-user lockout is per sign-in and
// spoofable by minting a fresh anonymous user per attempt (anonymous
// sign-in is unlimited).  Keying an *additional* cap on the source IP
// stops the spraying attack regardless of how many anon users a
// script creates (review finding C4).
const LOGIN_IP_LIMIT = { max: 30, windowMs: 10 * 60_000 };

export async function verifyStaffPin(pin: string, anonUserId: string): Promise<PinResult> {
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return { success: false, error: "Invalid PIN" };
  }

  // Rate limit check — keyed by anonymous user ID (per-device lockout)
  const rateCheck = checkRateLimit(anonUserId);
  if (!rateCheck.allowed) {
    const waitSeconds = Math.ceil(rateCheck.waitMs / 1000);
    return {
      success: false,
      error: `محاولات كثيرة جداً. انتظر ${waitSeconds} ثانية`,
    };
  }

  // IP-level cap — shared across the whole store and across anon-user
  // identities, so the anon-user lockout cannot be bypassed by minting
  // a new anonymous session for every guess.
  const ip = await callerIp();
  const ipThrottle = checkThrottle(`pin:${ip}`, LOGIN_IP_LIMIT);
  if (!ipThrottle.allowed) {
    const waitMinutes = Math.max(1, Math.ceil(ipThrottle.retryAfterMs / 60_000));
    return {
      success: false,
      error: `محاولات كثيرة من هذا الجهاز. انتظر ${waitMinutes} دقيقة`,
    };
  }

  const supabase = createServiceClient();

  const { data: staffRows, error: fetchErr } = await supabase
    .from("staff")
    .select("id, pin_hash, role")
    .eq("active", true);

  if (fetchErr || !staffRows) {
    return { success: false, error: "Something went wrong" };
  }

  const match = staffRows.find((row) => verifyPin(pin, row.pin_hash));

  if (!match) {
    const { locked, waitMs } = recordFailedAttempt(anonUserId);
    if (locked) {
      return {
        success: false,
        error: `تم قفل الحساب مؤقتاً. حاول بعد ${Math.ceil(waitMs / 1000)} ثانية`,
      };
    }
    return { success: false, error: "Invalid PIN" };
  }

  // Successful auth — reset attempt counter
  resetAttempts(anonUserId);

  const { error: authErr } = await supabase.auth.admin.updateUserById(anonUserId, {
    app_metadata: { staff_id: match.id, role: match.role },
  });

  if (authErr) {
    return { success: false, error: "Something went wrong" };
  }

  await supabase.from("staff").update({ auth_user_id: anonUserId }).eq("id", match.id);

  const [openShift] = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.staffId, match.id), isNull(shifts.closedAt)))
    .limit(1);

  return { success: true, hasOpenShift: !!openShift };
}
