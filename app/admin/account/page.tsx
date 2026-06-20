"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import Toast, { type ToastKind } from "@/components/Toast";
import ConfigNotice from "@/components/ConfigNotice";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export default function AdminAccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (pw.length < 8) {
      setToast({ msg: "Password must be at least 8 characters", kind: "error" });
      return;
    }
    if (pw !== confirm) {
      setToast({ msg: "Passwords don't match", kind: "error" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setToast({ msg: error.message, kind: "error" });
      return;
    }
    setPw("");
    setConfirm("");
    setToast({ msg: "Password updated ✓", kind: "success" });
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/admin" />
        <ConfigNotice />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Nav backHref="/admin" />
      <div className="mx-auto max-w-sm px-4 py-8">
        <h1 className="font-display text-4xl text-brand-green">Account</h1>
        {email ? (
          <p className="mt-1 text-sm text-brand-text/70">
            Signed in as <strong>{email}</strong>
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="camp-card mt-6 space-y-3 p-6">
          <h2 className="font-display text-2xl text-brand-green">Change password</h2>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-brand-green">
              New password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              className="mt-1 w-full rounded-full border-2 border-brand-green bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-brand-green">
              Confirm new password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="mt-1 w-full rounded-full border-2 border-brand-green bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
            />
          </div>
          <p className="text-xs text-brand-text/60">At least 8 characters.</p>
          <button type="submit" disabled={busy} className="camp-btn w-full">
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>

      {toast ? (
        <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />
      ) : null}
    </main>
  );
}
