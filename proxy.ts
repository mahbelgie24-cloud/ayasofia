import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { computeProxyRedirect } from "@/lib/security/proxy-redirect";

/**
 * Proxy — route protection per spec §12.
 *
 * Replaces middleware.ts (deprecated in Next.js 16, renamed to proxy).
 * Runs on every matched route and checks whether the incoming session
 * carries a `staff_id` claim in `app_metadata`.  Routes that require
 * authentication redirect to `/login` if the claim is absent.
 *
 * Protected routes: /pos, /kitchen, /drive-thru, /admin
 * Public routes:   /, /login, /order (customer self-order, no auth)
 *
 * The redirect decision (fail-closed on protected + unauthenticated,
 * fail-loud on protected + session-check error) lives in
 * `lib/security/proxy-redirect.ts` so it can be unit-tested in
 * isolation. This file owns the I/O (Supabase client, cookies,
 * NextResponse); the helper owns the decision.
 */

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  const staffId = user?.app_metadata?.staff_id as string | undefined;
  const pathname = request.nextUrl.pathname;

  const redirectTo = computeProxyRedirect({
    pathname,
    staffId,
    getUserError: getUserError ? { message: getUserError.message } : null,
  });

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  // Authenticated user on /login or / → send them to /pos.
  if (staffId && (pathname.startsWith("/login") || pathname === "/")) {
    return NextResponse.redirect(new URL("/pos", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Public guest routes are excluded from the auth proxy so no Supabase
    // session round-trip runs before they render (LCP budget, NFR):
    //   m/  digital menu, wifi/  captive portal splash.
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|order|m|wifi).*)",
  ],
};
