import { test, expect } from "@playwright/test";

/**
 * T-D2 — customer-facing happy paths (local-run, documented, NOT CI-gated).
 *
 * These need a running dev server backed by a migrated + seeded Supabase with
 * `feature.digital_menu` and `feature.wifi_portal` enabled, and the default
 * branch slug `qalqilya`. Run locally:
 *
 *   npm run dev
 *   npx playwright test e2e/customer-flow.spec.ts
 *
 * They are intentionally NOT wired into CI (they create real orders/sessions).
 */
test.describe("Customer customer-flow (T-D2)", () => {
  test("/m happy path: scan → add → order → status carries the access token", async ({ page }) => {
    await page.goto("/m/qalqilya");

    // Menu renders with a real seeded product.
    const product = page.getByRole("button", { name: /ميلك تي كلاسيك/ }).first();
    await expect(product).toBeVisible({ timeout: 15000 });
    await product.click();
    await page.waitForTimeout(400);

    // The modifier builder sheet opens. Confirm it to add the item to the cart
    // (selecting any required group is handled by the sheet's pre-selection).
    const addBtn = page.getByRole("button", { name: /أضف إلى السلة/ }).first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();
    await page.waitForTimeout(400);

    // Open the cart and place a takeaway order.
    const cart = page
      .getByRole("button", { name: /سلعة/ })
      .or(page.getByRole("button", { name: /السلة/ }))
      .first();
    await expect(cart).toBeVisible({ timeout: 10000 });
    await cart.click();
    await page.waitForTimeout(300);
    await page
      .getByRole("button", { name: /أكد الطلب|إتمام|اطلب|تأكيد الطلب/ })
      .first()
      .click();

    // Lands on the status page — the order id in the path and a token query.
    await page.waitForURL(/\/status\/.+\?accessToken=/, { timeout: 15000 });
    expect(page.url()).toMatch(/\/m\/qalqilya\/status\/\w+/);
  });

  test("/wifi one-tap connect reaches the post-connect screen", async ({ page }) => {
    await page.goto("/wifi");
    const connect = page.getByRole("button", { name: "اتصال بالإنترنت" });
    await expect(connect).toBeVisible({ timeout: 15000 });
    await connect.click();
    await page.waitForURL(/\/wifi\/connect/, { timeout: 15000 });
  });
});
