import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["node_modules", "e2e"],
    // isolation: load .env.test.local (staging) + assert the resolved
    // DATABASE_URL is not the production project, before any test runs.
    globalSetup: [path.resolve(__dirname, "vitest.setup.ts")],
    // TD-2: integration tests share one Supabase project across files; running
    // them in parallel makes them contend for the same rows (shifts,
    // idempotency keys, RLS state), turning the local suite red. CI's
    // seed-gate sidesteps this by using a fresh migration-only DB; locally
    // we use the shared DB, so we serialize file execution. This matches
    // playwright.config.ts's `workers: 1` posture. Equivalent of the
    // removed-in-v4 `poolOptions.forks.singleFork` is `fileParallelism: false`
    // (a.k.a. `vitest run --no-file-parallelism`).
    fileParallelism: false,
    // T2: coverage tooling. `npm run test:coverage` reports lines/branches/
    // functions/statements across the app+lib source. Integration tests hit
    // the real DB when the local stack is up; thresholds are intentionally
    // not enforced as a CI gate yet — the number is reported, not weaponized.
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "db/**/*.ts"],
      exclude: ["**/*.d.ts", "app/**/page.tsx", "app/**/layout.tsx", "coverage/**"],
      reporter: ["text", "text-summary", "lcov"],
      reportsDirectory: "coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
} as Parameters<typeof defineConfig>[0]);
