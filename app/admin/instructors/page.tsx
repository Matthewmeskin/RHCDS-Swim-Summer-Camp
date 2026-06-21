"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import CampLoader from "@/components/CampLoader";
import ConfigNotice from "@/components/ConfigNotice";
import Toast, { type ToastKind } from "@/components/Toast";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  fetchInstructors,
  fetchAvailabilitySubmissions,
  fetchDefaultWeekNumber,
  resetInstructorCode,
  setupAllInstructorCodes,
} from "@/lib/data";
import { formatRelative } from "@/lib/format";
import { fireConfetti } from "@/lib/confetti";
import type { Instructor } from "@/lib/types";

const WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function InstructorAccessPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [week, setWeek] = useState(1);
  const [subs, setSubs] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    Promise.all([fetchInstructors(), fetchDefaultWeekNumber()])
      .then(([instr, wk]) => {
        setInstructors(instr);
        if (wk != null) setWeek(wk);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) fetchAvailabilitySubmissions(week).then(setSubs).catch(() => {});
  }, [week]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return instructors.filter((i) => (q ? i.name.toLowerCase().includes(q) : true));
  }, [instructors, query]);

  const availSet = useMemo(() => instructors.filter((i) => subs[i.id]).length, [instructors, subs]);
  const codeSet = useMemo(() => instructors.filter((i) => i.access_code).length, [instructors]);
  const missingCodes = instructors.length - codeSet;

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ msg: `${label} copied ✓`, kind: "success" });
    } catch {
      setToast({ msg: "Couldn't copy — long-press to copy manually", kind: "error" });
    }
  }

  async function makeCode(i: Instructor, isReset: boolean) {
    setBusyId(i.id);
    try {
      const code = await resetInstructorCode(i.id);
      setInstructors((prev) => prev.map((x) => (x.id === i.id ? { ...x, access_code: code } : x)));
      setToast({ msg: `${i.name.split(" ")[0]}'s code ${isReset ? "reset" : "created"} ✓`, kind: "success" });
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Couldn't set code", kind: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function setupAll() {
    setSettingUp(true);
    try {
      const n = await setupAllInstructorCodes();
      const refreshed = await fetchInstructors();
      setInstructors(refreshed);
      setToast({ msg: `Created ${n} new code${n === 1 ? "" : "s"} ✓`, kind: "success" });
      if (n > 0) fireConfetti();
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Couldn't set up codes", kind: "error" });
    } finally {
      setSettingUp(false);
    }
  }

  function shareText(i: Instructor) {
    return (
      `Hi ${i.name.split(" ")[0]}! Here's how to see your Country Day Camp swim schedule:\n` +
      `1. Go to ${origin}\n` +
      `2. Enter your name: ${i.name}\n` +
      `3. Access code: ${i.access_code}`
    );
  }

  async function share(i: Instructor) {
    if (!i.access_code) return;
    const text = shareText(i);
    if (typeof navigator !== "undefined" && (navigator as Navigator).share) {
      try {
        await (navigator as Navigator).share({ title: "Swim Camp sign-in", text });
        return;
      } catch {
        /* cancelled */
      }
    }
    copy(text, "Sign-in message");
  }

  function copyAllCodes() {
    const lines = instructors
      .filter((i) => i.access_code)
      .map((i) => `${i.name}: ${i.access_code}`)
      .join("\n");
    copy(lines || "(no codes yet)", "All codes");
  }

  // Availability nudge for the selected week.
  const notSet = useMemo(() => instructors.filter((i) => !subs[i.id]), [instructors, subs]);
  function nudgeAll() {
    if (notSet.length === 0) return;
    const lines = notSet
      .map((i) => `${i.name} (code: ${i.access_code ?? "—"})`)
      .join("\n");
    copy(
      `Reminder: ${notSet.length} still need Week ${week} availability. Sign in at ${origin}.\n\n${lines}`,
      `Reminder for ${notSet.length}`,
    );
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
        <h1 className="font-display text-4xl text-brand-green">Instructor Access</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Each instructor signs in at <strong>{origin || "your site"}</strong> with their{" "}
          <strong>name + access code</strong>. Create codes here and share them — no email needed.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            Availability for:
            <select
              value={week}
              onChange={(e) => setWeek(parseInt(e.target.value, 10))}
              className="rounded-full border-2 border-brand-green bg-white px-4 py-1.5"
            >
              {WEEK_OPTIONS.map((w) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </label>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              codeSet === instructors.length ? "bg-brand-green/15 text-brand-green" : "bg-brand-orange/15 text-brand-orange"
            }`}
            title="Instructors with an access code"
          >
            🔑 {codeSet}/{instructors.length} codes
          </span>
          <span className="rounded-full bg-brand-sand px-3 py-1 text-sm font-semibold text-brand-text">
            {availSet}/{instructors.length} avail.
          </span>
          <button
            onClick={setupAll}
            disabled={settingUp || missingCodes === 0}
            className="camp-btn ml-auto px-4 py-1.5 text-sm disabled:opacity-40"
            title="Create a code + login for every instructor who doesn't have one yet"
          >
            {settingUp ? "Setting up…" : missingCodes > 0 ? `🔑 Set up ${missingCodes} code${missingCodes === 1 ? "" : "s"}` : "All set up ✓"}
          </button>
          <button onClick={copyAllCodes} className="camp-btn-ghost px-4 py-1.5 text-sm">
            📋 Copy all codes
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search instructors…"
          className="mt-4 w-full rounded-full border-2 border-brand-green bg-white px-5 py-2.5 text-sm"
        />

        {loading ? (
          <CampLoader />
        ) : (
          <ul className="mt-4 space-y-3">
            {filtered.map((i) => {
              const submitted = subs[i.id];
              return (
                <li key={i.id} className="camp-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-xl text-brand-green">{i.name}</span>
                    {i.role === "guard" ? (
                      <span className="rounded-full bg-brand-aqua px-2 py-0.5 text-xs font-bold text-brand-text">Guard</span>
                    ) : null}
                    {submitted ? (
                      <span className="rounded-full bg-brand-green px-2.5 py-0.5 text-xs font-bold text-white" title={new Date(submitted).toLocaleString()}>
                        ✓ Availability set · {formatRelative(submitted)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-brand-orange/15 px-2.5 py-0.5 text-xs font-bold text-brand-orange">
                        Availability not set
                      </span>
                    )}
                  </div>

                  {/* Access code */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-brand-text/50">Access code</span>
                    {i.access_code ? (
                      <code className="rounded-lg bg-brand-sand px-3 py-1 text-lg font-bold tracking-[0.25em] text-brand-green">
                        {i.access_code}
                      </code>
                    ) : (
                      <span className="rounded-full bg-brand-orange/15 px-2 py-0.5 text-[11px] font-bold text-brand-orange">no code yet</span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {i.access_code ? (
                      <>
                        <button onClick={() => copy(i.access_code!, "Code")} className="camp-btn px-4 py-1.5 text-sm">
                          📋 Copy code
                        </button>
                        <button onClick={() => share(i)} className="camp-btn-orange px-4 py-1.5 text-sm">
                          📤 Share sign-in
                        </button>
                        <button
                          onClick={() => makeCode(i, true)}
                          disabled={busyId === i.id}
                          className="camp-btn-ghost px-4 py-1.5 text-sm disabled:opacity-40"
                        >
                          {busyId === i.id ? "…" : "🔄 Reset code"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => makeCode(i, false)}
                        disabled={busyId === i.id}
                        className="camp-btn px-4 py-1.5 text-sm disabled:opacity-40"
                      >
                        {busyId === i.id ? "Creating…" : "🔑 Create code"}
                      </button>
                    )}
                    <Link href={`/instructor/${i.slug}?week=${week}`} className="camp-btn-ghost px-4 py-1.5 text-sm">
                      👁 Preview
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <button onClick={nudgeAll} disabled={notSet.length === 0} className="camp-btn-orange mt-4 px-4 py-1.5 text-sm disabled:opacity-40">
          🔔 Copy reminder for {notSet.length || 0} without Week {week} availability
        </button>
      </div>

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} /> : null}
    </main>
  );
}
