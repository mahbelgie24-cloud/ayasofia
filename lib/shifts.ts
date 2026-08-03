"use server";

import { requireStaffSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { shifts, orders } from "@/db/schema";
import { eq, and, isNull, gte, lte, sql } from "drizzle-orm";

export type ShiftResult = { success: true; shiftId: string } | { success: false; error: string };

export async function openShift(openingCash: number): Promise<ShiftResult> {
  const { staffId } = await requireStaffSession();

  const openingCashNum = isNaN(openingCash) || openingCash < 0 ? 0 : openingCash;

  const [existing] = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.staffId, staffId), isNull(shifts.closedAt)))
    .limit(1);

  if (existing) {
    return { success: true, shiftId: existing.id };
  }

  const [created] = await db
    .insert(shifts)
    .values({
      staffId,
      openedAt: new Date(),
      openingCash: openingCashNum.toFixed(2),
    })
    .returning({ id: shifts.id });

  if (!created) {
    return { success: false, error: "Failed to open shift" };
  }

  return { success: true, shiftId: created.id };
}

export type CloseShiftResult =
  | { success: true; shiftId: string; totalSales: string; discrepancy: string }
  | { success: false; error: string };

export async function closeShift(closingCash: number): Promise<CloseShiftResult> {
  const { staffId } = await requireStaffSession();

  const closingCashNum = isNaN(closingCash) || closingCash < 0 ? 0 : closingCash;

  const [current] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.staffId, staffId), isNull(shifts.closedAt)))
    .limit(1);

  if (!current) {
    return { success: false, error: "لا توجد وردية مفتوحة" };
  }

  const salesRows = await db
    .select({ sum: sql<string>`COALESCE(SUM(${orders.total}::numeric), 0)` })
    .from(orders)
    .where(
      and(
        eq(orders.staffId, staffId),
        gte(orders.createdAt, current.openedAt),
        lte(orders.createdAt, new Date()),
      ),
    );

  const totalSales = salesRows[0]?.sum ?? "0.00";

  const [closed] = await db
    .update(shifts)
    .set({
      closedAt: new Date(),
      closingCash: closingCashNum.toFixed(2),
      totalSales,
    })
    .where(eq(shifts.id, current.id))
    .returning({ id: shifts.id });

  if (!closed) {
    return { success: false, error: "Failed to close shift" };
  }

  const discrepancy = (
    closingCashNum -
    parseFloat(current.openingCash) -
    parseFloat(totalSales)
  ).toFixed(2);

  return {
    success: true,
    shiftId: closed.id,
    totalSales,
    discrepancy,
  };
}

export async function getOpenShift(): Promise<{
  hasOpen: boolean;
  shiftId?: string;
  openedAt?: string;
  openingCash?: string;
} | null> {
  const { staffId } = await requireStaffSession();

  const [current] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.staffId, staffId), isNull(shifts.closedAt)))
    .limit(1);

  if (!current) return { hasOpen: false };

  return {
    hasOpen: true,
    shiftId: current.id,
    openedAt: current.openedAt.toISOString(),
    openingCash: current.openingCash,
  };
}
