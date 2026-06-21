"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import Toast, { type ToastKind } from "@/components/Toast";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { fetchSwimLevels, saveSwimLevel } from "@/lib/data";
import { groupByLevel } from "@/lib/groups";
import type { SwimLevel } from "@/lib/types";

export default function AdminLevelsPage() {
  const [levels, setLevels] = useState<SwimLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    fetchSwimLevels().then(setLevels).finally(() => setLoading(false));
  }, []);

  function edit(level: number, field: "overview" | "assessment" | "games", value: string) {
    setLevels((prev) => prev.map((l) => (l.level === level ? { ...l, [field]: value } : l)));
  }

  async function save(l: SwimLevel) {
    setBusy(l.level);
    try {
      await saveSwimLevel(l.level, {
        overview: l.overview?.trim() || null,
        assessment: l.assessment?.trim() || null,
        games: l.games?.trim() || null,
      });
      setToast({ msg: `Saved ${l.emoji} ${l.name}`, kind: "success" });
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Save failed", kind: "error" });
    } finally {
      setBusy(null);
    }
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
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Level Guide</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Edit what instructors see for each swim group. This is pre-loaded from the
          2026 Instructor Training doc — update it any time.{" "}
          <Link href="/levels" className="font-bold text-brand-green underline">
            Preview the guide →
          </Link>
        </p>

        {loading ? (
          <p className="mt-8 text-center text-brand-text/60">Loading…</p>
        ) : (
          <div className="mt-6 space-y-5">
            {levels.map((l) => {
              const g = groupByLevel(l.level);
              const color = g?.color ?? "#407A5B";
              return (
                <section key={l.level} className="overflow-hidden rounded-2xl border-2 bg-white" style={{ borderColor: color }}>
                  <div className="flex items-center gap-3 px-4 py-2.5 text-white" style={{ backgroundColor: color }}>
                    <span className="text-2xl">{l.emoji}</span>
                    <h2 className="font-display text-xl">Level {l.level}: {l.name}</h2>
                  </div>
                  <div className="space-y-3 p-4">
                    <Field label="What to teach" value={l.overview ?? ""} rows={6} onChange={(v) => edit(l.level, "overview", v)} />
                    <Field label="Assessment to pass" value={l.assessment ?? ""} rows={2} onChange={(v) => edit(l.level, "assessment", v)} />
                    <Field label="Games & activities" value={l.games ?? ""} rows={6} onChange={(v) => edit(l.level, "games", v)} />
                    <button onClick={() => save(l)} disabled={busy === l.level} className="camp-btn px-5 py-2 text-sm">
                      {busy === l.level ? "Saving…" : "Save"}
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
      {toast ? <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} /> : null}
    </main>
  );
}

function Field({
  label, value, rows, onChange,
}: {
  label: string;
  value: string;
  rows: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-brand-green">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-brand-green/30 p-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-brand-aqua"
      />
    </label>
  );
}
