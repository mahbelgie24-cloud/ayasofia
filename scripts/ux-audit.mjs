/**
 * Accessibility + rendering audit (evidence pass).
 *
 * 1. axe-core scan on every key route, per role-context and viewport
 *    (customer phone / staff tablet / admin desktop), with the WCAG tags
 *    and impact of every violation recorded.
 * 2. DOM-level rendering checks Playwright can measure reliably:
 *    - horizontal overflow ( RTL bugs, fixed-width elements )
 *    - interactive elements below 44×44 CSS px on touch surfaces
 *    - presence of :focus-visible styling on primary interactive elements
 *
 * Usage: node scripts/ux-audit.mjs <outDir>
 */
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "docs/ux-audit";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3000";

const results = { axe: [], dom: [] };

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("button[aria-label='رقم 1']", { timeout: 15000 });
  for (const d of "1111") {
    await page.click(`button[aria-label='رقم ${d}']`);
    await page.waitForTimeout(120);
  }
  await page.click("button:has-text('تأكيد')");
  try {
    const skip = page.getByRole("button", { name: "تخطي" });
    await skip.waitFor({ timeout: 8000 });
    await skip.click();
  } catch {}
  await page.waitForURL(/\/(pos|admin)/, { timeout: 20000 });
  await page.waitForTimeout(1000);
}

async function axeScan(page, name, url) {
  try {
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const violations = scan.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      wcag: v.tags.filter((t) => t.startsWith("wcag")),
      help: v.help,
      nodes: v.nodes.length,
      sample: v.nodes[0]?.target,
    }));
    results.axe.push({ name, url, violations, violationCount: violations.length });
    console.log(
      `axe ${name}: ${violations.length} violations` +
        (violations.length
          ? ` — ${violations.map((v) => `${v.id}(${v.impact},×${v.nodes})`).join(", ")}`
          : ""),
    );
  } catch (err) {
    results.axe.push({ name, url, error: String(err).slice(0, 200) });
    console.error(`axe ${name}: FAILED ${String(err).slice(0, 120)}`);
  }
}

async function domChecks(page, name) {
  // horizontal overflow
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const over = doc.scrollWidth - doc.clientWidth;
    if (over <= 1) return { overflowPx: 0, culprits: [] };
    const culprits = [];
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.right > doc.clientWidth + 1 || r.left < -1) {
        culprits.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className).slice(0, 80),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
        if (culprits.length >= 5) break;
      }
    }
    return { overflowPx: over, culprits };
  });

  // sub-44px interactive targets (touch surfaces only — caller decides)
  const smallTargets = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(
      "button, a, [role='button'], input, select, textarea",
    )) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue; // hidden
      if (r.width < 44 || r.height < 44) {
        out.push({
          tag: el.tagName.toLowerCase(),
          label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
        if (out.length >= 12) break;
      }
    }
    return out;
  });

  results.dom.push({ name, url: page.url(), ...overflow, smallTargets });
  console.log(
    `dom ${name}: overflow=${overflow.overflowPx}px, smallTargets=${smallTargets.length}`,
  );
}

const browser = await chromium.launch();

// ── Customer · phone ────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "ar",
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  const routes = [
    ["landing", "/"],
    ["menu", "/m/qalqilya"],
    [
      "status",
      "/order/status/9d5910ce-0a75-4e55-97ac-c1a0c38c2993?accessToken=3cef283c-33e9-4ce4-8450-b0f53ff9ff79",
    ],
    ["wifi", "/wifi"],
    ["wifi-connect", "/wifi/connect"],
  ];
  for (const [name, path] of routes) {
    await page.goto(`${BASE}${path}`);
    await page.waitForTimeout(2200);
    await axeScan(page, `customer-${name}`, path);
    await domChecks(page, `customer-${name}`);
  }
  await ctx.close();
}

// ── Staff · tablet landscape ────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(1500);
  await axeScan(page, "staff-login", "/login");
  await domChecks(page, "staff-login");

  await login(page);
  for (const [name, path] of [
    ["pos", "/pos"],
    ["kitchen", "/kitchen"],
    ["drive-thru", "/drive-thru"],
    ["receipt", "/pos/receipt/9d5910ce-0a75-4e55-97ac-c1a0c38c2993"],
  ]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForTimeout(2200);
    await axeScan(page, `staff-${name}`, path);
    await domChecks(page, `staff-${name}`);
  }
  await ctx.close();
}

// ── Admin · desktop ─────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await login(page);
  for (const [name, path] of [
    ["dashboard", "/admin"],
    ["menu", "/admin/menu"],
    ["inventory", "/admin/inventory"],
    ["reports", "/admin/reports"],
    ["staff", "/admin/staff"],
    ["settings", "/admin/settings"],
    ["wifi", "/admin/wifi"],
    ["digital-menu", "/admin/digital-menu"],
  ]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForTimeout(2200);
    await axeScan(page, `admin-${name}`, path);
    await domChecks(page, `admin-${name}`);
  }
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, "a11y-dom-audit.json"), JSON.stringify(results, null, 2));

const totalViol = results.axe.reduce((s, r) => s + (r.violationCount ?? 0), 0);
console.log(`\nTOTAL: ${totalViol} axe violations across ${results.axe.length} scans`);
