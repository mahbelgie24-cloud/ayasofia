/**
 * G2 — archive-when-orders-exist ingest branch, fully ISOLATED.
 *
 * ingest-real-menu REPLACES the catalog, so this destructive scenario must
 * never run against the shared/dev DB. It runs against a throwaway database
 * (on the same server as `INGEST_TEST_DATABASE_URL`) that it creates, migrates,
 * seeds, exercises, and drops. It is SKIPPED unless `INGEST_TEST_DATABASE_URL`
 * is set (e.g. pointing at a local Docker Postgres for verification).
 *
 *   INGEST_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres \
 *   npx vitest run __tests__/ingest-archive.integration.test.ts
 *
 * Asserts: referenced products are ARCHIVED (not hard-deleted), order history
 * stays readable, the new catalog is live, a re-run is a no-op, and a price
 * edit lands.
 */
import { vi } from "vitest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const { TestPool, TestClient } = vi.hoisted(() => {
  // Node 22 ESM: pull pg via require (the test config loads .env.local).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("pg") as typeof import("pg");
  return { TestPool: mod.Pool, TestClient: mod.Client };
});

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql, eq } from "drizzle-orm";
import {
  branches,
  categories,
  products,
  ingredients,
  recipes,
  orders,
  orderItems,
} from "@/db/schema";
import { ingestIntoDb, type RealMenu } from "@/scripts/ingest-real-menu";

const SERVER_URL = process.env.INGEST_TEST_DATABASE_URL;

const describeScoped = SERVER_URL ? describe : describe.skip;

function menuWith({ nameAr, priceILS }: { nameAr: string; priceILS: number }): RealMenu {
  return {
    branch: { slug: "qalqilya", name_ar: "أياسوفيا" },
    ingredients: [{ name_ar: "شاي أسود", unit: "ml", currentStock: 1000, reorderAt: 100 }],
    categories: [{ key: "tea", name_ar: "شاي", sort: 1 }],
    products: [
      {
        name_ar: nameAr,
        priceILS,
        category: "tea",
        recipe: [{ ingredient: "شاي أسود", qty: 200 }],
      },
    ],
    tables: [],
  };
}

let scratchDbName = "";
let adminPool: InstanceType<typeof TestPool> | null = null;
let scratchPool: InstanceType<typeof TestPool> | null = null;

describeScoped("G2 — archive-when-orders-exist ingest (isolated)", () => {
  beforeAll(async () => {
    // Connect to the SERVER (the admin DB), create a scratch DB, migrate + seed it.
    scratchDbName = `ayasofia_g2_${randomUUID().slice(0, 8)}`;
    const admin = new TestClient({ connectionString: SERVER_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${scratchDbName}"`);
    await admin.end();

    const scratchUrl = new URL(SERVER_URL!);
    scratchUrl.pathname = `/${scratchDbName}`;
    adminPool = new TestPool({ connectionString: scratchUrl.toString() });
    const scratchDb = drizzle(adminPool);

    // Mint the Supabase-shaped objects the migrations reference (vanilla
    // Postgres lacks them) — mirrors .github/ci-ensure-role.mjs.
    const boot = new TestClient({ connectionString: scratchUrl.toString() });
    await boot.connect();
    await boot.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
      END $$;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
      LANGUAGE sql STABLE AS $$ SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb; $$;
    `);
    await boot.end();

    await migrate(scratchDb, { migrationsFolder: "./db/migrations" });

    // Minimal seed: branch + category + ingredient + two products (with recipes).
    await scratchDb.insert(branches).values({ name: "أياسوفيا", slug: "qalqilya" });
    await scratchDb.insert(categories).values({ nameAr: "شاي", nameEn: "tea", sortOrder: 1 });
    const [tea] = await scratchDb
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.nameEn, "tea"))
      .limit(1);
    await scratchDb
      .insert(ingredients)
      .values({
        name: "شاي أسود",
        unit: "ml",
        currentStock: "1000",
        reorderThreshold: "100",
        costPerUnit: "0",
      });
    const [ing] = await scratchDb
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.name, "شاي أسود"))
      .limit(1);

    const [prodA] = await scratchDb
      .insert(products)
      .values({
        nameAr: "منتج أ",
        nameEn: "product-a",
        categoryId: tea!.id,
        basePrice: "10.00",
        isAvailable: true,
      })
      .returning({ id: products.id });
    const [prodB] = await scratchDb
      .insert(products)
      .values({
        nameAr: "منتج ب",
        nameEn: "product-b",
        categoryId: tea!.id,
        basePrice: "12.00",
        isAvailable: true,
      })
      .returning({ id: products.id });
    await scratchDb
      .insert(recipes)
      .values({ productId: prodA.id, ingredientId: ing.id, quantityUsed: "200" });
    await scratchDb
      .insert(recipes)
      .values({ productId: prodB.id, ingredientId: ing.id, quantityUsed: "200" });

    // Two historical orders referencing the two products (with snapshots).
    const mkOrder = async (productId: string, num: string) => {
      const [o] = await scratchDb
        .insert(orders)
        .values({
          orderNumber: num,
          channel: "takeaway",
          status: "completed",
          subtotal: "10.00",
          tax: "0.00",
          discount: "0.00",
          total: "10.00",
          paymentMethod: "cash",
          idempotencyKey: `g2-${randomUUID()}`,
        })
        .returning({ id: orders.id });
      await scratchDb.insert(orderItems).values({
        orderId: o.id,
        productId,
        selectedModifiers: [
          { modifierId: "m1", nameAr: "لقطات", nameEn: "Snap", priceDelta: "0.00" },
        ],
        quantity: 1,
        unitPrice: "10.00",
      });
    };
    await mkOrder(prodA.id, "G2-ORDER-A");
    await mkOrder(prodB.id, "G2-ORDER-B");
  });

  it("archives referenced products (not hard-deleted), keeps history, ships the new catalog; re-run is a no-op; price edit lands", async () => {
    const url = new URL(SERVER_URL!);
    url.pathname = `/${scratchDbName}`;
    scratchPool = new TestPool({ connectionString: url.toString() });
    const db = drizzle(scratchPool);

    const referencedBefore = await db
      .select({ id: products.id, nameAr: products.nameAr, isAvailable: products.isAvailable })
      .from(products)
      .where(sql`${products.isAvailable} = true`);
    expect(referencedBefore.map((p) => p.nameAr).sort()).toEqual(["منتج أ", "منتج ب"]);

    // Run ingest with a NEW menu (replaces catalog with a single new product).
    const s1 = await ingestIntoDb(menuWith({ nameAr: "منتج جديد", priceILS: 15 }), db);
    expect(s1.archivedProducts).toBe(2);

    // Old products ARCHIVED, not deleted; history readable.
    const allProds = await db.select().from(products);
    const a = allProds.find((p) => p.nameAr === "منتج أ");
    const b = allProds.find((p) => p.nameAr === "منتج ب");
    const fresh = allProds.find((p) => p.nameAr === "منتج جديد");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.isAvailable).toBe(false);
    expect(b!.isAvailable).toBe(false);
    expect(fresh).toBeDefined();
    expect(fresh!.isAvailable).toBe(true);

    const orderRows = await db.select().from(orders);
    expect(orderRows.length).toBe(2);
    const items = await db.select().from(orderItems);
    expect(items.length).toBe(2);
    expect(items.some((i) => i.productId === a!.id)).toBe(true);
    expect(items.some((i) => i.productId === b!.id)).toBe(true);

    // Re-run SAME file → no-op (still exactly 1 live product; 2 archived).
    const s2 = await ingestIntoDb(menuWith({ nameAr: "منتج جديد", priceILS: 15 }), db);
    const liveProds2 = await db
      .select({ id: products.id })
      .from(products)
      .where(sql`${products.isAvailable} = true`);
    const archived2 = await db
      .select({ id: products.id })
      .from(products)
      .where(sql`${products.isAvailable} = false`);
    expect(liveProds2.length).toBe(1);
    expect(archived2.length).toBe(2);
    void s2;

    // Price edit → new live product reflects the new price.
    await ingestIntoDb(menuWith({ nameAr: "منتج جديد", priceILS: 18 }), db);
    const [newProd] = await db
      .select({ basePrice: products.basePrice })
      .from(products)
      .where(sql`${products.nameAr}='منتج جديد' AND ${products.isAvailable} = true`)
      .limit(1);
    expect(newProd?.basePrice).toBe("18.00");
  });

  afterAll(async () => {
    await scratchPool?.end();
    await adminPool?.end();
    const admin = new TestClient({ connectionString: SERVER_URL });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${scratchDbName}" WITH (FORCE)`);
    await admin.end();
  });
});
