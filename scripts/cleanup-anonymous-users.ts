#!/usr/bin/env -S npx tsx
/**
 * Anonymous Supabase Auth User Cleanup
 *
 * Deletes stale anonymous auth.users rows that are NOT linked to any
 * staff member.  Runs as a maintenance job, not as a request handler.
 *
 * NEVER imports this module into client-side code.
 *
 * Usage:
 *   npx tsx scripts/cleanup-anonymous-users.ts            # dry-run
 *   npx tsx scripts/cleanup-anonymous-users.ts --execute  # real deletion
 *   ANONYMOUS_USER_MAX_AGE_HOURS=48 npx tsx scripts/cleanup-anonymous-users.ts --execute
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL        — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY       — service-role key (NEVER expose)
 *   ANONYMOUS_USER_MAX_AGE_HOURS    — retention, default 24
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";

// ── Config ──

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const RAW_HOURS = process.env.ANONYMOUS_USER_MAX_AGE_HOURS;
const MAX_AGE_HOURS = parseRetention(RAW_HOURS);
const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;

const DRY_RUN = !process.argv.includes("--execute");

// ── Helpers ──

function parseRetention(raw: string | undefined): number {
  if (!raw) return 24;
  const n = parseInt(raw, 10);
  if (!isFinite(n) || n <= 0) {
    console.error(
      `Invalid ANONYMOUS_USER_MAX_AGE_HOURS="${raw}" — must be a positive integer. Falling back to 24.`,
    );
    return 24;
  }
  return n;
}

function redact(uuid: string): string {
  return uuid.slice(0, 6) + "***";
}

// ── Main ──

async function main(): Promise<void> {
  console.log(
    `\n🧹 Anonymous User Cleanup — ${DRY_RUN ? "DRY-RUN (no deletions)" : "EXECUTE MODE"}`,
  );
  console.log(
    `   Retention: ${MAX_AGE_HOURS}h (cutoff older than ${new Date(Date.now() - MAX_AGE_MS).toISOString()})\n`,
  );

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 1: Build the set of staff-linked auth_user_id values.
  // We query the staff table for all non-null auth_user_id values so
  // that we NEVER delete a user linked to a staff member.
  let staffLinkedIds: Set<string>;
  try {
    const { data: staffRows, error: staffErr } = await supabase
      .from("staff")
      .select("auth_user_id")
      .not("auth_user_id", "is", null);

    if (staffErr) {
      console.error("❌ Failed to query staff table — aborting (fail-closed).");
      console.error("  ", staffErr.message);
      process.exit(1);
    }

    staffLinkedIds = new Set((staffRows ?? []).map((r) => r.auth_user_id as string));
    console.log(`   Staff-linked user IDs loaded: ${staffLinkedIds.size}`);
  } catch (err) {
    console.error("❌ Exception querying staff table — aborting (fail-closed).");
    console.error("  ", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Step 2: Paginate through all auth users.
  const cutoff = new Date(Date.now() - MAX_AGE_MS);

  let totalInspected = 0;
  let eligible = 0;
  let deleted = 0;
  let deleteFailures = 0;
  let page = 1;
  let morePages = true;

  while (morePages) {
    let pageUsers;
    try {
      const result = await supabase.auth.admin.listUsers({ page, perPage: 100 });

      if (result.error) {
        console.error(`❌ Failed to list users on page ${page} — aborting.`);
        console.error("  ", result.error.message);
        process.exit(1);
      }

      pageUsers = result.data?.users ?? [];
    } catch (err) {
      console.error(`❌ Exception listing users on page ${page} — aborting.`);
      console.error("  ", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    if (pageUsers.length === 0) {
      morePages = false;
      break;
    }

    totalInspected += pageUsers.length;

    for (const user of pageUsers) {
      // Safety checks — ALL must pass for this user to be eligible:

      // 1. Must be marked anonymous
      if (user.is_anonymous !== true) continue;

      // 2. Must be older than cutoff
      const createdAt = new Date(user.created_at);
      if (isNaN(createdAt.getTime())) continue;
      if (createdAt >= cutoff) continue;

      // 3. Must NOT be linked via staff.auth_user_id
      if (staffLinkedIds.has(user.id)) continue;

      // 4. Must NOT have staff_id in app_metadata
      const appMeta = user.app_metadata as Record<string, unknown> | undefined;
      if (appMeta && typeof appMeta.staff_id === "string" && appMeta.staff_id.length > 0) {
        continue;
      }

      // 5. Email/phone presence suggests a non-anonymous account — skip
      if (user.email || user.phone) continue;

      eligible++;

      if (!DRY_RUN) {
        try {
          const delResult = await supabase.auth.admin.deleteUser(user.id);
          if (delResult.error) {
            console.error(`   ⚠️  Failed to delete ${redact(user.id)}: ${delResult.error.message}`);
            deleteFailures++;
          } else {
            deleted++;
          }
        } catch (err) {
          console.error(
            `   ⚠️  Exception deleting ${redact(user.id)}: ${err instanceof Error ? err.message : String(err)}`,
          );
          deleteFailures++;
        }
      }
    }

    page++;
    // Safety: if we somehow process > 10,000 pages, something is wrong
    if (page > 10000) {
      console.error("❌ Pagination exceeded 10,000 pages — aborting.");
      process.exit(1);
    }
  }

  console.log(`\n   Total inspected: ${totalInspected} users across ~${page - 1} pages`);
  console.log(`   Eligible (would delete): ${eligible}`);
  if (!DRY_RUN) {
    console.log(`   Deleted: ${deleted}`);
    if (deleteFailures > 0) {
      console.log(`   Delete failures: ${deleteFailures}`);
    }
  }
  console.log(`   Staff-linked (protected): ${staffLinkedIds.size}`);

  if (!DRY_RUN && deleteFailures > 0) {
    console.error("\n❌ Cleanup completed with errors — some deletions failed.");
    process.exit(1);
  }

  if (!DRY_RUN) {
    console.log("\n✅ Cleanup completed successfully.");
  } else {
    console.log(
      "\n✅ Dry-run completed — no users were deleted. Use --execute to perform deletions.",
    );
  }
}

main().catch((err) => {
  console.error("❌ Unhandled error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
