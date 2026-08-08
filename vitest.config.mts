import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["node_modules", "e2e"],
    // TD-2: integration tests share one Supabase project across files; running
    // them in parallel makes them contend for the same rows (shifts,
    // idempotency keys, RLS state), turning the local suite red. CI's
    // seed-gate sidesteps this by using a fresh migration-only DB; locally
    // we use the shared DB, so we serialize file execution. This matches
    // playwright.config.ts's `workers: 1` posture. Equivalent of the
    // removed-in-v4 `poolOptions.forks.singleFork` is `fileParallelism: false`
    // (a.k.a. `vitest run --no-file-parallelism`).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
} as Parameters<typeof defineConfig>[0]);
