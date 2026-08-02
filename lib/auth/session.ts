import { createClient } from "@/lib/supabase/client";

/**
 * End the current staff session by signing out the anonymous auth
 * user.  Called from the shift-close flow (spec §9 shifts table —
 * Phase 4) so the next staff member on this device starts with a
 * fresh anonymous sign-in.  Sessions must NOT persist across shift
 * changes — this is the privacy and RBAC guardrail.
 */
export async function endStaffSession(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
