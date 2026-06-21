"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  fetchInstructors,
  fetchWeeks,
  fetchAllScheduleSlots,
  fetchAllOffAvailability,
  type SlotLite,
  type OffLite,
} from "@/lib/data";
import { parseISODate } from "@/lib/format";
import type { Instructor, Week } from "@/lib/types";

type Metric = "lessons" | "kids";

/** Heatmap tint for a lesson count — denser weeks read darker. */
function cellClass(count: number): string {
  if (count === 0) return "bg-gray-50 text-brand-text/30";
  if (count <= 2) return "bg-brand-green/15 text-brand-green";
  if (count <= 5) return "bg-brand-green/35 text-brand-green";
  if (count <= 9) return "bg-brand-green/60 text-white";
  return "bg-brand-green text-white";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function weekShort(w: Week): string {
  const d = parseISODate(w.start_date);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function MasterSchedulePage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [slots, setSlots] = useState<SlotLite[]>([]);
  const [off, setOff] = useState<OffLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>("lessons");
  const [showOff, setShowOff] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetchInstructors(),
      fetchWeeks(),
      fetchAllScheduleSlots(),
      fetchAllOffAvailability(),
    ])
      .then(([ins, w, sl, of]) => {
        setInstructors(ins);
        setWeeks(w);
        setSlots(sl);
        setOff(of);
      })
      .finally(() => setLoading(false));
  }, []);

  // counts[`${instructorId}__${weekNumber}`] for the selected metric.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    if (metric === "lessons") {
      for (const s of slots) {
        if (!s.instructor_id || s.week_number == null || !s.student_id) continue;
        const k = `${s.instructor_id}__${s.week_number}`;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    } else {
      const seen = new Map<string, Set<string>>();
      for (const s of slots) {
        if (!s.instructor_id || s.week_number == null || !s.student_id) continue;
        const k = `${s.instructor_id}__${s.week_number}`;
        const set = seen.get(k) ?? new Set<string>();
        set.add(s.student_id);
        seen.set(k, set);
      }
      seen.forEach((set, k) => m.set(k, set.size));
    }
    return m;
  }, [slots, metric]);

  // offCounts[`${instructorId}__${weekNumber}`] = number of off slots that week.
  const offCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of off) {
      if (!o.instructor_id || o.week_number == null) continue;
      const k = `${o.instructor_id}__${o.week_number}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [off]);

  const rowTotal = (id: string) =>
    weeks.reduce((sum, w) => sum + (counts.get(`${id}__${w.week_number}`) ?? 0), 0);
  const colTotal = (wk: number) =>
    instructors.reduce((sum, i) => sum + (counts.get(`${i.id}__${wk}`) ?? 0), 0);
  const grandTotal = useMemo(
    () => Array.from(counts.values()).reduce((a, b) => a + b, 0),
    [counts]
  );

  // Which week to highlight: the one containing today, else the next upcoming.
  const highlight = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const current = weeks.find((w) => w.start_date <= today && today <= w.end_date);
    if (current) return { wk: current.week_number, label: "This week" };
    const upcoming = weeks.find((w) => today < w.start_date);
    if (upcoming) return { wk: upcoming.week_number, label: "Up next" };
    return null;
  }, [weeks]);

  const busiest = useMemo(() => {
    let best: { wk: number; n: number } | null = null;
    for (const w of weeks) {
      const n = colTotal(w.week_number);
      if (!best || n > best.n) best = { wk: w.week_number, n };
    }
    return best && best.n > 0 ? best : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, counts]);

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
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Master Schedule</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Every instructor across all weeks — the whole summer at a glance. Tap any
          cell to open that instructor&apos;s week.
        </p>

        {loading ? (
          <p className="mt-8 text-center text-brand-text/60">Loading…</p>
        ) : weeks.length === 0 || instructors.length === 0 ? (
          <div className="camp-card mt-6 p-5 text-sm text-brand-text/70">
            Add instructors and weeks first, then build a schedule to see it here.
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Instructors" value={instructors.length} />
              <Stat label="Weeks" value={weeks.length} />
              <Stat label="Total lessons" value={grandTotal} />
              <Stat
                label="Busiest week"
                value={busiest ? `Wk ${busiest.wk}` : "—"}
                sub={busiest ? `${busiest.n} lessons` : undefined}
              />
            </div>

            {/* Controls: metric toggle + time-off overlay */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex overflow-hidden rounded-full border-2 border-brand-green">
                {(["lessons", "kids"] as Metric[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`px-4 py-1.5 text-sm font-bold capitalize transition ${
                      metric === m ? "bg-brand-green text-white" : "bg-white text-brand-green"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-brand-text">
                <input
                  type="checkbox"
                  checked={showOff}
                  onChange={(e) => setShowOff(e.target.checked)}
                  className="h-4 w-4 accent-brand-orange"
                />
                Show time off
              </label>
            </div>

            {/* Legend + scroll hint */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-brand-text/60">
              <span className="font-semibold capitalize">{metric} / week:</span>
              <span className="rounded px-2 py-0.5 bg-gray-50 text-brand-text/40">0</span>
              <span className="rounded px-2 py-0.5 bg-brand-green/15 text-brand-green">1–2</span>
              <span className="rounded px-2 py-0.5 bg-brand-green/35 text-brand-green">3–5</span>
              <span className="rounded px-2 py-0.5 bg-brand-green/60 text-white">6–9</span>
              <span className="rounded px-2 py-0.5 bg-brand-green text-white">10+</span>
              {showOff ? (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-brand-orange" />
                  has time off
                </span>
              ) : null}
              <span className="ml-auto italic text-brand-text/40 sm:hidden">swipe sideways →</span>
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-brand-green/15">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-30 min-w-[150px] bg-brand-aqua p-2 text-left text-brand-text">
                      Instructor
                    </th>
                    {weeks.map((w) => {
                      const isHi = highlight?.wk === w.week_number;
                      return (
                        <th
                          key={w.week_number}
                          className={`sticky top-0 z-20 border-l border-white/40 p-2 text-center text-brand-text ${
                            isHi ? "bg-brand-orange/90 text-white" : "bg-brand-aqua"
                          }`}
                        >
                          <span className="block font-bold">Wk {w.week_number}</span>
                          <span className={`block text-[11px] font-semibold ${isHi ? "text-white/90" : "text-brand-text/70"}`}>
                            {weekShort(w)}
                          </span>
                          {isHi ? (
                            <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide">
                              {highlight?.label}
                            </span>
                          ) : null}
                        </th>
                      );
                    })}
                    <th className="sticky top-0 z-20 border-l border-white/40 bg-brand-aqua p-2 text-center font-bold text-brand-text">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {instructors.map((ins, rowIdx) => {
                    const stripe = rowIdx % 2 ? "bg-brand-cream/40" : "bg-white";
                    const stickyBg = rowIdx % 2 ? "bg-brand-cream" : "bg-white";
                    return (
                      <tr key={ins.id} className={stripe}>
                        <th
                          className={`sticky left-0 z-10 border-t border-brand-green/10 p-2 text-left font-semibold text-brand-green ${stickyBg}`}
                        >
                          {ins.name}
                          {ins.role && ins.role !== "instructor" ? (
                            <span className="ml-1 rounded bg-brand-aqualight/60 px-1 text-[9px] font-bold uppercase text-brand-text/70">
                              {ins.role}
                            </span>
                          ) : null}
                        </th>
                        {weeks.map((w) => {
                          const c = counts.get(`${ins.id}__${w.week_number}`) ?? 0;
                          const offN = offCounts.get(`${ins.id}__${w.week_number}`) ?? 0;
                          const isHi = highlight?.wk === w.week_number;
                          const offDot =
                            showOff && offN > 0 ? (
                              <span className="absolute right-1 top-1 rounded-full bg-brand-orange px-1 text-[9px] font-bold leading-tight text-white">
                                {offN}
                              </span>
                            ) : null;
                          const inner = <span className="block h-full w-full">{c === 0 ? "—" : c}</span>;
                          const title = `${ins.name} — Week ${w.week_number}: ${c} ${metric}${
                            offN > 0 ? ` · ${offN} time(s) off` : ""
                          }`;
                          return (
                            <td
                              key={w.week_number}
                              className={`relative border-l border-t border-brand-green/10 p-0 text-center font-semibold ${cellClass(c)} ${
                                isHi ? "ring-2 ring-inset ring-brand-orange/50" : ""
                              }`}
                            >
                              {ins.slug ? (
                                <Link
                                  href={`/instructor/${ins.slug}?week=${w.week_number}`}
                                  className="block px-2 py-2 transition hover:brightness-95"
                                  title={title}
                                >
                                  {inner}
                                </Link>
                              ) : (
                                <div className="px-2 py-2" title={title}>{inner}</div>
                              )}
                              {offDot}
                            </td>
                          );
                        })}
                        <td className="border-l border-t border-brand-green/10 bg-brand-sand/40 p-2 text-center font-bold text-brand-text">
                          {rowTotal(ins.id)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-brand-aqualight/40">
                    <th className="sticky left-0 z-10 border-t-2 border-brand-green/30 bg-brand-aqualight p-2 text-left font-bold text-brand-text">
                      Total
                    </th>
                    {weeks.map((w) => (
                      <td
                        key={w.week_number}
                        className={`border-l border-t-2 border-brand-green/30 p-2 text-center font-bold text-brand-text ${
                          highlight?.wk === w.week_number ? "bg-brand-orange/15" : ""
                        }`}
                      >
                        {colTotal(w.week_number)}
                      </td>
                    ))}
                    <td className="border-l border-t-2 border-brand-green/30 bg-brand-green p-2 text-center font-bold text-white">
                      {grandTotal}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="mt-2 text-xs text-brand-text/50">
              Each cell is the number of lessons (kids placed) that week. Empty weeks
              show <span className="font-semibold">—</span>. Tap a cell to open that
              instructor&apos;s schedule for the week.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="camp-card p-3 text-center">
      <div className="font-display text-2xl text-brand-green">{value}</div>
      <div className="text-xs font-semibold text-brand-text/70">{label}</div>
      {sub ? <div className="text-[11px] text-brand-text/50">{sub}</div> : null}
    </div>
  );
}
