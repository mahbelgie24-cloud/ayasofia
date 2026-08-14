# Step 2 — Header Consistency Report (read-only)

> Comparison of every page-level header against the brand-kit reference's
> "WEB HEADER" panel: small icon + bold "Ayasofia" wordmark, dark text on
> white, no glass, no blur, no halo glow.
>
> Per task guardrails: **no surface is fixed in this task**. This report
> only documents what the bold-direction pass will need to address when
> each page is touched (and explicitly not before).

## Reference: what the brand kit calls for

From the attached mockup's "WEB HEADER" panel (re-attached in this
task): a small red icon tile to the left, the wordmark "**Ayasofia**"
in dark ink (Charcoal) next to it, on a clean white surface with a thin
1-px hairline at the bottom. No glass, no blur, no soft halo glow.
This matches `LogoLockup` in `components/ui/logo.tsx:200`.

## Surface-by-surface audit

| #   | Surface                           | File / line                                                                      | Header matches reference?                           | Specific deviations                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | --------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/login`                          | `app/login/page.tsx:30-99`                                                       | **No**                                              | Heavy ambient backdrop: 3 stacked `blur-3xl` radial halos (lines 38-40) + a `<PearlField variant="scatter">` (line 41). The `Logo` uses `surface="halo" breathing` (line 48) which adds an `animate-pearl-pulse blur-xl` ring (logo.tsx:60-62). The wordmark uses `gradient-text-brand` (line 53) — a red gradient with `ff2a26` and `ff6b6b` end stops, not the flat `brand-red` token.                                                      |
| 2   | `/pos`                            | `app/(pos)/pos/pos-shell.tsx:145`                                                | **Mostly** (wordmark content) / **No** (surface)    | The wordmark is "Ayasofia POS / حلويات آيا صوفيا" in brand-ink, which is the right idea. But the `<header>` is `bg-white/95 ... backdrop-blur-md shadow-sm` (line 145) — exactly the glass effect the reference excludes. The category tabs row also uses `bg-white/60 backdrop-blur-sm` (line 184).                                                                                                                                          |
| 3   | `/drive-thru`                     | `app/(pos)/drive-thru/drive-thru-shell.tsx:107`                                  | **No** (whole direction wrong)                      | The Drive-Thru header is a **red** surface (not white), with a `bg-white/10 blur-3xl` halo blob behind it (line 110) and a glass-blur icon container (`bg-white/15 backdrop-blur-md` line 113). The reference says dark-on-white, not white-on-red. The category row (line 137) also uses `bg-white/70 backdrop-blur-sm`.                                                                                                                     |
| 4   | `/admin` (sidebar, desktop)       | `app/(admin)/admin/nav.tsx:62-76`                                                | **No**                                              | Sidebar background is `bg-white/70 backdrop-blur-md` (line 62). The brand block has a `bg-brand-red/10 size-24 rounded-full blur-2xl` halo behind the logo (line 69). Wordmark "الإدارة / Ayasofia Sweet" is in ink (line 73) — content is right; surface is wrong.                                                                                                                                                                           |
| 5   | `/admin` (mobile top bar)         | `app/(admin)/admin/layout.tsx:37-46`                                             | **No**                                              | `bg-white/80 backdrop-blur-md shadow-sm` (line 37). Wordmark "لوحة الإدارة / Ayasofia Sweet" content is right.                                                                                                                                                                                                                                                                                                                                |
| 6   | `/admin` (mobile bottom nav)      | `app/(admin)/admin/mobile-nav.tsx:46`                                            | **No** (peripheral, not the header)                 | Pill background uses `bg-white/85 backdrop-blur-xl` (line 46). Not a header, included only for completeness — the bottom nav is a persistent chrome element.                                                                                                                                                                                                                                                                                  |
| 7   | `/kitchen`                        | `app/(pos)/kitchen/kitchen-shell.tsx:147, 163`                                   | **N/A — different surface**                         | Kitchen is a status board, not a navigation surface. The `bg-white/10 blur-3xl` halo on the header (line 147) and the `bg-white/20 backdrop-blur-md` channel tag (line 163) both contradict the bold direction; flagged here so the eventual kitchen redesign pass knows.                                                                                                                                                                     |
| 8   | `/m/[branchSlug]` (customer menu) | `app/m/[branchSlug]/page.tsx` → `components/digital-menu/menu-shell.tsx:245-275` | **No** (header is a hero)                           | The `<header>` is a full-bleed red hero with floating-pearl scatter (`<PearlField variant="scatter" tone="white" count={12} />`), an aurora radial-gradient overlay, a "glass" logo surface, and a backdrop-blur table badge. The next task (`bold-direction.md`) is the right place to fix this — it's the explicit scope of the `/m` pilot, called out in `bold-direction.md` §1-§5. **Out of scope for this report's "no-fix" guardrail.** |
| 9   | `/` (marketing landing)           | `app/page.tsx:10-11, 37`                                                         | **No** (no chrome header at all, but heavy ambient) | No traditional header — but the page itself is built on stacked `blur-3xl` radial halos. Out of scope for this task.                                                                                                                                                                                                                                                                                                                          |

## Summary

| Treatment                                                          | Count                                                                                  | Reference says                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `backdrop-blur-*` on a chrome surface                              | **5** (login shell, pos header, drive-thru header, admin sidebar, admin mobile header) | ❌ excluded                                          |
| `blur-2xl` / `blur-3xl` halo on a brand mark                       | **4** (login halo logo, admin nav halo, drive-thru header halo, login hero halos)      | ❌ excluded                                          |
| `bg-white/NN backdrop-filter` on a non-overlay element             | **6** (above plus admin mobile bottom nav)                                             | ❌ excluded                                          |
| Wordmark content "Ayasofia …" in brand-ink on white                | **3** (`/pos`, `/admin` mobile, `/admin` desktop)                                      | ✅ matches                                           |
| Wordmark content on a red background or in white type              | **1** (`/drive-thru`)                                                                  | ❌ doesn't match — drive-thru header is white-on-red |
| Header **content** wrong (red type on red, missing wordmark, etc.) | 0                                                                                      | —                                                    |

## What this means for the next task

When the bold-direction pilot touches `/m/[branchSlug]`, the brief
explicitly says: "no other page touched." This report is the
hand-off document so the next round of page-level work
(`/pos`, `/admin`, `/login`, `/kitchen`, `/drive-thru`, `/`) knows
exactly which surfaces carry the glass/blur/halo patterns and which
don't.

The patterns to delete across the codebase, when that work is
authorized, are:

- `backdrop-blur-md` on `<header>` and `<nav>` elements
- `backdrop-blur-sm` / `backdrop-blur-xl` on category-tab and
  bottom-nav pills
- `bg-white/NN` (translucent) on top-level chrome surfaces
- `bg-brand-red/NN absolute … blur-{2,3}xl rounded-full` halo
  decorations
- The `surface="halo"` logo variant on the login page
- The `gradient-text-brand` red-aurora gradient on the login
  wordmark (replace with solid `text-brand-red`)

The two **`components/ui/*` primitives** that ship the glass and
aurora-halo behavior today are `logo.tsx` (`surface="halo"`,
`surface="glass"`) and the `.glass` / `.glass-dark` /
`bg-aurora` utilities in `app/globals.css`. These primitives are
intentionally **not** edited in this task. Removing them globally
would touch routes out of scope; the right sequencing is to land
the pilot, then sweep the primitives when other surfaces get the
same treatment.

## Visual evidence

Five screenshots in `docs/design-review/header-check/`:

- `pos-header-1440.png`
- `drive-thru-header-1440.png`
- `admin-header-1440.png`
- `m-menu-header-1440.png`
- `login-header-1440.png`
