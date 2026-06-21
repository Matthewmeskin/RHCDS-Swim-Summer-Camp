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
  saveInstructor,
} from "@/lib/data";
import { formatRelative } from "@/lib/format";
import type { Instructor } from "@/lib/types";

const WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function InstructorLinksPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [week, setWeek] = useState(1);
  const [subs, setSubs] = useState<Record<string, string>>({});
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
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
        setEmails(Object.fromEntries(instr.map((i) => [i.id, i.email ?? ""])));
        if (wk != null) setWeek(wk);
      })
      .finally(() => setLoading(false));
  }, []);

  // Paste "Full Name, email@x.com" lines (CSV-style) to set many emails at once.
  async function applyBulkEmails() {
    const lines = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setBulkBusy(true);
    let matched = 0;
    const unmatched: string[] = [];
    const updated = new Map<string, string | null>();
    try {
      for (const line of lines) {
        const tokens = line.split(/[,\t]/).map((t) => t.trim()).filter(Boolean);
        const email = tokens.find((t) => t.includes("@")) ?? null;
        const name = tokens.filter((t) => !t.includes("@")).join(" ").trim();
        if (!email || !name) continue;
        const lc = name.toLowerCase();
        const hit =
          instructors.find((i) => i.name.toLowerCase() === lc) ??
          instructors.find((i) => i.name.toLowerCase().includes(lc) || lc.includes(i.name.toLowerCase()));
        if (!hit) {
          unmatched.push(name);
          continue;
        }
        await saveInstructor({ id: hit.id, name: hit.name, role: hit.role, email, slug: hit.slug, active: hit.active });
        updated.set(hit.id, email);
        matched++;
      }
      setInstructors((prev) => prev.map((x) => (updated.has(x.id) ? { ...x, email: updated.get(x.id)! } : x)));
      setEmails((prev) => {
        const next = { ...prev };
        updated.forEach((v, k) => (next[k] = v ?? ""));
        return next;
      });
      setBulkText("");
      setBulkOpen(false);
      setToast({
        msg: `${matched} email${matched === 1 ? "" : "s"} set${unmatched.length ? ` · ${unmatched.length} unmatched` : ""} ✓`,
        kind: unmatched.length ? "error" : "success",
      });
    } finally {
      setBulkBusy(false);
    }
  }

  async function saveEmail(i: Instructor) {
    const next = (emails[i.id] ?? "").trim() || null;
    if ((i.email ?? null) === next) return;
    setSavingEmail(i.id);
    try {
      await saveInstructor({ id: i.id, name: i.name, role: i.role, email: next, slug: i.slug, active: i.active });
      setInstructors((prev) => prev.map((x) => (x.id === i.id ? { ...x, email: next } : x)));
      setToast({ msg: `${i.name.split(" ")[0]}'s email saved ✓`, kind: "success" });
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Couldn't save email", kind: "error" });
    } finally {
      setSavingEmail(null);
    }
  }

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
          Add each instructor&apos;s <strong>login email</strong> so they can sign in with a
          one-time link to see their schedule and set availability. You can still copy or
          share their personal link below.
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
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              instructors.filter((i) => i.email).length === instructors.length
                ? "bg-brand-green/15 text-brand-green"
                : "bg-brand-orange/15 text-brand-orange"
            }`}
            title="Instructors with a login email — needed for sign-in"
          >
            ✉️ {instructors.filter((i) => i.email).length}/{instructors.length} emails
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

        <div className="mt-4 flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search instructors…"
            className="w-full rounded-full border-2 border-brand-green bg-white px-5 py-2.5 text-sm"
          />
          <button onClick={() => setBulkOpen((o) => !o)} className="camp-btn-ghost shrink-0 px-4 py-2 text-sm">
            📥 Import emails
          </button>
        </div>

        {bulkOpen ? (
          <div className="camp-card mt-3 p-4">
            <p className="text-sm font-semibold text-brand-green">Bulk-add login emails</p>
            <p className="mt-1 text-xs text-brand-text/60">
              Paste one per line as <code>Full Name, email@example.com</code> (commas or tabs).
              Names are matched to your instructors.
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              placeholder={"Abbey Higgens, abbey@example.com\nAkira Kokate, akira@example.com"}
              className="mt-2 w-full rounded-xl border-2 border-brand-green/40 bg-white px-3 py-2 text-sm focus:border-brand-green focus:outline-none"
            />
            <div className="mt-2 flex gap-2">
              <button onClick={applyBulkEmails} disabled={bulkBusy || !bulkText.trim()} className="camp-btn px-4 py-1.5 text-sm disabled:opacity-40">
                {bulkBusy ? "Applying…" : "Apply emails"}
              </button>
              <button onClick={() => { setBulkOpen(false); setBulkText(""); }} className="camp-btn-ghost px-4 py-1.5 text-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : null}

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

                  {/* Email — required for magic-link login */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-brand-text/50">Login email</span>
                    {!i.email ? (
                      <span className="rounded-full bg-brand-orange/15 px-2 py-0.5 text-[11px] font-bold text-brand-orange">needed</span>
                    ) : null}
                    <input
                      type="email"
                      value={emails[i.id] ?? ""}
                      onChange={(e) => setEmails((prev) => ({ ...prev, [i.id]: e.target.value }))}
                      onBlur={() => saveEmail(i)}
                      placeholder="name@email.com"
                      className="min-w-[200px] flex-1 rounded-full border-2 border-brand-green/40 bg-white px-3 py-1 text-sm focus:border-brand-green focus:outline-none"
                    />
                    <button
                      onClick={() => saveEmail(i)}
                      disabled={savingEmail === i.id}
                      className="camp-btn-ghost px-3 py-1 text-xs disabled:opacity-40"
                    >
                      {savingEmail === i.id ? "Saving…" : "Save"}
                    </button>
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
