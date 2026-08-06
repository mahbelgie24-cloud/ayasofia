#!/usr/bin/env tsx
/**
 * G3 — full local database reset with a pre-destructive backup guard.
 *
 *   npx tsx scripts/reset-db.ts [--ack-backup]
 *
 * Steps (all gated by `ensureBackup` for non-ephemeral DBs):
 *   1. backup  → `pg_dump` into backups/ (unless CI/ephemeral), print restore cmd
 *   2. drop    → DROP public schema, recreate
 *   3. migrate → drizzle-kit migrate (all migrations)
 *   4. seed    → db/seed.ts demo catalog
 *
 * Requires `pg_dump` and the Postgres client on PATH, and DATABASE_URL.
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { execSync } from "node:child_process";
import { ensureBackup, restoreCommand } from "./lib/backup";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL is required.");
    process.exit(1);
  }

  let backupFile: string | null = null;
  try {
    backupFile = await ensureBackup(url, process.argv);
  } catch (e) {
    console.error(`❌ ${(e as Error).message}`);
    process.exit(1);
  }
  if (backupFile) {
    console.log(`💾 نسخة احتياطية: ${backupFile}`);
    console.log(`   الاستعادة: ${restoreCommand(url, backupFile)}`);
  }

  console.log("🧨 إسقاط مخطط public وإعادة إنشائه …");
  execSync(`psql "${url}" -c "DROP SCHEMA public CASCADE;" -c "CREATE SCHEMA public;" 2>&1`);

  console.log("📦 تطبيق الهجرات …");
  execSync("npx drizzle-kit migrate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });

  console.log("🌱 بذر بيانات التجربة …");
  execSync("npx tsx db/seed.ts", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });

  console.log("\n✅ إعادة الضبط اكتملت. (للتحقق: npx vitest run)");
}

main().catch((e) => {
  console.error("❌ فشل إعادة الضبط:", (e as Error).message);
  process.exit(1);
});
