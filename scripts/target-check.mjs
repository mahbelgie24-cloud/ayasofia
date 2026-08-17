import { chromium } from "@playwright/test";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(20000);
await page.goto(`${BASE}/login`);
await page.waitForSelector("button[aria-label='رقم 1']");
for (const d of "1111") {
  await page.click(`button[aria-label='رقم ${d}']`);
  await page.waitForTimeout(120);
}
await page.click("button:has-text('تأكيد')");
try {
  const s = page.getByRole("button", { name: "تخطي" });
  await s.waitFor({ timeout: 8000 });
  await s.click();
} catch {}
await page.waitForURL(/\/(pos|admin)/, { timeout: 20000 });
const out = [];
for (const path of [
  "/admin/menu",
  "/admin/settings",
  "/admin/wifi",
  "/admin/reports",
  "/admin/staff",
]) {
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(2000);
  const small = await page.evaluate(() => {
    const list = [];
    for (const el of document.querySelectorAll("main button, main a, main input, main select")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 24 || r.height < 24) {
        list.push({
          tag: el.tagName.toLowerCase(),
          label: (
            el.getAttribute("aria-label") ||
            el.textContent ||
            el.getAttribute("placeholder") ||
            ""
          )
            .trim()
            .slice(0, 30),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    return list;
  });
  out.push({ path, below24: small });
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
