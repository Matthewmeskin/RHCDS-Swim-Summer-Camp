import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabaseServer";

/**
 * Magic-link / OTP callback. Supabase redirects here with a `code` after the
 * user clicks their login link. We exchange it for a session, then route the
 * user to the right place based on who they are:
 *   - admin  -> /admin
 *   - instructor -> their own schedule page
 *   - anything else -> home with an "unknown" notice
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const supabase = await createRouteClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/?login=error`);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/?login=error`);
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin) {
    return NextResponse.redirect(`${origin}/admin`);
  }

  const { data: slug } = await supabase.rpc("my_instructor_slug");
  if (slug) {
    return NextResponse.redirect(`${origin}/instructor/${slug}`);
  }

  // Authenticated, but not a known admin or instructor.
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/?login=unknown`);
}
