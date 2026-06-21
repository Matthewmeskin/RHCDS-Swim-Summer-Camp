import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabaseServer";

/**
 * Server-side gate for the admin area.
 *
 * Every /admin/* request (except the login page) must carry a valid Supabase
 * session whose email is in the public.admins allowlist. This is enforced here,
 * on the server, so admin pages can't be reached just by skipping the in-page
 * client guard. It also refreshes the auth cookie on every request.
 */
export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  // Refreshes the session cookie if needed and tells us who (if anyone) is signed in.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminArea = pathname.startsWith("/admin");
  const isLogin = pathname === "/admin/login";

  if (isAdminArea && !isLogin) {
    if (!user) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Signed in — verify they're actually an admin (allowlist check in the DB).
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("denied", "1");
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  // Run on admin routes only; static assets and other pages are untouched.
  matcher: ["/admin/:path*"],
};
