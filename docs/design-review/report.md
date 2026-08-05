# Design Review — Delta Report

## Step 0 — Baseline Capture

**Status:** Complete.

Captured full-page screenshots of every surface at two viewports each into `docs/design-review/before/`:

| Surface                             | Viewport | File                                                                 |
| ----------------------------------- | -------- | -------------------------------------------------------------------- |
| `/login`                            | 1440×900 | `login-1440x900.png`                                                 |
| `/pos` (empty)                      | 1440×900 | `pos-empty-1440x900.png`                                             |
| `/pos` (cart open + modifier sheet) | 1440×900 | `pos-cart-open-1440x900.png`, `pos-modifier-sheet-open-1440x900.png` |
| `/pos` (mobile)                     | 390×844  | `pos-390x844.png`                                                    |
| `/drive-thru`                       | 1440×900 | `drive-thru-1440x900.png`, `drive-thru-cart-open-1440x900.png`       |
| `/kitchen`                          | 1440×900 | `kitchen-1440x900.png`                                               |
| `/order` (browsing)                 | 390×844  | `order-390x844.png`                                                  |
| `/order` (cart open)                | 390×844  | `order-cart-open-390x844.png`                                        |
| `/order/status/[id]`                | 390×844  | `order-status-<uuid>-390x844.png`                                    |
| `/admin` (dashboard)                | 1440×900 | `admin-dashboard-1440x900.png`                                       |
| `/admin` (inventory)                | 1440×900 | `admin-inventory-1440x900.png`                                       |
| `/admin` (reports)                  | 1440×900 | `admin-reports-1440x900.png`                                         |
| `/admin` (menu)                     | 1440×900 | `admin-menu-1440x900.png`                                            |
| `/admin` (staff)                    | 1440×900 | `admin-staff-1440x900.png`                                           |
| `/admin` (settings)                 | 1440×900 | `admin-settings-1440x900.png`                                        |

Playwright test file: `e2e/design-review.spec.ts` (15 tests, all passing).

---

## Step 1 — Design Token Compliance Audit

**Status:** 2 violations found and fixed.

### Finding 1: Tailwind default neutral class `text-zinc-500`

- **File:** `app/login/page.tsx:10`
- **Before:** `<p className="mt-2 text-sm text-zinc-500">`
- **After:** `<p className="mt-2 text-sm text-text-secondary">`
- **Rationale:** `text-zinc-500` is a Tailwind default palette class. The spec §11.2 defines `text.secondary` (`#6B5C5C`) for helper text — this is the correct token.

### Finding 2: Tailwind default shade `hover:bg-red-50`

- **File:** `app/(admin)/admin/menu/menu-shell.tsx:130`
- **Before:** `className="text-status-error rounded px-2 py-0.5 text-xs hover:bg-red-50"`
- **After:** `className="text-status-error rounded px-2 py-0.5 text-xs hover:bg-status-error/10"`
- **Rationale:** `bg-red-50` is a Tailwind default palette class. The spec §11.2 defines `status.error` (`#9F1239`) with `/10` opacity for subtle error tinted backgrounds.

### No other violations found.

All other color usage in `app/` and `components/` uses the defined `--color-brand-*`, `--color-border-*`, `--color-text-*`, and `--color-status-*` tokens, or uses `bg-white`/`text-black` which map to the shadcn/ui semantic `--color-card`/`--color-card-foreground` tokens (functionally equivalent, intentionally neutral for card surfaces).

---

## Step 2 — Typography Hierarchy Audit

**Status:** 2 ad-hoc font sizes normalized.

### Font-family compliance

- `font-heading` (Baloo 2 / Baloo Bhaijaan 2) is used **only** for: page titles, product names, category headers, brand moments, and KDS order numbers. ✓
- Default `font-sans` (Inter / Noto Sans Arabic) is used for all body text, prices, tables, timestamps, and dense data. ✓
- No violations of the spec §11.3 rule.

### Type scale normalization

- **File:** `app/(pos)/drive-thru/drive-thru-shell.tsx:125`
  - **Before:** `text-[10px]` on "تخصيص" label
  - **After:** `text-xs` (12px)
- **File:** `app/(pos)/drive-thru/drive-thru-shell.tsx:242`
  - **Before:** `text-[10px]` on modifier buttons
  - **After:** `text-xs` (12px)
- **File:** `components/ui/button.tsx:26`
  - **Before:** `text-[0.8rem]` (~12.8px) on `size="sm"` variant
  - **After:** `text-xs` (12px)

The established scale is: `xs` (12px), `sm` (14px), `base` (16px), `lg` (18px), `xl` (20px), `2xl` (24px). All ad-hoc values now map to this scale.

---

## Step 3 — Spacing & Grid Consistency Audit

**Status:** Clean — no arbitrary spacing values found.

- Grep for arbitrary Tailwind spacing values (`p-[13px]`, `mt-[7px]`, etc.) across `app/` and `components/` returned **zero matches** outside intentional exceptions.
- The only arbitrary dimension values found are:
  - `max-w-[80mm]` in `app/(pos)/pos/receipt/[orderId]/receipt-client.tsx:74` — intentional, receipt width for 80mm thermal printers.
  - `max-h-[85vh]` in `components/ui/sheet.tsx:58` — intentional, sheet max height.
- All spacing is on the 4px rhythm (Tailwind base unit = 4px). Product cards across `/pos`, `/drive-thru`, and `/order` use consistent internal padding within their respective density tiers (POS/order: `p-3` = 12px, drive-thru: `p-2` = 8px — drive-thru is intentionally denser per spec §11.7).

---

## Step 4 — Shape & Elevation Language Audit

**Status:** Consistent. Elevation system documented in spec §11.4.

### Radius consistency

- No `rounded-none` or `rounded-sm` anywhere in `app/` or `components/`. ✓
- All rounded elements use at least `rounded-lg` or higher. ✓
- `rounded-full` used consistently for pills, CTAs, badges, and tags. ✓
- `rounded-2xl` used consistently for cards on `/pos`, `/order`, and status page. ✓
- `rounded-xl` used for cards on `/drive-thru` and `/kitchen` (slightly tighter radius for denser surfaces). ✓
- `rounded-lg` used for inputs and admin form elements. ✓

### Elevation system

Established and applied consistently:

- `shadow-sm` — resting cards (product cards, reports cards, status card)
- `shadow-md` — hover/interactive card states (product card hover)
- `shadow-lg` — overlay layers (toasts, receipt action bar)
- No shadows on `/drive-thru` product cards (intentionally flat per spec §11.7 "no decorative elements")

**Spec update:** Added elevation documentation to `docs/technical-spec.md` §11.4.

---

## Step 5 — Icon Consistency Audit

**Status:** Clean.

- All `lucide-react` icons (`Wifi`, `WifiOff`, `RefreshCw` in `components/connectivity-indicator.tsx`) use `h-4 w-4` (16px) with default `strokeWidth={2}`. ✓
- Inline SVG chevron in `app/(pos)/pos/pos-shell.tsx:184` uses `strokeWidth={2}` and `size-5` (20px). ✓
- Icon-to-text size ratios are intentional: 16px icons next to 14px body text, 20px icon next to 18px cart label text. ✓
- No icon stroke-width outliers found.

---

## Step 6 — Motion Consistency Audit

**Status:** Spring easing extended to all interactive transitions. One shared constant (`ease-spring`) used everywhere.

### Before

- `ease-spring-gentle` used in toast and sheet (different from `ease-spring` used in status)
- POS cart interactions had no spring easing (`transition-colors` only)
- Buttons had no spring easing (`transition-all` only)

### After

- **Unified:** `ease-spring-gentle` replaced with `ease-spring` in toast (`components/ui/toast.tsx:128,129`) and sheet (`components/ui/sheet.tsx:59`).
- **Extended to POS:** All interactive transitions in `app/(pos)/pos/pos-shell.tsx` now use `ease-spring`:
  - Shift button (line 116)
  - Category tabs (line 128)
  - Product cards (line 150)
  - Cart toggle (line 179, 185)
  - Payment buttons (lines 255, 265)
  - Phone input (line 280)
  - Checkout button (line 287)
  - Modifier buttons (line 327)
  - Confirm/cancel buttons (lines 347, 375)
  - Sign-out button (line 409)
- **Extended to Drive-Thru:** All transitions in `app/(pos)/drive-thru/drive-thru-shell.tsx` now use `ease-spring`:
  - Category tabs (line 89)
  - Product cards (line 107)
  - Cart button (line 136)
  - Payment buttons (lines 185, 191)
- **Extended to Order:** All transitions in `app/order/order-shell.tsx` now use `ease-spring`:
  - Category tabs (line 92)
  - Product cards (line 109)
  - Cart toggle (line 139)
  - Quantity buttons (lines 161, 168)
- **Extended to Admin:** All transitions in admin shells now use `ease-spring`:
  - `app/(admin)/admin/nav.tsx:30`
  - `app/(admin)/admin/reports/reports-shell.tsx:297`
  - `app/(admin)/admin/inventory/inventory-client.tsx:38,215,279`
  - `app/(admin)/admin/menu/menu-shell.tsx:160`
- **Extended to Components:**
  - `components/ui/button.tsx:7` — `transition-all ease-spring`
  - `components/ui/toast.tsx:145` — `transition-opacity ease-spring`
  - `components/ui/sheet.tsx:119` — `transition-colors ease-spring`
  - `components/connectivity-indicator.tsx:21` — `transition-colors ease-spring`
  - `components/pin-pad.tsx:121,134,142,157,182,197,210,218` — all `transition-colors ease-spring`
- **Extended to Global Error:** `app/global-error.tsx:31` — `transition ease-spring`

---

## Step 7 — RTL Correctness Deep Audit

**Status:** Clean.

- All major surfaces use `dir="rtl"` and `lang="ar"`. ✓
- Inputs that must be LTR (phone numbers, PIN, cash amounts) use `dir="ltr"`:
  - `app/(pos)/pos/pos-shell.tsx:281` (customer phone)
  - `app/(pos)/pos/pos-shell.tsx:368` (closing cash)
  - `app/(pos)/drive-thru/drive-thru-shell.tsx:202` (customer phone)
  - `app/(pos)/pos/receipt/[orderId]/receipt-client.tsx:74` (receipt)
  - `app/(admin)/admin/inventory/inventory-client.tsx:94` (cost per unit)
  - `app/(admin)/admin/staff/staff-shell.tsx:222,236` (PIN inputs)
  - `app/(admin)/admin/settings/settings-shell.tsx:44` (tax rate)
  - `components/pin-pad.tsx:122` (opening cash)
- Directional icons: the down chevron in `app/(pos)/pos/pos-shell.tsx:184` is direction-neutral (points down in both LTR and RTL). No back/forward arrows or other directional icons that need mirroring were found.
- `formatPrice()` returns Western Arabic numerals (0-9) which render LTR within RTL text flow correctly.
- Phone numbers are stripped to digits only before use in WhatsApp URLs (`app/(pos)/pos/receipt/[orderId]/receipt-client.tsx:23`).

---

## Step 8 — Per-Surface Density/Hierarchy Correctness Check

**Status:** All surfaces match their intended character per spec §11.7.

| Surface       | Intended character                | Verification                                                                             |
| ------------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| `/kitchen`    | Boldest, largest-text             | Red header, `text-2xl font-bold` order numbers, large status colors ✓                    |
| `/order`      | Most brand-forward                | Red hero header with logo, product images, spring bounce on add-to-cart ✓                |
| `/pos`        | Large touch targets, minimal taps | Cream base, red pill CTAs, `font-heading` category headers, body-font prices ✓           |
| `/drive-thru` | Denser, no decorative elements    | Tighter grid (`grid-cols-3`), `p-2` cards, no shadows ✓                                  |
| `/admin`      | Calmest, most restrained          | Cream base, `shadow-sm` cards, red used only for primary actions, neutral chart colors ✓ |

No drift detected during iterative development.

---

## Step 9 — Responsive Integrity Check

**Status:** Clean.

- `/pos` product grid: `grid-cols-2` at base, `sm:grid-cols-3` at 640px+, `lg:grid-cols-4` at 1024px+. At 820px (iPad Mini): 3 columns. ✓
- `/drive-thru` product grid: `grid-cols-3` at base, `sm:grid-cols-4`, `lg:grid-cols-5`. At 820px: 4 columns. ✓
- `/order` product grid: `grid-cols-2` at all sizes. At 375px and 390px: 2 columns. ✓
- No overflow, cramped touch-target, or broken grid issues detected at 375px, 390px, or 820px.
- Cart panels use `max-h-64` (POS) and `max-h-48` (drive-thru) to prevent overflow on small screens. ✓
- Admin sidebar is fixed `w-48` — admin is staff-only and intended for desktop use. ✓

---

## Step 10 — Final Capture + Delta Report

**Status:** Complete.

After screenshots captured into `docs/design-review/after/` using `e2e/design-review-after.spec.ts` (15 tests, all passing). Files match the before set exactly.

### Checklist

- [x] `docs/design-review/before/` exists with full screenshot set
- [x] `docs/design-review/after/` exists with full screenshot set
- [x] `docs/design-review/report.md` documents every finding with evidence
- [x] Zero hardcoded hex colors remain outside the token system (grep-clean in `app/` and `components/`)
- [x] Zero arbitrary spacing values remain (grep-clean)
- [x] All interactive transitions use `ease-spring`
- [x] Lint green (0 errors)
- [x] Typecheck green
