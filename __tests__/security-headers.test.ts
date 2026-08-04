import { describe, it, expect, vi } from "vitest";
import { buildCSP } from "@/lib/security-headers";

const SUPABASE_URL = "https://hdptsbfzjhmzvfyouhlg.supabase.co";
const SUPABASE_ORIGIN = "https://hdptsbfzjhmzvfyouhlg.supabase.co";

describe("buildCSP — production", () => {
  const csp = buildCSP({ dev: false, supabaseUrl: SUPABASE_URL });

  it("starts with restrictive default-src 'self'", () => {
    expect(csp).toContain("default-src 'self'");
  });

  it("allows self + unsafe-inline scripts (Next.js framework requirement)", () => {
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });

  it("includes Supabase origin in script-src", () => {
    expect(csp).toContain(`script-src 'self' 'unsafe-inline' ${SUPABASE_ORIGIN}`);
  });

  it("does NOT include 'unsafe-eval' in production script-src", () => {
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("allows unsafe-inline styles (receipt <style> block)", () => {
    expect(csp).toContain("style-src 'self' 'unsafe-inline' data:");
  });

  it("restricts images to self + data URIs only", () => {
    expect(csp).toContain("img-src 'self' data:");
  });

  it("restricts fonts to self + data URIs only", () => {
    expect(csp).toContain("font-src 'self' data:");
  });

  it("blocks all iframes", () => {
    expect(csp).toContain("frame-src 'none'");
  });

  it("blocks all plugins (object-src 'none')", () => {
    expect(csp).toContain("object-src 'none'");
  });

  it("restricts base tag to same origin", () => {
    expect(csp).toContain("base-uri 'self'");
  });

  it("restricts form actions to same origin", () => {
    expect(csp).toContain("form-action 'self'");
  });

  it("allows media (audio) from self and data URIs", () => {
    expect(csp).toContain("media-src 'self' data:");
  });

  it("allows self + Supabase REST API in connect-src", () => {
    expect(csp).toContain(`connect-src 'self' ${SUPABASE_ORIGIN}`);
  });

  it("includes wss:// for Supabase Realtime (KDS)", () => {
    expect(csp).toContain(`wss://hdptsbfzjhmzvfyouhlg.supabase.co`);
  });

  it("does NOT include ws://localhost in production connect-src", () => {
    expect(csp).not.toContain("ws://localhost");
  });
});

describe("buildCSP — development", () => {
  const csp = buildCSP({ dev: true, supabaseUrl: SUPABASE_URL });

  it("includes 'unsafe-eval' for HMR source maps", () => {
    expect(csp).toContain("'unsafe-eval'");
  });

  it("includes ws://localhost for Fast Refresh", () => {
    expect(csp).toContain("ws://localhost:*");
    expect(csp).toContain("wss://localhost:*");
  });
});

describe("buildCSP — missing Supabase URL", () => {
  const csp = buildCSP({ dev: false, supabaseUrl: null });

  it("does not include Supabase origin in connect-src", () => {
    expect(csp).not.toContain("supabase");
  });

  it("connect-src only allows self", () => {
    expect(csp).toContain("connect-src 'self'");
    // Should not have extra spaces after 'self'
    expect(csp).not.toContain("connect-src 'self' ");
  });

  it("script-src does not reference Supabase", () => {
    expect(csp).not.toContain("supabase.co");
  });
});

describe("buildCSP — invalid Supabase URL", () => {
  const csp = buildCSP({ dev: false, supabaseUrl: "not-a-valid-url" });

  it("gracefully skips the invalid URL", () => {
    expect(csp).not.toContain("not-a-valid-url");
    expect(csp).toContain("default-src 'self'");
  });
});

describe("securityHeaders — full set", () => {
  it("returns all required OWASP ASVS headers", async () => {
    // Import at runtime after stubbing env so the module-level
    // process.env read works correctly.
    const { securityHeaders } =
      await vi.importActual<typeof import("@/lib/security-headers")>("@/lib/security-headers");
    const headers = securityHeaders();

    expect(headers).toHaveProperty("Content-Security-Policy");
    expect(headers).toHaveProperty("X-Content-Type-Options");
    expect(headers).toHaveProperty("X-Frame-Options");
    expect(headers).toHaveProperty("Referrer-Policy");
    expect(headers).toHaveProperty("Strict-Transport-Security");
    expect(headers).toHaveProperty("Permissions-Policy");
  });

  it("X-Content-Type-Options is set to nosniff", async () => {
    const { securityHeaders } =
      await vi.importActual<typeof import("@/lib/security-headers")>("@/lib/security-headers");
    const headers = securityHeaders();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("X-Frame-Options is set to DENY", async () => {
    const { securityHeaders } =
      await vi.importActual<typeof import("@/lib/security-headers")>("@/lib/security-headers");
    const headers = securityHeaders();
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("Referrer-Policy is strict-origin-when-cross-origin", async () => {
    const { securityHeaders } =
      await vi.importActual<typeof import("@/lib/security-headers")>("@/lib/security-headers");
    const headers = securityHeaders();
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("HSTS is set with max-age, includeSubDomains, and preload", async () => {
    const { securityHeaders } =
      await vi.importActual<typeof import("@/lib/security-headers")>("@/lib/security-headers");
    const headers = securityHeaders();
    expect(headers["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(headers["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(headers["Strict-Transport-Security"]).toContain("preload");
  });

  it("Permissions-Policy locks down all powerful features", async () => {
    const { securityHeaders } =
      await vi.importActual<typeof import("@/lib/security-headers")>("@/lib/security-headers");
    const headers = securityHeaders();
    const pp = headers["Permissions-Policy"];
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
    expect(pp).toContain("payment=()");
  });
});
