#!/usr/bin/env node
// Build all brand-asset derivatives (favicon, app icon, PWA icons, og-image)
// from a single canonical source SVG. Idempotent: re-running produces the
// same bytes for the same input. Run with `node scripts/build-brand-assets.mjs`.
//
// Inputs (committed to the repo):
//   public/icons/mark-canonical.svg     — the cup mark on a red rounded square
// Outputs:
//   public/favicon.svg                  — vector favicon (served as a static
//                                         asset at /favicon.svg; metadata in
//                                         app/layout.tsx links to it)
//   app/favicon.ico                     — 32x32 ICO (Next App Router favicon
//                                         file convention; auto-emits the
//                                         <link rel="icon" sizes="any"> tag)
//   app/apple-icon.png                  — 180x180 PNG (Next App Router
//                                         apple-icon file convention; iOS
//                                         applies its own rounded mask)
//   app/icon1.png                       — 192x192 PWA icon
//   app/icon2.png                       — 512x512 PWA icon
//   app/opengraph-image.png             — 1200x630 social card
//
// No network access at build time. Google Fonts (Baloo 2) is downloaded
// ONCE on first run and cached at .cache/baloo2-800.ttf.

import { execFile as _execFile } from "node:child_process";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import https from "node:https";

const execFile = promisify(_execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const APP = join(ROOT, "app");
const PUBLIC = join(ROOT, "public");
const MARK = join(PUBLIC, "icons", "mark-canonical.svg");
const CACHE = join(ROOT, ".cache");

// Brand tokens (spec §11.2). Do not introduce new hex values from eyeballing.
const BRAND_RED = "#DC0000";
const WHITE = "#FFFFFF";

// ── 1. Read canonical mark ────────────────────────────────────────────────
async function loadMarkSvg() {
  return readFile(MARK, "utf8");
}

// ── 2. Fetch Baloo 2 weight 800 (one-time) for the og-image wordmark ──────
async function ensureBalooFont() {
  const fontPath = join(CACHE, "Baloo2-ExtraBold.woff2");
  if (existsSync(fontPath)) return fontPath;
  await mkdir(CACHE, { recursive: true });
  // Resolve the woff2 URL from the Google Fonts CSS API. Google has
  // dropped TTF fallbacks for the latin subset; only woff2 is served. The
  // recent librsvg shipped with ImageMagick 7 can decode woff2, so we keep
  // the font as woff2 all the way through.
  const cssUrl = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&display=swap";
  const css = await fetchText(cssUrl, {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  });
  // The first @font-face block is the latin subset; pick the first woff2
  // url from it. (Google emits a per-unicode-range block per script.)
  const m = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
  if (!m) throw new Error("Could not parse Baloo 2 woff2 URL from Google Fonts CSS");
  const woff2 = await fetchBinary(m[1]);
  await writeFile(fontPath, woff2);
  return fontPath;
}

function fetchText(url, headers = {}) {
  return new Promise((res, rej) => {
    https
      .get(url, { headers }, (r) => {
        if (r.statusCode && r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          return fetchText(r.headers.location, headers).then(res, rej);
        }
        if (r.statusCode !== 200) return rej(new Error(`HTTP ${r.statusCode} for ${url}`));
        let body = "";
        r.on("data", (c) => (body += c));
        r.on("end", () => res(body));
      })
      .on("error", rej);
  });
}

function fetchBinary(url) {
  return new Promise((res, rej) => {
    https
      .get(url, (r) => {
        if (r.statusCode && r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          return fetchBinary(r.headers.location).then(res, rej);
        }
        if (r.statusCode !== 200) return rej(new Error(`HTTP ${r.statusCode} for ${url}`));
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => res(Buffer.concat(chunks)));
      })
      .on("error", rej);
  });
}

// ── 3. ImageMagick SVG → PNG/ICO pipeline ──────────────────────────────────
async function svgToPng(svgString, width, height, outPath) {
  // Write SVG to a temp file because magick can be picky about inline data:
  // / and : in attribute values are unsafe on the command line.
  const tmp = join(CACHE, `_render_${width}x${height}_${Date.now()}.svg`);
  await writeFile(tmp, svgString);
  try {
    await execFile("magick", [
      "-background",
      "none",
      "-density",
      "300",
      tmp,
      "-resize",
      `${width}x${height}`,
      outPath,
    ]);
  } finally {
    if (existsSync(tmp)) await import("node:fs/promises").then((fs) => fs.unlink(tmp));
  }
}

async function pngToIco(pngPath, outPath) {
  await execFile("magick", [pngPath, "-define", "icon:auto-resize=16,32", outPath]);
}

// ── 4. Build the SVG variants we need ─────────────────────────────────────
// The canonical mark SVG (mark-canonical.svg) is already the right
// composition (centered, padded, red rounded square + white mark) for
// every size we need. Each variant function is a hook in case a future
// size needs a different treatment (e.g. a wider corner radius for
// a specific platform mask); today they all return the canonical mark
// unchanged, so the build is one source of truth.

function buildFaviconSvg(markSvg) {
  return markSvg;
}

function buildAppleIconSvg(markSvg) {
  // iOS applies its own rounded mask; we ship the canonical mark
  // unchanged. No shadow — the iOS home screen does not need one.
  return markSvg;
}

function buildPwaIconSvg(markSvg) {
  // PWA install banner / notification icons. The canonical mark is
  // designed with ~22% safe-area padding, which is enough for the
  // OS launcher mask. We declare `purpose: maskable` in the manifest
  // so the platform knows the safe area is honored.
  return markSvg;
}

function buildOgImageSvg(fontPath) {
  // 1200x630 social card. Red full-bleed, mark on the left, wordmark +
  // tagline on the right. Numbers are absolute px in the SVG coordinate
  // space, which ImageMagick will scale to 1200x630 at render time.
  // fontPath is embedded as a file:// URL inside the SVG so ImageMagick can
  // pick it up via librsvg.
  const fontUrl = `file://${fontPath}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style>
      @font-face {
        font-family: 'Baloo 2';
        font-weight: 800;
        src: url('${fontUrl}') format('woff2');
      }
      .wm { font-family: 'Baloo 2', sans-serif; font-weight: 800; fill: ${WHITE}; }
      .tg { font-family: 'Baloo 2', sans-serif; font-weight: 800; fill: ${WHITE}; }
    </style>
  </defs>
  <rect width="1200" height="630" fill="${BRAND_RED}"/>
  <!-- mark tile on the left, vertically centered -->
  <g transform="translate(140, 175)">
    <rect width="280" height="280" rx="62" fill="${BRAND_RED}" stroke="${WHITE}" stroke-width="6" stroke-opacity="0.0"/>
    <g transform="translate(58, 22)">
      <g stroke="${WHITE}" stroke-width="20" stroke-linecap="round" fill="none">
        <path d="M 50 12 L 86 64"/>
        <path d="M 86 64 L 50 100"/>
        <path d="M 50 100 L 32 152"/>
      </g>
      <rect x="6" y="146" width="142" height="22" rx="8" fill="${WHITE}"/>
      <path d="M 16 168 L 138 168 L 118 256 Q 115 270 100 270 L 54 270 Q 39 270 36 256 Z" fill="${WHITE}"/>
      <g fill="${BRAND_RED}">
        <circle cx="50" cy="216" r="9"/>
        <circle cx="76" cy="216" r="9"/>
        <circle cx="102" cy="216" r="9"/>
        <circle cx="55" cy="240" r="9"/>
        <circle cx="81" cy="240" r="9"/>
        <circle cx="107" cy="240" r="9"/>
      </g>
    </g>
  </g>
  <!-- wordmark + tagline -->
  <text class="wm" x="500" y="320" font-size="148" letter-spacing="-3">Ayasofia</text>
  <text class="tg" x="500" y="410" font-size="44" letter-spacing="0">Bubble Tea &amp; Sweets</text>
</svg>`;
}

// ── 5. Main pipeline ──────────────────────────────────────────────────────
async function main() {
  await access(MARK);
  await mkdir(CACHE, { recursive: true });

  const markSvg = await loadMarkSvg();

  // favicon.svg (lives in public/ so the metadata.icons array can link
  // to it as a static asset; App Router's `favicon` file convention only
  // supports .ico, so SVG goes in public/ + metadata).
  await writeFile(join(PUBLIC, "favicon.svg"), buildFaviconSvg(markSvg));
  console.log("wrote public/favicon.svg");

  // 32x32 PNG for the ICO. We render from the canonical mark SVG.
  const png32 = join(CACHE, "favicon-32.png");
  await svgToPng(markSvg, 32, 32, png32);
  await pngToIco(png32, join(APP, "favicon.ico"));
  console.log("wrote app/favicon.ico");

  // 180x180 apple-icon
  const appleSvg = buildAppleIconSvg(markSvg);
  await svgToPng(appleSvg, 180, 180, join(APP, "apple-icon.png"));
  console.log("wrote app/apple-icon.png (180x180)");

  // PWA icons: 192 + 512. Same canonical mark — the safe area inside the
  // rounded square is intentionally generous (~22%) so the OS launcher
  // mask can crop the corners without losing the cup mark.
  const pwaSvg = buildPwaIconSvg(markSvg);
  await svgToPng(pwaSvg, 192, 192, join(APP, "icon1.png"));
  await svgToPng(pwaSvg, 512, 512, join(APP, "icon2.png"));
  console.log("wrote app/icon1.png (192x192) + app/icon2.png (512x512)");

  // og-image 1200x630
  const fontPath = await ensureBalooFont();
  const ogSvg = buildOgImageSvg(fontPath);
  await svgToPng(ogSvg, 1200, 630, join(APP, "opengraph-image.png"));
  console.log("wrote app/opengraph-image.png (1200x630)");

  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
