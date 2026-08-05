import { describe, it, expect, beforeEach } from "vitest";
import { cacheSetForTesting, clearCache } from "@/lib/cache";
import { getDigitalMenuData } from "@/app/digital-menu/actions";
import { authorizeGuest } from "@/app/wifi/actions";

/**
 * Flag-off drill (C9): with a feature flag read as OFF, public server
 * actions must return a typed `{ success:false, error }` — never throw,
 * never leak restricted data. The flag value is primed in the in-process
 * cache (lib/cache.ts) to avoid mutating the shared settings table; the
 * same cache path `isFeatureEnabled` reads in production.
 *
 * NOTE: both flag gates short-circuit before any DB read / rate-limit /
 * adapter work, so the test is fast and does not touch the DB.
 */
describe("flag-off drill — typed errors from public actions (C9)", () => {
  beforeEach(() => {
    clearCache();
  });

  it("digital menu action returns a typed error when the flag is off", async () => {
    cacheSetForTesting("feature:digital_menu", false);
    const result = await getDigitalMenuData("qalqilya");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("wifi action returns a typed error when the flag is off", async () => {
    cacheSetForTesting("feature:wifi_portal", false);
    const result = await authorizeGuest({ deviceId: "device-off-drill" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.length).toBeGreaterThan(0);
  });
});
