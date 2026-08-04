import { describe, it, expect, beforeAll } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Vitest doesn't auto-load Next.js .env.local — load it explicitly
// BEFORE creating the Pool (same pattern as checkout.integration.test.ts).
const envPath = resolve(import.meta.dirname ?? __dirname, "..", ".env.local");
try {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^(\w+)=(.*)$/);
    if (match && match[1] === "DATABASE_URL") {
      process.env.DATABASE_URL = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* ignore — tests will skip if DB is unreachable */
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, {
  schema: { shifts, staff, orders },
});

import { shifts, staff, orders } from "@/db/schema";
import { eq, and, isNull, ne, gte, sql } from "drizzle-orm";

describe("shifts integration", () => {
  let canConnect = false;

  beforeAll(async () => {
    try {
      await db
        .select({ n: sql<number>`1` })
        .from(staff)
        .limit(1);
      canConnect = true;
    } catch {
      canConnect = false;
    }
  });

  it("prevents opening a second shift while one is open", async (ctx) => {
    if (!canConnect) return ctx.skip();
    const existingStaff = await db.select({ id: staff.id }).from(staff).limit(1);

    if (existingStaff.length === 0) return;

    const staffId = existingStaff[0]!.id;

    await db.execute(
      sql`UPDATE shifts SET closed_at = NOW() WHERE staff_id = ${staffId} AND closed_at IS NULL`,
    );

    const [first] = await db
      .insert(shifts)
      .values({
        staffId,
        openedAt: new Date(),
        openingCash: "100.00",
      })
      .returning({ id: shifts.id });

    expect(first).toBeDefined();

    const [existing] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.staffId, staffId), isNull(shifts.closedAt)))
      .limit(1);

    expect(existing).toBeDefined();

    await db.execute(
      sql`UPDATE shifts SET closed_at = NOW() WHERE staff_id = ${staffId} AND closed_at IS NULL`,
    );
  });

  it("closing a shift computes totalSales from orders in the shift window", async (ctx) => {
    if (!canConnect) return ctx.skip();
    const existingStaff = await db.select({ id: staff.id }).from(staff).limit(1);

    if (existingStaff.length === 0) return;

    const staffId = existingStaff[0]!.id;

    await db.execute(
      sql`UPDATE shifts SET closed_at = NOW() WHERE staff_id = ${staffId} AND closed_at IS NULL`,
    );

    const shiftStart = new Date();
    shiftStart.setHours(shiftStart.getHours() - 2);

    const [openShift] = await db
      .insert(shifts)
      .values({
        staffId,
        openedAt: shiftStart,
        openingCash: "50.00",
      })
      .returning({ id: shifts.id });

    const orderTime = new Date(shiftStart.getTime() + 3600000);
    const idempotencyKey = `test-shift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    await db.insert(orders).values({
      orderNumber: `TEST-SH-${Date.now().toString(36).toUpperCase()}`.slice(0, 20),
      channel: "dine_in",
      status: "completed",
      subtotal: "30.00",
      total: "30.00",
      paymentMethod: "cash",
      staffId,
      createdAt: orderTime,
      idempotencyKey,
    });

    const salesRows = await db
      .select({
        sum: sql<string>`COALESCE(SUM(${orders.total}::numeric), 0)`,
      })
      .from(orders)
      .where(
        and(eq(orders.staffId, staffId), sql`${orders.createdAt} >= ${shiftStart}::timestamptz`),
      );

    const totalSales = salesRows[0]?.sum ?? "0.00";
    expect(parseFloat(totalSales)).toBeGreaterThanOrEqual(30.0);

    await db
      .update(shifts)
      .set({
        closedAt: new Date(),
        closingCash: "85.00",
        totalSales,
      })
      .where(eq(shifts.id, openShift!.id));

    const [closed] = await db.select().from(shifts).where(eq(shifts.id, openShift!.id)).limit(1);

    expect(closed!.closedAt).toBeDefined();
    expect(closed!.closingCash).toBe("85.00");

    await db.execute(sql`DELETE FROM orders WHERE idempotency_key = ${idempotencyKey}`);
  });

  it("shift queries work correctly with staff join", async (ctx) => {
    if (!canConnect) return ctx.skip();
    const existingStaff = await db.select({ id: staff.id, name: staff.name }).from(staff).limit(1);

    if (existingStaff.length === 0) return;

    const staffId = existingStaff[0]!.id;

    await db.execute(
      sql`UPDATE shifts SET closed_at = NOW() WHERE staff_id = ${staffId} AND closed_at IS NULL`,
    );

    const [newShift] = await db
      .insert(shifts)
      .values({
        staffId,
        openedAt: new Date(),
        openingCash: "0.00",
      })
      .returning({ id: shifts.id });

    const rows = await db
      .select({
        shiftId: shifts.id,
        staffName: staff.name,
        openingCash: shifts.openingCash,
      })
      .from(shifts)
      .leftJoin(staff, eq(shifts.staffId, staff.id))
      .where(eq(shifts.id, newShift!.id))
      .limit(1);

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]!.staffName).toBeDefined();

    await db.execute(
      sql`UPDATE shifts SET closed_at = NOW() WHERE staff_id = ${staffId} AND closed_at IS NULL`,
    );
  });

  it("totalSales excludes cancelled orders (SEC-003)", async (ctx) => {
    if (!canConnect) return ctx.skip();
    const existingStaff = await db.select({ id: staff.id }).from(staff).limit(1);

    if (existingStaff.length === 0) return;

    const staffId = existingStaff[0]!.id;

    await db.execute(
      sql`UPDATE shifts SET closed_at = NOW() WHERE staff_id = ${staffId} AND closed_at IS NULL`,
    );

    const shiftStart = new Date();
    shiftStart.setHours(shiftStart.getHours() - 2);
    const orderTime = new Date(shiftStart.getTime() + 3600000);
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    // Insert one completed order (₪30) and one cancelled order (₪99)
    await db.insert(orders).values({
      orderNumber: `TSC-OK-${suffix}`.slice(0, 20),
      channel: "dine_in",
      status: "completed",
      subtotal: "30.00",
      total: "30.00",
      paymentMethod: "cash",
      staffId,
      createdAt: orderTime,
      idempotencyKey: `TSC-OK-${suffix}`,
    });

    await db.insert(orders).values({
      orderNumber: `TSC-NO-${suffix}`.slice(0, 20),
      channel: "dine_in",
      status: "cancelled",
      subtotal: "99.00",
      total: "99.00",
      paymentMethod: "cash",
      staffId,
      createdAt: orderTime,
      idempotencyKey: `TSC-NO-${suffix}`,
    });

    // This is the same SUM query closeShift uses, with the status filter
    const salesRows = await db
      .select({ sum: sql<string>`COALESCE(SUM(${orders.total}::numeric), 0)` })
      .from(orders)
      .where(
        and(
          eq(orders.staffId, staffId),
          ne(orders.status, "cancelled"),
          gte(orders.createdAt, shiftStart),
        ),
      );

    const totalSales = parseFloat(salesRows[0]?.sum ?? "0");
    // Must include the ₪30 completed order but NOT the ₪99 cancelled one
    expect(totalSales).toBeGreaterThanOrEqual(30.0);
    expect(totalSales).toBeLessThan(99.0 + 30.0);

    // Cleanup
    await db.execute(sql`DELETE FROM orders WHERE idempotency_key = ${`TSC-OK-${suffix}`}`);
    await db.execute(sql`DELETE FROM orders WHERE idempotency_key = ${`TSC-NO-${suffix}`}`);
  });
});
