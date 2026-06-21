import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const DEFAULT_SUPABASE_URL = "https://aaioiktrlkyexmcbobzx.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_CanFJJQueodlsEBK0Sh03Q_-QHrO2iq";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

/**
 * Builds a Supabase client bound to the request/response cookies, and returns
 * it alongside the response so the caller can persist refreshed auth cookies.
 * Used by middleware to read the signed-in user server-side.
 */
export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  return { supabase, response };
}

/**
 * Supabase client for use inside Route Handlers (e.g. the auth callback),
 * reading/writing the session cookie via next/headers.
 */
export async function createRouteClient() {
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a context where cookies can't be set — safe to ignore.
        }
      },
    },
  });
}
