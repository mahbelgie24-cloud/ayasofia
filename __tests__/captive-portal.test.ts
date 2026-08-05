import { describe, it, expect } from "vitest";
import { MockAdapter, MikrotikAdapter, UnifiAdapter, getAdapter } from "@/lib/captive-portal";

describe("captive portal adapters", () => {
  it("mock adapter authorizes and returns a session id", async () => {
    const a = new MockAdapter();
    const res = await a.authorizeDevice({ deviceId: "dev-1", ttlSeconds: 600 });
    expect(res.ok).toBe(true);
    expect(res.data?.sessionId).toContain("mock-");
  });

  it("mock adapter revokes and reports status", async () => {
    const a = new MockAdapter();
    expect((await a.revoke({ deviceId: "dev-1" })).ok).toBe(true);
    expect((await a.sessionStatus({ deviceId: "dev-1" })).data?.active).toBe(true);
  });

  it("stubs are not silently active — they must return not-configured", async () => {
    for (const a of [new MikrotikAdapter(), new UnifiAdapter()]) {
      const r = await a.authorizeDevice({ deviceId: "x", ttlSeconds: 60 });
      expect(r.ok).toBe(false);
      expect(r.error).toContain("not configured");
    }
  });

  it("getAdapter defaults to mock when env is unset", () => {
    const prev = process.env.CAPTIVE_PORTAL_ADAPTER;
    delete process.env.CAPTIVE_PORTAL_ADAPTER;
    expect(getAdapter().id).toBe("mock");
    process.env.CAPTIVE_PORTAL_ADAPTER = prev;
  });
});
