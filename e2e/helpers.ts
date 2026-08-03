import type { Page } from "@playwright/test";

/**
 * Log into the POS using the seeded owner PIN (1111).
 */
export async function loginWithPin(page: Page, pin = "1111") {
  await page.goto("/login");
  await page.waitForSelector("button[aria-label='Digit 1']", { timeout: 10000 });

  for (const d of pin) {
    await page.click(`button[aria-label='Digit ${d}']`);
    await page.waitForTimeout(200);
  }

  // Click Enter and wait for the redirect
  await page.click("button:has-text('Enter')");

  // Category tabs appear once the menu loads — this proves we're on /pos
  await page.waitForSelector("text=بابل تي", { timeout: 30000 });
}
