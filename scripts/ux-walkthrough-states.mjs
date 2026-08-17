/**
 * Extended-state walkthrough — the states the 2026-08-16 matrix missed:
 * checkout flows, form validation errors, offline/degraded connectivity,
 * sheets/modals open, and interactive mid-flow states.
 *
 * Usage: node scripts/ux-walkthrough-states.mjs <outDir>
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "docs/ux-audit/states";
const BASE = "http://localhost:3000";
mkdirSync(OUT, { recursive: true });

const manifest = [];
const failures = [];

async function shot(page, name, { fullPage = false } = {}) {
  try {
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
    manifest.push({ name, url: page.url() });
    console.log(`✓ ${name}`);
  } catch (err) {
    failures.push({ name, error: String(err).slice(0, 200) });
    console.error(`✗ ${name}: ${String(err).slice(0, 120)}`);
  }
}

async function login(page, { skipShift = true } = {}) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("button[aria-label='رقم 1']", { timeout: 15000 });
  for (const d of "1111") {
    await page.click(`button[aria-label='رقم ${d}']`);
    await page.waitForTimeout(120);
  }
  await page.click("button:has-text('تأكيد')");
  if (skipShift) {
    try {
      const skip = page.getByRole("button", { name: "تخطي" });
      await skip.waitFor({ timeout: 8000 });
      await skip.click();
    } catch {}
  }
  await page.waitForURL(/\/(pos|admin)/, { timeout: 20000 });
  await page.waitForTimeout(1200);
}

const browser = await chromium.launch();

// ── Customer · phone 390×844 — checkout flow + validation + offline ──────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "ar",
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  // table QR entry — the real dine-in path
  await page.goto(`${BASE}/m/qalqilya/table/c15a9a7e-8c9b-49ef-a310-90ce1cc2c714`);
  await page.waitForTimeout(2200);
  await shot(page, "menu-table-entry");

  // add an item and walk checkout
  const card = page.getByRole("button", { name: /بابل تي|بنجسو|كرومبس|شاي/ }).first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(900);
    const addBtn = page.getByRole("button", { name: /إضافة|اطلب/ }).first();
    if (await addBtn.count()) await addBtn.click();
    await page.waitForTimeout(700);
  }
  const cartBtn = page.getByRole("button", { name: /السلة|سلة/ }).first();
  if (await cartBtn.count()) {
    await cartBtn.click();
    await page.waitForTimeout(800);
    await shot(page, "menu-cart-populated");

    // validation: submit checkout empty
    const submit = page.getByRole("button", { name: /إرسال|تأكيد|اطلب الآن|متابعة/ }).first();
    if (await submit.count()) {
      await submit.click();
      await page.waitForTimeout(900);
      await shot(page, "menu-checkout-validation-error");
    }
  }

  // wifi connect form validation
  await page.goto(`${BASE}/wifi/connect`);
  await page.waitForTimeout(1500);
  const wifiSubmit = page.getByRole("button", { name: /اتصال|تسجيل|إرسال/ }).first();
  if (await wifiSubmit.count()) {
    await wifiSubmit.click();
    await page.waitForTimeout(900);
    await shot(page, "wifi-connect-validation-error");
  }

  // offline customer state
  await page.goto(`${BASE}/m/qalqilya`);
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.waitForTimeout(1200);
  await shot(page, "menu-offline");
  const offlineCard = page.getByRole("button", { name: /بابل تي|بنجسو|كرومبس|شاي/ }).first();
  if (await offlineCard.count()) {
    await offlineCard.click();
    await page.waitForTimeout(900);
    await shot(page, "menu-offline-product-tap");
  }
  await ctx.setOffline(false);

  await ctx.close();
}

// ── Staff · tablet 1180×820 — POS flow, offline, kitchen, drive-thru ─────
{
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  // fresh login WITHOUT skipping the shift form
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("button[aria-label='رقم 1']", { timeout: 15000 });
  for (const d of "1111") {
    await page.click(`button[aria-label='رقم ${d}']`);
    await page.waitForTimeout(120);
  }
  await page.click("button:has-text('تأكيد')");
  // shift-open form appears when no shift is open (text: الرصيد الافتتاحي للوردية)
  const shiftHeading = page.getByText("الرصيد الافتتاحي للوردية");
  try {
    await shiftHeading.waitFor({ timeout: 8000 });
    await shot(page, "pos-shift-open-form");
    await page.getByRole("button", { name: "تخطي" }).click();
  } catch {}
  await page.waitForURL(/\/(pos|admin)/, { timeout: 20000 });
  await page.waitForTimeout(1000);

  // POS: add item, open checkout, payment sheet
  const product = page.getByRole("button", { name: /بابل تي/ }).first();
  if (await product.count()) {
    await product.click();
    await page.waitForTimeout(600);
    const add = page.getByRole("button", { name: "إضافة إلى السلة" });
    if (await add.count()) {
      await add.click();
      await page.waitForTimeout(600);
    }
  }
  await shot(page, "pos-item-in-cart");
  const charge = page.getByRole("button", { name: /الدفع|تحصيل|إتمام|charge/i }).first();
  if (await charge.count()) {
    await charge.click();
    await page.waitForTimeout(900);
    await shot(page, "pos-payment-sheet");
    const cash = page.getByRole("button", { name: /نقد|كاش|cash/i }).first();
    if (await cash.count()) {
      await cash.click();
      await page.waitForTimeout(1200);
      await shot(page, "pos-payment-success");
    }
  }

  // POS offline banner
  await page.goto(`${BASE}/pos`);
  await page.waitForTimeout(1200);
  await ctx.setOffline(true);
  await page.waitForTimeout(1500);
  await shot(page, "pos-offline");
  await ctx.setOffline(false);
  await page.waitForTimeout(800);

  // kitchen: mid-flow states
  await page.goto(`${BASE}/kitchen`);
  await page.waitForTimeout(2200);
  await shot(page, "kitchen-tickets");
  const startBtn = page.getByRole("button", { name: /بدء التحضير/ }).first();
  if (await startBtn.count()) {
    await startBtn.click();
    await page.waitForTimeout(1000);
    await shot(page, "kitchen-preparing");
    const readyBtn = page.getByRole("button", { name: /جاهز|تسليم/ }).first();
    if (await readyBtn.count()) {
      await readyBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, "kitchen-ready");
    }
  }

  // drive-thru: fast add state
  await page.goto(`${BASE}/drive-thru`);
  await page.waitForTimeout(1800);
  const dtItem = page.getByRole("button", { name: /بابل تي|شاي/ }).first();
  if (await dtItem.count()) {
    await dtItem.click();
    await page.waitForTimeout(600);
    await shot(page, "drive-thru-item-added");
  }

  await ctx.close();
}

// ── Admin · desktop 1440×900 — sheets, modals, form states ───────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await login(page);

  // menu edit sheet
  await page.goto(`${BASE}/admin/menu`);
  await page.waitForTimeout(2000);
  const editBtn = page.getByRole("button", { name: /تعديل/ }).first();
  if (await editBtn.count()) {
    await editBtn.click();
    await page.waitForTimeout(900);
    await shot(page, "admin-menu-edit-sheet");
  }

  // inventory adjust modal
  await page.goto(`${BASE}/admin/inventory`);
  await page.waitForTimeout(2000);
  const adjustBtn = page.getByRole("button", { name: /تعديل|اضافة|شراء|حركة/ }).first();
  if (await adjustBtn.count()) {
    await adjustBtn.click();
    await page.waitForTimeout(900);
    await shot(page, "admin-inventory-modal");
  }

  // staff add form
  await page.goto(`${BASE}/admin/staff`);
  await page.waitForTimeout(1800);
  const addStaff = page.getByRole("button", { name: /إضافة|موظف جديد/ }).first();
  if (await addStaff.count()) {
    await addStaff.click();
    await page.waitForTimeout(800);
    await shot(page, "admin-staff-add-form");
  }

  // reports with data
  await page.goto(`${BASE}/admin/reports`);
  await page.waitForTimeout(2200);
  await shot(page, "admin-reports-populated");

  await ctx.close();
}

await browser.close();
writeFileSync(
  join(OUT, "manifest.json"),
  JSON.stringify({ captured: manifest, failures }, null, 2),
);
console.log(`\nDone: ${manifest.length} captured, ${failures.length} failed`);
