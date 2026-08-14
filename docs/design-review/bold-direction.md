# Bold-Identity Direction — Pilot on `/m/[branchSlug]`

> One-pager. Reviewed before any code is touched.
> The brand is bold saturated red/white pop branding (spec §11.1) — a QSR
> mark, not a "kawaii" dessert aesthetic. The recent premium pass drifted
> toward soft glass, pearls, halos, and shimmer — decoration that softens
> exactly what the mark is loudest about. This pilot goes the other way:
> commit harder to the existing identity, not away from it.

## 1 — Typography scale becomes the loudest thing on the page

The bold direction is not "bigger font-size everywhere." Scale creates
impact at the **few moments the brand is allowed to be loud**:

- **Hero page title** (`أهلًا بك في Ayasofia Qalqilya`): increase to
  `display-1` territory — chunky, tight leading, weight 800 — and
  break onto two lines on mobile by design, not by accident. The English
  wordmark fragment sits inside the same Arabic line, set in Baloo 2
  Latin so the display family owns the moment.
- **Product prices on the grid**: promoted to `font-bold text-base` in
  pure brand-red, no opacity, no "secondary" tone. They should read as
  the second-loudest thing after the hero.
- **Sticky cart total** (right side of the floating bar): same Baloo
  family, weight 800, ~`text-xl` — a price that earns the bottom of the
  screen.
- **Category tabs** (sticky row): tracky `text-sm font-bold` with
  `tracking-[0.04em]` — quiet horizontally-scrolling chips, then the
  active one is a solid red pill with white text (see §4).
- **Everywhere else stays on the established semantic scale** (heading-3
  for product names, `body-sm` for modifier lists, `caption` for
  meta). The display family's job is to be the punctuation, not the
  body copy.

## 2 — Color-blocking replaces gradients and glass

The mark is two colors, full stop. The page should feel the same way.

- **Hero:** flat `#DC0000` background, **no aurora radial-gradient
  overlay**, **no `bg-aurora`**, **no `brand-red-bright` accent
  blending**. One uniform red panel, full-bleed, edge to edge of the
  viewport. White logo, white type, period.
- **Below the fold:** a single solid white panel (`bg-white`) on the
  hero, not a soft cream wash. The `brand-cream` token stays available
  for `/pos` and `/admin` per spec §11.7 — but `/m` is the
  brand-forward surface, and brand-forward means red-and-white, not
  red-and-warm-cream.
- **Sticky category row:** solid white, hairline bottom border, no
  `bg-white/85 backdrop-blur-xl` glass.
- **Hard 1-px hairline** between the red hero and the white panel
  (`border-b border-border-subtle` or an explicit `border-white/100`
  on the hero) — the boundary between the two color blocks should be
  crisp, like a print poster.
- **No background gradients on cards, no `gradient-cream-warm` body,
  no `--gradient-brand-aurora`** anywhere on this page.

## 3 — What gets removed entirely from this page

The drift toward soft/ambient is the failure mode. These come out, and
**must not be reintroduced under any "subtle" name**:

- **Glass / backdrop-blur:** delete `backdrop-blur-md` on the table
  badge, delete `backdrop-blur-xl` on the category row, delete
  `backdrop-blur-sm` on the cart's count chip. The
  `glass` / `glass-dark` utilities stay in the codebase (other
  surfaces may use them later), but the `/m` page must not invoke
  them.
- **Pearl scatter decoration:** delete the `<PearlField
variant="scatter" count={12} />` in the hero. The 6-dot motif
  _belongs_ to the logo (spec §11.4) — it works as the logo, it works
  in the empty-state / loading indicator, and as a **tiny**
  decorative accent. As a floating cloud on top of a red hero it
  reads as confetti, not brand identity.
- **Aurora radial gradient overlay** on the hero (the
  `radial-gradient(... rgba(255,255,255,0.18) ... rgba(0,0,0,0.18) ...)`)
  — out.
- **Film grain `noise` utility** on the today's-suggestion card — out.
  It adds nothing legible and dilutes the bold reading.
- **`blur-3xl` halo blob** behind the today's-suggestion card — out.
- **Shimmer sweep** (`animate-shimmer`) on the sticky cart bar — out.
  The cart is loud enough; shimmer is "look, this is a button" theater
  that contradicts the solid-fill CTA direction.
- **Floating pearl on add-to-cart** (`pearl-fly` animation that arcs a
  small red dot to the cart icon) — out, for the same reason. The cart
  bar visibly fills with a count; that is the feedback.
- **`animate-glow-pulse`, `ring-brand-soft`, `ring-brand-medium`** —
  out on this page. Halos around CTAs are exactly the "soft halo
  glow" the brief excludes.

The brand mark itself — the logo, the 6 dots as the logo, the
chunky Baloo type — does not get reduced. **Decoration is what
comes out; identity stays in.**

## 4 — CTAs become solid fill, not shimmer

- **Sticky cart bar:** solid `bg-brand-red`, `rounded-full` (pill),
  white text, white count chip, white price. **No** `shadow-brand`
  (the heavy red-tinted glow stack), **no** shimmer, **no** `-translate-y-0.5`
  lift on hover. Weight comes from being a 56-px tall saturated red
  pill at the bottom of the screen, not from effects.
- **"Add to cart" confirm in the modifier sheet:** same solid red pill,
  same treatment. Single shadow tier (`shadow-sm`) or none.
- **Selected modifier chip:** solid `bg-brand-red` with white text, no
  shadow, no translate. Unselected chips: white background,
  `border-border-subtle`, brand-ink text. The contrast between
  selected and unselected is the affordance, not a glow.
- **Active category tab:** solid red pill. Inactive: white background,
  thin border. Currently it's the opposite (red text on a soft wash)
  — that's a designer's "subtle" choice that costs legibility.

## 5 — Icon and illustration treatment: bigger, fewer, sharper

- **Product icons on the grid cards:** grow to **64-72 px** (currently
  56 px) inside a flat white square, brand-ink product name, brand-red
  price. The product card is the most-repeated element on the page;
  at 390 px it must read confidently without the user having to
  lean in. No `bg-brand-red-bg` tinted wash around the icon — flat
  white, full stop.
- **The 6-dot motif stays** as the **literal logo 3×2 grid** (one
  unit, rendered via `<PearlField variant="grid" tone="white" />`),
  on the hero — _as part of the mark itself_, not as scattered
  ambient. Anywhere else on the page it does not appear.
- **No `Sparkles` icons** sprinkled in front of "اقتراح اليوم" or
  "الأكثر طلبًا" labels. The bold eyebrow is enough; the sparkle
  icon is the "premium decoration" emoji the brief is moving away
  from.
- **Empty states and loading:** the pearl-bounce loader (3 dots,
  brand red) is kept — it's a small, branded motion and it survives
  the cull. The floating pearl scatter, the shimmer, the aurora
  drift, the pearl-fly arc, the glow-pulse, and the noise do not.

## 6 — What is deliberately NOT changed

- The Logo, IconBadge, Card, PearlField primitives in
  `components/ui/` are **not edited in this task**. They expose
  variants that other surfaces still rely on (the `glass` logo
  surface is used on `/login`; the `noise` / `animate-shimmer`
  utilities are global). Editing them risks breaking routes that
  are out of scope.
- The modifier builder sheet, the cart sheet, and the upsell
  pattern inside them: **structure stays**, only the noise /
  decoration is removed and the typography is promoted to match
  the new scale.
- `idempotencyKey` generation, RBAC checks, pricing math, server
  actions: untouched. This is a surface design pass, not a
  product logic pass.
- The 1440 px and 390 px screenshots are the proof — the
  `/m/qalqilya` page must be re-captured at both viewports
  before this pilot is "done." A description of what changed is
  not the result; the screenshots are.

## 7 — Definition of done, in order

1. This doc approved.
2. `app/m/[branchSlug]/page.tsx` and the components it directly
   composes (the `MenuShell` and the small helpers it imports) are
   edited. No other route touched. No `components/ui/*` primitive
   edited.
3. `npm run lint` clean, `npm run typecheck` clean, `npm test`
   green, `next build` succeeds.
4. `next start` against the production build, real chromium, real
   PNGs at 390×844 and 1440×900 of `/m/qalqilya` (browsing state
   and cart-open state) saved into
   `docs/design-review/bold-pilot/` for owner-side review.
5. The "before" reference set is the existing
   `docs/design-review/after/order-390x844.png` and
   `docs/design-review/creative-pass/menu-{390,1440}.png` — the
   new screenshots are compared against them, not against
   recollection.
