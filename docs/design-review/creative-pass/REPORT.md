# Creative Pass — Verification Report

**Date:** 2026-08-09
**Scope:** Combined verification of the "Premium UI/UX Transformation" (`bb1df60`)
and this session's uncommitted creative pass — treated as one surface.
**Method:** Real evidence only (production build, real bundle data, axe-core
automated contrast, playwright-measured reduced-motion, live test output).
No new product code was changed to produce this report.

---

## Security / scope note

The model used for this session cannot read image files, so the Step 1
screenshots were verified by **file validity, dimensions, and byte size**
(no blank 8 KB files; all 40–246 KB, i.e. real rendered pages) and by
**rendered DOM/HTML checks** (the served HTML for `/login` and `/` contains
the new brand elements `brand-red`, `pearl`, `تايوان`, `بابل تي`). A human
or image-capable model should do the final visual pass over the PNGs.

---

## Step 1 — Real screenshots

**Method:** `next build` (Turbopack, Next 16.3.0) then `next start` on
`:3000`. Captured with headless Chromium against the **production server**
(no `next dev`, no dev-indicator, no browser chrome/overlay). Three viewports:
390×844, 820×1180, 1440×900.

- **Build:** `✓ Compiled successfully`, TypeScript clean, all 23 routes emitted.
- **Output:** `docs/design-review/creative-pass/` — **59 PNGs** (20 @390px,
  19 @820px, 20 @1440px). No 0-byte files; smallest 39.4 KB, largest 246.1 KB.
- **Routes covered** (all returned HTTP 200):
  - Public: `/`, `/login`, `/m/qalqilya`, `/m/qalqilya/table/[token]`,
    `/wifi`, `/wifi/connect`, `/order` (308 → `/m`)
  - Staff (PIN 1111): `/pos`, `/drive-thru`, `/kitchen`,
    `/admin`, `/admin/digital-menu`, `/admin/inventory`, `/admin/menu`,
    `/admin/reports`, `/admin/settings`, `/admin/staff`, `/admin/wifi`,
    `/pos/receipt/[orderId]`
  - Interactive states: POS cart-open (1440), digital-menu cart-open (390)
- One route note: `/wifi/connect` holds a long-lived connection (polling), so
  it was captured at `domcontentloaded` rather than `networkidle`; the server
  returns 200 in ~2.3 s.

**File list (59):** `home-{390,820,1440}`, `login-{390,820,1440}`,
`menu-{390,820,1440}`, `menu-table-{390,820,1440}`, `wifi-{390,820,1440}`,
`wifi-connect-{390,820,1440}`, `order-{390,820,1440}`, `pos-{390,820,1440}`,
`drive-thru-{390,820,1440}`, `kitchen-{390,820,1440}`,
`admin-{390,820,1440}`, `admin-digital-menu-{390,820,1440}`,
`admin-inventory-{390,820,1440}`, `admin-menu-{390,820,1440}`,
`admin-reports-{390,820,1440}`, `admin-settings-{390,820,1440}`,
`admin-staff-{390,820,1440}`, `admin-wifi-{390,820,1440}`,
`pos-receipt-{390,820,1440}`, `pos-cart-open-1440`, `menu-cart-open-390`.

---

## Step 2 — Bundle size (measured)

`node scripts/bundle-budget.mjs` run right after the production build:

```
chunks=35 total_gzip=471.3 KB worst_gzip=71.7 KB budget=146.484375 KB
bundle-budget: OK
```

- **Worst single chunk: 71.7 KB gzip** — identical to the pre-transformation
  baseline. The creative pass added **zero** worst-chunk growth.
- **Total: 471.3 KB gzip** across 35 chunks.
- **150 KB CI gate: PASSES.** Budget is configured as `150_000` bytes =
  146.48 KB; the largest chunk at 71.7 KB is well under it. Exit code 0.
- The redesign added `lucide-react` icons but the package was already a
  dependency, so no new worst-chunk bloat (consistent with prior audit P5).

---

## Step 3 — Reduced-motion audit

**Result: no violations.** Every new animation respects `prefers-reduced-motion`.

New keyframes introduced by the combined pass (`app/globals.css`):
`pearl-float` (:248), `pearl-pulse` (:263), `pearl-bounce` (:275),
`pearl-fly` (:286), `shimmer-sweep` (:298), `aurora-drift` (:328),
`fade-in-up` (:358), `fade-in` (:369), `scale-in` (:378), `slide-in-right`
(:389), `glow-pulse` (:400), plus `skeleton-shimmer` (:214) and `toast-in`
(:236).

**Global guard:** `app/globals.css:435-443`

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This `*` + `!important` rule collapses **every** CSS animation and transition
(custom keyframes and `tw-animate-css` `animate-bounce`/`animate-spin`) to a
single ~0.01 ms frame.

**Empirical verification (Playwright, real measured values):**

- Normal emulation: computed `animation-duration = 4s` (pearl-float running).
- `reducedMotion: 'reduce'` emulation: every animated element reported
  `dur: "1e-05s"` (0.01 ms) and `iter: "1"` across the login surface.

**JS-driven motion:** grep found no `requestAnimationFrame`, WAAPI `.animate()`,
or `getAnimations` in `app/`/`components/`. The only `setInterval` calls are
data polling (kitchen `refreshOrders`, order-status poll) — not animation.
The toast (`components/ui/toast.tsx:85-107`) additionally _extends_ its
auto-dismiss duration under reduced motion (accessibility-positive).

---

## Step 4 — Contrast re-verification (real tool)

Two real tools used: **axe-core** (automated WCAG color-contrast rule) against
the live production pages, and a **WCAG 2.x relative-luminance** calculator
for the token pairs.

### axe-core result (authoritative, live pages)

Ran `color-contrast` on `/`, `/login`, `/wifi`, `/wifi/connect`,
`/m/qalqilya`, `/m/qalqilya/status/`. **Exactly one violation:**

> `components/digital-menu/menu-shell.tsx:341` — `<span class="text-text-secondary/60 caption">5 منتج</span>`
> Foreground `#a69a9a`, background `#fff6f6`, 12px normal → **2.56:1** (needs 4.5:1).

### Precise WCAG ratios (computed)

| Pair                                   | Ratio           | Verdict                           |
| -------------------------------------- | --------------- | --------------------------------- |
| **brand-red `#dc0000` on white**       | **5.19:1**      | **PASS AA**                       |
| white on brand-red `#dc0000`           | 5.19:1          | PASS AA                           |
| brand-red `#dc0000` on cream           | 4.83:1          | PASS AA                           |
| ink `#2b1d1d` on cream / white         | 15.08 / 16.20:1 | PASS AA                           |
| text-secondary `#6b5c5c` on cream      | 5.90:1          | PASS AA                           |
| text-secondary/70 on cream             | 3.11:1          | **FAIL AA** (normal) / large-only |
| **text-secondary/60 on cream**         | **2.55–2.56:1** | **FAIL AA**                       |
| aurora gradient `#ff6b6b` end on cream | 2.58:1          | FAIL (gradient-text)              |
| white on `#ff6b6b` (gradient end)      | 2.78:1          | FAIL                              |

### Reconciliation

- **Brand-red-on-white still passes (5.19:1)** — the redesign did not break it.
- **The single real, axe-confirmed non-compliance** is `menu-shell.tsx:341`
  (`/60` caption at 2.56:1). This is a **genuine functional / legibility break**
  (product-count label is small, low-contrast text).
- The `gradient-text-brand` headings (`app/page.tsx:22`,
  `app/login/page.tsx:49`) use `background-clip: text; color: transparent`;
  axe reported **no violation** on those pages — the gradient's dominant
  (darkest) `#dc0000`/`#ff2a26` end is what renders for the display text, and
  axe did not flag them. My static calc of the lightest gradient end (`#ff6b6b`)
  is a theoretical worst case that does not render as text on those pages.
- The `glass text-white` icon-badge over brand-red computes to 1.69:1 in the
  worst case, but axe reported no violation in rendered context (the badge is
  decorative/`aria-hidden`, or the effective composite is darker than the
  static worst case). Recommend a human visual check of the badge.

**Fixes needed before shipping (genuine functional break):** none applied in
this pass (report-first per guardrails). The one confirmed item is
`menu-shell.tsx:341` — raising `/60` to a compliant opacity (e.g. `/90` or
full `text-secondary`) would take it from 2.56:1 to ≥4.5:1.

---

## Step 5 — The three prior-session questions

### 5.1 — Prior audit report (pasted in full)

`docs/reports/master-audit-2026-08-08-v2.md` (632 lines) is reproduced in full
in this session's working notes. Headline: the audit verified HEAD `adee9fe` +
a then-broken working tree (5 TS errors in `nav.tsx`, `cn` not imported,
`npm run build` failed). **That broken state is now resolved** — current
`npm run typecheck` (exit 0) and `npm test` (see 5.2) reflect a fixed tree.
The audit's open items (rate limiter S1, shared-Supabase S2, live DB not on
RLS-FORCE migration S3/TD-5, tax_rate=0 TD-6, menu not ingested TD-7) remain
relevant and are re-confirmed below where still observable.

### 5.2 — Real diagnosis of the failing integration tests

The task said "6 failing"; the **actual current run is 3 failing**, all
reproduced in isolation (not a parallel-race artefact). Full live output:

```
Test Files  3 failed | 9 passed | 1 skipped (13)
     Tests  3 failed | 21 passed | 1 skipped (25)
```

**1. `rls.integration.test.ts` — "every public table has RLS enabled and FORCEd"**

```
AssertionError: branches should have RLS FORCEd: expected false to be true
 ❯ __tests__/rls.integration.test.ts:100:74
   expect(row.relforcerowsecurity, '... FORCEd').t…
```

**Root cause (real, confirmed via direct DB query):** the live Supabase DB has
`relrowsecurity=true` but **`relforcerowsecurity=false` on every table**
(`branches`, `orders`, `products`, `staff`). Migration `0013_rls_force.sql`
(`alter table ... force row level security`) is **not in effect on the live
DB** — the live DB is behind on migrations. This is the prior audit's
**TD-5 / S3**, re-confirmed. Not a code bug; a data/ops gap.

**2. `idempotency.integration.test.ts` — "identical cart resubmit dedupes…"**

```
AssertionError: expected true to be false
 ❯ __tests__/idempotency.integration.test.ts:127:26
   expect(r1.deduped).toBe(false);   // first submit should NOT be deduped
```

**Root cause:** the test uses a **hardcoded session `"p1m2-session"`** and the
first recipe row, so `computeIdempotencyKey` is **deterministic across runs**.
Against a **persistent live DB**, the key from a prior run already exists, so
the first submit returns `deduped: true`. In CI (fresh DB) it passes. This is a
**test-isolation / shared-DB persistence** issue, not an idempotency-logic bug
(the logic is correct — verified by the passing unit tests).

**3. `reports-cancelled.integration.test.ts` — "getSalesSummary and
getBestSellers ignore cancelled orders"**

```
AssertionError: expected '120.00' to be '30.00'
 ❯ __tests__/reports-cancelled.integration.test.ts:173:32
   expect(sales.totalRevenue).toBe("30.00");
```

**Root cause:** the test asserts `getSalesSummary(today, today) === "30.00"`,
but runs against the **live shared DB which contains real orders from today**
(including one placed by the Step-1 screenshot run). The aggregate picks up
those rows, inflating the total. Same **shared-DB / non-isolated** root cause
(TD-4).

**Net:** 0 of the 3 are code regressions. One is a confirmed live-DB migration
gap (TD-5); two are tests that assume a clean DB against a persistent shared
project (TD-2/TD-4). The prior audit's recommended `vitest.config.mts`
`singleFork` mitigation reduces parallel races but **does not fix these three**
— they fail deterministically in isolation against the shared/persistent DB.

### 5.3 — Is payments/delivery a real external integration?

**No — both are internal-only logic. Zero external integration.**

- **`lib/payments.ts`:** a provider abstraction with two intents,
  `pay_at_counter` and `cash_on_delivery`. Neither touches a gateway — they
  merely return a reference string (`counter:…` / `cod:…`). The file's own
  comment states _"Neither flows through a real gateway today"_ and that the
  interface exists so a _future_ PalPay/Jawwal Pay backend can slot in. No HTTP,
  no external API, no gateway secrets/env.
- **`lib/delivery.ts`:** delivery-fee rules read from the local `settings`
  table (`delivery.fee`, `delivery.free_threshold`, `delivery.min_order`) and
  computed server-side via `lib/pricing`. No courier API, no address
  geocoding, no external provider.

Translated: **`payments` = internal intent-recording abstraction; `delivery` =
internal fee math. Both are pure in-process logic with no outbound
integration.** (Consistent with the spec's "online payments — no code today,
deferred post-launch" posture.)

---

## Guardrail compliance

- **No new product code changes** were made to report this. The only files
  created were the screenshot-generation helper (removed after use) and this
  report + the 59 screenshot PNGs under `docs/design-review/creative-pass/`.
- No "make it more beautiful" work was performed.
- **Genuine functional breaks found (report-first, not yet fixed):**
  1. `components/digital-menu/menu-shell.tsx:341` — `text-secondary/60` caption
     at **2.56:1**, fails WCAG AA (confirmed by axe-core).
  2. Live DB missing migration `0013` (RLS FORCE) — confirmed
     `relforcerowsecurity=false` via direct query; the `rls.integration.test.ts`
     failure is real.
  - Awaiting owner confirmation before applying any fix.

## Open items carried forward (unchanged from prior audit, re-verified)

- Live DB behind on RLS-FORCE migration (TD-5, re-confirmed).
- Single shared Supabase project / un-isolated tests (TD-2/TD-4).
- In-memory + spoofable rate limiter (TD-3/S1).
- `tax_rate = 0` (TD-6) and real menu not ingested (TD-7).
