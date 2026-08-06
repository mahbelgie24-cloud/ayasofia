import { test, expect, type Page } from "@playwright/test";
import { loginWithPin, addItemToCart } from "./helpers";

test.describe("A11y — toast notifications", () => {
  test('error toast renders with role="alert" and status-error brand token', async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector("button[aria-label='رقم 1']", { timeout: 10000 });

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("ayasofia-toast", {
          detail: { variant: "error", message: "خطأ تجريبي" },
        }),
      );
    });

    const toast = page.getByTestId("toast");
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toHaveAttribute("role", "alert");

    const classList = await toast.getAttribute("class");
    expect(classList).toContain("bg-status-error");
  });

  test('warning toast renders with role="status" and status-warning brand token', async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForSelector("button[aria-label='رقم 1']", { timeout: 10000 });

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("ayasofia-toast", {
          detail: { variant: "warning", message: "تحذير تجريبي" },
        }),
      );
    });

    const toast = page.getByTestId("toast");
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toHaveAttribute("role", "status");

    const classList = await toast.getAttribute("class");
    expect(classList).toContain("bg-status-warning");
  });

  test("toast auto-dismisses after timeout", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector("button[aria-label='رقم 1']", { timeout: 10000 });

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("ayasofia-toast", {
          detail: { variant: "error", message: "رسالة مؤقتة" },
        }),
      );
    });

    const toast = page.getByTestId("toast");
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toBeHidden({ timeout: 10000 });
  });
});

test.describe("A11y — touch target size (WCAG 2.5.5)", () => {
  async function openCartWithItem(page: Page) {
    await loginWithPin(page);
    await addItemToCart(page, "ميلك تي كلاسيك", []);
    const cartToggle = page
      .getByRole("button", { name: /سلعة/ })
      .or(page.getByRole("button", { name: /السلة/ }))
      .first();
    if (await cartToggle.isVisible()) {
      await cartToggle.click();
      await page.waitForTimeout(300);
    }
  }

  test("quantity and remove buttons meet 44×44px minimum", async ({ page }) => {
    await openCartWithItem(page);

    const qtyMinus = page.getByRole("button", { name: "−" }).first();
    const qtyPlus = page.getByRole("button", { name: "+" }).first();
    const removeBtn = page.getByRole("button", { name: "حذف" }).first();

    for (const btn of [qtyMinus, qtyPlus, removeBtn]) {
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
