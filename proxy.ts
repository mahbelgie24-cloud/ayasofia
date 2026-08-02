import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  } = await supabase.auth.getUser();

  const staffId = user?.app_metadata?.staff_id as string | undefined;

  const pathname = request.nextUrl.pathname;

  const isProtected =
    pathname.startsWith("/pos") ||
    pathname.startsWith("/kitchen") ||
    pathname.startsWith("/drive-thru") ||
    pathname.startsWith("/admin");

  const isLogin = pathname.startsWith("/login");
  const isHome = pathname === "/";

  if (isProtected && !staffId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if ((isLogin || isHome) && staffId) {
    return NextResponse.redirect(new URL("/pos", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|order).*)",
  ],
};
