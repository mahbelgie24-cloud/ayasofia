import { headers } from "next/headers";

/**
 * Resolve the caller's source IP from the standard proxy headers.
 *
 * On Vercel `x-forwarded-for` is always set (the first entry is the
 * originating client).  When no IP can be determined, all such callers
 * share the "unknown" bucket — still capped, just collectively.
 *
 * Server-only — must only be called from Server Actions / Route
 * Handlers / Server Components.
 */
export async function callerIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0].trim();
  const realIp = h.get("x-real-ip");
  return first || realIp || "unknown";
}
