/**
 * T-B6 — product image URL origin allowlist.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { sanitizeImageUrl } from "@/lib/image-url";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co";
});

describe("sanitizeImageUrl allowlist (T-B6)", () => {
  it("allows a local asset path", () => {
    expect(sanitizeImageUrl("/icons/bubbletea.svg")).toBe("/icons/bubbletea.svg");
  });

  it("allows the app's own Supabase origin", () => {
    expect(sanitizeImageUrl("https://abcd.supabase.co/storage/v1/object/public/menu/a.png")).toBe(
      "https://abcd.supabase.co/storage/v1/object/public/menu/a.png",
    );
  });

  it("allows any supabase.co /storage/ object URL", () => {
    expect(sanitizeImageUrl("https://other.supabase.co/storage/v1/object/public/x.png")).toBe(
      "https://other.supabase.co/storage/v1/object/public/x.png",
    );
  });

  it("rejects an external host", () => {
    expect(sanitizeImageUrl("https://evil.example.com/pixel.png")).toBeNull();
  });

  it("rejects javascript:/data: URLs", () => {
    expect(sanitizeImageUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeImageUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects malformed URLs and normalizes empty to null", () => {
    expect(sanitizeImageUrl("://bad")).toBeNull();
    expect(sanitizeImageUrl("")).toBeNull();
    expect(sanitizeImageUrl(undefined)).toBeNull();
    expect(sanitizeImageUrl(null)).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeImageUrl("  /icons/logo.svg  ")).toBe("/icons/logo.svg");
  });
});
