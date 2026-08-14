// Header consistency check — captures the top 200px of each primary
// surface so we can compare against the brand-kit reference's web-header
// treatment (small icon + bold wordmark, ink on white, no glass/blur).
//
// Reads-only: writes PNGs into docs/design-review/header-check/. No code
// outside that directory is touched.

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "docs/design-review/header-check");

const VIEWPORTS = {
  desktop: { width: 1440, height: 200 },
};

const SURFACES = [
  { name: "pos-header", path: "/pos", auth: "manager" },
  { name: "drive-thru-header", path: "/drive-thru", auth: "manager" },
  { name: "admin-header", path: "/admin", auth: "manager" },
  { name: "m-menu-header", path: "/m/qalqilya", auth: "public" },
  { name: "login-header", path: "/login", auth: "public" },
];

const PIN = process.env.STAFF_PIN ?? "1111";

const ORIGIN = "http://localhost:3000";

async function loginAs(page, role) {
  if (role === "public") return;
  await page.goto(`${ORIGIN}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("button[aria-label='رقم 1']", { timeout: 10000 });
  for (const d of PIN) {
    await page.click(`button[aria-label='رقم ${d}']`);
    await page.waitForTimeout(200);
  }
  await page.click("button:has-text('تأكيد')");
  // If no open shift exists, the PinPad shows an opening-cash form.
  try {
    const skipBtn = page.getByRole("button", { name: "تخطي" });
    await skipBtn.waitFor({ timeout: 10000 });
    await skipBtn.click();
  } catch {
    // No opening-cash form — proceed directly.
  }
  await page.waitForTimeout(2000);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const surface of SURFACES) {
    // Fresh context per surface so the PIN-login session doesn't leak
    // between captures (a logged-in /login redirects to /pos).
    const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const page = await ctx.newPage();
    try {
      await loginAs(page, surface.auth);
      await page.goto(`${ORIGIN}${surface.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: join(OUT, `${surface.name}-${VIEWPORTS.desktop.width}.png`),
        clip: {
          x: 0,
          y: 0,
          width: VIEWPORTS.desktop.width,
          height: 200,
        },
      });
      console.log(`captured ${surface.name}`);
    } catch (e) {
      console.error(`FAILED ${surface.name}:`, e.message);
    }
    await ctx.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
