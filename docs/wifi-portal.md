# Welcome Wi-Fi Captive Portal

Module guide for the branded wifi splash (`/wifi`) and post-connect screen
(`/wifi/connect`). API contract in [`docs/openapi.md`](./openapi.md).

## Feature flag

`settings.feature.wifi_portal` — set to `"1"` to enable (seeded by default).
When off: `/wifi/*` render the branded fallback, wifi actions return a typed
error, and the `/admin/wifi` nav item hides.

## Flow

1. Guest SSID redirects the device to `/wifi` (splash).
2. ONE-TAP `اتصال بالإنترنت` → `authorizeGuest` hashes the device id, calls the
   router adapter, and logs a `wifi_sessions` row.
3. Redirect to `/wifi/connect` → Today's Suggestion + `تصفّح القائمة` CTA +
   Instagram link.
4. Leaving (pagehide) calls `endWifiSession` which revokes via the adapter and
   records wall-clock duration.

A visible privacy line is on the splash; no third-party trackers
(NFR-WF-01). Critical-path assets are inline-only (fonts are self-hosted by
next/font).

## Privacy (C5)

- Device id is stored **hashed** (`sha256(salt:deviceId)`), never raw.
- Name/phone are written to `wifi_sessions` ONLY when `consented=true`.
- Zero-field guest access always works — no name/phone is ever required.
- Data minimization: nothing beyond the device hash, consent flag, and PII
  the guest explicitly supplied under consent.

## Router adapters (WF-04)

`lib/captive-portal.ts` defines:

```
interface CaptivePortalAdapter {
  authorizeDevice({ deviceId, ttlSeconds }): Promise<{ ok, data:{sessionId}, error? }>
  revoke({ deviceId }): Promise<{ ok, data:{ok:true}, error? }>
  sessionStatus({ deviceId }): Promise<{ ok, data:{active}, error? }>
}
```

| Adapter           | Status                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `MockAdapter`     | Default. Logs and always succeeds — ships today so the product flow works end-to-end before a router is confirmed. |
| `MikrotikAdapter` | **Stub** — returns `not configured`. Fill once the router model + API (REST/API-TLS) is confirmed.                 |
| `UnifiAdapter`    | **Stub** — returns `not configured`. Fill once the controller API is confirmed.                                    |

Select via `CAPTIVE_PORTAL_ADAPTER=mock|mikrotik|unifi` (default `mock`).

## Session logging (WF-05)

`wifi_sessions(device_id_hash, consented, guest_name?, guest_phone?,
authorized_at, expires_at, revoked_at, duration_sec, router_session_id, notes)`.
Anonymous by default; PII (name/phone) only with consent. The admin wifi
screen shows aggregate stats (total / today / consented) — never individual
PII.

## Admin (WF-06)

`/admin/wifi` (RBAC manager+) edits splash copy from settings keys
`wifi.splash_title`, `wifi.splash_subtitle`, `wifi.privacy_line` and shows
connect stats. Today's Suggestion is a shared entity with the digital menu —
managed at `/admin/digital-menu` ("اقتراح اليوم").

## Performance (NFR-WF-01)

The splash uses only inline CSS/JS and local images; fonts are build-time
self-hosted. Target: first paint well under 1.5s on the captive network.

## Testing

- Unit: `__tests__/captive-portal.test.ts` (adapter contract + stubs not active).
- Integration: `__tests__/wifi.integration.test.ts` (authorize via MockAdapter;
  asserts an anonymous session row — no PII without consent).
