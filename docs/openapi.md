# API Contract

This codebase uses **Next.js Server Actions**, not REST. Every entry below is
a public/admin server action; inputs are validated server-side and public
ones are rate-limited per IP (`lib/rate-limit.ts`). Money stays as
numeric-as-string at the boundary and integer minor units (agorot) during
computation (`lib/pricing.ts`).

## Public — Digital Menu

### `getDigitalMenuData(branchSlug, tableToken?)`

`lib/db/queries.ts` + `app/digital-menu/actions.ts`

- **Flag gate:** `feature.digital_menu` (off → `{ success:false }`).
- Rate limit: 120 / 60s per IP for catalog reads.
- Response `{ success:true, data: PublicMenuData, table }`:
  - `data.branch`: `{ id, name, slug }`
  - `data.categories[]`: `{ id, nameAr, nameEn, sortOrder, products[] }`
  - product: `{ id, categoryId, nameAr, nameEn, basePrice, imageUrl, isAvailable,
modifierGroups[] }` — only published+available items served (FR-DM-11)
  - modifierGroup: `{ id, name, type: single|multi, isRequired, maxSelections,
modifiers[] }`; modifier: `{ id, nameAr, name, priceDelta }`
  - `data.todaySuggestion`: `{ productId, nameAr, basePrice, imageUrl, titleAr, descriptionAr } | null`
  - `data.bestSellers[]`: `{ productId, nameAr, nameEn, imageUrl, quantitySold }`
  - `table`: `{ id, code } | null` when the QR token resolves for that branch
- Cached 60s per branch.

### `placeDigitalMenuOrder(input)`

`app/digital-menu/actions.ts`

- **Flag gate:** `feature.digital_menu`.
- Rate limit: 10 / 60s per IP.
- Input: `{ branchSlug, cartItems[], idempotencyKey, orderType: dine_in|takeaway|delivery, tableId?, deliveryAddress?, customerName?, customerPhone? }`
- cartItem: `{ productId, modifierIds[], quantity }`
- Validates: UUID shapes, branch exists, dine_in requires a table belonging to
  the branch, delivery requires an address, modifier rules (required groups,
  max selections) server-side.
- Delegates to the **shared** `executeCheckout` (same pipeline as the
  cashier) with `source=DIGITAL_MENU`, server-computed delivery fee.
- Response `{ success:true, orderId, orderNumber, total, accessToken, deduped }`:
  `accessToken` gates the status page (P2-SEC-1); `deduped=true` when the same
  cart fingerprint was already submitted (P1-M2), in which case `orderId`
  points at the existing order.

### `getUpsellSuggestions({ cartItems, hour? })`

- Flag gate + rate limit (120/60s).
- Recomputes subtotal server-side, evaluates `upsell_rules` via
  `lib/upsell.ts`, returns `{ success:true, suggestions:[{ ruleId, productId }] }`.

### `getOrderStatus(orderId, accessToken)`

`app/order/status/[orderId]/actions.ts` (shared by `/order/status` and
`/m/{slug}/status`)

- Returns `{ status }`. Gated by the per-order access token (P2-SEC-1); a
  missing/wrong token is indistinguishable from a 404.
- Rate limit: 90 / 60s per IP per order (T-B1); a malformed `orderId` is
  rejected before any query.

## Public — WiFi

### `authorizeGuest({ deviceId, consent?, guestName?, guestPhone? })`

`app/wifi/actions.ts`

- **Flag gate:** `feature.wifi_portal`. Rate limit: 20 / 60s per IP.
- Hashes `deviceId`, calls the `CaptivePortalAdapter` (MockAdapter by default),
  writes a `wifi_sessions` row. Name/phone persisted ONLY when `consent=true`.
- Response `{ success:true, sessionId, expiresAt, suggestionAvailable }`.

### `endWifiSession({ deviceId, durationSec? })`

- Revokes via adapter, records `duration_sec` (capped 86400), and marks the
  latest non-revoked session `revoked_at` (T-B3).
- Rate limit: 60 / 60s per IP.
- Response `{ success:true }`.

### `getWifiSuggestion()`

- Returns today's suggestion (shared entity) + owning `branchSlug` for the
  menu CTA.
- Rate limit: 90 / 60s per IP.

## Admin (RBAC: `manager`+ unless noted)

`app/(admin)/admin/digital-menu/actions.ts`:

- `getTables`, `createTable({code})`, `toggleTable({id})`, `regenerateTableQr({id})`,
  `getPrimaryBranchSlug`
- `getCurrentSuggestion`, `setTodaySuggestion({productId, titleAr?, descriptionAr?})`,
  `clearTodaySuggestion`, `getProductsForSuggestion`
- `getAdminUpsellRules`, `createUpsellRule`, `toggleUpsellRule`, `deleteUpsellRule`,
  `getUpsellCatalog`
- All mutations invalidate the public catalog cache (C2).

`app/(admin)/admin/wifi/actions.ts`:

- `getWifiSettings`, `saveWifiSetting(key, value)`
- `getWifiStats()` → `{ totalSessions, todaySessions, consented }`

`app/(admin)/admin/reports/actions.ts`:

- `getSalesSummary(startDate, endDate)` now also returns `bySource`
  (`POS`/`DIGITAL_MENU`) — digital adoption (FR-DM-15).

## Errors

Public actions return `{ success:false, error: "Arabic message" }`. Feature-off
returns a typed error referencing the flag. Admin RBAC failures throw
`AuthError` (`lib/auth.ts`), surfaced as 404 by the admin layout.
