import type { Page } from "@playwright/test";

/**
 * Log into the POS using the seeded owner PIN (1111).
 * If no open shift exists, the PinPad shows an opening-cash form;
 * click "تخطي" (skip) to proceed directly to the POS.
 */
export async function loginWithPin(page: Page, pin = "1111") {
  await page.goto("/login");
  await page.waitForSelector("button[aria-label='رقم 1']", { timeout: 10000 });

  for (const d of pin) {
    await page.click(`button[aria-label='رقم ${d}']`);
    await page.waitForTimeout(200);
  }

  await page.click("button:has-text('تأكيد')");

  // If no open shift exists, the PinPad shows an opening-cash form.
  // Wait for the skip button to appear and click it.
  try {
    const skipBtn = page.getByRole("button", { name: "تخطي" });
    await skipBtn.waitFor({ timeout: 10000 });
    await skipBtn.click();
  } catch {
    // No opening-cash form — proceed directly.
  }

  await page.waitForSelector("text=بابل تي", { timeout: 30000 });
}

/**
 * Add an item to the cart from the POS product grid.
 */
export async function addItemToCart(
  page: Page,
  product: string,
  modifiers: string[],
  confirmText = "إضافة إلى السلة",
) {
  await page.getByRole("button", { name: product }).first().click();
  if (modifiers.length > 0) {
    await page.waitForTimeout(300);
    for (const mod of modifiers) {
      await page
        .getByRole("button", { name: new RegExp(mod) })
        .first()
        .click();
      await page.waitForTimeout(100);
    }
  }
  await page.getByRole("button", { name: confirmText }).click();
  await page.waitForTimeout(400);
}
