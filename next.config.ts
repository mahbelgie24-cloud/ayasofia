import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  images: {
    // Allow product images from local /public/icons/ and, in the future,
    // from Supabase Storage.  The Supabase host is read from env so it
    // adapts to staging/production automatically.
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https",
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },

  async headers() {
    const sec = securityHeaders();
    const headerEntries = Object.entries(sec).map(([key, value]) => ({ key, value }));

    return [
      {
        source: "/:path*",
        headers: headerEntries,
      },
    ];
  },
};

// ── Transport security decision (Phase C audit, 2026-08-08) ──
// No certificate pinning is implemented in this codebase. There is no
// inert TLS-bypass, no debug kill-switch that disables transport
// validation, and no environment-gated "skip TLS check" flag. The
// HTTP layer is plain `fetch` and Drizzle's `pg` driver — both
// delegate TLS validation to the platform defaults (Node.js + the
// system trust store).
//
// Why no pinning: the codebase runs against a Supabase-managed
// Postgres pooler. A pin would have to be updated every time
// Supabase rotates the leaf or intermediate certificate, and a
// mistake (e.g. pinning the wrong SAN or forgetting the backup
// pooler hostname) would brick the app on every deploy. The
// operational risk outweighs the marginal security gain over
// relying on Supabase's own certificate management + the standard
// trust store. The transport-security posture is instead: (a)
// HTTPS-only at the edge (HSTS, see lib/security-headers.ts), (b)
// HTTP security headers on every response (CSP, X-Frame-Options,
// Referrer-Policy, Permissions-Policy, X-Content-Type-Options),
// and (c) secure SDLC (this comment, the Phase C audit document
// in docs/security/phase-c-audit.md, and code review of every
// transport-handling call site).

export default withSentryConfig(nextConfig, {
  // Sourcemap upload requires SENTRY_AUTH_TOKEN and sentry org/project
  // configured in environment.  When absent, sourcemaps are generated but
  // not uploaded — Sentry still works, just without source context on errors.
  silent: true,
  telemetry: false,
});
