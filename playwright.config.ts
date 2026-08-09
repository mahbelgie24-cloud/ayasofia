import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import { loadTestEnv } from "@/lib/test-env";

// Load the isolated staging credentials (never production .env.local). This
// also asserts DATABASE_URL is not the production project (Step-3 guard).
loadTestEnv();

const baseURL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  retries: 0,
  // H4: run workers serially. The e2e suite places real orders and mutates a
  // shared live Supabase project; parallel workers contend on one dev server
  // and the shared DB, producing intermittent failures that do not reproduce
  // in isolation. A deterministic single-worker launch gate is more valuable
  // than speed.
  workers: 1,
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  use: {
    baseURL,
    headless: true,
  },
  globalSetup: resolve(__dirname, "e2e/global-setup.ts"),
  globalTeardown: resolve(__dirname, "e2e/global-teardown.ts"),
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    // Point the dev server at the isolated local/cloud-staging Supabase (from
    // .env.test.local), NOT production. Without this, `npm run dev` loads
    // .env.local and the app would talk to the production project.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      DATABASE_URL: process.env.DATABASE_URL ?? "",
    },
  },
});
