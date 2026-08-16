/**
 * Launch-gate environment validation (audit finding C5/TD-15).
 *
 * Referenced from `.env.example` ("يُستخدم بواسطة scripts/validate-env.ts")
 * and wired into the Release workflow. Two strictness levels:
 *
 *   - default (local/CI): the four required variables must be PRESENT.
 *     Placeholder values are fine — CI builds with placeholders.
 *   - RUN_ENV=production: values are also sanity-checked (https URL,
 *     postgres scheme, JWT-shaped keys, real wifi salt, connection_limit
 *     hint). Anything that would silently misconfigure a production
 *     deployment fails the build.
 *
 * Exit code 0 = OK (warnings allowed), 1 = errors.
 */

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
] as const;

const errors: string[] = [];
const warnings: string[] = [];

for (const key of REQUIRED) {
  const value = process.env[key];
  if (!value || !value.trim()) {
    errors.push(`${key} is required (see .env.example)`);
  }
}

const runEnv = process.env.RUN_ENV;
if (runEnv && !["staging", "production"].includes(runEnv)) {
  errors.push(`RUN_ENV must be "staging" or "production" (got "${runEnv}")`);
}
const isProduction = runEnv === "production";

if (isProduction) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    if (new URL(url).protocol !== "https:") {
      errors.push("NEXT_PUBLIC_SUPABASE_URL must use https in production");
    }
  } catch {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
  }

  const db = process.env.DATABASE_URL ?? "";
  if (!db.startsWith("postgresql://") && !db.startsWith("postgres://")) {
    errors.push("DATABASE_URL must be a postgres:// or postgresql:// connection string");
  }
  if (!db.includes("connection_limit=")) {
    warnings.push(
      "DATABASE_URL has no connection_limit — production should use the pooler with connection_limit=10 (P2-PERF-3)",
    );
  }

  // Supabase keys are long JWTs (header.payload.signature). Placeholders and
  // truncated pastes are shorter than any real key.
  for (const key of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const value = process.env[key] ?? "";
    if (value.length < 100 || value.split(".").length !== 3) {
      errors.push(`${key} does not look like a Supabase JWT (expected header.payload.signature)`);
    }
  }

  const salt = process.env.WIFI_DEVICE_ID_SALT;
  if (!salt || salt.length < 16 || salt === "change-me") {
    errors.push(
      "WIFI_DEVICE_ID_SALT is required in production (≥16 chars) — the dev fallback salt must never ship (KNOWN_ISSUES P1-M10)",
    );
  }
} else if (!process.env.WIFI_DEVICE_ID_SALT) {
  warnings.push(
    "WIFI_DEVICE_ID_SALT not set — using the public dev fallback (fine locally, never in production)",
  );
}

for (const warning of warnings) {
  console.warn(`[env] WARN: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[env] ERROR: ${error}`);
  }
  console.error(`[env] validation failed (${errors.length} error${errors.length > 1 ? "s" : ""})`);
  process.exit(1);
}

console.log(
  `[env] OK — required variables present${isProduction ? " and production checks passed" : ""}${
    warnings.length > 0 ? ` (${warnings.length} warning${warnings.length > 1 ? "s" : ""})` : ""
  }`,
);
