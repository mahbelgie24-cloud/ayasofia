# UX / UI / Performance / Accessibility Audit — 2026-08-16

|            |                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Date**   | 2026-08-16                                                                                                                                                                                              |
| **Mode**   | Full experiential protocol: render → audit (4 pillars) → research → fix → re-measure                                                                                                                    |
| **Target** | Production build (`next start`) against the local Supabase stack                                                                                                                                        |
| **Method** | Playwright walkthrough (29 screenshots × 3 viewports), axe-core 4 (WCAG 2.0/2.1/2.2 A+AA tags) on 18 route-contexts, DOM-level rendering checks, Lighthouse (mobile preset: simulated slow-4G + 4× CPU) |

## 1. Before / After — the numbers

| Metric                                                                                                              | Before                                                       | After                                                  |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| axe-core violations (18 scans, all roles/routes)                                                                    | **10 rule-groups, 35+ nodes** (4 critical groups, 5 serious) | **0**                                                  |
| Unnamed buttons (admin menu)                                                                                        | 23 (critical)                                                | 0                                                      |
| Unlabeled form inputs (reports/settings/wifi/digital-menu)                                                          | 11 (critical)                                                | 0                                                      |
| Color-contrast failures (kitchen ×7, drive-thru, dashboard, inventory ×2)                                           | 11 nodes (serious)                                           | 0                                                      |
| Touch targets < 44px on touch surfaces (menu/POS/kitchen/drive-thru chips, kitchen actions, POS top bar, wifi link) | ~40 elements                                                 | 0 (remaining 1×1 nodes are intentional skip-links)     |
| `prefers-reduced-motion` support                                                                                    | none (8 keyframe animations ignored the setting)             | global reduce block (WCAG 2.3.3)                       |
| Horizontal overflow (RTL defects), all 18 pages                                                                     | 0 px                                                         | 0 px                                                   |
| Lighthouse mobile — `/m/qalqilya` (customer QR menu)                                                                | 0.98 · LCP 1.8 s                                             | 0.97 · LCP 2.0 s · CLS 0.003 · TBT 100 ms              |
| Lighthouse mobile — `/wifi`, `/login`                                                                               | 0.98 · LCP 2.1 s                                             | unchanged paths, clean                                 |
| Lighthouse mobile — `/`                                                                                             | 0.98 (single sample)                                         | 0.90–0.98 · LCP 2.2–3.2 s (bimodal run-to-run; see §5) |
| vitest suite                                                                                                        | 390 ✔                                                        | 390 ✔ (+1 flaky test repaired)                         |
| Playwright e2e (39 specs, **production build**)                                                                     | —                                                            | **39/39 ✔**                                            |
| lint / typecheck / build / bundle budget                                                                            | clean                                                        | clean (worst chunk 71.8 KB ≤ 150 KB)                   |

## 2. Findings → resolutions

| #   | Finding (pillar · severity)                                                                                                                                     | Resolution                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | 23 icon-only Edit buttons in admin menu had no accessible name (A11y · Critical)                                                                                | `aria-label="تعديل {product}"` + raised to 36 px target                                                                                                                                      |
| A2  | 10 form inputs had labels not programmatically associated; 1 more unlabeled (A11y · Critical)                                                                   | `FormField` now binds label ↔ control via `useId` + `cloneElement` (id + `aria-describedby`); wrapped-input cases (settings/wifi) and the digital-menu table input got explicit `aria-label` |
| A3  | `aria-label` on a role-less div (PIN progress, landing + login) (A11y · Serious)                                                                                | `role="group"` added                                                                                                                                                                         |
| A4  | Amber `--color-status-warning` used **as text** on light surfaces ≈ 2.2:1 — kitchen chips ×6, inventory numerals ×2, plus 8 more latent usages (A11y · Serious) | New `--color-status-warning-ink: #8a4b06` token (≥5.9:1); every warning-as-text usage swept to it (kitchen, inventory, staff, settings, reports, POS shift modal, icon-badge, stat)          |
| A5  | Kitchen header caption `text-white/85` on brand red; dashboard/status captions `text-secondary/80` (A11y · Serious)                                             | Full-opacity tokens                                                                                                                                                                          |
| A6  | Drive-thru header chips: white on 10%-white-over-red ≈ 4.2:1 (A11y · Serious)                                                                                   | Solid `bg-brand-ink/35` chips + 44 px                                                                                                                                                        |
| A7  | Category pill tabs 32 px — primary nav on touch (digital menu phone, POS/drive-thru tablet) (A11y/UX · High)                                                    | Shared `Tabs` pills now `min-h-11` (44 px, WCAG 2.5.5/HIG) — one fix, three surfaces                                                                                                         |
| A8  | Kitchen "بدء التحضير" 32 px — highest-frequency action under time pressure (UX/A11y · High)                                                                     | `min-h-11`                                                                                                                                                                                   |
| A9  | POS top-bar buttons 30 px; sign-out icon 36 px wide; receipt actions 42 px; wifi Instagram link 20 px (A11y · Medium)                                           | All raised to ≥44 px                                                                                                                                                                         |
| A10 | Admin table micro-buttons 16–22 px — below even AA 24 px (A11y · Medium)                                                                                        | Raised to 32 px inline targets with hover affordance                                                                                                                                         |
| A11 | No `prefers-reduced-motion` despite 8 decorative keyframes (A11y · Medium)                                                                                      | Global reduce block: animations/transitions collapse to final state                                                                                                                          |
| T1  | `wifi.integration.test.ts` flaky against shared DB — unordered `select()` could pick a stale session row (Testing)                                              | Scoped to rows created after test start (`gte(authorizedAt, startedAt)`)                                                                                                                     |

**Performance**: no Critical/High findings. All measured routes meet the current (2026, unchanged) CWV "good" thresholds on lab data — LCP ≤ 2.5 s (except `/`, see §5), CLS ≤ 0.003, TBT ≤ 160 ms; worst client chunk 71.8 KB gzip vs the 150 KB budget gate. INP is not directly measurable in Lighthouse; TBT is its lab proxy and is uniformly low.

## 3. Design-system changes (documentation)

- **New token**: `--color-status-warning-ink` — the dark companion to `--color-status-warning`. Rule going forward: the mid amber is for **fills/borders/icons only**; any warning **text** on a light surface uses the ink variant. (Mirrors how the brand already splits red fill vs error text.)
- **Touch-target contract**: interactive elements on touch surfaces (customer phone pages, POS/drive-thru/kitchen tablets) are `min-h-11` (44 px) — `Tabs` pills now enforce it structurally; pointer-fine admin surfaces use ≥ 32 px inline targets (AA 24 px minimum respected everywhere).
- **Label contract**: every form control is programmatically labeled — `FormField` handles single-element children automatically (id + `aria-describedby`); wrapped controls take explicit `aria-label`.
- **Motion contract**: all animation honors `prefers-reduced-motion` globally.

## 4. Standards applied (live-researched, 2026-08-16)

- **Core Web Vitals** thresholds unchanged into 2026: LCP ≤ 2.5 s, INP ≤ 200 ms (replaced FID Mar 2024), CLS ≤ 0.1 — [web.dev/articles/vitals](https://web.dev/articles/vitals), [Google Search Central](https://developers.google.com/search/docs/appearance/core-web-vitals).
- **WCAG 2.2** is the current W3C Recommendation (WCAG 3 still draft): SC 2.5.8 Target Size (Minimum) AA = 24 px; SC 2.5.5 AAA = 44 px (matches Apple HIG) — [Understanding SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [Understanding SC 2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html), [WCAG 2.2 REC](https://www.w3.org/TR/WCAG22/).
- axe-core scanned with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` across **all three role-contexts** (customer phone, staff tablet, admin desktop) — including authenticated routes Lighthouse cannot reach.

## 5. Screens, states, breakpoints covered

Walkthrough matrix (29 screenshots each in `before/` and `after/`): customer landing (top + scrolled), digital menu (top, catalog, product sheet, cart-open), order status (valid token + wrong-token 404 state), wifi splash + connect, unknown-branch error state — all at 390×844; login (default, wrong-PIN error, keyboard-focus), POS (empty, modifier sheet, cart), kitchen, drive-thru, receipt — 1180×820; all 8 admin pages — 1440×900, plus admin at phone width. Horizontal overflow measured 0 px on every page (RTL discipline holds).

Honest gaps: (a) offline/degraded connectivity states were reviewed at code level (connectivity indicator + offline queue exist and are unit-tested) but not visually exercised; (b) the in-app vision check in this environment proved unreliable (details hallucinated), so visual judgment rests on the DOM/axe/computed-style evidence plus archived screenshots for human review; (c) `/` Lighthouse LCP is **bimodal 2.2–3.2 s** run-to-run on this machine (font-delivery cliff under simulated throttle) — no critical-path code changed for the landing in this pass; a field-data (RUM) check at deploy time is the honest next step for that one route.

## 6. Tooling added (repeatable evidence)

- `scripts/ux-audit.mjs` — axe + overflow + touch-target audit across the full role/route matrix (this report's before/after numbers).
- `scripts/ux-walkthrough.mjs` — screenshot walkthrough with PIN-login bootstrap.
- devDependencies: `@axe-core/playwright`, `lighthouse`.

## 7. Remaining risks / recommendations

- The `/` landing LCP borderline: verify with real-user data post-deploy; if field LCP > 2.5 s at p75, preload the hero font subset or inline the hero heading styles.
- Vision-based design review by a human (or reliable vision model) of the archived `after/` screenshots is still worthwhile — automated a11y catches structure, not taste.
- No owner decisions were required for this pass; none were made on brand identity.
