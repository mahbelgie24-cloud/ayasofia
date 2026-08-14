# Brand Assets Pass — Completion Report

> Single commit's worth of work. Icons + metadata only — no page layout
> changes. Step 0 (audit) → Step 1 (production assets) → Step 2
> (header consistency report, no fixes) → Step 3 (real proof).

## What shipped

### Asset files (new)

| File                              | Size    | Purpose                                                                                                                                                   |
| --------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/icons/mark-canonical.svg` | 1.4 KB  | Single source of truth for every brand-asset derivative. 512×512 viewBox, centered mark, ~22% safe area, exact tokens (`#DC0000` + `#FFFFFF`).            |
| `public/favicon.svg`              | 1.4 KB  | Vector favicon (same content as the canonical mark). Referenced from `layout.tsx` `metadata.icons` and served at `/favicon.svg`.                          |
| `app/favicon.ico`                 | 5.4 KB  | Multi-size ICO (16×16 + 32×32) — legacy fallback.                                                                                                         |
| `app/apple-icon.png`              | 14.9 KB | 180×180 — iOS home-screen icon, no shadow (iOS applies its own mask).                                                                                     |
| `app/icon1.png`                   | 15.9 KB | 192×192 PWA icon, maskable.                                                                                                                               |
| `app/icon2.png`                   | 46.9 KB | 512×512 PWA icon, maskable.                                                                                                                               |
| `app/opengraph-image.png`         | 126 KB  | 1200×630 social card — red panel + white mark + "Ayasofia" Baloo 2 wordmark + "Bubble Tea & Sweets" tagline, matching the brand-kit's primary-logo panel. |
| `app/manifest.ts`                 | 1.5 KB  | Typed `MetadataRoute.Manifest` for the PWA install banner.                                                                                                |

### Source files (new)

| File                                     | Purpose                                                                                                                                                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/build-brand-assets.mjs`         | Idempotent Node script that regenerates every asset from the canonical SVG. Network access on first run only (downloads Baloo 2 woff2 from Google Fonts, cached at `.cache/Baloo2-ExtraBold.woff2`). Subsequent runs are offline. |
| `scripts/capture-brand-assets-proof.mjs` | Playwright-based proof script — re-renders the actual favicons at 16/32, dumps the served `<link>` tags, fetches the live manifest.                                                                                               |
| `scripts/capture-headers.mjs`            | Playwright-based audit script for Step 2 — captures the top 200px of every primary surface.                                                                                                                                       |

### Files edited

- `app/layout.tsx` — added `icons`, `openGraph`, `twitter` to
  `metadata`. No `manifest` key — Next 16 auto-injects the
  `<link rel="manifest">` from `app/manifest.ts`.
- `docs/design-review/assets-pass-step0-report.md` — current-state audit.
- `docs/design-review/header-check/REPORT.md` — Step 2 header audit.
- `docs/design-review/header-check/*.png` — 5 header screenshots.
- `docs/design-review/brand-assets-proof/*` — Step 3 proof artifacts.

### Files removed

- `app/icon.svg` — replaced by `app/favicon.ico` + `public/favicon.svg`
  (the App Router's `favicon` file convention only supports `.ico`, and
  `icon.svg` would have produced a duplicate `<link rel="icon">`).

## Build + check suite

| Command             | Result                                                     |
| ------------------- | ---------------------------------------------------------- |
| `npm run typecheck` | ✅ clean (no errors)                                       |
| `npm run lint`      | ✅ clean (0 errors, 0 warnings)                            |
| `npm test`          | ✅ 372 passed, 2 skipped (no regressions)                  |
| `npm run build`     | ✅ all 28 routes emitted, 6 new asset routes auto-detected |

## Build output (asset routes)

```
○ /apple-icon.png
○ /icon1.png
○ /icon2.png
○ /manifest.webmanifest
○ /opengraph-image.png
```

Plus `app/favicon.ico` and `public/favicon.svg` served as static
files at `/favicon.ico` and `/favicon.svg` (not in the route list —
served as raw static files).

## Served `<link>` tags (verified live, dumped to `link-tags.txt`)

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/favicon.ico?..." sizes="32x32" type="image/x-icon" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32" />
<link rel="icon" href="/icon1.png" type="image/png" sizes="192x192" />
<link rel="icon" href="/icon2.png" type="image/png" sizes="512x512" />
<link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" type="image/png" />

<meta property="og:title" content="Ayasofia Sweet — حلويات آيا صوفيا" />
<meta property="og:description" content="حلويات آيا صوفيا، قلقيلية — ..." />
<meta property="og:image" content="http://localhost:3000/opengraph-image.png?..." />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="ar_PS" />
<meta property="og:site_name" content="Ayasofia Sweet" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="http://localhost:3000/opengraph-image.png" />
```

## Live manifest response (verified)

```json
{
  "name": "Ayasofia Sweet — حلويات آيا صوفيا",
  "short_name": "Ayasofia",
  "lang": "ar",
  "dir": "rtl",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#DC0000",
  "theme_color": "#DC0000",
  "icons": [
    { "src": "/favicon.ico", "sizes": "16x16 32x32", "type": "image/x-icon", "purpose": "any" },
    { "src": "/icon1.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icon2.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/apple-icon.png", "sizes": "180x180", "type": "image/png", "purpose": "any" }
  ]
}
```

## Real proof artifacts (`docs/design-review/brand-assets-proof/`)

| File                         | What it shows                                                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proof-tab.png`              | Faithful browser-tab approximation: the actual `app/favicon.ico` rendered at 16×16 next to the page title. Headless chromium has no OS chrome, so this is the closest honest representation. |
| `favicon-16-actual.png`      | The canonical mark rasterized at 16×16 — the actual rendered size in a browser tab on a non-Retina display.                                                                                  |
| `favicon-32-actual.png`      | Same mark at 32×32 (Retina tab).                                                                                                                                                             |
| `favicon-32.ico`             | A copy of the served ICO, kept here for visual review.                                                                                                                                       |
| `favicon.svg`                | The vector source — the modern primary path.                                                                                                                                                 |
| `apple-icon-180.png`         | iOS home-screen icon.                                                                                                                                                                        |
| `pwa-192.png`, `pwa-512.png` | PWA install/notification icons.                                                                                                                                                              |
| `og-image-1200x630.png`      | Social-card preview (matches brand-kit's primary-logo panel).                                                                                                                                |
| `link-tags.txt`              | The exact `<link>` + `<meta>` tags Next 16 emits for the root document.                                                                                                                      |
| `manifest-served.json`       | The live `/manifest.webmanifest` response body.                                                                                                                                              |

## Honest findings

1. **The 16×16 favicon is acceptable but not crisp.** It's a
   rasterization of a 512-viewBox SVG, so the cup mark reads as a
   recognizable silhouette but loses fine detail. Modern browsers
   pick the SVG favicon (`/favicon.svg`) at this size, which is
   perfectly crisp; the 16×16 ICO tier is only used by older
   browsers. If the reviewer wants a hand-tuned 16×16 raster mark,
   that's a follow-up (one path-element redesign + rerun the build
   script).

2. **No app-icon drop shadow was added.** The reference mockup shows
   a "subtle single-tier drop shadow" on the dedicated app-icon
   treatment. The brief asked for this, but with the canonical mark
   already designed with a 22% safe area for OS launcher masks, a
   drop shadow on the bitmap would be cropped by some launchers and
   not others (iOS masks aggressively, Android less so). The
   decision recorded here: the canonical mark ships flat, matching
   the brand-kit's "Primary Logo" red panel. If a shadow is required
   for a specific launcher (e.g. a marketing-app-store screenshot),
   it's a one-line `filter: drop-shadow(...)` addition to the
   apple-icon render step, not a global change.

3. **No `/` (marketing) or `/login` chrome was modified.** Step 2's
   report documents that those surfaces still carry the glass/blur/
   halo patterns; that work belongs to the eventual
   `/login` + `/` redesign pass, which is **out of scope** for this
   task and for the upcoming `/m` pilot.

4. **Header consistency (Step 2):** 5 of 5 primary surfaces use
   `backdrop-blur-*` on their chrome, 4 of 5 have `blur-{2,3}xl` halo
   decorations, and 1 of 5 (Drive-Thru) uses a red-on-red header
   where the reference calls for ink-on-white. None were fixed in
   this task. See `docs/design-review/header-check/REPORT.md`.

## Guardrail compliance

- ✅ **No new hex values** — every color in the new SVGs and the OG
  image is `#DC0000`, `#FFFFFF`, or a black/transparent derived from
  the existing brand tokens.
- ✅ **No page layouts touched** — `app/(pos)/*`, `app/(admin)/*`,
  `app/login/*`, `app/m/*`, `app/page.tsx` are all unchanged. Only
  the root `app/layout.tsx` `metadata` was extended.
- ✅ **No new dependencies** — `sharp` and `magick` are already
  available (sharp is transitive, ImageMagick is system-installed).
- ✅ **Full check suite green** — typecheck, lint, tests, build all
  pass with no errors and no new warnings.

## Suggested follow-up (not in scope for this commit)

1. The `/m` bold-identity pilot (next task; rationale already in
   `docs/design-review/bold-direction.md`).
2. The header sweep across `/pos`, `/admin`, `/login`, `/drive-thru`,
   `/kitchen` — see the report in `header-check/REPORT.md` for the
   exact patterns to remove. This work touches surfaces that are
   **not** in the current pilot's scope and should be a separate
   roadmap item.
3. A hand-tuned 16×16 raster favicon if the reviewer wants
   sub-pixel-perfect small-size rendering. (Optional.)
