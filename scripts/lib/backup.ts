#!/usr/bin/env tsx
/**
 * G3 — pre-destructive backup hardening.
 *
 * Any reset/ingest tool that mutates a NON-ephemeral database must first
 * produce a plain `pg_dump` artifact into the git-ignored `backups/` folder,
 * unless the operator explicitly acknowledges. The ephemeral CI database
 * (`postgresql://postgres:postgres@localhost:5432/ayasofia_test`) never needs
 * a backup.
 *
 * Acknowledgement is either `BACKUP_ALLOWED=true` in the environment or the
 * `--ack-backup` CLI flag. On every run a restore command is printed.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const execFileP = promisify(execFile);

// The ephemeral DB CI spins up per run — no backup needed there.
const CI_EPHEMERAL_RE = /^postgresql:\/\/postgres:postgres@localhost:5432\/ayasofia_test/;

/**
 * @returns the backup file path, or `null` when no backup is required (CI-only).
 * @throws an explanatory error (before ANY DB change) when a non-ephemeral DB
 *         is targeted without acknowledgement.
 */
export async function ensureBackup(
  url: string | undefined,
  argv: string[] = process.argv,
): Promise<string | null> {
  const isCi = process.env.CI === "true" || (url ? CI_EPHEMERAL_RE.test(url) : false);
  if (isCi) return null;

  const acked = process.env.BACKUP_ALLOWED === "true" || argv.includes("--ack-backup");
  if (!acked) {
    throw new Error(
      "Destructive operation against a NON-ephemeral database. " +
        "Set BACKUP_ALLOWED=true or pass --ack-backup to first produce an " +
        "automatic pg_dump into backups/. Nothing was changed.",
    );
  }

  if (!url) throw new Error("DATABASE_URL is required for backup.");
  const dir = resolve(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(dir, `dump_${stamp}.sql`);

  // Plain SQL format (default) so restore is simply `psql "$DATABASE_URL" -f <file>`.
  // --no-owner/--no-privileges keep the dump portable to the same Supabase role.
  await execFileP("pg_dump", ["--no-owner", "--no-privileges", "-f", file, url], {
    maxBuffer: 64 * 1024 * 1024,
  });

  return file;
}

/** One-line restore guidance for the operator. */
export function restoreCommand(url: string | undefined, file: string): string {
  return `psql "${url}" -f "${file}"   # restore the ${basename(file)} backup`;
}
