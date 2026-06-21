import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";

/**
 * Public project defaults for the Country Day Camp Swim Portal.
 * These are the project URL and the *publishable* anon key — both are designed
 * to be exposed in client code (and are already committed in .env.example), so
 * baking them in lets the app run with zero configuration. Real environment
 * variables, when set (e.g. on Vercel), always take precedence.
 */
const DEFAULT_SUPABASE_URL = "https://aaioiktrlkyexmcbobzx.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_CanFJJQueodlsEBK0Sh03Q_-QHrO2iq";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client using the public anon key.
 *
 * Uses @supabase/ssr's browser client so the auth session is stored in
 * cookies (not just localStorage). That lets server-side middleware read the
 * session and enforce admin access — see middleware.ts and lib/supabaseServer.ts.
 *
 * If env vars are missing we expose `null` so the UI can show a friendly
 * "not configured yet" state instead of crashing the whole app.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createBrowserClient(url as string, anonKey as string)
  : null;

/** Throwing accessor for code paths that require a configured client. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }
  return supabase;
}
