"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { verifyPin } from "@/lib/auth";

export type PinResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Verify a staff PIN and link the anonymous auth session to the
 * matched staff row.  Called from the PIN-pad client component.
 *
 * Runs with the service-role key — never callable from the browser
 * directly because the key itself never leaves the server.
 */
export async function verifyStaffPin(
  pin: string,
  anonUserId: string,
): Promise<PinResult> {
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return { success: false, error: "Invalid PIN" };
  }

  const supabase = createServiceClient();

  // Fetch all active staff — a small shop has <20 rows so a
  // full scan is cheaper than adding a lookup prefix to the schema.
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

  // Stamp the anonymous user with the staff identity so the JWT
  // carries app_metadata.staff_id from this point forward.  RLS
  // policies on orders / order_items read this claim (§4 guardrail).
  const { error: authErr } = await supabase.auth.admin.updateUserById(
    anonUserId,
    {
      app_metadata: { staff_id: match.id, role: match.role },
    },
  );

  if (authErr) {
    return { success: false, error: "Something went wrong" };
  }

  // Persist the linkage so we can audit which auth user belongs to
  // which staff row (nullable column, set once on first match).
  await supabase
    .from("staff")
    .update({ auth_user_id: anonUserId })
    .eq("id", match.id);

  return { success: true };
}
