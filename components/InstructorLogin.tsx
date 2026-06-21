"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Instructor sign-in with name + access code (no email). The typed name maps to
 * a hidden login id via the instructor_login_email RPC; the code is the password.
 */
export default function InstructorLogin() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const fullName = name.trim();
    const accessCode = code.trim().toUpperCase();
    if (!fullName || !accessCode) return;
    setBusy(true);
    setError(null);
    try {
      const { data: loginEmail } = await supabase.rpc("instructor_login_email", { p_name: fullName });
      if (!loginEmail) {
        setError("We couldn't find that name, or no code is set up yet. Check with the aquatics director.");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail as string,
        password: accessCode,
      });
      if (signInError) {
        setError("That code doesn't match. Double-check it with the aquatics director.");
        return;
      }
      const { data: slug } = await supabase.rpc("my_instructor_slug");
      // Hard navigation so the new session cookie is in effect.
      window.location.assign(slug ? `/instructor/${slug}` : "/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="text-left">
      <label htmlFor="login-name" className="text-xs font-bold uppercase tracking-wide text-brand-green">
        Your name
      </label>
      <input
        id="login-name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="First Last"
        className="mt-1 w-full rounded-full border-2 border-brand-green bg-white px-5 py-3 text-base text-brand-text outline-none focus:ring-2 focus:ring-brand-aqua"
      />
      <label htmlFor="login-code" className="mt-3 block text-xs font-bold uppercase tracking-wide text-brand-green">
        Access code
      </label>
      <input
        id="login-code"
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        required
        placeholder="e.g. K7M2QP"
        className="mt-1 w-full rounded-full border-2 border-brand-green bg-white px-5 py-3 text-center text-lg font-bold tracking-[0.3em] text-brand-text outline-none focus:ring-2 focus:ring-brand-aqua"
      />
      {error ? (
        <p className="mt-2 rounded-lg bg-brand-orange/15 px-3 py-2 text-sm text-brand-orange">{error}</p>
      ) : null}
      <button type="submit" disabled={busy} className="camp-btn mt-3 w-full">
        {busy ? "Signing in…" : "See my schedule"}
      </button>
      <p className="mt-2 text-center text-xs text-brand-text/50">
        Your aquatics director gives you your code.
      </p>
    </form>
  );
}
