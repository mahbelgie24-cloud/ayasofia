#!/usr/bin/env node
/**
 * T-C2 — client bundle budget gate.
 *
 * Next 16 (Turbopack) no longer prints per-route "First Load JS" in the build
 * summary, so this script gates on a robust proxy: the WORST-CASE single client
 * chunk (gzipped) must stay under the budget (default 150 KB). A runaway inline
 * dependency (e.g. importing a huge library into a page chunk) will blow past it
 * and fail CI, which is exactly the regression this guard exists to catch.
 *
 * Usage:  node scripts/bundle-budget.mjs [budgetBytes=150000]
 * Run AFTER `next build`. Reads the built chunks in .next/static/chunks.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const CHUNKS_DIR = join(".next", "static", "chunks");
const budgetBytes = Number(process.argv[2] ?? 150_000);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

let chunks = [];
try {
  chunks = walk(CHUNKS_DIR);
} catch {
  console.error(`bundle-budget: could not read ${CHUNKS_DIR} — did you run \`next build\` first?`);
  process.exit(1);
}

const sized = chunks
  .map((p) => ({ p, gz: gzipSync(readFileSync(p)).byteLength }))
  .sort((a, b) => b.gz - a.gz);

const largest = sized[0];
const total = sized.reduce((s, c) => s + c.gz, 0);

console.log(
  `chunks=${sized.length} total_gzip=${(total / 1024).toFixed(1)} KB worst_gzip=${(
    (largest?.gz ?? 0) / 1024
  ).toFixed(1)} KB budget=${budgetBytes / 1024} KB`,
);

if (largest && largest.gz > budgetBytes) {
  console.error(
    `bundle-budget: FAIL — largest chunk ${largest.p} is ${(largest.gz / 1024).toFixed(1)} KB gzip ` +
      `(budget ${budgetBytes / 1024} KB). A per-route import grew too large.`,
  );
  process.exit(1);
}

console.log("bundle-budget: OK");
