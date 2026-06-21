"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Email magic-link login for instructors (and admins). Enter email → we verify
 * it's a known instructor/admin → Supabase emails a one-time login link, which
 * lands on /auth/callback and routes the user to their schedule (or /admin).
 */
export default function InstructorLogin() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const addr = email.trim();
    if (!addr) return;
    setBusy(true);
    setError(null);
    try {
      // Don't email strangers / create stray accounts: confirm it's on file first.
      const { data: allowed } = await supabase.rpc("login_allowed", { p_email: addr });
      if (!allowed) {
        setError(
          "We don't have that email on file. Check with the aquatics director to get added.",
        );
        return;
      }
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: addr,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (otpError) {
        setError(otpError.message);
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border-2 border-brand-green bg-white px-5 py-6 text-center">
        <p className="text-2xl">📧</p>
        <p className="mt-2 font-semibold text-brand-green">Check your email</p>
        <p className="mt-1 text-sm text-brand-text/70">
          We sent a one-time login link to <strong>{email.trim()}</strong>. Open it on
          this device to see your schedule.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="text-left">
      <label htmlFor="login-email" className="text-xs font-bold uppercase tracking-wide text-brand-green">
        Your email
      </label>
      <input
        id="login-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="you@example.com"
        className="mt-1 w-full rounded-full border-2 border-brand-green bg-white px-5 py-3 text-base text-brand-text outline-none focus:ring-2 focus:ring-brand-aqua"
      />
      {error ? (
        <p className="mt-2 rounded-lg bg-brand-orange/15 px-3 py-2 text-sm text-brand-orange">{error}</p>
      ) : null}
      <button type="submit" disabled={busy} className="camp-btn mt-3 w-full">
        {busy ? "Sending…" : "Email me a login link"}
      </button>
      <p className="mt-2 text-center text-xs text-brand-text/50">
        We&apos;ll email you a secure link — no password to remember.
      </p>
    </form>
  );
}
