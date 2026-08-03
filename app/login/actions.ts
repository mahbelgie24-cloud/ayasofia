"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { verifyPin } from "@/lib/auth";
import { db } from "@/lib/db";
import { shifts } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export type PinResult =
  { success: true; hasOpenShift: boolean } | { success: false; error: string };

export async function verifyStaffPin(pin: string, anonUserId: string): Promise<PinResult> {
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return { success: false, error: "Invalid PIN" };
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
    return { success: false, error: "Invalid PIN" };
  }

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
