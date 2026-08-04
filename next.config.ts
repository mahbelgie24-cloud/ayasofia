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

export default withSentryConfig(nextConfig, {
  // Sourcemap upload requires SENTRY_AUTH_TOKEN and sentry org/project
  // configured in environment.  When absent, sourcemaps are generated but
  // not uploaded — Sentry still works, just without source context on errors.
  silent: true,
  telemetry: false,
});
