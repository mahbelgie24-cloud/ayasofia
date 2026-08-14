# Step 0 — Current State Report (icon / brand assets)

> Read-only audit, completed before any asset production. No files changed.

## Files in `public/`

| File                               | Size   | Source / role                                                                                                                                                                 |
| ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/icons/logo-mono.svg`       | 1.2 KB | Monochrome (black-on-white) reproduction of the brand mark — designed for thermal/print receipts per spec §11.6. NOT a web favicon; no colored background, no rounded square. |
| `public/icons/icon-bubbletea.svg`  | 1.1 KB | Cream-filled circle with red straw + ink cup — used in product grids as a category default.                                                                                   |
| `public/icons/icon-bingsu.svg`     | 788 B  | Same cream circle treatment, bingsu variant.                                                                                                                                  |
| `public/icons/icon-cheesefoam.svg` | 1.0 KB | Same cream circle treatment, cheese-foam variant.                                                                                                                             |
| `public/icons/icon-croffle.svg`    | 849 B  | Same cream circle treatment, croffle variant.                                                                                                                                 |
| `public/icons/icon-fruittea.svg`   | 1.0 KB | Same cream circle treatment, fruit-tea variant.                                                                                                                               |
| `public/icons/icon-souffle.svg`    | 965 B  | Same cream circle treatment, soufflé variant.                                                                                                                                 |
| `public/menu/`                     | (dir)  | Unknown content; needs follow-up. **Not icon-related, ignored for this task.**                                                                                                |
| `public/sw.js`                     | 4.1 KB | Service worker (offline app-shell cache). Not a brand asset.                                                                                                                  |

**No `favicon.ico`, no `favicon.svg`, no `apple-touch-icon.png`, no PWA
manifest icons (192/512), no `og-image.png` exist in `public/`.**

## Files in `app/`

| File           | Source / role                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/icon.svg` | Next.js convention — the App Router auto-generates a favicon from this file. Hand-authored SVG: rounded red square (200×200, `rx=44`), white cup mark, red pearl dots. Uses `#DC0000` and `#FFFFFF` directly. This is the ONLY web favicon the app has today. |

**No `manifest.ts`, no `manifest.json`, no `apple-icon.png`, no
`opengraph-image.png` exist in `app/`.**

## Metadata references in code

`grep` for `favicon|apple-touch|manifest|og-image` across `app/` and
`components/`:

- `proxy.ts:79` — the only match. It is a CSP / routing rule that
  allow-lists `favicon.ico` as a public path. **No code anywhere
  references a specific favicon file, manifest, OG image, or
  apple-touch icon.** All of that is currently either auto-generated
  by Next.js from `app/icon.svg` or simply missing.

## Root layout (`app/layout.tsx`)

- `metadata` defines `title`, `description`, `keywords`, `applicationName`,
  `formatDetection`. **No `icons` array, no `openGraph`, no `twitter`,
  no `manifest` link.**
- `viewport.themeColor` is set to `#DC0000` and `#2B1D1D` (light/dark).

## What this means for the task

- The only thing currently in place is the Next.js auto-generated
  favicon from `app/icon.svg`. It is **not** the recommended
  multi-format setup for iOS home screen (no apple-touch), PWA install
  (no 192/512 PNGs, no manifest), or social link previews (no
  og-image).
- The reference mockup shows:
  - **Favicon** — red rounded-square, white mark, generous padding, flat
  - **App icon** — same red rounded-square with a single-tier drop shadow
  - **Web header** — small icon + bold "Ayasofia" wordmark in **ink**
    on **white** (not red-on-red), no glass, no blur
  - **OG / social card** — red full-bleed panel with white logo + wordmark +
    "Bubble Tea & Sweets" tagline
- The existing `app/icon.svg` mark itself is good (right shapes, right
  palette, right pearl grid) — the gap is entirely in the
  multi-format packaging around it, plus matching `manifest.ts` /
  metadata.

## Files that will be created in Step 1

1. `app/favicon.ico` (32×32 ICO, single tier — or 16+32 if cheap)
2. `app/favicon.svg` (vector, red rounded-square + white mark)
3. `app/apple-icon.png` (180×180) — generated by App Router convention
4. `app/icon-192.png` (192×192, PWA)
5. `app/icon-512.png` (512×512, PWA)
6. `app/og-image.png` (1200×630)
7. `app/manifest.ts` (PWA manifest, App Router convention)

## Files that will be edited in Step 1

- `app/layout.tsx` — add `icons`, `openGraph`, `twitter`,
  `manifest` to `metadata`. No visual layout change.

## Files NOT touched (out of scope per guardrails)

- `app/icon.svg` — replaced/augmented but its core mark is fine.
- `public/icons/logo-mono.svg` — print-only asset, unchanged.
- `public/icons/icon-*.svg` — product icons, unchanged.
- All page routes (`/m`, `/pos`, `/admin`, `/login`, `/kitchen`, etc.)
  — Step 2 reports on them; nothing is fixed in this task.
- `components/ui/logo.tsx`, `components/ui/header*` etc. — out of
  scope.
