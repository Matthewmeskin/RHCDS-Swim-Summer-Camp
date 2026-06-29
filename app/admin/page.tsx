"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import ConfigNotice from "@/components/ConfigNotice";
import TodayPanel, { type TodoItem } from "@/components/TodayPanel";
import BackupCard from "@/components/BackupCard";
import InstallButton from "@/components/InstallButton";
import WelcomeTour from "@/components/WelcomeTour";
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
    const cantLogin = active.filter((i) => !i.access_code || !i.email).length;
    if (cantLogin > 0) {
      out.push({
        key: "codes",
        icon: "🔑",
        title: `${cantLogin} instructor${cantLogin === 1 ? "" : "s"} can't log in yet`,
        desc: "Add their email + access code so they can sign in",
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

  const secondary: { href: string; icon: string; title: string; desc: string; badge?: number }[] = [
    { href: "/admin/requests", icon: "📥", title: "Requests", desc: "Approve availability changes.", badge: pendingReqs },
    { href: "/admin/coverage", icon: "📊", title: "Coverage", desc: "Empty slots & unscheduled kids." },
    { href: "/admin/roster", icon: "👥", title: "Roster", desc: "Add / edit kids & instructors." },
    { href: "/admin/camper", icon: "🧾", title: "Camper Schedule", desc: "One camper's summer — print / PDF." },
    { href: "/admin/sheets", icon: "🏊", title: "Pool-Deck Sheets", desc: "Daily lineups per instructor." },
    { href: "/admin/instructors", icon: "🔗", title: "Instructor Links", desc: "Personal links & who's set availability." },
    { href: "/admin/levels", icon: "🐬", title: "Swim Level Guide", desc: "The 6 groups instructors see." },
    { href: "/admin/import", icon: "📥", title: "Imports", desc: "Bring in rosters, schedules & more." },
  ];

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

        {/* Master Schedule — the hero. Everything day-to-day happens here. */}
        <Link
          href="/admin/master"
          className="group mt-6 block rounded-3xl bg-brand-green p-6 text-white shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">📅</div>
            <div className="flex-1">
              <h2 className="font-display text-3xl">Master Schedule</h2>
              <p className="mt-1 text-sm text-white/85">
                The whole summer in one table — tap <strong>Build</strong> to assign kids with
                Auto-fill, drag-and-drop, time-off and lifeguard duty.
              </p>
            </div>
            <span className="text-3xl transition-transform group-hover:translate-x-1">→</span>
          </div>
        </Link>

        {/* Everything else — one compact, uniform grid */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {secondary.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="camp-card relative block p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
            >
              {it.badge ? (
                <span className="absolute right-3 top-3 rounded-full bg-brand-orange px-2 py-0.5 text-xs font-bold text-white">
                  {it.badge}
                </span>
              ) : null}
              <div className="text-2xl">{it.icon}</div>
              <h2 className="mt-1 font-display text-lg text-brand-green">{it.title}</h2>
              <p className="text-xs text-brand-text/70">{it.desc}</p>
            </Link>
          ))}
        </div>

        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Instructors" value={stats?.instructorCount} />
          <Stat label="Students" value={stats?.studentCount} />
          <Stat label={`Slots · Wk ${week}`} value={stats?.slotsThisWeek} />
        </div>

        {/* Reassurance: one-click full backup */}
        <BackupCard />

        {/* Install to phone home screen */}
        <InstallButton />
      </div>

      {/* First-time guided tour (+ always-available re-open button) */}
      <WelcomeTour />
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
