/**
 * Test-environment loader + safety guard (TD-4 final fix).
 *
 * Local integration/e2e runs must NEVER touch the shared production Supabase
 * project. Each local run reads its DB credentials from `.env.test.local`
 * (gitignored, points at the isolated staging project), never from
 * `.env.local` (production).
 *
 * Resolution order:
 *   1. If `process.env.DATABASE_URL` is already set (CI injects it as a job
 *      env var) it is used as-is and NO `.env` file is loaded — CI owns the
 *      value and it is already isolated (fresh migration-only Postgres).
 *   2. Otherwise load `.env.test.local` if present; else fall back to
 *      `.env.local` (so a bare checkout still has a DB to talk to).
 *
 * Step-3 guard: after resolution, if the effective DATABASE_URL host is the
 * known production project host, throw immediately — a future accidental
 * repoint to production becomes impossible to run silently.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Host of the shared production Supabase project (from .env.local). */
export const PRODUCTION_DB_HOST = "aws-0-ap-northeast-1.pooler.supabase.com";

/** Resolve the env file to load: `.env.test.local` preferred, else `.env.local`. */
export function resolveTestEnvFile(dir = process.cwd()): string {
  const testLocal = resolve(dir, ".env.test.local");
  if (existsSync(testLocal)) return testLocal;
  return resolve(dir, ".env.local");
}

/** Parse a `.env`-style file into a plain object (no external deps). */
export function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(filePath)) return out;
  const content = readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (/^(['"])(.*)\1$/.test(value)) value = value.replace(/^(['"])(.*)\1$/, "$2");
    if (value.startsWith("#")) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Load the test DB credentials into process.env (only fills keys not already
 * set, so CI-injected values win). Returns the effective DATABASE_URL.
 */
export function loadTestEnv(dir = process.cwd()): string {
  // CI already injected a (isolated) DATABASE_URL — respect it, no file load.
  if (process.env.DATABASE_URL) {
    assertNotProductionHost(process.env.DATABASE_URL, "injected env");
    return process.env.DATABASE_URL;
  }

  const file = resolveTestEnvFile(dir);
  const parsed = parseEnvFile(file);
  const set = (k: string) => {
    if (!process.env[k] && parsed[k]) process.env[k] = parsed[k];
  };
  set("DATABASE_URL");
  set("NEXT_PUBLIC_SUPABASE_URL");
  set("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  set("SUPABASE_SERVICE_ROLE_KEY");

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      `[test-env] No DATABASE_URL resolved. Loaded "${file}". ` +
        "Create .env.test.local (staging) so local tests never hit production.",
    );
  }
  assertNotProductionHost(url, file);
  return url;
}

/** Step-3 guard: refuse any DATABASE_URL whose host is the production project. */
export function assertNotProductionHost(url: string, source: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    // Not a valid URL — treat as suspect and fail loudly rather than risk prod.
    throw new Error(`[test-env] DATABASE_URL from "${source}" is not a valid postgres URL: ${url}`);
  }
  if (host === PRODUCTION_DB_HOST) {
    throw new Error(
      `[test-env] REFUSED: DATABASE_URL from "${source}" points at the PRODUCTION ` +
        `project (host=${host}). Local tests must use the isolated staging .env.test.local. ` +
        `Aborting to keep production data untouched.`,
    );
  }
}

/**
 * Synchronous loader for use inside `vi.hoisted` blocks (which run before
 * module imports resolve, so they cannot use the `@/` alias or ESM imports).
 * Reads `.env.test.local` (staging) then `.env.local` (fallback) and sets
 * DATABASE_URL/supabase keys into process.env, then applies the production
 * host guard. Returns the effective DATABASE_URL.
 */
export function loadTestEnvSync(dir = process.cwd()): string {
  const file = resolveTestEnvFile(dir);
  const parsed = parseEnvFile(file);
  if (!process.env.DATABASE_URL && parsed.DATABASE_URL) {
    process.env.DATABASE_URL = parsed.DATABASE_URL;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && parsed.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = parsed.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && parsed.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = parsed.SUPABASE_SERVICE_ROLE_KEY;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      `[test-env] No DATABASE_URL resolved from "${file}". Create .env.test.local (staging).`,
    );
  }
  assertNotProductionHost(url, file);
  return url;
}
