"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
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

  // T-B5: derive the target user from the SERVER session, never from the
  // client-supplied id. A client can pass any GUID for `anonUserId`; if we
  // blindly called updateUserById(anonUserId, …) a successful PIN would promote
  // an ARBITRARY user to staff. Identify the caller via their own session cookie.
  const ssr = await createClient();
  const {
    data: { user },
    error: getUserErr,
  } = await ssr.auth.getUser();
  if (getUserErr || !user) {
    return { success: false, error: "Not authenticated" };
  }
  const sessionUserId = user.id;

  // Defense-in-depth: if the client sent a different id, it is forging the
  // identity the pin-pad minted — reject outright.
  if (anonUserId && anonUserId !== sessionUserId) {
    return { success: false, error: "Session mismatch" };
  }

  // Rate limit check — keyed by the server-derived session user (per-device
  // lockout), plus an IP-level cap below that cannot be bypassed by minting
  // fresh anonymous users (review finding C4).
  const rateCheck = checkRateLimit(sessionUserId);
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
    const { locked, waitMs } = recordFailedAttempt(sessionUserId);
    if (locked) {
      return {
        success: false,
        error: `تم قفل الحساب مؤقتاً. حاول بعد ${Math.ceil(waitMs / 1000)} ثانية`,
      };
    }
    return { success: false, error: "Invalid PIN" };
  }

  // Successful auth — reset attempt counter
  resetAttempts(sessionUserId);

  const { error: authErr } = await supabase.auth.admin.updateUserById(sessionUserId, {
    app_metadata: { staff_id: match.id, role: match.role },
  });

  if (authErr) {
    return { success: false, error: "Something went wrong" };
  }

  await supabase.from("staff").update({ auth_user_id: sessionUserId }).eq("id", match.id);

  const [openShift] = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.staffId, match.id), isNull(shifts.closedAt)))
    .limit(1);

  return { success: true, hasOpenShift: !!openShift };
}
