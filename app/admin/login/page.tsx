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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If already signed in (and authorized), skip the form. Don't auto-redirect
  // when we just bounced them here for not being an admin.
  useEffect(() => {
    if (!supabase || denied) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next);
    });
  }, [router, next, denied]);

  async function handleSubmit(e: React.FormEvent) {
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
          <p className="mt-1 text-sm text-brand-text/70">
            Aquatics director access only.
          </p>

          {denied ? (
            <p className="mt-4 rounded-lg bg-brand-orange/15 px-3 py-2 text-sm text-brand-orange">
              That account isn&apos;t authorized for admin. Sign in with an admin email.
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-brand-green">
                Email
              </label>
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
              <label className="text-xs font-bold uppercase tracking-wide text-brand-green">
                Password
              </label>
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
              <p className="rounded-lg bg-brand-orange/15 px-3 py-2 text-sm text-brand-orange">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={busy} className="camp-btn w-full">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
