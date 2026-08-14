// Generates the visual proof artifacts for the brand-assets pass.
//
// Outputs (all in docs/design-review/brand-assets-proof/):
//   proof-tab.png         — HTML overlay rendered in headless chromium that
//                            shows the 32x32 favicon next to the page
//                            title — a faithful approximation of a real
//                            browser tab, since headless mode doesn't
//                            render the OS chrome.
//   favicon-16-actual.png — the canonical mark rasterized at 16x16 (the
//                            actual rendered size in a browser tab).
//   favicon-32-actual.png — same, at 32x32 (Retina tab).
//   link-tags.txt         — every <link rel="icon|apple-touch-icon|manifest">
//                            tag Next 16 emits for the root document.
//   manifest-served.json  — the live /manifest.webmanifest response body.
//
// Reads only. No source code modified.

import { chromium } from "@playwright/test";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const execFile = promisify(_execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "docs/design-review/brand-assets-proof");
const ORIGIN = "http://localhost:3000";
const MARK_SVG = join(ROOT, "public/icons/mark-canonical.svg");

async function main() {
  await mkdir(OUT, { recursive: true });

  // 1) Render the mark at the actual favicon sizes a browser uses.
  const markSvg = await readFile(MARK_SVG, "utf8");
  const tmp16 = join(OUT, "_mark_16.svg");
  const tmp32 = join(OUT, "_mark_32.svg");
  await writeFile(tmp16, markSvg);
  await writeFile(tmp32, markSvg);
  await execFile("magick", [
    "-background",
    "none",
    "-density",
    "300",
    tmp16,
    "-resize",
    "16x16",
    join(OUT, "favicon-16-actual.png"),
  ]);
  await execFile("magick", [
    "-background",
    "none",
    "-density",
    "300",
    tmp32,
    "-resize",
    "32x32",
    join(OUT, "favicon-32-actual.png"),
  ]);
  await unlink(tmp16).catch(() => {});
  await unlink(tmp32).catch(() => {});

  // 2) Headless chromium → /, dump link tags, fetch manifest.
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);

  const linkTags = await page.evaluate(() => {
    const heads = Array.from(
      document.querySelectorAll(
        "link[rel='icon'], link[rel='apple-touch-icon'], link[rel='manifest'], meta[property^='og:'], meta[name^='twitter:']",
      ),
    );
    return heads.map((el) => el.outerHTML);
  });
  await writeFile(join(OUT, "link-tags.txt"), linkTags.join("\n") + "\n");

  const manifestRes = await page.request.get(`${ORIGIN}/manifest.webmanifest`);
  const manifestJson = await manifestRes.text();
  await writeFile(join(OUT, "manifest-served.json"), manifestJson + "\n");

  // 3) Browser-tab-strip proof: render a tiny HTML page that embeds the
  // real /favicon.ico as a base64 data URL (cross-origin from a data:
  // document would otherwise be blocked), then take a 360x40 screenshot.
  // This is a faithful approximation of a real tab — headless mode has no
  // OS chrome, so the chrome strip is the closest honest representation.
  const icoBytes = await readFile(join(ROOT, "app/favicon.ico"));
  const icoB64 = icoBytes.toString("base64");
  const tabPage = await ctx.newPage();
  await tabPage.setViewportSize({ width: 360, height: 40 });
  const tabHtml = `<!doctype html><html><head><style>
    body { margin: 0; font: 13px -apple-system, system-ui, sans-serif; background: #e5e7eb; padding: 8px 12px; }
    .tab { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; background: white; border-radius: 8px 8px 0 0; max-width: 320px; box-shadow: 0 -1px 0 rgba(0,0,0,0.05); }
    .tab img { width: 16px; height: 16px; }
    .tab .title { color: #202124; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tab .close { margin-inline-start: auto; color: #5f6368; font-size: 16px; line-height: 1; }
  </style></head><body>
    <div class="tab">
      <img src="data:image/x-icon;base64,${icoB64}" alt="" />
      <span class="title">Ayasofia Sweet — حلويات آيا صوفيا</span>
      <span class="close">×</span>
    </div>
  </body></html>`;
  const tabUrl = `data:text/html;charset=utf-8,${encodeURIComponent(tabHtml)}`;
  await tabPage.goto(tabUrl, { waitUntil: "load" });
  await tabPage.waitForTimeout(500);
  await tabPage.screenshot({
    path: join(OUT, "proof-tab.png"),
    clip: { x: 0, y: 0, width: 360, height: 40 },
  });
  await tabPage.close();

  await ctx.close();
  await browser.close();
  console.log("proof artifacts written to", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
