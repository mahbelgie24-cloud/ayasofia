/**
 * Global teardown: delete test-created orders/order_items/
 * inventory_moves, restore ingredient stock to pre-suite values.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

loadEnvConfig(process.cwd());

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

interface Snapshot {
  ingredients: Array<{ id: string; stock: string }>;
  maxOrderTimestamp: string | null;
}

async function globalTeardown() {
  const snapPath = resolve(__dirname, "..", "e2e", ".stock-snapshot.json");
  let snapshot: Snapshot;

  try {
    snapshot = JSON.parse(readFileSync(snapPath, "utf-8"));
  } catch {
    console.warn("[globalTeardown] No snapshot found — skipping cleanup.");
    await pool.end();
    return;
  }

  if (snapshot.maxOrderTimestamp) {
    const newOrders = await db.execute(
      sql`SELECT id FROM orders WHERE created_at > ${snapshot.maxOrderTimestamp}`,
    );
    const newIds: string[] = (newOrders.rows as Array<{ id: string }>).map((r) => r.id);

    for (const oid of newIds) {
      await db.execute(sql`DELETE FROM inventory_moves WHERE ref_order_id = ${oid}`);
      await db.execute(sql`DELETE FROM order_items WHERE order_id = ${oid}`);
      await db.execute(sql`DELETE FROM orders WHERE id = ${oid}`);
    }
    console.log(`[globalTeardown] Cleaned up ${newIds.length} orders`);
  }

  for (const ing of snapshot.ingredients) {
    await db.execute(
      sql`UPDATE ingredients SET current_stock = ${ing.stock}::numeric WHERE id = ${ing.id}`,
    );
  }

  console.log(`[globalTeardown] Restored ${snapshot.ingredients.length} ingredients`);
  await pool.end();
}

export default globalTeardown;
