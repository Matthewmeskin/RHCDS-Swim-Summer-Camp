"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import ConfigNotice from "@/components/ConfigNotice";
import StudentModal from "@/components/StudentModal";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  fetchInstructors,
  fetchWeeks,
  fetchAllScheduleSlots,
  fetchAllOffAvailability,
  fetchAllStudents,
  type SlotLite,
  type OffLite,
} from "@/lib/data";
import { parseISODate, formatDayHeader, formatSlotLabel } from "@/lib/format";
import { getWeekDays } from "@/lib/builder";
import type { Instructor, Student, Week } from "@/lib/types";

type Metric = "lessons" | "kids";
type View = "overview" | "detail";

const SLOT_TIMES = ["16:30:00", "17:00:00", "17:30:00"];
const hhmm = (t: string) => t.slice(0, 5);

function levelPill(level: string | null): string {
  switch (level) {
    case "Non-Swimmer": return "bg-brand-orange text-white";
    case "Beginner": return "bg-brand-yellow text-brand-text";
    case "Intermediate": return "bg-brand-green text-white";
    case "Advanced": return "bg-brand-aqua text-brand-text";
    default: return "bg-gray-400 text-white";
  }
}
function initials(s: Student): string {
  return `${s.first_name.charAt(0)}${s.last_name.charAt(0)}`.toUpperCase();
}

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
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>("lessons");
  const [showOff, setShowOff] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [detailWeek, setDetailWeek] = useState<number>(1);
  const [selected, setSelected] = useState<Student | null>(null);

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
      fetchAllStudents(),
    ])
      .then(([ins, w, sl, of, st]) => {
        setInstructors(ins);
        setWeeks(w);
        setSlots(sl);
        setOff(of);
        setStudents(st);
        if (w[0]) setDetailWeek(w[0].week_number);
      })
      .finally(() => setLoading(false));
  }, []);

  const studentsById = useMemo(() => {
    const m = new Map<string, Student>();
    students.forEach((s) => m.set(s.id, s));
    return m;
  }, [students]);

  // counts[`${instructorId}__${weekNumber}`] for the selected metric (overview).
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

  // ----- Week-detail data: per instructor × day × time -----
  const detailWeekObj = weeks.find((w) => w.week_number === detailWeek) ?? null;
  const detailDays = useMemo(() => getWeekDays(detailWeekObj), [detailWeekObj]);

  const detailKids = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of slots) {
      if (s.week_number !== detailWeek || !s.instructor_id || !s.student_id) continue;
      const k = `${s.instructor_id}__${s.lesson_date}__${hhmm(s.start_time)}`;
      (m.get(k) ?? m.set(k, []).get(k)!).push(s.student_id);
    }
    return m;
  }, [slots, detailWeek]);

  const detailOff = useMemo(() => {
    const set = new Set<string>();
    for (const o of off) {
      if (o.week_number !== detailWeek || !o.instructor_id) continue;
      set.add(`${o.instructor_id}__${o.lesson_date}__${hhmm(o.start_time)}`);
    }
    return set;
  }, [off, detailWeek]);

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/admin" />
        <ConfigNotice />
      </main>
    );
  }

  const ready = !loading && weeks.length > 0 && instructors.length > 0;

  return (
    <main className="min-h-screen">
      <Nav backHref="/admin" />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Master Schedule</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          The whole summer at a glance. Switch to <strong>Week detail</strong> to see
          the Mon–Fri times for each instructor.
        </p>

        {loading ? (
          <p className="mt-8 text-center text-brand-text/60">Loading…</p>
        ) : !ready ? (
          <div className="camp-card mt-6 p-5 text-sm text-brand-text/70">
            Add instructors and weeks first, then build a schedule to see it here.
          </div>
        ) : (
          <>
            {/* View toggle */}
            <div className="mt-4 inline-flex overflow-hidden rounded-full border-2 border-brand-green">
              {([
                ["overview", "Season overview"],
                ["detail", "Week detail"],
              ] as [View, string][]).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 text-sm font-bold transition ${
                    view === v ? "bg-brand-green text-white" : "bg-white text-brand-green"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {view === "overview" ? (
              <Overview
                instructors={instructors}
                weeks={weeks}
                counts={counts}
                offCounts={offCounts}
                metric={metric}
                setMetric={setMetric}
                showOff={showOff}
                setShowOff={setShowOff}
                highlight={highlight}
                busiest={busiest}
                grandTotal={grandTotal}
                rowTotal={rowTotal}
                colTotal={colTotal}
                weekShort={weekShort}
              />
            ) : (
              <Detail
                instructors={instructors}
                weeks={weeks}
                days={detailDays}
                detailWeek={detailWeek}
                setDetailWeek={setDetailWeek}
                detailKids={detailKids}
                detailOff={detailOff}
                studentsById={studentsById}
                onPick={setSelected}
                showOff={showOff}
                setShowOff={setShowOff}
              />
            )}
          </>
        )}
      </div>

      {selected ? <StudentModal student={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

/* ------------------------------- Overview ------------------------------- */

function Overview(props: {
  instructors: Instructor[];
  weeks: Week[];
  counts: Map<string, number>;
  offCounts: Map<string, number>;
  metric: Metric;
  setMetric: (m: Metric) => void;
  showOff: boolean;
  setShowOff: (b: boolean) => void;
  highlight: { wk: number; label: string } | null;
  busiest: { wk: number; n: number } | null;
  grandTotal: number;
  rowTotal: (id: string) => number;
  colTotal: (wk: number) => number;
  weekShort: (w: Week) => string;
}) {
  const {
    instructors, weeks, counts, offCounts, metric, setMetric, showOff, setShowOff,
    highlight, busiest, grandTotal, rowTotal, colTotal, weekShort,
  } = props;

  return (
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

      {/* Controls */}
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

      {/* Legend */}
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
                  <th className={`sticky left-0 z-10 border-t border-brand-green/10 p-2 text-left font-semibold text-brand-green ${stickyBg}`}>
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
                            {c === 0 ? "—" : c}
                          </Link>
                        ) : (
                          <div className="px-2 py-2" title={title}>{c === 0 ? "—" : c}</div>
                        )}
                        {showOff && offN > 0 ? (
                          <span className="absolute right-1 top-1 rounded-full bg-brand-orange px-1 text-[9px] font-bold leading-tight text-white">
                            {offN}
                          </span>
                        ) : null}
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
        Each cell is the number of {metric} that week. Tap a cell to open that
        instructor&apos;s schedule for the week.
      </p>
    </>
  );
}

/* -------------------------------- Detail -------------------------------- */

function Detail(props: {
  instructors: Instructor[];
  weeks: Week[];
  days: string[];
  detailWeek: number;
  setDetailWeek: (n: number) => void;
  detailKids: Map<string, string[]>;
  detailOff: Set<string>;
  studentsById: Map<string, Student>;
  onPick: (s: Student) => void;
  showOff: boolean;
  setShowOff: (b: boolean) => void;
}) {
  const {
    instructors, weeks, days, detailWeek, setDetailWeek, detailKids, detailOff,
    studentsById, onPick, showOff, setShowOff,
  } = props;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold">Week:</label>
        <select
          value={detailWeek}
          onChange={(e) => setDetailWeek(parseInt(e.target.value, 10))}
          className="rounded-full border-2 border-brand-green bg-white px-4 py-1.5 text-sm font-semibold"
        >
          {weeks.map((w) => (
            <option key={w.week_number} value={w.week_number}>
              {w.label ?? `Week ${w.week_number}`}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-brand-text">
          <input
            type="checkbox"
            checked={showOff}
            onChange={(e) => setShowOff(e.target.checked)}
            className="h-4 w-4 accent-brand-orange"
          />
          Show time off
        </label>
        <span className="ml-auto italic text-xs text-brand-text/40 sm:hidden">swipe sideways →</span>
      </div>

      {/* Level legend */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-brand-text/70">
        <span>Levels:</span>
        <span className="rounded px-2 py-0.5 bg-brand-orange text-white">Non-Swimmer</span>
        <span className="rounded px-2 py-0.5 bg-brand-yellow text-brand-text">Beginner</span>
        <span className="rounded px-2 py-0.5 bg-brand-green text-white">Intermediate</span>
        <span className="rounded px-2 py-0.5 bg-brand-aqua text-brand-text">Advanced</span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-brand-green/15">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 top-0 z-30 min-w-[140px] border-b border-white/40 bg-brand-aqua p-2 text-left align-bottom text-brand-text"
              >
                Instructor
              </th>
              {days.map((d) => {
                const { day, date } = formatDayHeader(d);
                return (
                  <th
                    key={d}
                    colSpan={SLOT_TIMES.length}
                    className="sticky top-0 z-20 border-l-2 border-white/60 bg-brand-aqua p-1.5 text-center text-brand-text"
                  >
                    <span className="block font-bold uppercase tracking-wide">{day}</span>
                    <span className="block text-[11px] font-semibold text-brand-text/70">{date}</span>
                  </th>
                );
              })}
            </tr>
            <tr>
              {days.map((d) =>
                SLOT_TIMES.map((t, i) => (
                  <th
                    key={`${d}__${t}`}
                    className={`sticky top-[44px] z-20 bg-brand-aqualight p-1 text-center text-[11px] font-bold text-brand-text ${
                      i === 0 ? "border-l-2 border-white/60" : "border-l border-white/40"
                    }`}
                  >
                    {formatSlotLabel(t)}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {instructors.map((ins, rowIdx) => {
              const stickyBg = rowIdx % 2 ? "bg-brand-cream" : "bg-white";
              return (
                <tr key={ins.id} className={rowIdx % 2 ? "bg-brand-cream/40" : "bg-white"}>
                  <th className={`sticky left-0 z-10 border-t border-brand-green/10 p-2 text-left font-semibold text-brand-green ${stickyBg}`}>
                    {ins.slug ? (
                      <Link href={`/instructor/${ins.slug}?week=${detailWeek}`} className="hover:underline">
                        {ins.name}
                      </Link>
                    ) : (
                      ins.name
                    )}
                  </th>
                  {days.map((d) =>
                    SLOT_TIMES.map((t, i) => {
                      const key = `${ins.id}__${d}__${hhmm(t)}`;
                      const kids = (detailKids.get(key) ?? [])
                        .map((id) => studentsById.get(id))
                        .filter((s): s is Student => Boolean(s));
                      const isOff = detailOff.has(key);
                      const offEmpty = showOff && isOff && kids.length === 0;
                      return (
                        <td
                          key={key}
                          className={`min-w-[44px] border-t border-brand-green/10 p-1 align-top ${
                            i === 0 ? "border-l-2 border-brand-green/20" : "border-l border-brand-green/10"
                          } ${offEmpty ? "bg-brand-orange/10" : kids.length === 0 ? "bg-gray-50" : ""}`}
                        >
                          {kids.length === 0 ? (
                            <span className={`block text-center text-[11px] ${offEmpty ? "font-bold text-brand-orange/60" : "text-brand-text/30"}`}>
                              {offEmpty ? "off" : "—"}
                            </span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {kids.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => onPick(s)}
                                  title={`${s.first_name} ${s.last_name}${s.level ? ` · ${s.level}` : ""} — tap for details`}
                                  className={`rounded px-1 py-0.5 text-center text-[11px] font-bold leading-tight transition hover:brightness-95 ${levelPill(s.level)}`}
                                >
                                  {initials(s)}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-brand-text/50">
        Each pill is a kid (initials, colored by level) at that day &amp; time —
        <strong> tap a pill for their info &amp; notes</strong>. Times are{" "}
        {SLOT_TIMES.map((t) => formatSlotLabel(t)).join(" · ")}.
      </p>
    </>
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
