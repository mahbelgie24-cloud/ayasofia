/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * P1-M1 — catalog invalidation integration test.
 *
 * Proves that editing a product PRICE via the admin menu action immediately
 * changes what the public digital-menu catalog returns, i.e. the admin
 * mutation invalidates the 60s per-branch catalog cache synchronously.
 *
 * Requires DATABASE_URL (from .env.local) pointing at a migrated + seeded
 * Postgres (see README "CI seed gate").
 *
 * Self-cleaning: restores the product's original price and removes any audit
 * rows the edit wrote.
 */

import { vi } from "vitest";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

// Fake an authenticated manager session. updateProduct's price path writes a
// priceChanges row keyed by changedBy → staff.id, so we need a REAL staff id.
const session = vi.hoisted(() => ({
  current: { staffId: "", role: "manager" as const },
}));

// Load DATABASE_URL into process.env BEFORE lib/db evaluates (module-load time)
// so the app's own pool uses the test database, matching the phase3 pattern.
await vi.hoisted(async () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const testEnvFile = path.resolve(__dirname, "..", ".env.test.local");
  const envPath = fs.existsSync(testEnvFile)
    ? testEnvFile
    : path.resolve(__dirname, "..", ".env.local");
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
// Step-3 guard: refuse to run against the production project host.
if ((process.env.DATABASE_URL ?? "").includes("aws-0-ap-northeast-1.pooler.supabase.com")) {
  throw new Error(
    `[test-env] REFUSED: DATABASE_URL points at the PRODUCTION project. ` +
      `Use the isolated staging .env.test.local.`,
  );
}

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireStaffSession: vi.fn().mockImplementation(() => Promise.resolve(session.current)),
  };
});

import { updateProduct } from "@/app/(admin)/admin/menu/actions";
import { getPublicCatalog } from "@/lib/db/queries";
import { clearCache } from "@/lib/cache";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { and, eq } from "drizzle-orm";
import { staff, branches, products, priceChanges } from "@/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { staff, branches, products, priceChanges } });

// The product under test — its audit rows are cleaned up after each test.
let editedProductId = "";

beforeAll(async () => {
  const [s] = await db.select({ id: staff.id }).from(staff).limit(1);
  if (!s) throw new Error("seed must have at least one staff row");
  session.current = { staffId: s.id, role: "manager" };
});

afterEach(async () => {
  if (editedProductId) {
    try {
      await db
        .delete(priceChanges)
        .where(
          and(eq(priceChanges.entityId, editedProductId), eq(priceChanges.entityType, "product")),
        );
    } catch {
      /* ignore */
    }
  }
  editedProductId = "";
  clearCache();
});

afterAll(async () => {
  clearCache();
  await pool.end();
});

/** Scale a numeric price to the numeric(10,2) "xx.yy" string Postgres returns. */
function normPrice(v: string): string {
  return (Math.round(parseFloat(v) * 100) / 100).toFixed(2);
}

describe("admin menu mutations invalidate the public catalog (P1-M1)", () => {
  it(
    "a product price edit is served immediately by the public catalog",
    { timeout: 30000 },
    async () => {
      const [branch] = await db.select({ slug: branches.slug }).from(branches).limit(1);
      expect(branch).toBeDefined();

      const [prod] = await db
        .select({ id: products.id, basePrice: products.basePrice })
        .from(products)
        .limit(1);
      expect(prod).toBeDefined();
      editedProductId = prod.id;
      const original = prod.basePrice;

      // Warm the cache — this is what a guest's scan produces.
      const warmed = await getPublicCatalog(branch.slug);
      expect(warmed).not.toBeNull();
      const findIn = (catalog: typeof warmed) => {
        if (!catalog) return undefined;
        for (const cat of catalog.categories) {
          const found = cat.products.find((p) => p.id === prod.id);
          if (found) return found.basePrice;
        }
        return undefined;
      };

      // A price guaranteed different from the current one.
      const currentInCatalog = findIn(warmed);
      const newPrice = normPrice(original) === "7.77" ? "8.88" : "7.77";

      // Edit the price through the ADMIN action.
      const res = await updateProduct({ id: prod.id, basePrice: newPrice });
      expect(res.success).toBe(true);

      // Immediately re-read the public catalog (still inside the 60s TTL). The
      // guest faces a cook of the OLD price and now sees the NEW price — if the
      // admin action had NOT invalidated the cache, this returns a stale value.
      const changed = findIn(await getPublicCatalog(branch.slug));
      expect(changed).not.toBe(currentInCatalog);
      expect(changed).toBe(normPrice(newPrice));

      // Restore the original price so seed data stays intact.
      const restore = await updateProduct({ id: prod.id, basePrice: original });
      expect(restore.success).toBe(true);
    },
  );
});
