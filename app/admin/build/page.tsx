"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Nav from "@/components/Nav";
import CampLoader from "@/components/CampLoader";
import LevelBadge from "@/components/LevelBadge";
import Toast, { type ToastKind } from "@/components/Toast";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { formatDayHeader } from "@/lib/format";
import type { Student, Week } from "@/lib/types";
import {
  BUILDER_SLOTS,
  cellKey,
  getWeekDays,
  fetchAllBuilderData,
  saveAllWeeks,
  copyInstructorWeekToLater,
  copyInstructorWeekInto,
  checkSchedule,
  type AllBuilderData,
  type HealthIssue,
} from "@/lib/builder";
import { autoAssignWeek, computePrior, type AutoConfig } from "@/lib/autoSchedule";
import type { Instructor } from "@/lib/types";

const LEVEL_ORDER: Record<string, number> = {
  "Non-Swimmer": 0, Beginner: 1, Intermediate: 2, Advanced: 3,
};

function pillClass(level: string | null): string {
  switch (level) {
    case "Non-Swimmer": return "bg-brand-orange text-white";
    case "Beginner": return "bg-brand-yellow text-brand-text";
    case "Intermediate": return "bg-brand-green text-white";
    case "Advanced": return "bg-brand-aqua text-brand-text";
    default: return "bg-gray-400 text-white";
  }
}

export default function ScheduleBuilderPage() {
  const [data, setData] = useState<AllBuilderData | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [instructorId, setInstructorId] = useState<string>("");
  const [picker, setPicker] = useState<{ date: string; start: string } | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind; undo?: () => void } | null>(null);
  const [showAuto, setShowAuto] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const [poolOpen, setPoolOpen] = useState(false);
  const dragRef = useRef<{ id: string; fromKey: string | null; startX: number; startY: number; active: boolean } | null>(null);
  const dragOverRef = useRef<string | null>(null);
  const assignmentsRef = useRef<Record<string, string[]>>({});
  const studentsByIdRef = useRef<Map<string, Student>>(new Map());

  // Show a toast whose "Undo" restores the assignments to `snapshot` (a deep
  // copy taken before the change). Everything here is in-memory until Save.
  function toastWithUndo(msg: string, kind: ToastKind, snapshot: Record<string, string[]>) {
    setToast({
      msg,
      kind,
      undo: () => {
        setAssignments(snapshot);
        setToast({ msg: "Undone ✓", kind: "success" });
      },
    });
  }

  function runAuto(opts: {
    scope: "current" | "all";
    config: AutoConfig;
    targetWeek: number;
    useEnrollment: boolean;
  }) {
    if (!data) return;
    if (
      opts.config.mode === "rebuild" &&
      !confirm("Rebuild from scratch clears existing lessons for the chosen week(s) and re-assigns. Continue?")
    )
      return;

    const snapshot = structuredClone(assignments); // for one-tap Undo
    const teaching = data.instructors; // active, guards already excluded
    const activeStudents = data.students.filter((s) => s.active !== false);
    const weeksToRun =
      opts.scope === "all"
        ? data.weeks.map((w) => w.week_number)
        : [opts.targetWeek];

    let working = { ...assignments };
    let placed = 0,
      partial = 0;
    const unplaced: string[] = [];

    for (const wk of weeksToRun) {
      const weekObj = data.weeks.find((w) => w.week_number === wk);
      if (!weekObj) continue;
      const prior = computePrior(working, data.dateToWeek, wk);
      const lessonsByStudent =
        opts.useEnrollment && data.enrollment[wk] ? data.enrollment[wk] : undefined;
      const res = autoAssignWeek({
        days: getWeekDays(weekObj),
        instructors: teaching,
        students: activeStudents,
        assignments: working,
        offCells: data.offCells,
        requestedByStudent: data.requestedByStudent,
        priorByStudent: prior,
        config: opts.config,
        lessonsByStudent,
      });
      working = res.assignments;
      placed += res.report.placed;
      partial += res.report.partial;
      res.report.unplaced.forEach((u) => unplaced.push(u.name));
    }

    setAssignments(working);
    setShowAuto(false);
    const couldnt = Array.from(new Set(unplaced));
    toastWithUndo(
      `Auto-fill: ${placed} placed · ${partial} partial${couldnt.length ? ` · ${couldnt.length} couldn't place` : ""} — review & Save`,
      couldnt.length ? "error" : "success",
      snapshot
    );
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchAllBuilderData();
      setData(d);
      setAssignments(structuredClone(d.assignments));
      setInstructorId((prev) => prev || d.instructors[0]?.id || "");
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Load failed", kind: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) load();
  }, [load]);

  const studentsById = useMemo(() => {
    const m = new Map<string, Student>();
    (data?.students ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [data]);

  const instructorsById = useMemo(() => {
    const m = new Map<string, Instructor>();
    (data?.instructors ?? []).forEach((i) => m.set(i.id, i));
    return m;
  }, [data]);

  const issues = useMemo(() => {
    if (!data) return [];
    return checkSchedule(assignments, data.offCells, studentsById, instructorsById);
  }, [assignments, data, studentsById, instructorsById]);

  const placedCount = useMemo(() => {
    const m = new Map<string, number>();
    Object.values(assignments).forEach((ids) =>
      ids.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1))
    );
    return m;
  }, [assignments]);

  const unplacedCount = useMemo(() => {
    if (!data) return 0;
    return data.students.filter((s) => !placedCount.get(s.id)).length;
  }, [data, placedCount]);

  // Active campers not placed with anyone all summer — draggable into the grid.
  const unplacedStudents = useMemo(() => {
    if (!data) return [];
    return data.students
      .filter((s) => s.active !== false && !placedCount.get(s.id))
      .sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      );
  }, [data, placedCount]);

  // Students / last names already with the selected instructor (any week).
  const withInstructor = useMemo(() => {
    const ids = new Set<string>();
    const lastNames = new Set<string>();
    if (instructorId) {
      for (const [k, list] of Object.entries(assignments)) {
        if (!k.startsWith(`${instructorId}__`)) continue;
        list.forEach((id) => {
          ids.add(id);
          const s = studentsById.get(id);
          if (s) lastNames.add(s.last_name.toLowerCase());
        });
      }
    }
    return { ids, lastNames };
  }, [assignments, instructorId, studentsById]);

  function addStudent(studentId: string) {
    if (!picker || !instructorId) return;
    const k = cellKey(instructorId, picker.date, picker.start);
    setAssignments((prev) => {
      const cur = prev[k] ?? [];
      if (cur.includes(studentId)) return prev;
      return { ...prev, [k]: [...cur, studentId] };
    });
    setPicker(null);
    setQuery("");
  }

  function removeStudent(date: string, start: string, studentId: string) {
    const snapshot = structuredClone(assignments);
    const k = cellKey(instructorId, date, start);
    setAssignments((prev) => ({
      ...prev,
      [k]: (prev[k] ?? []).filter((id) => id !== studentId),
    }));
    const nm = studentsById.get(studentId);
    toastWithUndo(`Removed ${nm ? nm.first_name : "camper"} — tap Undo to put back`, "success", snapshot);
  }

  // Move a camper between slots, or add from the "needs a spot" pool when
  // fromKey is null. Pointer drag works for both mouse and touch.
  function moveAssignmentFromTo(fromKey: string | null, id: string, toKey: string) {
    if (fromKey === toKey) return;
    const snapshot = structuredClone(assignmentsRef.current);
    setAssignments((prev) => {
      const toList = prev[toKey] ?? [];
      const next: Record<string, string[]> = { ...prev };
      if (fromKey) next[fromKey] = (prev[fromKey] ?? []).filter((x) => x !== id);
      if (!toList.includes(id)) next[toKey] = [...toList, id];
      return next;
    });
    const nm = studentsByIdRef.current.get(id);
    toastWithUndo(`${fromKey ? "Moved" : "Added"} ${nm ? nm.first_name : "camper"} — tap Undo`, "success", snapshot);
  }

  // Keep refs fresh for the (once-bound) global pointer listeners.
  useEffect(() => { assignmentsRef.current = assignments; }, [assignments]);
  useEffect(() => { studentsByIdRef.current = studentsById; }, [studentsById]);

  // A drag begins only after the pointer moves past a small threshold, so taps
  // and the × remove button still behave like normal clicks.
  function startChipDrag(e: React.PointerEvent, fromKey: string | null, id: string) {
    if (e.button && e.button !== 0) return;
    dragRef.current = { id, fromKey, startX: e.clientX, startY: e.clientY, active: false };
  }

  useEffect(() => {
    function move(e: PointerEvent) {
      const d = dragRef.current;
      if (!d) return;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
        d.active = true;
        setDraggingId(d.id);
        const s = studentsByIdRef.current.get(d.id);
        setGhost({ x: e.clientX, y: e.clientY, label: s ? `${s.first_name} ${s.last_name.charAt(0)}.` : "" });
        document.body.style.userSelect = "none";
      } else {
        setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
      }
      e.preventDefault();
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const cell = el?.closest("[data-cell]")?.getAttribute("data-cell") ?? null;
      dragOverRef.current = cell;
      setDragOverKey(cell);
    }
    function end() {
      const d = dragRef.current;
      dragRef.current = null;
      setDraggingId(null);
      setGhost(null);
      document.body.style.userSelect = "";
      const toKey = dragOverRef.current;
      dragOverRef.current = null;
      setDragOverKey(null);
      if (d?.active && toKey) moveAssignmentFromTo(d.fromKey, d.id, toKey);
    }
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copyToLater(week: Week) {
    if (!data) return;
    if (!confirm(`Copy ${instructorName}'s Week ${week.week_number} to every later week (overwrites their later weeks)?`)) return;
    const snapshot = structuredClone(assignments);
    setAssignments((prev) => copyInstructorWeekToLater(prev, instructorId, week, data.weeks));
    toastWithUndo(`Copied Week ${week.week_number} to later weeks for ${instructorName}.`, "success", snapshot);
  }

  // Copies the immediately preceding week's schedule into this one week.
  function copyPrevInto(week: Week) {
    if (!data) return;
    const prev = data.weeks
      .filter((w) => w.week_number < week.week_number)
      .sort((a, b) => b.week_number - a.week_number)[0];
    if (!prev) return;
    if (!confirm(`Copy ${instructorName}'s Week ${prev.week_number} into Week ${week.week_number} (overwrites just this week)?`)) return;
    const snapshot = structuredClone(assignments);
    setAssignments((cur) => copyInstructorWeekInto(cur, instructorId, prev, week));
    toastWithUndo(`Copied Week ${prev.week_number} → Week ${week.week_number} for ${instructorName}.`, "success", snapshot);
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    try {
      const n = await saveAllWeeks(
        assignments,
        data.dateToWeek,
        data.weeks.map((w) => w.week_number)
      );
      setToast({ msg: `Saved · ${n} lesson slots across ${data.weeks.length} weeks`, kind: "success" });
      load();
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Save failed", kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  const pickerList = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const list = data.students.filter(
      (s) =>
        s.active !== false &&
        (q ? `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) : true)
    );
    const top = (s: Student) => {
      const requested = data.requestedByStudent[s.id]?.instructorId === instructorId;
      return requested || withInstructor.ids.has(s.id) ? 0 : 1;
    };
    return list.sort((a, b) => {
      const at = top(a), bt = top(b);
      if (at !== bt) return at - bt;
      const aSib = withInstructor.lastNames.has(a.last_name.toLowerCase()) ? 0 : 1;
      const bSib = withInstructor.lastNames.has(b.last_name.toLowerCase()) ? 0 : 1;
      if (aSib !== bSib) return aSib - bSib;
      const al = LEVEL_ORDER[a.level ?? ""] ?? 9;
      const bl = LEVEL_ORDER[b.level ?? ""] ?? 9;
      if (al !== bl) return al - bl;
      return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    });
  }, [data, query, instructorId, withInstructor]);

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/admin" />
        <ConfigNotice />
      </main>
    );
  }

  const instructorName = data?.instructors.find((i) => i.id === instructorId)?.name ?? "";

  return (
    <main className="min-h-screen pb-28">
      <Nav backHref="/admin" />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Schedule Builder</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Pick an instructor to see their whole summer (all weeks). Build Week 1,
          then <strong>Copy to later weeks</strong> to keep kids with the same
          instructor — and adjust from there. 👉 <strong>Tip:</strong> drag a
          camper to another time to move them.
        </p>

        {loading ? (
          <CampLoader />
        ) : !data || data.weeks.length === 0 ? (
          <p className="mt-10 text-center text-brand-text/60">No weeks set up yet.</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold">Instructor:</label>
              <select
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                className="rounded-full border-2 border-brand-green bg-white px-4 py-1.5 font-semibold"
              >
                {data.instructors.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <button onClick={() => setShowAuto(true)} className="camp-btn-orange px-4 py-1.5 text-sm">
                ✨ Auto-fill
              </button>
              <span className="ml-auto text-sm font-semibold text-brand-text/70">
                {unplacedCount} kid{unplacedCount === 1 ? "" : "s"} unplaced all summer
              </span>
            </div>

            {/* "Still needs a spot" — drag a camper from here into any open time */}
            {unplacedStudents.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-brand-orange/30 bg-brand-orange/5 p-3">
                <button
                  onClick={() => setPoolOpen((o) => !o)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className="text-lg">🛟</span>
                  <span className="font-display text-lg text-brand-orange">
                    {unplacedStudents.length} still need a spot
                  </span>
                  <span className="ml-auto text-sm font-semibold text-brand-orange/70">
                    {poolOpen ? "Hide ▲" : "Show ▼"}
                  </span>
                </button>
                {poolOpen ? (
                  <>
                    <p className="mt-1 text-xs text-brand-text/60">
                      Drag a camper into any open time below to give them a lesson with{" "}
                      {instructorName || "this instructor"}.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {unplacedStudents.map((s) => (
                        <span
                          key={s.id}
                          onPointerDown={(e) => startChipDrag(e, null, s.id)}
                          style={{ touchAction: "none" }}
                          className={`flex cursor-grab items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold active:cursor-grabbing ${pillClass(
                            s.level
                          )} ${draggingId === s.id ? "opacity-40" : ""}`}
                        >
                          {s.first_name} {s.last_name.charAt(0)}.
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {/* Schedule health checks (whole season, live) */}
            <HealthPanel issues={issues} />

            {/* All weeks for the selected instructor */}
            <div className="mt-4 space-y-6">
              {data.weeks.map((week) => {
                const days = getWeekDays(week);
                return (
                  <section key={week.week_number} className="camp-card overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-green/10 bg-brand-sand/50 px-3 py-2">
                      <h2 className="font-display text-xl text-brand-green">
                        {week.label ?? `Week ${week.week_number}`}
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {week.week_number > data.weeks[0].week_number ? (
                          <button
                            onClick={() => copyPrevInto(week)}
                            className="rounded-full border border-brand-green/30 bg-white px-3 py-1 text-xs font-bold text-brand-green hover:bg-brand-sand"
                            title="Copy the previous week into just this week for this instructor"
                          >
                            ↻ Copy last week here
                          </button>
                        ) : null}
                        <button
                          onClick={() => copyToLater(week)}
                          className="rounded-full border border-brand-green/30 bg-white px-3 py-1 text-xs font-bold text-brand-green hover:bg-brand-sand"
                          title="Copy this week to all later weeks for this instructor"
                        >
                          ↓ Copy to later weeks
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px] border-collapse">
                        <thead>
                          <tr>
                            <th className="w-14 bg-gradient-to-b from-brand-aqualight to-brand-aqua p-1.5" />
                            {days.map((d) => {
                              const { day, date } = formatDayHeader(d);
                              return (
                                <th key={d} className="border-l border-white/40 bg-gradient-to-b from-brand-aqualight to-brand-aqua p-1.5 text-center text-xs font-bold text-brand-text">
                                  <span className="block uppercase tracking-wide">{day}</span>
                                  <span className="block text-[11px] font-semibold text-brand-text/75">{date}</span>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {BUILDER_SLOTS.map((slot, rowIdx) => (
                            <tr key={slot.start} className={rowIdx % 2 ? "bg-brand-cream/60" : "bg-white"}>
                              <th className="border-t border-brand-green/10 p-1 text-center align-middle text-xs font-bold text-brand-green">
                                {slot.label}
                              </th>
                              {days.map((d) => {
                                const k = cellKey(instructorId, d, slot.start);
                                const ids = assignments[k] ?? [];
                                const isOff = data.offCells.has(k);
                                return (
                                  <td
                                    key={k}
                                    data-cell={k}
                                    className={`border-l border-t border-brand-green/10 p-1 align-top ${
                                      dragOverKey === k ? "bg-brand-aqua/30 ring-2 ring-inset ring-brand-green" : isOff && ids.length === 0 ? "bg-gray-50" : ""
                                    }`}
                                  >
                                    <div className="flex flex-col gap-1">
                                      {ids.map((id) => {
                                        const s = studentsById.get(id);
                                        if (!s) return null;
                                        return (
                                          <span
                                            key={id}
                                            onPointerDown={(e) => startChipDrag(e, k, id)}
                                            style={{ touchAction: "none" }}
                                            className={`flex cursor-grab items-center justify-between gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold active:cursor-grabbing ${pillClass(s.level)} ${draggingId === id ? "opacity-40" : ""}`}
                                          >
                                            <span className="truncate">{s.first_name} {s.last_name.charAt(0)}.</span>
                                            <button onClick={() => removeStudent(d, slot.start, id)} aria-label="Remove" className="shrink-0 rounded-full px-1 leading-none hover:bg-black/20">×</button>
                                          </span>
                                        );
                                      })}
                                      <button
                                        onClick={() => { setPicker({ date: d, start: slot.start }); setQuery(""); }}
                                        className="rounded-md border border-dashed border-brand-green/40 px-1.5 py-0.5 text-[11px] font-semibold text-brand-green/70 hover:bg-brand-sand"
                                      >
                                        {isOff && ids.length === 0 ? "Off ·+" : "+"}
                                      </button>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Sticky save bar */}
      {data && data.weeks.length > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-brand-green/15 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <span className="text-sm text-brand-text/70">
              Editing <strong>{instructorName}</strong> · saving writes the whole season.
            </span>
            <button onClick={handleSave} disabled={saving} className="camp-btn ml-auto px-6 py-2.5">
              {saving ? "Saving…" : "Save all weeks"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Student picker */}
      {picker && data ? (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center">
          <button aria-label="Close" onClick={() => setPicker(null)} className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md rounded-t-3xl bg-brand-cream p-5 shadow-2xl sm:rounded-3xl sm:border-2 sm:border-brand-green">
            <h3 className="font-display text-2xl text-brand-green">Add a student</h3>
            <p className="text-xs text-brand-text/60">
              {instructorName} · {formatDayHeader(picker.date).day} {formatDayHeader(picker.date).date} · {BUILDER_SLOTS.find((s) => s.start === picker.start)?.label}
            </p>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students…" className="mt-3 w-full rounded-full border-2 border-brand-green bg-white px-4 py-2 text-sm" />
            <ul className="mt-3 max-h-72 divide-y divide-brand-sand overflow-auto rounded-xl border border-brand-green/15 bg-white">
              {pickerList.map((s) => {
                const requested = data.requestedByStudent[s.id];
                const requestedYou = requested?.instructorId === instructorId;
                const withYou = withInstructor.ids.has(s.id);
                const siblingHere = withInstructor.lastNames.has(s.last_name.toLowerCase());
                const placed = placedCount.get(s.id) ?? 0;
                return (
                  <li key={s.id}>
                    <button onClick={() => addStudent(s.id)} className="flex w-full flex-wrap items-center gap-1.5 px-3 py-2 text-left hover:bg-brand-sand">
                      <span className="flex-1 truncate text-sm font-semibold">
                        {s.first_name} {s.last_name}
                        {s.special_needs ? <span title="Special needs note"> ⚠️</span> : null}
                      </span>
                      <LevelBadge level={s.level} />
                      {requestedYou ? (
                        <span className="camp-pill bg-brand-green text-white" title="Parent requested you">⭐ Requested</span>
                      ) : requested ? (
                        <span className="camp-pill bg-brand-yellow text-brand-text" title={`Parent requested ${requested.name}`}>⭐ {requested.name.split(" ")[0]}</span>
                      ) : null}
                      {withYou ? <span className="camp-pill bg-brand-green text-white">↩ Yours</span> : null}
                      {siblingHere && !withYou ? <span className="camp-pill bg-brand-aqua text-brand-text" title="Sibling already with this instructor">👫 sib</span> : null}
                      {placed > 0 ? <span className="camp-pill bg-brand-amber/30 text-brand-text/70">{placed}×</span> : null}
                    </button>
                  </li>
                );
              })}
              {pickerList.length === 0 ? <li className="px-3 py-4 text-center text-sm text-brand-text/50">No students</li> : null}
            </ul>
            <button onClick={() => setPicker(null)} className="camp-btn-ghost mt-3 w-full">Done</button>
          </div>
        </div>
      ) : null}

      {showAuto && data ? (
        <AutoModal
          weeks={data.weeks}
          hasEnrollment={Object.keys(data.enrollment).length > 0}
          onClose={() => setShowAuto(false)}
          onRun={runAuto}
        />
      ) : null}

      {ghost ? (
        <div
          className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2 rounded-md bg-brand-green px-2 py-1 text-xs font-bold text-white shadow-lg"
          style={{ left: ghost.x, top: ghost.y }}
        >
          {ghost.label}
        </div>
      ) : null}

      {toast ? (
        <Toast
          message={toast.msg}
          kind={toast.kind}
          onDismiss={() => setToast(null)}
          action={toast.undo ? { label: "Undo", onClick: toast.undo } : undefined}
        />
      ) : null}
    </main>
  );
}

function AutoModal({
  weeks,
  hasEnrollment,
  onClose,
  onRun,
}: {
  weeks: { week_number: number; label: string | null }[];
  hasEnrollment: boolean;
  onClose: () => void;
  onRun: (opts: {
    scope: "current" | "all";
    config: AutoConfig;
    targetWeek: number;
    useEnrollment: boolean;
  }) => void;
}) {
  const [scope, setScope] = useState<"current" | "all">("current");
  const [targetWeek, setTargetWeek] = useState(weeks[0]?.week_number ?? 1);
  const [lessonsPerKid, setLessonsPerKid] = useState(1);
  const [maxPerSlot, setMaxPerSlot] = useState(2);
  const [mode, setMode] = useState<"fill" | "rebuild">("fill");
  const [useEnrollment, setUseEnrollment] = useState(hasEnrollment);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-t-3xl bg-brand-cream p-5 shadow-2xl sm:rounded-3xl sm:border-2 sm:border-brand-green">
        <h2 className="font-display text-2xl text-brand-green">✨ Auto-fill schedule</h2>
        <p className="mt-1 text-sm text-brand-text/70">
          Generates a draft using availability, parent requests, prior-week
          consistency, siblings and the ratio cap. Review the health panel and
          edit before saving — nothing is saved automatically.
        </p>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-brand-green">Apply to</span>
            <div className="mt-1 flex gap-2">
              <button onClick={() => setScope("current")} className={`flex-1 rounded-full px-3 py-1.5 font-bold ${scope === "current" ? "bg-brand-green text-white" : "bg-brand-sand text-brand-text"}`}>One week</button>
              <button onClick={() => setScope("all")} className={`flex-1 rounded-full px-3 py-1.5 font-bold ${scope === "all" ? "bg-brand-green text-white" : "bg-brand-sand text-brand-text"}`}>All weeks</button>
            </div>
          </div>

          {scope === "current" ? (
            <label className="flex items-center justify-between">
              <span className="font-semibold">Week</span>
              <select value={targetWeek} onChange={(e) => setTargetWeek(parseInt(e.target.value, 10))} className="rounded-full border-2 border-brand-green bg-white px-3 py-1">
                {weeks.map((w) => (
                  <option key={w.week_number} value={w.week_number}>{w.label ?? `Week ${w.week_number}`}</option>
                ))}
              </select>
            </label>
          ) : null}

          {hasEnrollment ? (
            <label className="flex items-center gap-2 rounded-xl bg-brand-sand/60 px-3 py-2 font-semibold">
              <input type="checkbox" checked={useEnrollment} onChange={(e) => setUseEnrollment(e.target.checked)} />
              Use enrollment (only enrolled kids, their lesson counts)
            </label>
          ) : null}

          <label className={`flex items-center justify-between ${useEnrollment ? "opacity-40" : ""}`}>
            <span className="font-semibold">Lessons per kid {useEnrollment ? "(from enrollment)" : ""}</span>
            <input type="number" min={1} max={5} disabled={useEnrollment} value={lessonsPerKid} onChange={(e) => setLessonsPerKid(parseInt(e.target.value, 10) || 1)} className="w-20 rounded-full border-2 border-brand-green bg-white px-3 py-1 disabled:bg-gray-100" />
          </label>
          <label className="flex items-center justify-between">
            <span className="font-semibold">Max kids per slot</span>
            <input type="number" min={1} max={6} value={maxPerSlot} onChange={(e) => setMaxPerSlot(parseInt(e.target.value, 10) || 1)} className="w-20 rounded-full border-2 border-brand-green bg-white px-3 py-1" />
          </label>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-brand-green">Mode</span>
            <div className="mt-1 flex gap-2">
              <button onClick={() => setMode("fill")} className={`flex-1 rounded-full px-3 py-1.5 font-bold ${mode === "fill" ? "bg-brand-green text-white" : "bg-brand-sand text-brand-text"}`}>Fill gaps</button>
              <button onClick={() => setMode("rebuild")} className={`flex-1 rounded-full px-3 py-1.5 font-bold ${mode === "rebuild" ? "bg-brand-orange text-white" : "bg-brand-sand text-brand-text"}`}>Rebuild</button>
            </div>
            <p className="mt-1 text-xs text-brand-text/60">
              {mode === "fill" ? "Keeps current lessons, only adds kids who need slots." : "Clears the chosen week(s) and re-assigns everyone."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={() => onRun({ scope, config: { lessonsPerKid, maxPerSlot, mode }, targetWeek, useEnrollment })} className="camp-btn flex-1">
            Generate draft
          </button>
          <button onClick={onClose} className="camp-btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function HealthPanel({ issues }: { issues: HealthIssue[] }) {
  const [open, setOpen] = useState(true);
  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.length - errors;

  if (issues.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-brand-green/20 bg-brand-green/10 px-4 py-2 text-sm font-semibold text-brand-green">
        ✓ No scheduling conflicts
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-brand-orange/30 bg-brand-orange/5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-bold text-brand-orange"
      >
        ⚠️ {issues.length} issue{issues.length === 1 ? "" : "s"}
        <span className="font-semibold text-brand-text/60">
          {errors ? `${errors} error${errors === 1 ? "" : "s"}` : ""}
          {errors && warns ? " · " : ""}
          {warns ? `${warns} warning${warns === 1 ? "" : "s"}` : ""}
        </span>
        <span className="ml-auto text-brand-text/50">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <ul className="space-y-1 px-4 pb-3 text-sm">
          {issues.map((i, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span>{i.severity === "error" ? "🛑" : "⚠️"}</span>
              <span className="text-brand-text">{i.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
