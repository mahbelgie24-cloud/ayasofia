/**
 * Global setup: snapshot every ingredient's currentStock and the latest
 * order creation timestamp before the Playwright suite runs.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

loadEnvConfig(process.cwd());

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function globalSetup() {
  const ingRows = await db.execute(sql`SELECT id, current_stock FROM ingredients ORDER BY id`);
  const ingredients: Array<{ id: string; stock: string }> = (
    ingRows.rows as Array<{ id: string; current_stock: string }>
  ).map((r) => ({ id: r.id, stock: r.current_stock }));

  const maxResult = await db.execute(sql`SELECT max(created_at) as max_ts FROM orders`);
  const maxTs = (maxResult.rows as Array<{ max_ts: string | null }>)[0]?.max_ts;

  const snapshot = { ingredients, maxOrderTimestamp: maxTs };
  const outPath = resolve(__dirname, "..", "e2e", ".stock-snapshot.json");
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`[globalSetup] Snapshot saved: ${ingredients.length} ingredients, ts=${maxTs}`);

  await pool.end();
}

export default globalSetup;
