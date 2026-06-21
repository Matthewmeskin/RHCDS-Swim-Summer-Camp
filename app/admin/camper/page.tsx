"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  fetchAllStudents,
  fetchWeeks,
  fetchCamperSchedule,
  type CamperLessonRow,
} from "@/lib/data";
import { formatDayHeader, formatSlotLabel, parseISODate } from "@/lib/format";
import { groupByLevel } from "@/lib/groups";
import type { Student, Week } from "@/lib/types";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function weekRange(w?: Week): string {
  if (!w) return "";
  const a = parseISODate(w.start_date);
  const b = parseISODate(w.end_date);
  return `${MONTHS[a.getMonth()]} ${a.getDate()} – ${MONTHS[b.getMonth()]} ${b.getDate()}`;
}

export default function CamperSchedulePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [lessons, setLessons] = useState<CamperLessonRow[]>([]);
  const [weekFilter, setWeekFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSched, setLoadingSched] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    Promise.all([fetchAllStudents(), fetchWeeks()])
      .then(([s, w]) => {
        setStudents(s.filter((x) => x.active !== false));
        setWeeks(w);
      })
      .finally(() => setLoading(false));
  }, []);

  async function pick(s: Student) {
    setSelected(s);
    setQuery("");
    setWeekFilter(null);
    setLoadingSched(true);
    try {
      setLessons(await fetchCamperSchedule(s.id));
    } finally {
      setLoadingSched(false);
    }
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [students, query]);

  // Group lessons by week.
  const byWeek = useMemo(() => {
    const m = new Map<number, CamperLessonRow[]>();
    for (const l of lessons) {
      if (l.week_number == null) continue;
      (m.get(l.week_number) ?? m.set(l.week_number, []).get(l.week_number)!).push(l);
    }
    return m;
  }, [lessons]);

  const grp = groupByLevel(selected?.group_level);

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
      <div className="no-print">
        <Nav backHref="/admin" />
      </div>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="no-print">
          <h1 className="font-display text-4xl text-brand-green">Camper Schedule</h1>
          <p className="mt-1 text-sm text-brand-text/70">
            Pick a camper to see their whole-summer schedule and instructors — then
            print or save as PDF to share with parents.
          </p>

          {/* Search picker */}
          <div className="relative mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={loading ? "Loading…" : "Search a camper by name…"}
              className="w-full rounded-full border-2 border-brand-green bg-white px-5 py-2.5 text-sm"
            />
            {matches.length > 0 ? (
              <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-2xl border-2 border-brand-green bg-white shadow-lg">
                {matches.map((s) => {
                  const g = groupByLevel(s.group_level);
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => pick(s)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-brand-sand"
                      >
                        {g ? <span>{g.emoji}</span> : null}
                        <span className="font-semibold">{s.first_name} {s.last_name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>

        {selected ? (
          <section className="camp-card mt-6 p-5">
            {/* Print header */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-brand-green/15 pb-3">
              <div>
                <h2 className="font-display text-3xl text-brand-green">
                  {grp ? `${grp.emoji} ` : ""}{selected.first_name} {selected.last_name}
                </h2>
                <p className="text-sm text-brand-text/70">
                  Country Day Camp — Swim Lessons
                  {grp ? ` · ${grp.name}` : ""}
                  {selected.level ? ` · ${selected.level}` : ""}
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="camp-btn no-print px-5 py-2 text-sm"
              >
                🖨️ Print / Save as PDF
              </button>
            </div>

            {/* Week toggle (only weeks the camper has lessons in) */}
            {lessons.length > 0 ? (
              <div className="no-print mt-3 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-bold uppercase tracking-wide text-brand-text/60">Show:</span>
                <button
                  onClick={() => setWeekFilter(null)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                    weekFilter == null ? "border-brand-green bg-brand-green text-white" : "border-brand-green/30 bg-white text-brand-green"
                  }`}
                >
                  All weeks
                </button>
                {weeks
                  .filter((w) => byWeek.has(w.week_number))
                  .map((w) => (
                    <button
                      key={w.week_number}
                      onClick={() => setWeekFilter(weekFilter === w.week_number ? null : w.week_number)}
                      className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                        weekFilter === w.week_number ? "border-brand-green bg-brand-green text-white" : "border-brand-green/30 bg-white text-brand-green"
                      }`}
                    >
                      Wk {w.week_number}
                    </button>
                  ))}
              </div>
            ) : null}

            {loadingSched ? (
              <div className="mt-6 space-y-4">
                {[0, 1].map((r) => (
                  <div key={r} className="camp-card p-4">
                    <div className="mb-3 h-6 w-40 animate-pulse rounded bg-brand-sand/70" />
                    <div className="overflow-hidden rounded-xl border border-brand-green/15">
                      <div className="h-9 animate-pulse bg-brand-aqua/40" />
                      <div className="h-11 animate-pulse border-t border-brand-green/10 bg-white/50" />
                      <div className="h-11 animate-pulse border-t border-brand-green/10 bg-white/50" />
                    </div>
                  </div>
                ))}
                <span className="sr-only">Loading schedule…</span>
              </div>
            ) : lessons.length === 0 ? (
              <p className="mt-6 text-sm text-brand-text/60">
                No lessons scheduled yet for {selected.first_name}.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {weeks
                  .filter((w) => byWeek.has(w.week_number))
                  .filter((w) => weekFilter == null || w.week_number === weekFilter)
                  .map((w) => {
                    const rows = byWeek.get(w.week_number) ?? [];
                    return (
                      <div key={w.week_number} className="overflow-hidden rounded-xl border border-brand-green/20">
                        <div className="flex items-baseline justify-between bg-brand-sand/50 px-3 py-1.5">
                          <h3 className="font-display text-lg text-brand-green">
                            {w.label ?? `Week ${w.week_number}`}
                          </h3>
                          <span className="text-xs font-semibold text-brand-text/60">{weekRange(w)}</span>
                        </div>
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-brand-sand">
                            {rows.map((l, i) => {
                              const { day, date } = formatDayHeader(l.lesson_date);
                              return (
                                <tr key={i} className={i % 2 ? "bg-brand-cream/40" : "bg-white"}>
                                  <td className="p-2 font-semibold text-brand-text">{day} {date}</td>
                                  <td className="p-2 text-brand-text">{formatSlotLabel(l.start_time)}</td>
                                  <td className="p-2 text-brand-text/80">
                                    with <span className="font-semibold">{l.instructors?.name ?? "TBD"}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        ) : (
          <p className="no-print mt-8 text-center text-sm text-brand-text/50">
            Search for a camper above to view their schedule.
          </p>
        )}
      </div>
    </main>
  );
}
