// CI helper: make the vanilla postgres:16-alpine test service Supabase-shaped
// so the drizzle migrations apply. Supabase ships these objects out of the
// box; the plain Docker image does not, and migrations would otherwise fail on
// `CREATE POLICY ... TO authenticated` / `auth.jwt()`.
//
// Creates (idempotently):
//   1. the `authenticated` role referenced by the RLS policies, and
//   2. the `auth` schema + `auth.jwt()` function used by the policy USING
//      clause in db/migrations/0003_replace_rls_policies.sql (the JWT-claim
//      gate that lets staff read live orders).
//
// Run BEFORE `drizzle-kit migrate`. No-op when already present.
//
// Usage:  node .github/ci-ensure-role.mjs
// Env:    DATABASE_URL (superuser connection, e.g. the postgres user)

import { Client } from "pg";

const AUTH_SCHEMA = `CREATE SCHEMA IF NOT EXISTS auth;`;

// Mirrors Supabase's auth.jwt(). Returns the current role's JWT claims as
// jsonb; safe cast to '{}' when the request carries no token (anonymous).
const AUTH_JWT_FN = `
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb;
$$;
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
    END
    $$;
  `);
  await client.query(AUTH_SCHEMA);
  await client.query(AUTH_JWT_FN);
  await client.end();
  console.log("OK: authenticated role + auth.jwt() guaranteed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
