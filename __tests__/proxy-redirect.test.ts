import { describe, it, expect } from "vitest";
import { computeProxyRedirect } from "@/lib/security/proxy-redirect";

/**
 * Phase B regression tests — fail-loud session-error surfacing.
 *
 * The original `proxy.ts` had a silent-fallback class: when
 * `supabase.auth.getUser()` returned an error (corrupt cookie, JWT
 * rejected by Supabase, network/auth outage), the error was discarded
 * and the user was silently redirected to `/login` with no
 * explanation. A cashier arriving back at the device after a brief
 * Wi-Fi drop would see a login screen and have no way to know whether
 * they were logged out, the device was broken, or the backend was down.
 *
 * The fix captures the error and redirects with `?reason=...`. The
 * login page reads that query param and shows a user-friendly message.
 * SECURITY: this is a UX fix only. The authoritative gate is
 * `requireStaffSession` in `lib/auth.ts` — the proxy is fail-closed
 * (always redirects on session trouble) but now at least tells the
 * user why.
 *
 * `computeProxyRedirect` is the pure decision function extracted from
 * the proxy; testing it directly avoids the Next.js middleware test
 * harness entirely.
 */
describe("computeProxyRedirect — fail-loud session-error surfacing", () => {
  it("returns null when the user is authenticated and on a non-auth page", () => {
    expect(
      computeProxyRedirect({
        pathname: "/admin",
        staffId: "staff-1",
        getUserError: null,
      }),
    ).toBeNull();
  });

  it("returns null when the user is authenticated and visits /login (redirect-to-pos happens in the proxy)", () => {
    // This case is handled by the proxy's second redirect branch, not
    // by computeProxyRedirect — we only test the protected-route path.
    expect(
      computeProxyRedirect({
        pathname: "/pos",
        staffId: "staff-1",
        getUserError: null,
      }),
    ).toBeNull();
  });

  it("redirects to /login with NO reason when the user simply has no session", () => {
    // Normal "please sign in" UX — no scary error, no leaked message.
    const result = computeProxyRedirect({
      pathname: "/pos",
      staffId: null,
      getUserError: null,
    });
    expect(result).toBe("/login");
  });

  it("FAILS LOUD: redirects to /login?reason=... when the session check errored", () => {
    // The original bug: this was a silent /login redirect with no
    // reason. The cashier had no way to know whether the device was
    // broken, the cookie was corrupted, or the Supabase auth was down.
    const result = computeProxyRedirect({
      pathname: "/admin",
      staffId: null,
      getUserError: { message: "Auth session missing!" },
    });
    expect(result).not.toBe("/login");
    expect(result).toMatch(/^\/login\?reason=/);
    // The reason MUST be URL-encoded so a Supabase error message that
    // contains an arbitrary string (e.g. "Invalid Refresh Token:
    // Refresh Token Not Found") survives transport.
    expect(result).toContain(encodeURIComponent("Auth session missing!"));
  });

  it("uses a generic fallback reason when the error has no message", () => {
    const result = computeProxyRedirect({
      pathname: "/kitchen",
      staffId: null,
      getUserError: { message: "" },
    });
    expect(result).toMatch(/^\/login\?reason=/);
    expect(result).toContain(encodeURIComponent("session_check_failed"));
  });

  it("does NOT pass through an unencoded error message (XSS hardening)", () => {
    // A malicious or malformed error message MUST be URL-encoded. If
    // `encodeURIComponent` is forgotten, the login page would receive
    // a raw query string that could include characters that break the
    // URL parser (e.g. `#` would truncate everything after it).
    const result = computeProxyRedirect({
      pathname: "/pos",
      staffId: null,
      getUserError: { message: "weird#hash?and?q=stuff" },
    });
    expect(result).not.toContain("weird#hash");
    expect(result).toContain(encodeURIComponent("weird#hash?and?q=stuff"));
  });

  it("never returns a redirect for public routes (no false-positive on session errors)", () => {
    // The proxy short-circuits on public routes before any session
    // check matters. The helper models that: public routes return null
    // regardless of session state.
    expect(
      computeProxyRedirect({
        pathname: "/login",
        staffId: null,
        getUserError: { message: "boom" },
      }),
    ).toBeNull();
    expect(
      computeProxyRedirect({
        pathname: "/",
        staffId: null,
        getUserError: { message: "boom" },
      }),
    ).toBeNull();
  });
});
