import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";

loadEnvConfig(process.cwd());

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
  },
});
