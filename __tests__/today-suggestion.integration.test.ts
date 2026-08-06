/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * P2-DAT-1 — setTodaySuggestion is atomic.
 *
 * The deactivate-all + insert must run in one transaction: if the insert fails
 * (here: a productId that does not exist → FK violation), the deactivation is
 * rolled back and the previously-active suggestion is restored (not lost).
 */
import { vi } from "vitest";
import { describe, it, expect, afterAll, afterEach, beforeEach } from "vitest";

const authSession = vi.hoisted(() => ({
  current: { staffId: "s1", role: "manager" as const },
}));
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireStaffSession: vi.fn().mockImplementation(() => Promise.resolve(authSession.current)),
  };
});

await vi.hoisted(async () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const envPath = path.resolve(__dirname, "..", ".env.local");
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^(\w+)=(.*)$/);
      if (match && match[1] === "DATABASE_URL") {
        process.env.DATABASE_URL = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* ignore */
  }
});

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc } from "drizzle-orm";
import { todaySuggestion, products } from "@/db/schema";
import { setTodaySuggestion } from "@/app/(admin)/admin/digital-menu/actions";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { todaySuggestion, products } });

let createdSuggestionIds: string[] = [];

beforeEach(() => {
  createdSuggestionIds = [];
});

afterEach(async () => {
  for (const id of createdSuggestionIds) {
    try {
      await db.delete(todaySuggestion).where(eq(todaySuggestion.id, id));
    } catch {
      /* */
    }
  }
});

afterAll(async () => {
  await pool.end();
});

describe("setTodaySuggestion is atomic (P2-DAT-1)", () => {
  it(
    "an insert failure restores the previously-active suggestion",
    { timeout: 30000 },
    async () => {
      // A real product + a prior active suggestion.
      const [prod] = await db.select({ id: products.id }).from(products).limit(1);
      expect(prod).toBeDefined();

      // Deactivate anything currently active so the set-up is deterministic.
      await db.update(todaySuggestion).set({ isActive: false });
      const [prior] = await db
        .insert(todaySuggestion)
        .values({ productId: prod.id, titleAr: "قبل الفشل", isActive: true })
        .returning({ id: todaySuggestion.id });
      createdSuggestionIds.push(prior.id);

      // Suspicious productId that does not exist → the insert violates the FK
      // and must roll the WHOLE transaction back (including the deactivation).
      const bogus = "00000000-0000-4000-8000-000000000000";
      await expect(setTodaySuggestion({ productId: bogus })).rejects.toThrow();

      // The previously-active suggestion must still be active (not lost).
      const [row] = await db
        .select({ isActive: todaySuggestion.isActive })
        .from(todaySuggestion)
        .where(eq(todaySuggestion.id, prior.id))
        .limit(1);
      expect(row?.isActive).toBe(true);

      // No row for the bogus product was created.
      const bogusRows = await db
        .select({ id: todaySuggestion.id })
        .from(todaySuggestion)
        .where(eq(todaySuggestion.productId, bogus))
        .orderBy(desc(todaySuggestion.createdAt))
        .limit(1);
      expect(bogusRows).toHaveLength(0);
    },
  );
});
