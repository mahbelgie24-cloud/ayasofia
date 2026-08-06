/**
 * Security header generators — CSP, X-Content-Type-Options, etc.
 *
 * OWASP ASVS Level 1 §14.4 requires explicit Content-Security-Policy.
 * This module generates all security response headers.  The public API
 * is `securityHeaders()` — callers in next.config.ts use it directly.
 * Internal helpers accept explicit options so they are testable without
 * mutating `process.env`.
 */

// ── Public entry point ──

/**
 * All security response headers as a Record, reading config from
 * `process.env`.  Designed for direct use in `next.config.ts`:
 *
 * ```ts
 * async headers() {
 *   const sec = securityHeaders();
 *   return [{
 *     source: "/:path*",
 *     headers: Object.entries(sec).map(([key, val]) => ({ key, val })),
 *   }];
 * }
 * ```
 */
export function securityHeaders(): Record<string, string> {
  const dev = process.env.NODE_ENV === "development";
  const isProd = process.env.NODE_ENV === "production";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;

  return {
    "Content-Security-Policy": buildCSP({
      dev,
      supabaseUrl,
    }),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // T-B18: `preload` is a permanent, irreversible submission to the HSTS
    // preload list — only attach it in production, never on a dev/staging
    // host (would poison an unreviewed domain).
    "Strict-Transport-Security": buildHSTS(isProd),
    "Permissions-Policy": [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "bluetooth=()",
      "display-capture=()",
    ].join(", "),
  };
}

/**
 * HSTS value. `preload` is gated: it commits the domain to the browser's
 * preload list permanently, so callers pass false everywhere except prod.
 */
export function buildHSTS(preload: boolean): string {
  return `max-age=63072000; includeSubDomains${preload ? "; preload" : ""}`;
}

// ── CSP builder (testable) ──

export interface CSPOptions {
  dev?: boolean;
  supabaseUrl?: string | null;
}

/**
 * Build the Content-Security-Policy header value.
 *
 * DESIGN NOTES:
 *   - script-src 'unsafe-inline' is required by the Next.js framework
 *     (inline bootstrap scripts, FOUC guards).  Not avoidable without
 *     nonce-based CSP which Next.js does not natively support.
 *   - style-src 'unsafe-inline' is needed for the receipt print
 *     `<style>` block in receipt-client.tsx and Tailwind dev CSS.
 *   - connect-src wss:// is needed for Supabase Realtime (KDS).
 *   - Dev mode adds 'unsafe-eval' (HMR source maps) and ws://localhost.
 */
export function buildCSP(opts: CSPOptions = {}): string {
  const dev = opts.dev ?? false;
  const origin = parseOrigin(opts.supabaseUrl ?? null);

  const directives: string[] = [
    "default-src 'self'",
    scriptSrc(origin, dev),
    "style-src 'self' 'unsafe-inline' data:",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "media-src 'self' data:",
    connectSrc(origin, dev),
  ];

  return directives.join("; ");
}

// ── Internal helpers ──

function parseOrigin(url: string | null): string | null {
  if (!url) return null;
  try {
    const p = new URL(url);
    return `${p.protocol}//${p.host}`;
  } catch {
    return null;
  }
}

function scriptSrc(origin: string | null, dev: boolean): string {
  let v = `script-src 'self' 'unsafe-inline'`;
  if (origin) v += ` ${origin}`;
  if (dev) v += ` 'unsafe-eval'`;
  return v;
}

function connectSrc(origin: string | null, dev: boolean): string {
  let v = `connect-src 'self'`;
  if (origin) v += ` ${origin} wss://${origin.split("://")[1]}`;
  if (dev) v += ` ws://localhost:* wss://localhost:*`;
  return v;
}
