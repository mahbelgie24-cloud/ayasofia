"use server";

import { requireStaffSession, hashPin, verifyPin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { db } from "@/lib/db";
import { staff } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  active: boolean;
  authUserId: string | null;
  createdAt: string;
}

export async function getStaffList(): Promise<StaffMember[]> {
  await requireStaffSession("owner");
  const rows = await db
    .select({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      active: staff.active,
      authUserId: staff.authUserId,
      createdAt: staff.createdAt,
    })
    .from(staff)
    .orderBy(staff.name);
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt?.toISOString() ?? "",
  }));
}

export async function createStaffMember(input: {
  name: string;
  role: string;
  pin: string;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("owner");

  if (!input.name.trim()) return { success: false, error: "الاسم مطلوب" };
  if (!input.pin || input.pin.length !== 4 || !/^\d{4}$/.test(input.pin)) {
    return { success: false, error: "الـ PIN يجب أن يكون 4 أرقام" };
  }

  const validRoles = ["owner", "manager", "cashier", "barista"];
  if (!validRoles.includes(input.role)) {
    return { success: false, error: "دور غير صالح" };
  }

  // PIN uniqueness check against all active staff
  const allActive = await db
    .select({ id: staff.id, pinHash: staff.pinHash })
    .from(staff)
    .where(eq(staff.active, true));

  for (const s of allActive) {
    if (verifyPin(input.pin, s.pinHash)) {
      return { success: false, error: "هذا الـ PIN مستخدم من قبل موظف آخر" };
    }
  }

  await db.insert(staff).values({
    name: input.name.trim(),
    role: input.role as "owner" | "manager" | "cashier" | "barista",
    pinHash: hashPin(input.pin),
  });

  return { success: true };
}

export async function updateStaffMember(input: {
  id: string;
  name?: string;
  role?: string;
  pin?: string;
  active?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  await requireStaffSession("owner");

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.role !== undefined) {
    const validRoles = ["owner", "manager", "cashier", "barista"];
    if (!validRoles.includes(input.role)) {
      return { success: false, error: "دور غير صالح" };
    }
    data.role = input.role;
  }
  if (input.active !== undefined) data.active = input.active;

  // PIN uniqueness: check new PIN against ALL OTHER active staff
  if (input.pin !== undefined && input.pin.trim() !== "") {
    if (input.pin.length !== 4 || !/^\d{4}$/.test(input.pin)) {
      return { success: false, error: "الـ PIN يجب أن يكون 4 أرقام" };
    }

    const allOtherActive = await db
      .select({ id: staff.id, pinHash: staff.pinHash })
      .from(staff)
      .where(and(eq(staff.active, true), sql`${staff.id} != ${input.id}`));

    for (const s of allOtherActive) {
      if (verifyPin(input.pin, s.pinHash)) {
        return { success: false, error: "هذا الـ PIN مستخدم من قبل موظف آخر" };
      }
    }

    data.pinHash = hashPin(input.pin);
  }

  if (Object.keys(data).length === 0) {
    return { success: false, error: "لا توجد تغييرات" };
  }

  await db.update(staff).set(data).where(eq(staff.id, input.id));

  // S5: keep the LIVE session's authorization claims in sync with the staff
  // row. `requireStaffSession` reads app_metadata via auth.getUser() (fresh
  // from the DB on every call), so updating the auth user here takes effect
  // on the staff member's next server action — a demotion or deactivation
  // can no longer be outrun by an already-signed-in session. app_metadata
  // merges, so nulling staff_id clears the guard's key check.
  if (data.role !== undefined || data.active === false) {
    const [row] = await db
      .select({ authUserId: staff.authUserId })
      .from(staff)
      .where(eq(staff.id, input.id))
      .limit(1);
    if (row?.authUserId) {
      const supabase = createServiceClient();
      const claims =
        data.active === false
          ? { staff_id: null, role: null } // deactivated → NO_STAFF_ID on next action
          : { staff_id: input.id, role: data.role as string };
      const { error: authErr } = await supabase.auth.admin.updateUserById(row.authUserId, {
        app_metadata: claims,
      });
      if (authErr) {
        // The staff row IS updated — report the desync rather than pretend.
        return {
          success: false,
          error: "تم التحديث لكن فشل مزامنة صلاحيات الجلسة — اطلب من الموظف تسجيل الخروج",
        };
      }
    }
  }

  return { success: true };
}
