/**
 * UX walkthrough capture — screenshots every screen × state × breakpoint
 * against the running production build (localhost:3000, local Supabase stack).
 *
 * Usage: node scripts/ux-walkthrough.mjs <outDir>
 * Output: PNG screenshots + a manifest.json listing what was captured.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "docs/ux-audit/shots";
const BASE = "http://localhost:3000";
mkdirSync(OUT, { recursive: true });

const manifest = [];
const failures = [];

async function shot(page, name, { fullPage = false } = {}) {
  try {
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
    manifest.push({ name, url: page.url(), fullPage });
    console.log(`✓ ${name}`);
  } catch (err) {
    failures.push({ name, error: String(err).slice(0, 200) });
    console.error(`✗ ${name}: ${String(err).slice(0, 120)}`);
  }
}

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("button[aria-label='رقم 1']", { timeout: 15000 });
  for (const d of "1111") {
    await page.click(`button[aria-label='رقم ${d}']`);
    await page.waitForTimeout(150);
  }
  await page.click("button:has-text('تأكيد')");
  try {
    const skip = page.getByRole("button", { name: "تخطي" });
    await skip.waitFor({ timeout: 8000 });
    await skip.click();
  } catch {
    /* no opening-cash form */
  }
  await page.waitForURL(/\/(pos|admin)/, { timeout: 20000 });
  await page.waitForTimeout(1200);
}

const browser = await chromium.launch();

// ── Customer · phone 390×844 ─────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "ar",
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  await page.goto(`${BASE}/`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1800);
  await shot(page, "customer-landing-phone");
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(600);
  await shot(page, "customer-landing-phone-scrolled");

  await page.goto(`${BASE}/m/qalqilya`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  await shot(page, "menu-phone-top");
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(900);
  await shot(page, "menu-phone-catalog");

  // open the first product sheet (digital menu card)
  const card = page.getByRole("button", { name: /بابل تي|بنج سو|كروف/ }).first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(900);
    await shot(page, "menu-phone-product-sheet");
    const addBtn = page.getByRole("button", { name: /إضافة|اطلب/ }).first();
    if (await addBtn.count()) {
      await addBtn.click();
      await page.waitForTimeout(700);
    }
  }

  // cart open state
  const cartBtn = page.getByRole("button", { name: /السلة|سلة/ }).first();
  if (await cartBtn.count()) {
    await cartBtn.click();
    await page.waitForTimeout(800);
    await shot(page, "menu-phone-cart-open");
  }

  // order status (real order + token)
  await page.goto(
    `${BASE}/order/status/9d5910ce-0a75-4e55-97ac-c1a0c38c2993?accessToken=3cef283c-33e9-4ce4-8450-b0f53ff9ff79`,
  );
  await page.waitForTimeout(2000);
  await shot(page, "order-status-phone");

  // wrong token → not-found state
  await page.goto(
    `${BASE}/order/status/9d5910ce-0a75-4e55-97ac-c1a0c38c2993?accessToken=00000000-0000-0000-0000-000000000000`,
  );
  await page.waitForTimeout(1500);
  await shot(page, "order-status-wrong-token");

  // wifi portal
  await page.goto(`${BASE}/wifi`);
  await page.waitForTimeout(1800);
  await shot(page, "wifi-splash-phone");
  await page.goto(`${BASE}/wifi/connect`);
  await page.waitForTimeout(1800);
  await shot(page, "wifi-connect-phone");

  // branch not found (error state)
  await page.goto(`${BASE}/m/nothing-here`);
  await page.waitForTimeout(1500);
  await shot(page, "menu-branch-notfound");

  await ctx.close();
}

// ── Staff · tablet-landscape 1180×820 + login states ────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  // login: default + wrong-PIN error + focus ring
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(1500);
  await shot(page, "login-tablet");
  for (const d of "9999") {
    await page.click(`button[aria-label='رقم ${d}']`);
    await page.waitForTimeout(120);
  }
  await page.click("button:has-text('تأكيد')");
  await page.waitForTimeout(1500);
  await shot(page, "login-wrong-pin");

  // keyboard focus visibility on the pin pad
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(1200);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);
  await shot(page, "login-focus-visible");

  await login(page);
  await shot(page, "pos-tablet-empty");

  // add an item + open its modifier sheet
  const product = page.getByRole("button", { name: /بابل تي/ }).first();
  if (await product.count()) {
    await product.click();
    await page.waitForTimeout(700);
    await shot(page, "pos-tablet-modifier-sheet");
    const add = page.getByRole("button", { name: "إضافة إلى السلة" });
    if (await add.count()) {
      await add.click();
      await page.waitForTimeout(700);
    }
  }
  await shot(page, "pos-tablet-cart");

  await page.goto(`${BASE}/kitchen`);
  await page.waitForTimeout(2500);
  await shot(page, "kitchen-tablet");

  await page.goto(`${BASE}/drive-thru`);
  await page.waitForTimeout(2000);
  await shot(page, "drive-thru-tablet");

  await page.goto(`${BASE}/pos/receipt/9d5910ce-0a75-4e55-97ac-c1a0c38c2993`);
  await page.waitForTimeout(1500);
  await shot(page, "receipt-tablet");

  await ctx.close();
}

// ── Admin · desktop 1440×900 (same PIN session = owner) ──────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await login(page);

  for (const [slug, name] of [
    ["admin", "admin-dashboard"],
    ["admin/menu", "admin-menu"],
    ["admin/inventory", "admin-inventory"],
    ["admin/reports", "admin-reports"],
    ["admin/staff", "admin-staff"],
    ["admin/settings", "admin-settings"],
    ["admin/wifi", "admin-wifi"],
    ["admin/digital-menu", "admin-digital-menu"],
  ]) {
    await page.goto(`${BASE}/${slug}`);
    await page.waitForTimeout(2200);
    await shot(page, name);
  }

  // admin mobile nav (owner sometimes checks from phone)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/admin`);
  await page.waitForTimeout(1800);
  await shot(page, "admin-dashboard-phone");
  const burger = page.getByRole("button", { name: /القائمة|قائمة|Menu/ }).first();
  if (await burger.count()) {
    await burger.click();
    await page.waitForTimeout(700);
    await shot(page, "admin-mobile-nav-open");
  }

  await ctx.close();
}

await browser.close();
writeFileSync(
  join(OUT, "manifest.json"),
  JSON.stringify({ captured: manifest, failures }, null, 2),
);
console.log(`\nDone: ${manifest.length} captured, ${failures.length} failed`);
