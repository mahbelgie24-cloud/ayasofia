import { test } from "@playwright/test";
import { loginWithPin, addItemToCart } from "./helpers";

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  smallPhone: { width: 375, height: 812 },
};

async function captureSurface(
  page: {
    setViewportSize(v: { width: number; height: number }): Promise<void>;
    goto(
      path: string,
      opts?: { waitUntil?: string; timeout?: number },
    ): Promise<import("@playwright/test").Response | null>;
    waitForTimeout(ms: number): Promise<void>;
    screenshot(opts: { path: string; fullPage: boolean }): Promise<Buffer>;
  },
  name: string,
  path: string,
  viewport: { width: number; height: number } = VIEWPORTS.desktop,
) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: `docs/design-review/before/${name}-${viewport.width}x${viewport.height}.png`,
    fullPage: true,
  });
}

test.describe("Design review — baseline screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
  });

  test("login", async ({ page }) => {
    await captureSurface(page, "login", "/login");
  });

  test("pos — empty", async ({ page }) => {
    await loginWithPin(page);
    await page.screenshot({
      path: "docs/design-review/before/pos-empty-1440x900.png",
      fullPage: true,
    });
  });

  test("pos — populated cart with open modifier sheet", async ({ page }) => {
    await loginWithPin(page);
    await addItemToCart(page, "ميلك تي كلاسيك", []);
    await addItemToCart(page, "ميلك تي بالسكر البني", []);
    // Switch to second category to add a different product
    await page.getByRole("tab", { name: "شاي فواكه" }).click();
    await page.waitForTimeout(300);
    await addItemToCart(page, "شاي الفراولة", []);
    await page.getByRole("button", { name: /سلعة/ }).click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "docs/design-review/before/pos-cart-open-1440x900.png",
      fullPage: true,
    });
    // Close the blocking cart Sheet before interacting with the menu behind it.
    await page.getByRole("button", { name: "متابعة الإضافة" }).click();
    await page.waitForTimeout(300);
    // Switch to Cheese Foam Tea and open modifier sheet
    await page.getByRole("tab", { name: "شاي كريمة الجبن" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "ماتشا بكريمة الجبن" }).first().click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "docs/design-review/before/pos-modifier-sheet-open-1440x900.png",
      fullPage: true,
    });
  });

  test("pos — mobile", async ({ page }) => {
    await loginWithPin(page);
    await addItemToCart(page, "ميلك تي كلاسيك", []);
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.screenshot({
      path: "docs/design-review/before/pos-390x844.png",
      fullPage: true,
    });
  });

  test("drive-thru", async ({ page }) => {
    await loginWithPin(page);
    await page.goto("/drive-thru", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "docs/design-review/before/drive-thru-1440x900.png",
      fullPage: true,
    });
    await addItemToCart(page, "ميلك تي كلاسيك", [], "إضافة");
    await page.screenshot({
      path: "docs/design-review/before/drive-thru-cart-open-1440x900.png",
      fullPage: true,
    });
  });

  test("kitchen — with orders", async ({ page }) => {
    await loginWithPin(page);
    await page.goto("/kitchen", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: "docs/design-review/before/kitchen-1440x900.png",
      fullPage: true,
    });
  });

  test("order — browsing", async ({ page }) => {
    await captureSurface(page, "order", "/m/qalqilya", VIEWPORTS.mobile);
  });

  test("order — cart open", async ({ page }) => {
    await page.goto("/m/qalqilya", { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: /ميلك تي كلاسيك/ })
      .first()
      .click();
    await page.waitForTimeout(400);
    await page
      .getByRole("button", { name: /أضف إلى السلة/ })
      .first()
      .click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /سلعة/ }).click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "docs/design-review/before/order-cart-open-390x844.png",
      fullPage: true,
    });
  });

  test("order status", async ({ page }) => {
    await page.goto("/m/qalqilya", { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: /ميلك تي كلاسيك/ })
      .first()
      .click();
    await page.waitForTimeout(400);
    await page
      .getByRole("button", { name: /أضف إلى السلة/ })
      .first()
      .click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /سلعة/ }).click();
    await page.waitForTimeout(300);
    await page
      .getByRole("button", { name: /أكد الطلب/ })
      .first()
      .click();
    await page.waitForURL(/\/m\/qalqilya\/status\//, { timeout: 20000 });
    await page.waitForTimeout(3000);
    // Strip the ?accessToken= query from the filename — the token is a per-order
    // capability secret and must not be written into a tracked screenshot name.
    const orderId = page.url().split("/").pop()?.split("?")[0] ?? "unknown";
    await page.screenshot({
      path: `docs/design-review/before/order-status-${orderId}-390x844.png`,
      fullPage: true,
    });
  });

  test("admin — dashboard", async ({ page }) => {
    await loginWithPin(page);
    await page.goto("/admin", { waitUntil: "networkidle" });
    await page.screenshot({
      path: "docs/design-review/before/admin-dashboard-1440x900.png",
      fullPage: true,
    });
  });

  test("admin — inventory", async ({ page }) => {
    await loginWithPin(page);
    await page.goto("/admin/inventory", { waitUntil: "networkidle" });
    await page.screenshot({
      path: "docs/design-review/before/admin-inventory-1440x900.png",
      fullPage: true,
    });
  });

  test("admin — reports", async ({ page }) => {
    await loginWithPin(page);
    await page.goto("/admin/reports", { waitUntil: "networkidle" });
    await page.screenshot({
      path: "docs/design-review/before/admin-reports-1440x900.png",
      fullPage: true,
    });
  });

  test("admin — menu", async ({ page }) => {
    await loginWithPin(page);
    await page.goto("/admin/menu", { waitUntil: "networkidle" });
    await page.screenshot({
      path: "docs/design-review/before/admin-menu-1440x900.png",
      fullPage: true,
    });
  });

  test("admin — staff", async ({ page }) => {
    await loginWithPin(page);
    await page.goto("/admin/staff", { waitUntil: "networkidle" });
    await page.screenshot({
      path: "docs/design-review/before/admin-staff-1440x900.png",
      fullPage: true,
    });
  });

  test("admin — settings", async ({ page }) => {
    await loginWithPin(page);
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await page.screenshot({
      path: "docs/design-review/before/admin-settings-1440x900.png",
      fullPage: true,
    });
  });
});
