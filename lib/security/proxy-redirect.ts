/**
 * Pure decision function for the auth proxy's protected-route redirect.
 *
 * The Next.js middleware (`proxy.ts`) cannot be unit-tested directly
 * because it depends on `next/headers` cookies and on the Supabase
 * `@supabase/ssr` client. To keep the security-critical redirect logic
 * testable AND reviewable in isolation, the decision is factored out
 * into this small function. The proxy calls it with the inputs it
 * extracted from the request and the Supabase client response.
 *
 * SECURITY
 * --------
 * The proxy is a UX redirect; the authoritative authorization gate is
 * `requireStaffSession` in `lib/auth.ts`. This function MUST always
 * fail closed — if the caller says "this user has no session", we
 * redirect; we never "let them through". The only thing the helper
 * decides is whether the redirect is plain `/login` (normal "please
 * sign in") or `/login?reason=...` (fail-loud — session check FAILED,
 * show a user-friendly error so the cashier isn't left guessing).
 *
 * The fail-loud path is the regression target. Before this refactor,
 * a session error (corrupt cookie, JWT rejected, Supabase auth outage)
 * produced a silent `/login` redirect with no indication of why. The
 * cashier would re-enter their PIN, the cookie would be re-minted, and
 * the cycle would repeat until the underlying cause was resolved. Now
 * the login page reads `?reason=` and shows a user-friendly message.
 */

export interface ProxyRedirectInput {
  /** The request pathname (e.g. "/pos", "/admin/reports"). */
  pathname: string;
  /**
   * The `staff_id` claim from the verified session, or `null` when the
   * caller is anonymous / the session check returned no user.
   */
  staffId: string | null | undefined;
  /**
   * The error returned by `supabase.auth.getUser()`, or `null` when the
   * session check succeeded (whether or not a user was found). An
   * error here means the session storage failed — corrupted cookie,
   * expired JWT, network/auth outage, or revoked token.
   */
  getUserError: { message: string } | null;
}

const PROTECTED_PREFIXES = ["/pos", "/kitchen", "/drive-thru", "/admin"] as const;

const PUBLIC_EXACT = new Set(["/", "/login"]);
const PUBLIC_PREFIXES = ["/m", "/wifi", "/order"] as const;

/**
 * Returns the redirect path the proxy should send, or `null` if the
 * request can continue.
 *
 * Rules:
 *  - If the route is public, return `null` (no redirect). The proxy's
 *    second branch handles the authenticated-on-public-page case.
 *  - If the route is protected and the user is authenticated, return
 *    `null` (let them in).
 *  - If the route is protected and the user is NOT authenticated AND
 *    the session check errored, return `/login?reason=<urlencoded>` so
 *    the login page can show a user-friendly error.
 *  - If the route is protected and the user is NOT authenticated with
 *    no error, return `/login` (normal "please sign in").
 */
export function computeProxyRedirect(input: ProxyRedirectInput): string | null {
  const { pathname, staffId, getUserError } = input;

  // Public route — never redirect away.
  if (
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return null;
  }

  // Not protected — pass through. (The proxy's auth→/pos redirect
  // handles the authenticated-on-non-protected case separately.)
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!isProtected) return null;

  // Protected route + authenticated → pass through.
  if (staffId) return null;

  // Protected route + unauthenticated + session check FAILED → fail
  // LOUD so the user can act. The reason is URL-encoded so the
  // Supabase error message (which may contain `#`, `?`, or other
  // URL-reserved characters) is safe to transport.
  if (getUserError) {
    const reason = encodeURIComponent(getUserError.message?.trim() || "session_check_failed");
    return `/login?reason=${reason}`;
  }

  // Protected route + unauthenticated + no error → normal login.
  return "/login";
}
