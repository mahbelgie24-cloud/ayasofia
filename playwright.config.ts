import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";

loadEnvConfig(process.cwd());

const baseURL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  retries: 0,
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
