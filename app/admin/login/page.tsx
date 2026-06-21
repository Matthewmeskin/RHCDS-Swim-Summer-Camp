"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Nav from "@/components/Nav";
import ConfigNotice from "@/components/ConfigNotice";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";
  const denied = params.get("denied") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Default to password sign-in; the magic-link option stays available below.
  const [usePassword, setUsePassword] = useState(true);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If already signed in (and authorized), skip the form. Don't auto-redirect
  // when we just bounced them here for not being an admin.
  useEffect(() => {
    if (!supabase || denied) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next);
    });
  }, [router, next, denied]);

  async function sendLink(e?: React.FormEvent) {
    e?.preventDefault();
    if (!supabase) return;
    const addr = email.trim();
    if (!addr) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { data: allowed } = await supabase.rpc("login_allowed", { p_email: addr });
      if (!allowed) {
        setError("That email isn't on file as an admin or instructor.");
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

  async function resend() {
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    setInfo(otpError ? null : "Login link sent again ✓");
    if (otpError) setError(otpError.message);
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    // Hard navigation so middleware re-evaluates with the fresh session cookie.
    window.location.assign(next);
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/" />
        <ConfigNotice />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Nav backHref="/" />
      <div className="mx-auto max-w-sm px-4 py-10">
        <div className="camp-card p-8 text-center">
          <Image
            src="/camp-logo.png"
            alt="Country Day Camp"
            width={88}
            height={88}
            className="mx-auto h-20 w-20 rounded-full bg-white shadow-sm ring-2 ring-white"
            priority
          />
          <h1 className="mt-4 font-display text-3xl text-brand-green">Admin Login</h1>
          <p className="mt-1 text-sm text-brand-text/70">Aquatics director access only.</p>

          {denied ? (
            <p className="mt-4 rounded-lg bg-brand-orange/15 px-3 py-2 text-sm text-brand-orange">
              That account isn&apos;t authorized for admin. Sign in with an admin email.
            </p>
          ) : null}

          {/* Magic-link "check your email" state */}
          {sent && !usePassword ? (
            <div className="mt-6 text-center">
              <p className="text-2xl">📧</p>
              <p className="mt-2 font-semibold text-brand-green">Check your email</p>
              <p className="mt-1 text-sm text-brand-text/70">
                We sent a secure login link to <strong>{email.trim()}</strong>. Open it on
                this device to sign in.
              </p>
              {info ? <p className="mt-2 text-sm text-brand-green">{info}</p> : null}
              {error ? (
                <p className="mt-2 rounded-lg bg-brand-orange/15 px-3 py-2 text-sm text-brand-orange">{error}</p>
              ) : null}
              <div className="mt-4 flex flex-col gap-2">
                <button onClick={resend} disabled={busy} className="camp-btn-ghost w-full disabled:opacity-40">
                  {busy ? "Sending…" : "Resend link"}
                </button>
                <button
                  onClick={() => { setSent(false); setInfo(null); setError(null); }}
                  className="text-xs font-semibold text-brand-text/50 hover:text-brand-green"
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : usePassword ? (
            /* Password fallback */
            <form onSubmit={signInWithPassword} className="mt-6 space-y-3 text-left">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-brand-green">Email</label>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-full border-2 border-brand-green bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-brand-green">Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1 w-full rounded-full border-2 border-brand-green bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
                />
              </div>
              {error ? (
                <p className="rounded-lg bg-brand-orange/15 px-3 py-2 text-sm text-brand-orange">{error}</p>
              ) : null}
              <button type="submit" disabled={busy} className="camp-btn w-full">
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setUsePassword(false); setError(null); }}
                className="block w-full text-center text-xs font-semibold text-brand-text/50 hover:text-brand-green"
              >
                ← Email me a login link instead
              </button>
            </form>
          ) : (
            /* Default: magic link */
            <form onSubmit={sendLink} className="mt-6 space-y-3 text-left">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-brand-green">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-full border-2 border-brand-green bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
                />
              </div>
              {error ? (
                <p className="rounded-lg bg-brand-orange/15 px-3 py-2 text-sm text-brand-orange">{error}</p>
              ) : null}
              <button type="submit" disabled={busy} className="camp-btn w-full">
                {busy ? "Sending…" : "Email me a login link"}
              </button>
              <p className="text-center text-xs text-brand-text/50">
                We&apos;ll email you a secure sign-in link — no password needed.
              </p>
              <button
                type="button"
                onClick={() => { setUsePassword(true); setError(null); }}
                className="block w-full text-center text-xs font-semibold text-brand-text/50 hover:text-brand-green"
              >
                Use a password instead
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
