import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => {
  const signOut = vi.fn().mockResolvedValue({ error: null });
  return {
    createClient: () => ({ auth: { signOut } }),
  };
});

import { hashPin, verifyPin } from "@/lib/auth";
import { endStaffSession } from "@/lib/auth/session";

describe("auth — hashPin / verifyPin", () => {
  it("hashPin produces a salt:hash string of the expected format", () => {
    const stored = hashPin("1234");

    expect(stored).toContain(":");
    const [salt, hash] = stored.split(":");
    expect(salt).toHaveLength(64);
    expect(hash).toHaveLength(128);
  });

  it("verifyPin returns true for a matching PIN", () => {
    const stored = hashPin("5678");
    expect(verifyPin("5678", stored)).toBe(true);
  });

  it("verifyPin returns false for a wrong PIN", () => {
    const stored = hashPin("5678");
    expect(verifyPin("1111", stored)).toBe(false);
  });

  it("verifyPin returns false for a malformed stored value", () => {
    expect(verifyPin("1234", "bad_value_no_separator")).toBe(false);
    expect(verifyPin("1234", "too:many:colons")).toBe(false);
    expect(verifyPin("1234", "short:hash")).toBe(false);
  });

  it("verifyPin returns false for empty PIN or empty stored hash", () => {
    const stored = hashPin("9999");
    expect(verifyPin("", stored)).toBe(false);
    expect(verifyPin("9999", "")).toBe(false);
  });

  it("hashPin produces unique hashes for the same PIN (different salt each time)", () => {
    const a = hashPin("1234");
    const b = hashPin("1234");
    expect(a).not.toBe(b);
    expect(verifyPin("1234", a)).toBe(true);
    expect(verifyPin("1234", b)).toBe(true);
  });

  it("hashPin with different PINs produces different hashes", () => {
    const a = hashPin("1111");
    const b = hashPin("9999");
    expect(a).not.toBe(b);
    expect(verifyPin("1111", b)).toBe(false);
    expect(verifyPin("9999", a)).toBe(false);
  });
});

describe("session — endStaffSession", () => {
  it("calls supabase.auth.signOut when ending a session", async () => {
    await endStaffSession();

    const { createClient } = await import("@/lib/supabase/client");
    const client = createClient();

    expect(client.auth.signOut).toHaveBeenCalledOnce();
  });
});
