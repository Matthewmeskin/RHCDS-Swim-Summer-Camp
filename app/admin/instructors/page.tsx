"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import ConfigNotice from "@/components/ConfigNotice";
import Toast, { type ToastKind } from "@/components/Toast";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  fetchInstructors,
  fetchAvailabilitySubmissions,
  fetchDefaultWeekNumber,
} from "@/lib/data";
import { formatRelative } from "@/lib/format";
import type { Instructor } from "@/lib/types";

const WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function InstructorLinksPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [week, setWeek] = useState(1);
  const [subs, setSubs] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
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

  const linkFor = (slug: string | null) => (slug ? `${origin}/instructor/${slug}` : "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return instructors.filter((i) => (q ? i.name.toLowerCase().includes(q) : true));
  }, [instructors, query]);

  const setCount = useMemo(
    () => instructors.filter((i) => subs[i.id]).length,
    [instructors, subs]
  );

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ msg: `${label} copied ✓`, kind: "success" });
    } catch {
      setToast({ msg: "Couldn't copy — long-press to copy manually", kind: "error" });
    }
  }

  async function share(instr: Instructor) {
    const url = linkFor(instr.slug);
    const text = `Hi ${instr.name.split(" ")[0]}! Here's your Country Day Camp swim schedule & availability link: ${url}`;
    // Native share sheet on mobile; clipboard fallback elsewhere.
    if (typeof navigator !== "undefined" && (navigator as Navigator).share) {
      try {
        await (navigator as Navigator).share({ title: "Swim Camp link", text, url });
        return;
      } catch {
        /* user cancelled — ignore */
      }
    }
    copy(text, "Message");
  }

  function copyAll() {
    const lines = instructors
      .filter((i) => i.slug)
      .map((i) => `${i.name}: ${linkFor(i.slug)}`)
      .join("\n");
    copy(lines, "All links");
  }

  // Instructors who haven't set availability for the selected week.
  const notSet = useMemo(
    () => instructors.filter((i) => i.slug && !subs[i.id]),
    [instructors, subs]
  );

  function nudgeAll() {
    if (notSet.length === 0) return;
    const lines = notSet
      .map(
        (i) =>
          `Hi ${i.name.split(" ")[0]} — please set your availability for Week ${week}: ${linkFor(i.slug)}`
      )
      .join("\n\n");
    const header = `Reminder: ${notSet.length} instructor${notSet.length === 1 ? "" : "s"} still need to set Week ${week} availability.\n\n`;
    copy(header + lines, `Reminder for ${notSet.length}`);
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
        <h1 className="font-display text-4xl text-brand-green">Instructor Links</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Send each instructor their personal link — they bookmark it once to see
          their schedule and set availability. No login needed for them.
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
          <span className="rounded-full bg-brand-sand px-3 py-1 text-sm font-semibold text-brand-text">
            {setCount}/{instructors.length} set
          </span>
          <button
            onClick={nudgeAll}
            disabled={notSet.length === 0}
            className="camp-btn-orange ml-auto px-4 py-1.5 text-sm disabled:opacity-40"
            title="Copy a reminder message for everyone who hasn't set this week"
          >
            🔔 Nudge {notSet.length || ""} not set
          </button>
          <button onClick={copyAll} className="camp-btn-ghost px-4 py-1.5 text-sm">
            📋 Copy all links
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search instructors…"
          className="mt-4 w-full rounded-full border-2 border-brand-green bg-white px-5 py-2.5 text-sm"
        />

        {loading ? (
          <p className="mt-8 text-center text-brand-text/60">Loading…</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {filtered.map((i) => {
              const submitted = subs[i.id];
              return (
                <li key={i.id} className="camp-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-xl text-brand-green">{i.name}</span>
                    {i.role === "guard" ? (
                      <span className="rounded-full bg-brand-aqua px-2 py-0.5 text-xs font-bold text-brand-text">
                        Guard
                      </span>
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

                  <div className="mt-2 truncate rounded-lg bg-brand-sand/60 px-3 py-1.5 text-xs text-brand-text/70">
                    {linkFor(i.slug)}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => copy(linkFor(i.slug), "Link")} className="camp-btn px-4 py-1.5 text-sm">
                      📋 Copy link
                    </button>
                    <button onClick={() => share(i)} className="camp-btn-orange px-4 py-1.5 text-sm">
                      📤 Share
                    </button>
                    <Link
                      href={`/instructor/${i.slug}?week=${week}`}
                      className="camp-btn-ghost px-4 py-1.5 text-sm"
                    >
                      👁 Preview
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} /> : null}
    </main>
  );
}
