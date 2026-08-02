# Technical & Product Specification
## Ayasofia Sweet — Integrated Ordering, Inventory & POS Platform

| | |
|---|---|
| **Version** | 2.1 (Brand Identity Added) |
| **Date** | August 2, 2026 |
| **Status** | Ready for Phase 0 (Discovery) |
| **Primary audience** | You (engineer/owner-side), plus AI coding agents (OpenCode, Cline) as execution context |

### Changelog — v2.1
Section 11 was rebuilt from a generic assumption into a real Brand Identity System, derived from the actual logo asset (colors extracted programmatically, typography verified against real licensed fonts). Key correction: the brand is bold saturated red/white pop branding, not a soft pastel palette as previously assumed. Scope confirmed as digital-product-only for now; physical decor guidance is deferred until interior photos are available. See §11 for the full system, including implementation-ready color tokens.

### Changelog from v1.0
This version was audited against v1.0 for completeness and gaps, then rebuilt in English (the working language for the coding agents) with the business's real profile embedded. Material changes:
- Added a first-class **Business Profile** section grounding every decision in the real brand, not a generic café.
- Added **Drive-Thru** as a first-class order channel — it was absent in v1 and materially changes the POS and KDS flows.
- Replaced the generic "size/sugar" modifier example with a **bubble-tea-accurate modifier model** (sugar %, ice %, toppings, size) — this is an industry-standard pattern for this product category, not a guess.
- Rewrote the **Design System** section to match the actual brand identity (Taiwanese/East-Asian dessert café, bilingual, social-media-forward) instead of a generic "warm coffee tones" assumption.
- Set a working default **currency (₪ ILS)**, since NIS is the de facto retail currency across the West Bank — still fully configurable.
- Added an explicit, named **Standards & Compliance Baseline** section (WCAG, OWASP, Core Web Vitals, SemVer, 12-Factor) so "best practice" isn't just asserted, it's anchored to recognized references.
- Restructured the whole document into a standard industry PRD/tech-spec shape: Goals/Non-Goals, Assumptions, Open Questions — sections a genuinely rigorous spec should not skip.

---

## 1. Business Profile

| Field | Value |
|---|---|
| **Brand name** | Ayasofia Sweet — حلويات آيا صوفيا |
| **Concept** | First Asian-specialty coffee house in the area: Taiwanese bubble tea (Boba/Bubble Tea) + Japanese & Korean desserts |
| **Positioning line** | "From Taiwan to Qalqilya 🇹🇼" |
| **Phone / WhatsApp** | +972 56-645-8003 |
| **Address** | Al-Wad Street, next to Al-Murabiteen Mosque, Qalqilya |
| **Service channels** | Dine-in, takeaway, **Drive-Thru** |
| **Audience signal** | Bilingual (Arabic/English) branding, emoji-forward, social-media-active tone → target audience is young, mobile-first, Instagram/TikTok-influenced |

This profile is not decorative — it directly drives three engineering decisions below: the order-channel model (Drive-Thru), the product/modifier schema (bubble tea customization), and the visual design language (vibrant East-Asian dessert-café identity, not a generic coffee-shop template).

---

## 2. Engineering Philosophy

1. **"Professional" means correctly-sized, not maximally complex.** A single-location shop does not need microservices, container orchestration, or a distributed architecture. Recommending that here would be a genuine engineering mistake, not a sign of rigor. We use a **Modular Monolith**.
2. **This system touches real money and real inventory.** Every decision defaults toward data integrity and auditability over visual polish when the two are in tension.
3. **No inflated timelines.** A system you can actually trust with daily revenue takes weeks of reviewed work, even with strong AI coding agents — not days. This document plans for that reality.

---

## 3. Goals and Non-Goals

**Goals**
- Fast, reliable order entry across dine-in, takeaway, and Drive-Thru.
- Automatic inventory deduction tied to real recipes (critical for bubble tea, where toppings and bases are tracked separately).
- A customer-facing ordering surface reachable via QR code, no app install.
- Daily/weekly reporting the owner can act on (best sellers, margins, cash reconciliation).
- A distinct, on-brand interface — not a generic admin-panel look.

**Explicit Non-Goals (for v1)**
- No multi-branch support (the data model allows it later without a rewrite, but we are not building it now — see §9).
- No built-in online payment gateway in Phase 1 (cash/POS-terminal first; digital payment is a researched add-on, see §15).
- No native mobile app. A PWA covers the need at a fraction of the cost and maintenance burden.
- No loyalty/rewards engine in v1 — flagged as a strong Phase-6 candidate given the social-media-savvy audience, not core to daily operations.

---

## 4. Architecture Decision

**Pattern:** Modular Monolith — one deployable Next.js application, internally organized into clearly bounded modules (POS, Inventory, Ordering, Admin). This keeps operational overhead near zero for a solo/small-team operation while leaving a clean seam to split out a module later *if* real scale ever justifies it — which is unlikely and should not be pre-optimized for.

**Why not microservices:** materially higher operational cost, requires dedicated DevOps capacity, introduces distributed-system failure modes with no corresponding benefit at this load. Rejected deliberately, not by default.

**Application shape:** server-rendered web app (Next.js App Router) rather than a separate SPA + API. Lower operational complexity, better performance on low-end in-store hardware (tablets), single deploy target.

**Entry surfaces (routes), same codebase:**
- `/pos` — cashier terminal (staff-authenticated)
- `/kitchen` — live prep queue (barista/kitchen display)
- `/drive-thru` — speed-optimized staff order entry for the car lane
- `/order/[qr-id]` — customer self-order page (no login)
- `/admin` — owner dashboard: reports, inventory, menu, settings

---

## 5. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | **TypeScript** everywhere | Type safety prevents silent arithmetic errors in totals/inventory; a single language reduces context-switching cost for both OpenCode and Cline |
| Framework | **Next.js 15+ (App Router)** | One codebase for UI + server logic; the best-documented React framework, which materially improves AI-agent output quality |
| Database | **PostgreSQL via Supabase** | Relational integrity with real ACID transactions — non-negotiable for money and stock; deliberate rejection of NoSQL here |
| Data access | **Drizzle ORM** | Type-safe, SQL-transparent — you can see and understand exactly what query runs, important at your current skill level |
| Auth | **Supabase Auth** with role claims | Never hand-roll authentication/authorization for a system handling money — that is a real security risk when built quickly |
| Realtime | **Supabase Realtime** (Postgres CDC) | An order placed at `/order` or `/drive-thru` must appear on `/kitchen` within seconds, without polling |
| UI | **Tailwind CSS + shadcn/ui (Radix primitives)** | Genuinely accessible components, fully themeable to a distinct, on-brand look instead of a generic template |
| Offline resilience | **Service Worker + IndexedDB (Dexie.js)** | The POS terminal must keep selling through a brief connectivity drop; transactions queue locally and sync with idempotency keys on reconnect |
| Testing | **Vitest** (unit) + **Playwright** (E2E) | Mandatory, at minimum, on anything that touches totals or stock deduction |
| Monitoring | **Sentry** (free tier) | You find out about a bug before the owner does |
| Hosting | **Vercel** (app) + **Supabase** (data) | Near-zero cost at this scale, scales up without a re-architecture |
| Source control | **Git + GitHub**, Conventional Commits | Non-negotiable baseline for any professional codebase |

---

## 6. Standards & Compliance Baseline

Named explicitly so "best practice" is verifiable, not asserted:

- **Accessibility:** WCAG 2.2 Level AA — minimum touch target size (24×24px per spec, 44×44px recommended for a POS used under time pressure), color contrast ratios, keyboard navigation for the admin dashboard.
- **Security baseline:** OWASP ASVS Level 1 as the minimum bar (input validation, auth/session handling, access control checks on every mutating server action) — appropriate for a small business system; OWASP Top 10 used as the review checklist before go-live.
- **Performance:** Core Web Vitals targets (LCP < 2.5s, INP < 200ms, CLS < 0.1) on the customer-facing `/order` page specifically, since that runs on customers' variable mobile connections.
- **Configuration hygiene:** 12-Factor App principles — strict separation of config/secrets from code via environment variables, no exceptions.
- **Versioning & change management:** Semantic Versioning for releases, Conventional Commits for history, so any future contributor (human or AI agent) can understand what changed and why.
- **Internationalization:** Native Arabic RTL layout (not a mirrored LTR layout) with English as a first-class secondary locale, reflecting the bilingual brand itself.

---

## 7. Order Channels

| Channel | Entry point | Notes |
|---|---|---|
| Dine-in | `/pos` (staff-entered) | Standard counter order |
| Takeaway | `/pos` or `/order` (QR) | Customer may self-order via QR while waiting |
| **Drive-Thru** | `/drive-thru` (staff-entered, speed-optimized) | Minimal-tap flow for the car window; feeds the same KDS queue with a visible "Drive-Thru" tag so kitchen staff can prioritize correctly |
| Delivery *(later phase)* | `/order` with delivery flag | Out of scope for MVP; flagged, not built, until courier/logistics process is confirmed with the owner |

Drive-Thru is not a cosmetic label — it changes two real things: the POS flow must complete in fewer taps than a normal counter order, and the KDS must visually distinguish "car waiting" orders from "table waiting" orders so nothing gets misprioritized during a rush.

---

## 8. System Modules

### 8.1 Point of Sale (POS)
Category-first menu browsing, product customization (see §10), running cart with live totals, tax/discount calculation, multiple payment methods, WhatsApp receipt sharing, **4-digit PIN staff login** — the real-world POS standard (Square, Toast) for fast shift changes, not a slow email/password flow.

**PIN uniqueness requirement:** PIN codes must be unique among active staff. Before saving a new or changed PIN in the future staff-management admin screen, verify it against every other active staff member's hash using the same `verifyPin` function used at login, and reject the save on any match. This is not yet enforced in code because the staff-management screen doesn't exist yet — this note is the guardrail so it isn't forgotten when it's built.

### 8.2 Kitchen/Prep Display (KDS)
Live queue across dine-in, takeaway, drive-thru, and online orders; status states (Received → Preparing → Ready); audible alert on new order; channel tag per ticket (e.g., "🚘 Drive-Thru", "🥤 Table 4").

### 8.3 Customer Self-Order (`/order`)
No login — name + phone only. Full menu browsing with product images, real-time cart, order status tracking after submission. Designed mobile-first given the brand's mobile/social-native audience.

### 8.4 Inventory
Raw ingredients (tapioca pearls, tea bases, milk, toppings, pancake/bingsu components) with precise units; each product linked to a **Recipe (Bill of Materials)** so every sale deducts stock automatically; low-stock threshold alerts; supplier and purchase log; waste log.

### 8.5 Admin Dashboard
Sales reports (daily/weekly), best-sellers, per-item margin, end-of-shift cash reconciliation (Z-report), menu/price management, staff roles, and shop settings (name, address, tax rate, currency, receipt footer).

### 8.6 Settings
Business identity (pre-seeded with the real profile in §1), currency, tax rate, operating hours, receipt footer text.

---

## 9. Data Model (Core Entities)

```
staff            (id, name, role[owner|manager|cashier|barista], pin_hash, active)
branches         (id, name, address, phone)              -- single row today; keeps schema future-proof, not over-built
categories       (id, name_ar, name_en, sort_order)
products         (id, category_id, name_ar, name_en, base_price, image_url, is_available, track_inventory)
modifier_groups  (id, product_id, name, type[single|multi], is_required)   -- e.g. "Sugar Level", "Toppings"
modifiers        (id, group_id, name, price_delta)                        -- e.g. "50% Sugar" (+0), "Pearls" (+2)
ingredients      (id, name, unit, current_stock, reorder_threshold, cost_per_unit)
recipes          (product_id, ingredient_id, quantity_used)
orders           (id, order_number, channel[dine_in|takeaway|drive_thru|delivery], status,
                   customer_name, customer_phone, subtotal, tax, discount, total,
                   payment_method, staff_id, created_at)
order_items      (id, order_id, product_id, selected_modifiers[json], qty, unit_price)
inventory_moves  (id, ingredient_id, delta_qty, reason[sale|purchase|waste|adjustment],
                   ref_order_id, created_by, created_at)
suppliers        (id, name, phone, notes)
purchases        (id, supplier_id, total_cost, status, created_at)
shifts           (id, staff_id, opened_at, closed_at, opening_cash, closing_cash, total_sales)
settings         (key, value)
```

Every stock movement carries a reference and a reason; every order is fully reconstructable after the fact. This is what makes the system auditable rather than merely functional.

---

## 10. Product & Modifier System — Bubble Tea Accurate

This is the part most generic POS templates get wrong for this category. The modifier structure below reflects the actual global bubble-tea ordering convention, not a simplified guess:

| Modifier group | Type | Typical options |
|---|---|---|
| **Size** | Single-select | Regular / Large |
| **Sugar level** | Single-select | 0% / 25% / 50% / 75% / 100% |
| **Ice level** | Single-select | No Ice / Less Ice / Regular / Extra Ice |
| **Toppings** | Multi-select, priced individually | Tapioca pearls, popping boba, grass jelly, pudding, cheese foam, red bean, etc. |

Desserts (bingsu, soufflé pancakes, etc.) typically need a lighter model — size and topping only, no sugar/ice logic — so the schema treats modifier groups as per-product, not global, letting each menu item define only the groups it actually needs.

---

## 11. Brand Identity System

Unlike v2.0, this section is no longer inferred — it is derived directly from the actual logo asset (programmatic color extraction + typographic analysis), audited for correctness. Scope confirmed with the owner-side stakeholder: **digital product only** for now (POS/ordering app); physical decor is out of scope until interior photos are available.

### 11.1 The Mark — What It Actually Is

The logo is not a decorative icon; it's a functional monogram. The straw bends to form the initial "S," and the cup base carries a 6-dot grid representing tapioca pearls. This dual meaning (product + initial) means **the icon works standalone**, without the wordmark — a real, testable property, not every logo has it. This is the app icon and favicon by default.

**Correction from v2.0:** the previous draft assumed a soft pastel East-Asian café palette (blush/lavender/mint). That was wrong. The real identity is deliberately stark: pure saturated red and white only, no gradient, no third color. It reads as confident, high-energy pop branding — closer to a bold modern QSR mark than a "kawaii" dessert aesthetic. Every choice below follows from this correction.

### 11.2 Color System

Extracted directly from the source file (not estimated):

| Token | Hex | Role |
|---|---|---|
| `brand.red` | **#DC0000** | Primary accent — CTAs, active/selected states, brand header, channel tags (e.g. Drive-Thru badge) |
| `brand.cream` | `#FAF6F3` | Base background for staff-facing screens (POS, Admin) — a warm off-white, not stark white |
| `brand.ink` | `#2B1D1D` | Primary text — warm near-black, not pure `#000`, stays cohesive with the cream base |
| `border.subtle` | `#E8DEDB` | Card borders, dividers |
| `text.secondary` | `#6B5C5C` | Timestamps, helper text |

**Functional colors — deliberately separate from brand red:**

| Token | Hex | Role |
|---|---|---|
| `status.success` | `#16A34A` | Order ready, payment confirmed |
| `status.warning` | `#F59E0B` | Low stock, pending action |
| `status.error` | `#9F1239` | Failed transaction, destructive action |

**Why error isn't red:** the brand color *is* red. If red also means "error," staff lose the ability to distinguish "primary action" from "something is wrong" at a glance — a real usability failure, and a violation of the WCAG "don't rely on color alone" principle once you also consider that two different meanings share one hue. `status.error` uses a distinct, less saturated wine tone, always paired with an icon and a text label, never color alone.

**On using red as a full background:** rejected for `/pos` and `/admin`. Full-saturation red as a backdrop for an 8-hour shift is a real ergonomic problem (eye fatigue, and it visually competes with itself for attention). Red stays reserved for *meaning* — action, selection, brand presence — on a calm cream base. `/order` (the customer-facing screen, used for seconds at a time) is the one surface where a bold red hero header is appropriate and on-brand.

**Implementation-ready tokens:**
```js
// tailwind.config token extension
colors: {
  brand: { red: '#DC0000', cream: '#FAF6F3', ink: '#2B1D1D' },
  border: { subtle: '#E8DEDB' },
  status: { success: '#16A34A', warning: '#F59E0B', error: '#9F1239' },
}
```

### 11.3 Typography

The logo's lettering is a thick, rounded, lowercase-forward display style with no sharp terminals anywhere. The closest real, licensed, production-ready match — verified, not guessed — is Ek Type's **Baloo 2** superfamily, which ships a matching Arabic sibling:

| Use | Family | Notes |
|---|---|---|
| Display / headers / product names | **Baloo 2** (Latin) + **Baloo Bhaijaan 2** (Arabic) | Free, SIL Open Font License (commercial use permitted), on Google Fonts, purpose-built for bilingual Arabic/Latin layouts — same design language as the logo itself |
| Body / prices / tables / receipts | **Inter** (Latin) + **IBM Plex Sans Arabic** or **Noto Sans Arabic** | Neutral, highly legible at small sizes, strong tabular figures for prices — the playful display font is reserved for brand moments, not dense numeric data |

**Rule:** Baloo appears in category headers, the KDS order number, and the `/order` page hero — everywhere the brand should feel present. Prices, receipts, and admin tables use the body font, because a bubbly display font hurts legibility exactly where accuracy matters most.

### 11.4 Shape Language & Iconography

Every rounded element in the mark (cup, straw curve, dot grid, letterforms) sets the rule: **no sharp corners anywhere in the UI.**

| Token | Value | Applied to |
|---|---|---|
| `radius.sm` | 8px | Badges, tags |
| `radius.md` | 16px | Buttons, inputs, cards |
| `radius.lg` | 24px | Modals, hero sections |
| `radius.full` | pill | Primary CTA buttons |

- Icons: consistent 2px stroke, rounded line caps (`stroke-linecap: round`) — matches the mark's thick, soft strokes.
- **Recurring motif:** the 6-dot tapioca grid from the logo, reused as a subtle decorative pattern in empty states and loading indicators — a distinctive brand touch tied to the actual product, not a generic spinner.

### 11.5 Motion

Interactions use spring/elastic easing, not linear cuts — a bounce on button press, a bounce-in on a new KDS order — consistent with the round, soft-edged visual language. Sharp, mechanical transitions would visually contradict the mark.

### 11.6 Logo Usage Rules

- **Clear space:** minimum padding around the mark equal to the cap-height of the "A" in the wordmark, on all sides.
- **Minimum size:** icon-only mark down to 32px (app icon, favicon); full lockup not smaller than ~120px wide.
- **Required variant for thermal receipts:** a single-color black version of the icon-only mark — standard 80mm receipt printers print black on white only; the full-color version cannot be used there. This variant does not yet exist and should be produced (flat black vector) before Phase 1 receipt work.
- **Don't:** recolor the mark outside brand red/white/black, stretch the lockup, place the full-color version on a busy photographic background without a solid safe area behind it.

### 11.7 Per-Surface Application

| Surface | User | Design priority | Brand expression |
|---|---|---|---|
| `/pos` | Staff, time pressure | Large touch targets, minimal taps, high contrast | Cream base, red pill-shaped CTAs, Baloo category headers, body-font prices |
| `/drive-thru` | Staff, extreme time pressure | Fewer taps than `/pos`; top items pinned | Same system, denser layout, no decorative elements |
| `/kitchen` | Barista, reading from a distance | Very large text, unmistakable status color | Boldest surface — red Drive-Thru tags, huge Baloo order numbers, green/amber status |
| `/order` | Customer's own phone | Appetizing imagery, zero friction, mobile-first | Most brand-forward — red hero header with white mark, cream content area, bounce-in add-to-cart |
| `/admin` | Owner, calmer session | Clear reports over decorative charts | Calmest surface — red used sparingly for primary actions only; charts use neutral tones, not red, so profit/loss isn't misread as an alert |
| Receipts | Anyone (paper) | Legibility in thermal print | Black icon-only mark, plain-text tagline, no color |

---

## 12. Non-Functional Requirements

- **Offline resilience:** every sale is written to IndexedDB immediately and synced with an idempotency key on reconnect — a POS that dies with the Wi-Fi is not production-ready.
- **Security:** role-based access control (a cashier cannot see margins; only a manager/owner can edit prices), secrets only in environment variables, an audit log on every price or stock adjustment.
- **Backups:** automatic daily database backups (native to Supabase).
- **Performance:** see Core Web Vitals targets in §6.
- **Accessibility:** see WCAG 2.2 AA baseline in §6.

---

## 13. Phased Roadmap — with Definition of Done

**Phase 0 — Discovery (before any code)**
Full real menu with prices, base recipes/toppings per bubble-tea item, actual payment methods accepted in-store, confirmation of currency (₪ assumed, confirm), whether a receipt printer already exists.
*DoD: a spreadsheet of real seed data, ready to load — not placeholder data.*

**Phase 1 — Core POS**
PIN login, menu browsing with bubble-tea modifiers, cart, totals, order persisted.
*DoD: 20 consecutive real test sales completed end-to-end with zero calculation errors.*

**Phase 2 — Inventory Wired In**
Every sale deducts the correct ingredient quantities via recipes; low-stock alerts fire correctly.
*DoD: selling 10 identical drinks deducts exactly the expected tapioca/milk/tea quantities.*

**Phase 3 — Drive-Thru + Customer Ordering + KDS**
`/drive-thru` fast flow live; `/order` QR flow live; both appear on `/kitchen` in real time with correct channel tags.
*DoD: an order placed from a phone off the in-store network appears on `/kitchen` in under 3 seconds.*

**Phase 4 — Reporting**
Daily sales, best sellers, margin per item, end-of-shift Z-report.
*DoD: the Z-report matches a manual cash count exactly.*

**Phase 5 — Hardening**
Offline-mode testing, backup verification, final security pass against the OWASP checklist, and a **mandatory one-week parallel run** alongside whatever manual process is used today before full cutover. This step is not optional for a system handling real daily revenue.

**Phase 6 — Candidate enhancements (post-launch, not MVP)**
Loyalty/rewards program (strong fit given the social-media-native audience), shareable order-card image for Instagram/TikTok, digital drive-thru menu board, online payment integration.

---

## 14. Division of Labor Across Your Tools

| Task | Best-fit tool | Why |
|---|---|---|
| Database schema, inventory-deduction logic, complex queries | **OpenCode (Go plan)** | Strong multi-file agentic reasoning, terminal-native, well suited to precise backend logic |
| Building `/pos`, `/drive-thru`, `/kitchen`, `/order` screens iteratively | **Cline (ClinePass)** | Plan/Act mode with per-change diff review — matches your intermediate skill level, you stay in control of every edit |
| OCR of supplier invoices to auto-populate inventory purchases | **StepFun** | Multimodal (vision) models, strong Arabic support |

**One rule that matters more than any tool choice:** never ask an agent to "build the whole system." Ask for one feature, review it, test it, then move to the next. That discipline is what separates code you trust from code you're merely hoping works.

---

## 15. Risks, Assumptions & Items Requiring Local Verification

I'm not a lawyer or accountant — the following must be confirmed locally before go-live, not assumed from this document:
- **Invoicing/tax compliance:** confirm with a local accountant whether formal e-invoicing requirements apply before using this system for official sales records.
- **Currency:** this spec defaults to ₪ (ILS) as the working assumption for a Qalqilya-based business, but confirm with the owner — the settings table supports changing this without a schema change.
- **Digital payment gateways:** if the owner wants in-app digital payment beyond cash/card-terminal, that requires separate research into locally available, compliant providers at implementation time — not assumed here.
- **Drive-Thru hardware:** whether staff will use a handheld tablet at the car window or a fixed terminal affects `/drive-thru` UI sizing — confirm before building that screen.
- **Anonymous user accumulation:** every failed or superseded PIN login creates a persistent anon user in `auth.users`. A scheduled cleanup job must be in place before Phase 5 hardening to purge these — otherwise the auth table grows without bound.

---

## 16. Open Questions (answer before Phase 1 starts)

1. Is the real menu (items, prices, toppings, base recipes) ready as seed data yet?
2. Confirmed payment methods accepted today (cash only? card terminal?).
3. Does a receipt printer already exist, and what model/connection type (USB, Bluetooth, network)?
4. Expected daily order volume (rough estimate) — this doesn't change the architecture, but it sanity-checks the free-tier hosting limits.

---

## Next Step

Once Phase 0 seed data (real menu + recipes) is ready, I can generate the actual Drizzle schema file and scaffold the Next.js project structure directly from this specification — turning this document from a plan into a working starting point.
