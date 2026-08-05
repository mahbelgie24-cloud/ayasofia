# Digital Menu — QR Immersive Menu

Module guide for the customer-facing QR digital menu (`/m/{branchSlug}` and
`/m/{branchSlug}/t/{tableToken}`). Backend API contract lives in
[`docs/openapi.md`](./openapi.md). This guide covers the module, its data
model additions, the upsell engine, analytics decision (C7), and the
feature flag.

## Feature flag

`settings.feature.digital_menu` — set to `"1"` to enable. When off:

- `/m/*` pages render a branded fallback (`components/digital-menu/feature-off.tsx`),
- public server actions return a typed `{ success: false, error }`,
- the admin nav item (`/admin/digital-menu`) is hidden.

## URLs

| Route                              | Purpose                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `/m/{branchSlug}`                  | Menu home (branch resolved by URL slug, FR-DM-10)                              |
| `/m/{branchSlug}/t/{tableToken}`   | Table-scoped menu; `tableToken` is the table's QR UUID (never a sequential id) |
| `/m/{branchSlug}/status/{orderId}` | Live order-status timeline (scrolls received→preparing→ready→completed)        |

A guest scans a table QR → the URL already carries the branch slug + table
token → catalog loads with the table prefilled (DM-01).

## Data model additions (migration `0009`)

- `branches.slug` — unique URL slug for `/m/{slug}`.
- `tables(id, branch_id, code, qr_token uuid unique, active)` — physical
  tables; each carries a UUID QR token (FR-DM-10).
- `modifier_groups.max_selections` — cap for `multi` groups (FR-DM-12).
- `orders.source` (`POS | DIGITAL_MENU`) — entry surface, orthogonal to
  `channel`; reports filter on it (FR-DM-15).
- `orders.table_id`, `orders.delivery_address`, `orders.delivery_fee` —
  dine-in table + delivery metadata (fee computed server-side, C6).
- `order_items.notes` — free-text line note from the builder (DM-03).
- `today_suggestion` — single "اقتراح اليوم", shared with the wifi portal.
- `upsell_rules` — condition→suggestion rules (FR-DM-16).
- `wifi_sessions` — wifi portal sessions (see wifi-portal.md).

The immutable modifiers snapshot already shipped on `order_items.selected_modifiers`
(jsonb: `modifierId, nameAr, nameEn, priceDelta`) satisfies FR-DM-14 — no
duplicate column added. Recipes/kitchen/receipt render these labels plus the
table code for dine-in digital orders (C1).

## Server-side validation (FR-DM-13)

`executeCheckout` (the single pipeline) validates every order — POS and
digital menu alike — via `lib/modifier-validation.ts`:

- a required `single` group must have a selection,
- a `single` group may have at most one selection,
- a `multi` group may not exceed `max_selections`,
- every submitted modifier id must belong to the product.

Prices are recomputed server-side (`lib/pricing-server.ts`); the client total
is logged-and-ignored on mismatch. Delivery fee is computed server-side from
`delivery.*` settings (C6).

## Upsell engine (FR-DM-16)

`lib/upsell.ts` is a pure, unit-tested scorer. Conditions:

| Condition                   | triggerValue          | Fires when                               |
| --------------------------- | --------------------- | ---------------------------------------- |
| `cart_has_product_category` | `{ categoryId }`      | cart contains a product in that category |
| `cart_without_modifier`     | `{ modifierId }`      | cart lacks that modifier                 |
| `cart_below_threshold`      | `{ thresholdAgorot }` | cart subtotal < threshold                |
| `time_of_day`               | `{ bias: hot\|cold }` | current hour in/out of 11–19             |
| `always`                    | `{}`                  | always                                   |

Matches are sorted by `priority` desc and capped at 3. The menu action
`getUpsellSuggestions` recomputes the subtotal server-side before evaluating
so the threshold rule is trustworthy.

## Payments (FR-DM-17)

`lib/payments.ts` defines a `PaymentProvider` interface. Two intents exist:
`pay_at_counter` and `cash_on_delivery`. Today the order records the intent as
`payment_method`; no gateway is wired. A future PalPay / Jawwal Pay backend
implements the interface without touching order logic.

## C7 DECISION — scan logging & attach-rate

**Decision: analytics are DEFERRED to a documented Backlog, not silently
omitted.** The public catalog endpoint is rate-limited and cached, but we do
**not** yet log per-scan branch/table hits or compute an attach-rate
(ordered-from-scan ÷ scans). Rationale: the table QR already routes dine-in
orders to `source=DIGITAL_MENU`, so order-level adoption is measured via the
reports "حسب المصدر" table. Adding a scans/attach-rate metric requires a new
`scan_events` table + write on every catalog hit, which expands the public
write surface and the analytics surface beyond the current scope.

### Backlog (future)

- `scan_events(branch_id, table_id|null, device_hash|null, created_at)` —
  insert on catalog load (rate-limited), prune old rows.
- Admin widget: scans/day, scan→order attach-rate (orders/source=DIGITAL_MENU
  ÷ scans), per-table conversion.
- No PII: device id hashed or dropped.

## Delivery fee rules (C6)

`lib/delivery.ts` reads `delivery.*` settings (see `.env.example`/seed):
`delivery.fee` (flat), `delivery.free_threshold` (subtotal above which waived),
`delivery.min_order`. Fee is computed inside the checkout transaction and
never trusted from the client.

## Cache & invalidation (C2)

The public catalog is cached in-memory for 60s per branch (`lib/cache.ts`).
Admin mutations (tables, suggestion, upsell rules, product/menu edits) call
`invalidatePublicCatalog(slug)` directly. There is no event bus in this
codebase, so invalidation is synchronous in-process — a multi-instance
deployment self-heals within the TTL (documented deviation from event-driven
invalidation).

## Testing

- Unit: `__tests__/upsell.test.ts`, `delivery.test.ts`, `modifier-validation.test.ts`,
  `payments.test.ts`, `cache.test.ts`.
- Integration: `__tests__/digital-menu.integration.test.ts` (menu order →
  POS pipeline → inventory decrement, `source=DIGITAL_MENU`, table id set).
