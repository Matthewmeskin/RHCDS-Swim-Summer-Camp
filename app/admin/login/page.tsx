"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Nav from "@/components/Nav";
import ConfigNotice from "@/components/ConfigNotice";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If already signed in, skip the form.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/admin");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/admin");
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
