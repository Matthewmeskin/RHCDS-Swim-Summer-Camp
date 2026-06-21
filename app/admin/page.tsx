"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import ConfigNotice from "@/components/ConfigNotice";
import TodayPanel, { type TodoItem } from "@/components/TodayPanel";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  fetchAdminStats,
  fetchUnmatchedNames,
  fetchDefaultWeekNumber,
  fetchInstructors,
  fetchAvailabilitySubmissions,
  pendingRequestCount,
  type AdminStats,
} from "@/lib/data";
import type { Instructor } from "@/lib/types";

const WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function AdminDashboard() {
  const [week, setWeek] = useState<number>(1);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [pendingReqs, setPendingReqs] = useState(0);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [subs, setSubs] = useState<Record<string, string>>({});
  const [instrLoaded, setInstrLoaded] = useState(false);
  const [subsLoaded, setSubsLoaded] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchDefaultWeekNumber()
      .then((def) => {
        if (def != null) setWeek(def);
      })
      .catch(() => {});
    pendingRequestCount().then(setPendingReqs).catch(() => {});
    fetchInstructors()
      .then(setInstructors)
      .catch(() => {})
      .finally(() => setInstrLoaded(true));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchAdminStats(week).then(setStats).catch(() => {});
    fetchUnmatchedNames(week).then(setUnmatched).catch(() => {});
    setSubsLoaded(false);
    fetchAvailabilitySubmissions(week)
      .then(setSubs)
      .catch(() => {})
      .finally(() => setSubsLoaded(true));
  }, [week]);

  // "Today" to-do list — only what genuinely needs the director's attention.
  const todoItems = useMemo<TodoItem[]>(() => {
    const out: TodoItem[] = [];
    if (pendingReqs > 0) {
      out.push({
        key: "reqs",
        icon: "📥",
        title: `${pendingReqs} availability request${pendingReqs === 1 ? "" : "s"} waiting`,
        desc: "Approve or deny instructor changes",
        href: "/admin/requests",
      });
    }
    const active = instructors.filter((i) => i.active !== false);
    const noCode = active.filter((i) => !i.access_code).length;
    if (noCode > 0) {
      out.push({
        key: "codes",
        icon: "🔑",
        title: `${noCode} instructor${noCode === 1 ? "" : "s"} can't log in yet`,
        desc: "Set up access codes so they can sign in",
        href: "/admin/instructors",
      });
    }
    const notSet = active.filter((i) => !subs[i.id]).length;
    if (notSet > 0) {
      out.push({
        key: "avail",
        icon: "📋",
        title: `${notSet} haven't set Week ${week} availability`,
        desc: "Send a reminder from Instructor Access",
        href: "/admin/instructors",
      });
    }
    if (unmatched.length > 0) {
      out.push({
        key: "unmatched",
        icon: "🔗",
        title: `${unmatched.length} schedule name${unmatched.length === 1 ? "" : "s"} don't match a camper`,
        desc: "Fix names so their schedule links up",
        href: "/admin/roster",
      });
    }
    return out;
  }, [pendingReqs, instructors, subs, week, unmatched]);

  const todayLoading = !instrLoaded || !subsLoaded;

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <Nav />
        <ConfigNotice />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Nav backHref="/" />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">
          Aquatics Director — Admin
        </h1>

        {/* Week selector */}
        <div className="mt-4 flex items-center gap-2">
          <label htmlFor="week" className="text-sm font-semibold">
            Current week:
          </label>
          <select
            id="week"
            value={week}
            onChange={(e) => setWeek(parseInt(e.target.value, 10))}
            className="rounded-full border-2 border-brand-green bg-white px-4 py-1.5 text-sm font-semibold"
          >
            {WEEK_OPTIONS.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </div>

        {/* Today — what needs the director's attention right now */}
        <TodayPanel items={todoItems} loading={todayLoading} />

        {/* Pending availability requests */}
        <Link
          href="/admin/requests"
          className="camp-card mt-6 flex items-center gap-4 p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="text-3xl">📥</div>
          <div className="flex-1">
            <h2 className="font-display text-2xl text-brand-green">Availability Requests</h2>
            <p className="text-sm text-brand-text/70">
              Approve or deny instructor availability changes.
            </p>
          </div>
          {pendingReqs > 0 ? (
            <span className="rounded-full bg-brand-orange px-3 py-1 text-sm font-bold text-white">
              {pendingReqs} pending
            </span>
          ) : (
            <span className="text-2xl text-brand-green">→</span>
          )}
        </Link>

        {/* Schedule builder CTA */}
        <Link
          href="/admin/build"
          className="camp-card mt-6 flex items-center gap-4 p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="text-3xl">🧩</div>
          <div className="flex-1">
            <h2 className="font-display text-2xl text-brand-green">Build the Schedule</h2>
            <p className="text-sm text-brand-text/70">
              Assign kids to instructors with consistency suggestions — copy last
              week and adjust.
            </p>
          </div>
          <span className="text-2xl text-brand-green">→</span>
        </Link>

        {/* Master schedule (whole summer) */}
        <Link
          href="/admin/master"
          className="camp-card mt-4 flex items-center gap-4 p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="text-3xl">📅</div>
          <div className="flex-1">
            <h2 className="font-display text-2xl text-brand-green">Master Schedule</h2>
            <p className="text-sm text-brand-text/70">
              Every instructor across all weeks in one big table — the whole summer
              at a glance.
            </p>
          </div>
          <span className="text-2xl text-brand-green">→</span>
        </Link>

        {/* Swim level guide */}
        <Link
          href="/admin/levels"
          className="camp-card mt-4 flex items-center gap-4 p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="text-3xl">🐬</div>
          <div className="flex-1">
            <h2 className="font-display text-2xl text-brand-green">Swim Level Guide</h2>
            <p className="text-sm text-brand-text/70">
              The 6 groups (🐙🐠🐟🐢🐬🦈) — edit what instructors see for each level.
            </p>
          </div>
          <span className="text-2xl text-brand-green">→</span>
        </Link>

        {/* Import cards */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link href="/admin/import/students" className="camp-card block p-6 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="text-3xl">🧑‍🎓</div>
            <h2 className="mt-2 font-display text-2xl text-brand-green">Import Roster</h2>
            <p className="mt-1 text-sm text-brand-text/70">
              One CSV — students, swim groups (🐙🐠🐟🐢🐬🦈), and parent preferences.
            </p>
          </Link>
          <Link href="/admin/import/schedule" className="camp-card block p-6 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="text-3xl">🗓️</div>
            <h2 className="mt-2 font-display text-2xl text-brand-green">Import Schedule</h2>
            <p className="mt-1 text-sm text-brand-text/70">
              Upload the Google Sheets schedule grid for a week.
            </p>
          </Link>
          <Link href="/admin/import/enrollment" className="camp-card block p-6 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="text-3xl">📝</div>
            <h2 className="mt-2 font-display text-2xl text-brand-green">Import Enrollment</h2>
            <p className="mt-1 text-sm text-brand-text/70">
              Who attends each week & how many lessons — powers Auto-fill.
            </p>
          </Link>
        </div>

        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Instructors" value={stats?.instructorCount} />
          <Stat label="Students" value={stats?.studentCount} />
          <Stat label={`Slots · Wk ${week}`} value={stats?.slotsThisWeek} />
        </div>

        {/* Warnings panel */}
        <section className="mt-6">
          <h3 className="font-display text-2xl text-brand-green">Unmatched names</h3>
          <p className="text-sm text-brand-text/70">
            Schedule names (Week {week}) with no matching student record.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unmatched.length === 0 ? (
              <span className="text-sm text-brand-text/50">None — all names matched 🎉</span>
            ) : (
              unmatched.map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-white"
                >
                  {n}
                </span>
              ))
            )}
          </div>
        </section>

        {/* Roster + Coverage */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link href="/admin/coverage" className="camp-card block p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="text-3xl">📊</div>
            <h2 className="mt-2 font-display text-xl text-brand-green">Coverage</h2>
            <p className="text-sm text-brand-text/70">Empty slots & kids not scheduled.</p>
          </Link>
          <Link href="/admin/roster" className="camp-card block p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="text-3xl">👥</div>
            <h2 className="mt-2 font-display text-xl text-brand-green">Roster</h2>
            <p className="text-sm text-brand-text/70">Add / edit kids & instructors.</p>
          </Link>
          <Link href="/admin/camper" className="camp-card block p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="text-3xl">🧾</div>
            <h2 className="mt-2 font-display text-xl text-brand-green">Camper Schedule</h2>
            <p className="text-sm text-brand-text/70">One camper&apos;s summer + instructor — print / PDF.</p>
          </Link>
        </div>

        {/* Instructor links + availability */}
        <Link
          href="/admin/instructors"
          className="camp-card mt-8 flex items-center gap-4 p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="text-3xl">🔗</div>
          <div className="flex-1">
            <h2 className="font-display text-2xl text-brand-green">Instructor Links & Availability</h2>
            <p className="text-sm text-brand-text/70">
              Share each instructor's personal link, and see who's set their
              availability for the week.
            </p>
          </div>
          <span className="text-2xl text-brand-green">→</span>
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="camp-card p-4 text-center">
      <div className="font-display text-3xl text-brand-green">{value ?? "—"}</div>
      <div className="text-xs font-semibold text-brand-text/70">{label}</div>
    </div>
  );
}
