/**
 * P1-M11 — saveWifiSetting WRITE allowlist.
 *
 * A manager may write `wifi.*` splash copy but MUST be blocked from writing
 * `feature.*` keys and owner-only settings (tax_rate, shop_name, currency) —
 * rejected with a typed RBACError, never silently accepted. Reads are not
 * affected: getWifiSettings still returns wifi.* (and any existing keys).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbSelect, mockDbUpdate, mockDbInsert, mockInvalidateFeatureFlags } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbInsert: vi.fn(),
  mockInvalidateFeatureFlags: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireStaffSession: vi.fn().mockResolvedValue({ staffId: "s1", role: "manager" as const }),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
    insert: mockDbInsert,
  },
}));

vi.mock("@/lib/features", () => ({
  invalidateFeatureFlags: mockInvalidateFeatureFlags,
}));

import { saveWifiSetting, getWifiSettings } from "@/app/(admin)/admin/wifi/actions";
import { RBACError } from "@/lib/auth";

function selectChain(rows: unknown[]) {
  const thenable = Object.assign(Promise.resolve(rows), {
    limit: () => Promise.resolve(rows),
  });
  return {
    from: () => ({
      where: () => thenable,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  });
});

describe("saveWifiSetting — WRITE allowlist (P1-M11)", () => {
  it("manager CAN write wifi.splash_title", async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([])); // key not present → insert
    const values = vi.fn((v: unknown) => v);
    mockDbInsert.mockReturnValue({ values });

    const r = await saveWifiSetting("wifi.splash_title", "أهلاً بكم");
    expect(r.success).toBe(true);
    expect(values).toHaveBeenCalledWith({ key: "wifi.splash_title", value: "أهلاً بكم" });
  });

  it("updates an existing wifi key and invalidates feature flags", async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([{ key: "wifi.privacy_line" }]));

    const r = await saveWifiSetting("wifi.privacy_line", "نص خصوصية جديد");
    expect(r.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockInvalidateFeatureFlags).toHaveBeenCalled();
  });

  it("manager CANNOT write feature.digital_menu (typed RBACError)", async () => {
    await expect(saveWifiSetting("feature.digital_menu", "1")).rejects.toBeInstanceOf(RBACError);
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it.each(["tax_rate", "shop_name", "currency"])(
    "manager CANNOT write owner-only key '%s' (typed RBACError)",
    async (key) => {
      await expect(saveWifiSetting(key, "x")).rejects.toBeInstanceOf(RBACError);
      expect(mockDbInsert).not.toHaveBeenCalled();
    },
  );

  it("a matching-prefix wifi key with extra dots is still allowed (wifi.*)", async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([]));
    mockDbInsert.mockReturnValue({ values: () => Promise.resolve() });
    const r = await saveWifiSetting("wifi.banner.image_url", "logo.png");
    expect(r.success).toBe(true);
  });
});

describe("getWifiSettings — reads unaffected by the write allowlist (P1-M11)", () => {
  it("still returns wifi.* and existing keys for a manager", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () =>
        Promise.resolve([
          { key: "wifi.splash_title", value: "أهلاً" },
          { key: "feature.digital_menu", value: "1" },
        ]),
    });
    const settings = await getWifiSettings();
    expect(settings["wifi.splash_title"]).toBe("أهلاً");
    expect(settings["feature.digital_menu"]).toBe("1");
  });
});
