"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import ConfigNotice from "@/components/ConfigNotice";
import StudentModal from "@/components/StudentModal";
import Toast, { type ToastKind } from "@/components/Toast";
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
import { getWeekDays, saveAllWeeks } from "@/lib/builder";
import { SWIM_GROUPS, groupByLevel } from "@/lib/groups";
import type { Instructor, Student, Week } from "@/lib/types";

type Metric = "lessons" | "kids";
type View = "allweeks" | "overview";

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
  const [view, setView] = useState<View>("allweeks");
  const [groupFilter, setGroupFilter] = useState<number | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [building, setBuilding] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [picker, setPicker] = useState<{ instructorId: string; date: string; hhmm: string } | null>(null);
  const [pickQuery, setPickQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const [gQuery, setGQuery] = useState("");

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
      })
      .finally(() => setLoading(false));
  }, []);

  const studentsById = useMemo(() => {
    const m = new Map<string, Student>();
    students.forEach((s) => m.set(s.id, s));
    return m;
  }, [students]);

  const inGroup = (studentId: string) =>
    groupFilter == null || studentsById.get(studentId)?.group_level === groupFilter;

  // counts[`${instructorId}__${weekNumber}`] for the selected metric (overview).
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    if (metric === "lessons") {
      for (const s of slots) {
        if (!s.instructor_id || s.week_number == null || !s.student_id || !inGroup(s.student_id)) continue;
        const k = `${s.instructor_id}__${s.week_number}`;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    } else {
      const seen = new Map<string, Set<string>>();
      for (const s of slots) {
        if (!s.instructor_id || s.week_number == null || !s.student_id || !inGroup(s.student_id)) continue;
        const k = `${s.instructor_id}__${s.week_number}`;
        const set = seen.get(k) ?? new Set<string>();
        set.add(s.student_id);
        seen.set(k, set);
      }
      seen.forEach((set, k) => m.set(k, set.size));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, metric, groupFilter, studentsById]);

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

  // ----- Per-cell data (instructor × date × time) for the detail grids -----
  const kidsByCell = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of slots) {
      if (!s.instructor_id || !s.student_id || !inGroup(s.student_id)) continue;
      const k = `${s.instructor_id}__${s.lesson_date}__${hhmm(s.start_time)}`;
      (m.get(k) ?? m.set(k, []).get(k)!).push(s.student_id);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, groupFilter, studentsById]);

  const offByCell = useMemo(() => {
    const set = new Set<string>();
    for (const o of off) {
      if (!o.instructor_id) continue;
      set.add(`${o.instructor_id}__${o.lesson_date}__${hhmm(o.start_time)}`);
    }
    return set;
  }, [off]);

  // ----- Build mode: editable assignments (cellKey -> studentIds) -----
  // Rebuild from the saved slots whenever not actively editing.
  useEffect(() => {
    if (building) return;
    const m: Record<string, string[]> = {};
    for (const s of slots) {
      if (!s.instructor_id || !s.student_id) continue;
      const k = `${s.instructor_id}__${s.lesson_date}__${hhmm(s.start_time)}`;
      (m[k] ||= []).push(s.student_id);
    }
    setAssignments(m);
  }, [slots, building]);

  const dateToWeek = useMemo(() => {
    const m: Record<string, number> = {};
    for (const w of weeks) for (const d of getWeekDays(w)) m[d] = w.week_number;
    return m;
  }, [weeks]);

  const buildKids = useMemo(() => new Map(Object.entries(assignments)), [assignments]);

  function addKid(studentId: string) {
    if (!picker) return;
    const k = `${picker.instructorId}__${picker.date}__${picker.hhmm}`;
    setAssignments((prev) => {
      const cur = prev[k] ?? [];
      if (cur.includes(studentId)) return prev;
      return { ...prev, [k]: [...cur, studentId] };
    });
    setPicker(null);
    setPickQuery("");
  }
  function removeKid(instructorId: string, date: string, hh: string, studentId: string) {
    const k = `${instructorId}__${date}__${hh}`;
    setAssignments((prev) => ({ ...prev, [k]: (prev[k] ?? []).filter((id) => id !== studentId) }));
  }
  async function saveBuild() {
    setSaving(true);
    try {
      const n = await saveAllWeeks(assignments, dateToWeek, weeks.map((w) => w.week_number));
      setToast({ msg: `Saved · ${n} lessons across the season`, kind: "success" });
      setBuilding(false);
      const sl = await fetchAllScheduleSlots();
      setSlots(sl);
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Save failed", kind: "error" });
    } finally {
      setSaving(false);
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

  const ready = !loading && weeks.length > 0 && instructors.length > 0;

  return (
    <main className="min-h-screen">
      <Nav backHref="/admin" />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Master Schedule</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Every instructor across all weeks, Mon–Fri. Switch to{" "}
          <strong>Condensed</strong> for the counts-only overview.
        </p>

        {/* Global camper search */}
        <div className="relative mt-3">
          <input
            value={gQuery}
            onChange={(e) => setGQuery(e.target.value)}
            placeholder="🔍 Search any camper — ability, group & notes…"
            className="w-full rounded-full border-2 border-brand-green bg-white px-5 py-2.5 text-sm"
          />
          {gQuery.trim() ? (
            <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-2xl border-2 border-brand-green bg-white shadow-lg">
              {students
                .filter((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(gQuery.trim().toLowerCase()))
                .slice(0, 10)
                .map((s) => {
                  const g = groupByLevel(s.group_level);
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => { setSelected(s); setGQuery(""); }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-brand-sand"
                      >
                        {g ? (
                          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: g.color }}>
                            {g.emoji}
                          </span>
                        ) : null}
                        <span className="flex-1 truncate font-semibold">{s.first_name} {s.last_name}</span>
                        {g ? <span className="text-xs text-brand-text/60">{g.name}</span> : null}
                        {s.level ? <span className="text-xs text-brand-text/40">{s.level}</span> : null}
                      </button>
                    </li>
                  );
                })}
              {students.filter((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(gQuery.trim().toLowerCase())).length === 0 ? (
                <li className="px-4 py-3 text-center text-sm text-brand-text/50">No campers found</li>
              ) : null}
            </ul>
          ) : null}
        </div>

        {loading ? (
          <p className="mt-8 text-center text-brand-text/60">Loading…</p>
        ) : !ready ? (
          <div className="camp-card mt-6 p-5 text-sm text-brand-text/70">
            Add instructors and weeks first, then build a schedule to see it here.
          </div>
        ) : (
          <>
            {/* View toggle + build controls */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex overflow-hidden rounded-full border-2 border-brand-green">
                {([
                  ["allweeks", "Detailed"],
                  ["overview", "Condensed"],
                ] as [View, string][]).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    disabled={building}
                    className={`px-5 py-1.5 text-sm font-bold transition disabled:opacity-40 ${
                      view === v ? "bg-brand-green text-white" : "bg-white text-brand-green"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {view === "allweeks" ? (
                building ? (
                  <div className="flex items-center gap-2">
                    <button onClick={saveBuild} disabled={saving} className="camp-btn px-4 py-1.5 text-sm">
                      {saving ? "Saving…" : "💾 Save schedule"}
                    </button>
                    <button onClick={() => setBuilding(false)} className="camp-btn-ghost px-4 py-1.5 text-sm">
                      Cancel
                    </button>
                    <span className="text-xs font-semibold text-brand-orange">Editing — tap a slot to add/remove kids</span>
                  </div>
                ) : (
                  <button onClick={() => setBuilding(true)} className="camp-btn-orange px-4 py-1.5 text-sm">
                    🧩 Build schedule
                  </button>
                )
              ) : null}
            </div>

            {/* Group filter */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-bold uppercase tracking-wide text-brand-text/60">Group:</span>
              <button
                onClick={() => setGroupFilter(null)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                  groupFilter == null ? "border-brand-green bg-brand-green text-white" : "border-brand-green/30 bg-white text-brand-green"
                }`}
              >
                All
              </button>
              {SWIM_GROUPS.map((g) => {
                const active = groupFilter === g.level;
                return (
                  <button
                    key={g.level}
                    onClick={() => setGroupFilter(active ? null : g.level)}
                    className="rounded-full border px-3 py-1 text-xs font-bold transition"
                    style={
                      active
                        ? { backgroundColor: g.color, borderColor: g.color, color: "white" }
                        : { borderColor: g.color, color: g.color, backgroundColor: "white" }
                    }
                  >
                    {g.emoji} {g.name}
                  </button>
                );
              })}
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
              <AllWeeksDetail
                instructors={instructors}
                weeks={weeks}
                kidsByCell={building ? buildKids : kidsByCell}
                offByCell={offByCell}
                studentsById={studentsById}
                onPick={setSelected}
                showOff={showOff}
                setShowOff={setShowOff}
                building={building}
                onAdd={(instructorId, date, hh) => { setPicker({ instructorId, date, hhmm: hh }); setPickQuery(""); }}
                onRemove={removeKid}
              />
            )}
          </>
        )}
      </div>

      {/* Build picker */}
      {picker ? (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center">
          <button aria-label="Close" onClick={() => setPicker(null)} className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md rounded-t-3xl bg-brand-cream p-5 shadow-2xl sm:rounded-3xl sm:border-2 sm:border-brand-green">
            <h3 className="font-display text-2xl text-brand-green">Add a camper</h3>
            <p className="text-xs text-brand-text/60">
              {instructors.find((i) => i.id === picker.instructorId)?.name} ·{" "}
              {formatDayHeader(picker.date).day} {formatDayHeader(picker.date).date} · {formatSlotLabel(`${picker.hhmm}:00`)}
            </p>
            <input
              autoFocus
              value={pickQuery}
              onChange={(e) => setPickQuery(e.target.value)}
              placeholder="Search campers…"
              className="mt-3 w-full rounded-full border-2 border-brand-green bg-white px-4 py-2 text-sm"
            />
            <ul className="mt-3 max-h-72 divide-y divide-brand-sand overflow-auto rounded-xl border border-brand-green/15 bg-white">
              {students
                .filter((s) => s.active !== false)
                .filter((s) => {
                  const q = pickQuery.trim().toLowerCase();
                  return q ? `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) : true;
                })
                .slice(0, 40)
                .map((s) => {
                  const g = groupByLevel(s.group_level);
                  return (
                    <li key={s.id} className="flex items-center">
                      <button onClick={() => addKid(s.id)} className="flex flex-1 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-sand">
                        {g ? (
                          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: g.color }} title={g.name}>
                            {g.emoji} {g.name.split(" ")[1] ?? g.name}
                          </span>
                        ) : null}
                        <span className="flex-1 truncate font-semibold">{s.first_name} {s.last_name}</span>
                        {s.level ? <span className="text-xs text-brand-text/50">{s.level}</span> : null}
                      </button>
                      <button
                        onClick={() => setSelected(s)}
                        title="View ability, group & notes"
                        className="shrink-0 px-3 py-2 text-xs font-bold text-brand-green hover:underline"
                      >
                        Notes
                      </button>
                    </li>
                  );
                })}
            </ul>
            <button onClick={() => setPicker(null)} className="camp-btn-ghost mt-3 w-full">Done</button>
          </div>
        </div>
      ) : null}

      {selected ? (
        <StudentModal
          student={selected}
          adminEdit
          onClose={() => setSelected(null)}
          onSaved={(u) => {
            setSelected(u);
            setStudents((prev) => prev.map((s) => (s.id === u.id ? u : s)));
          }}
        />
      ) : null}

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} /> : null}
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

/* ----------------------- Shared per-week detail grid --------------------- */

function WeekGrid({
  weekNumber, days, instructors, kidsByCell, offByCell, studentsById, onPick, showOff,
  building = false, onAdd, onRemove,
}: {
  weekNumber: number;
  days: string[];
  instructors: Instructor[];
  kidsByCell: Map<string, string[]>;
  offByCell: Set<string>;
  studentsById: Map<string, Student>;
  onPick: (s: Student) => void;
  showOff: boolean;
  building?: boolean;
  onAdd?: (instructorId: string, date: string, hh: string) => void;
  onRemove?: (instructorId: string, date: string, hh: string, studentId: string) => void;
}) {
  // Header is not sticky-top: the page Nav is already sticky (z-30) and an
  // additional top-sticky header collides with it. Only the left column sticks.
  const cornerCls = "sticky left-0 z-20";

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-green/15">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th rowSpan={2} className={`${cornerCls} min-w-[140px] border-b border-white/40 bg-brand-aqua p-2 text-left align-bottom text-brand-text`}>
              Instructor
            </th>
            {days.map((d) => {
              const { day, date } = formatDayHeader(d);
              return (
                <th key={d} colSpan={SLOT_TIMES.length} className="border-l-2 border-white/60 bg-brand-aqua p-1.5 text-center text-brand-text">
                  <span className="block font-bold uppercase tracking-wide">{day}</span>
                  <span className="block text-[11px] font-semibold text-brand-text/70">{date}</span>
                </th>
              );
            })}
          </tr>
          <tr>
            {days.map((d) =>
              SLOT_TIMES.map((t, i) => (
                <th key={`${d}__${t}`} className={`bg-brand-aqualight p-1 text-center text-[11px] font-bold text-brand-text ${i === 0 ? "border-l-2 border-white/60" : "border-l border-white/40"}`}>
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
                    <Link href={`/instructor/${ins.slug}?week=${weekNumber}`} className="hover:underline">
                      {ins.name}
                    </Link>
                  ) : (
                    ins.name
                  )}
                </th>
                {days.map((d) =>
                  SLOT_TIMES.map((t, i) => {
                    const key = `${ins.id}__${d}__${hhmm(t)}`;
                    const kids = (kidsByCell.get(key) ?? [])
                      .map((id) => studentsById.get(id))
                      .filter((s): s is Student => Boolean(s));
                    const offEmpty = !building && showOff && offByCell.has(key) && kids.length === 0;
                    return (
                      <td
                        key={key}
                        className={`min-w-[44px] border-t border-brand-green/10 p-1 align-top ${
                          i === 0 ? "border-l-2 border-brand-green/20" : "border-l border-brand-green/10"
                        } ${offEmpty ? "bg-brand-orange/10" : kids.length === 0 && !building ? "bg-gray-50" : ""}`}
                      >
                        <KidPills
                          kids={kids}
                          offEmpty={offEmpty}
                          onPick={onPick}
                          onRemove={building && onRemove ? (s) => onRemove(ins.id, d, hhmm(t), s.id) : undefined}
                        />
                        {building && onAdd ? (
                          <button
                            onClick={() => onAdd(ins.id, d, hhmm(t))}
                            className="mt-0.5 block w-full rounded border border-dashed border-brand-green/40 py-0.5 text-center text-[11px] font-bold text-brand-green/70 hover:bg-brand-sand"
                          >
                            +
                          </button>
                        ) : null}
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
  );
}

function OffToggle({ showOff, setShowOff }: { showOff: boolean; setShowOff: (b: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-brand-text">
      <input
        type="checkbox"
        checked={showOff}
        onChange={(e) => setShowOff(e.target.checked)}
        className="h-4 w-4 accent-brand-orange"
      />
      Show time off
    </label>
  );
}

/* ----------------------- All weeks · all instructors --------------------- */

function AllWeeksDetail(props: {
  instructors: Instructor[];
  weeks: Week[];
  kidsByCell: Map<string, string[]>;
  offByCell: Set<string>;
  studentsById: Map<string, Student>;
  onPick: (s: Student) => void;
  showOff: boolean;
  setShowOff: (b: boolean) => void;
  building: boolean;
  onAdd: (instructorId: string, date: string, hh: string) => void;
  onRemove: (instructorId: string, date: string, hh: string, studentId: string) => void;
}) {
  const { instructors, weeks, kidsByCell, offByCell, studentsById, onPick, showOff, setShowOff, building, onAdd, onRemove } = props;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <OffToggle showOff={showOff} setShowOff={setShowOff} />
        <span className="ml-auto italic text-xs text-brand-text/40 sm:hidden">swipe sideways →</span>
      </div>

      <LevelLegend />

      <div className="mt-4 space-y-6">
        {weeks.map((week) => {
          const days = getWeekDays(week);
          let total = 0;
          for (const ins of instructors)
            for (const d of days)
              for (const t of SLOT_TIMES)
                total += kidsByCell.get(`${ins.id}__${d}__${hhmm(t)}`)?.length ?? 0;
          return (
            <section key={week.week_number}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl text-brand-green">
                  {week.label ?? `Week ${week.week_number}`}
                </h2>
                <span className="text-xs font-semibold text-brand-text/60">
                  {total} lesson{total === 1 ? "" : "s"}
                </span>
              </div>
              <WeekGrid
                weekNumber={week.week_number}
                days={days}
                instructors={instructors}
                kidsByCell={kidsByCell}
                offByCell={offByCell}
                studentsById={studentsById}
                onPick={onPick}
                showOff={showOff}
                building={building}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            </section>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-brand-text/50">
        Every week, every instructor across Mon–Fri × {SLOT_TIMES.map((t) => formatSlotLabel(t)).join(" · ")}.
        Each pill is a kid (initials, colored by level) — tap one for their info &amp; notes.
      </p>
    </>
  );
}

/* ------------------------- Shared kid pills & legend --------------------- */

function KidPills({
  kids, offEmpty, onPick, onRemove,
}: {
  kids: Student[];
  offEmpty: boolean;
  onPick: (s: Student) => void;
  onRemove?: (s: Student) => void;
}) {
  if (kids.length === 0) {
    return onRemove ? null : (
      <span className={`block text-center text-[11px] ${offEmpty ? "font-bold text-brand-orange/60" : "text-brand-text/30"}`}>
        {offEmpty ? "off" : "—"}
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {kids.map((s) => {
        const grp = groupByLevel(s.group_level);
        return (
          <span
            key={s.id}
            className={`flex items-center justify-between gap-0.5 rounded px-1 py-0.5 text-[11px] font-bold leading-tight ${levelPill(s.level)}`}
          >
            <button
              onClick={() => onPick(s)}
              title={`${s.first_name} ${s.last_name}${grp ? ` · ${grp.emoji} ${grp.name}` : ""}${s.level ? ` · ${s.level}` : ""} — tap for details`}
              className="flex-1 truncate text-center transition hover:brightness-90"
            >
              {grp ? `${grp.emoji} ` : ""}{initials(s)}
            </button>
            {onRemove ? (
              <button onClick={() => onRemove(s)} aria-label="Remove" className="shrink-0 rounded px-0.5 leading-none hover:bg-black/20">
                ×
              </button>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function LevelLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-brand-text/70">
      <span>Levels:</span>
      <span className="rounded px-2 py-0.5 bg-brand-orange text-white">Non-Swimmer</span>
      <span className="rounded px-2 py-0.5 bg-brand-yellow text-brand-text">Beginner</span>
      <span className="rounded px-2 py-0.5 bg-brand-green text-white">Intermediate</span>
      <span className="rounded px-2 py-0.5 bg-brand-aqua text-brand-text">Advanced</span>
    </div>
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
