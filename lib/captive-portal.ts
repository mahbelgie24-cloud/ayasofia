/**
 * Captive-portal router adapter (WF-04).
 *
 * The wifi splash asks the router to authorize a guest's device for a TTL.
 * Different routers expose different APIs, so the portal talks to a
 * `CaptivePortalAdapter` and never to a router directly.
 *
 * Today we ship `MockAdapter`: it logs the authorize/revoke call and
 * always succeeds, so the product flow works end-to-end before a real
 * router is confirmed. `MikrotikAdapter` / `UnifiAdapter` are DOCUMENTED
 * STUBS (interface + env wiring) to be filled when the router model is
 * known — see docs/wifi-portal.md.
 *
 * All methods are async and return a discriminated result.
 * NOTE: no `"use server"` directive — imported only from server modules.
 */

export interface AuthorizeDeviceParams {
  /** Opaque, hashed device identifier (never the raw MAC when stored). */
  deviceId: string;
  /** Session lifetime in seconds. */
  ttlSeconds: number;
}

export interface SessionStatusParams {
  deviceId: string;
}

export interface AdapterResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface CaptivePortalAdapter {
  readonly id: string;
  authorizeDevice(params: AuthorizeDeviceParams): Promise<AdapterResult<{ sessionId: string }>>;
  revoke(params: { deviceId: string }): Promise<AdapterResult<{ ok: true }>>;
  sessionStatus(params: SessionStatusParams): Promise<AdapterResult<{ active: boolean }>>;
}

/** Choose the configured adapter from env (`CAPTIVE_PORTAL_ADAPTER`). */
export function getAdapter(): CaptivePortalAdapter {
  const name = process.env.CAPTIVE_PORTAL_ADAPTER ?? "mock";
  switch (name.toLowerCase()) {
    case "mikrotik":
      return new MikrotikAdapter();
    case "unifi":
      return new UnifiAdapter();
    case "mock":
    default:
      return new MockAdapter();
  }
}

/** No-op adapter — logs calls, always succeeds. Default until a router is confirmed. */
export class MockAdapter implements CaptivePortalAdapter {
  readonly id = "mock";
  async authorizeDevice(
    params: AuthorizeDeviceParams,
  ): Promise<AdapterResult<{ sessionId: string }>> {
    console.info(`[wifi mock] authorize ${params.deviceId} for ${params.ttlSeconds}s`);
    return { ok: true, data: { sessionId: `mock-${params.deviceId}` } };
  }
  async revoke(params: { deviceId: string }): Promise<AdapterResult<{ ok: true }>> {
    console.info(`[wifi mock] revoke ${params.deviceId}`);
    return { ok: true, data: { ok: true } };
  }
  async sessionStatus(params: SessionStatusParams): Promise<AdapterResult<{ active: boolean }>> {
    console.info(`[wifi mock] status ${params.deviceId}`);
    return { ok: true, data: { active: true } };
  }
}

/**
 * DOCUMENTED STUB — MikroTik. Filled once the router model & API (REST/API-
 * TLS) are confirmed. Interface contract matches CaptivePortalAdapter.
 * See docs/wifi-portal.md §Router adapters.
 */
export class MikrotikAdapter implements CaptivePortalAdapter {
  readonly id = "mikrotik";
  async authorizeDevice(
    _params: AuthorizeDeviceParams,
  ): Promise<AdapterResult<{ sessionId: string }>> {
    void _params;
    return { ok: false, error: "MikroTikAdapter not configured yet (stub)" };
  }
  async revoke(_params: { deviceId: string }): Promise<AdapterResult<{ ok: true }>> {
    void _params;
    return { ok: false, error: "MikroTikAdapter not configured yet (stub)" };
  }
  async sessionStatus(_params: SessionStatusParams): Promise<AdapterResult<{ active: boolean }>> {
    void _params;
    return { ok: false, error: "MikroTikAdapter not configured yet (stub)" };
  }
}

/**
 * DOCUMENTED STUB — UniFi. Filled once the router model & controller API
 * are confirmed. Interface contract matches CaptivePortalAdapter.
 * See docs/wifi-portal.md §Router adapters.
 */
export class UnifiAdapter implements CaptivePortalAdapter {
  readonly id = "unifi";
  async authorizeDevice(
    _params: AuthorizeDeviceParams,
  ): Promise<AdapterResult<{ sessionId: string }>> {
    void _params;
    return { ok: false, error: "UnifiAdapter not configured yet (stub)" };
  }
  async revoke(_params: { deviceId: string }): Promise<AdapterResult<{ ok: true }>> {
    void _params;
    return { ok: false, error: "UnifiAdapter not configured yet (stub)" };
  }
  async sessionStatus(_params: SessionStatusParams): Promise<AdapterResult<{ active: boolean }>> {
    void _params;
    return { ok: false, error: "UnifiAdapter not configured yet (stub)" };
  }
}
