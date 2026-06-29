"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import CampLoader from "@/components/CampLoader";
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
  setWeekPublished,
  setInstructorSlotOff,
  type SlotLite,
  type OffLite,
} from "@/lib/data";
import AutoFillModal from "@/components/AutoFillModal";
import { fireConfetti } from "@/lib/confetti";
import { parseISODate, formatDayHeader, formatSlotLabel } from "@/lib/format";
import { getWeekDays, saveAllWeeks, fetchAllBuilderData, copyInstructorWeekToLater } from "@/lib/builder";
import { autoAssignWeek, computePrior, type AutoConfig } from "@/lib/autoSchedule";
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
  const [showOff, setShowOff] = useState(true);
  const [view, setView] = useState<View>("allweeks");
  const [groupFilter, setGroupFilter] = useState<number | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [building, setBuilding] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [picker, setPicker] = useState<{ instructorId: string; date: string; hhmm: string } | null>(null);
  const [pickQuery, setPickQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind; undo?: () => void } | null>(null);
  const [gQuery, setGQuery] = useState("");
  const [gActiveIndex, setGActiveIndex] = useState(0);

  // ----- Drag-and-drop (build mode): move a camper between cells -----
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const dragRef = useRef<{ id: string; fromKey: string | null; startX: number; startY: number; active: boolean } | null>(null);
  const dragOverRef = useRef<string | null>(null);
  const pointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const autoScrollRaf = useRef<number | null>(null);
  const assignmentsRef = useRef<Record<string, string[]>>({});
  const studentsByIdRef = useRef<Map<string, Student>>(new Map());
  const offByCellRef = useRef<Set<string>>(new Set());
  const [instructorFilter, setInstructorFilter] = useState<string>("");
  const [showAuto, setShowAuto] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [hasEnrollment, setHasEnrollment] = useState(false);
  const [poolOpen, setPoolOpen] = useState(false);
  // What the last Auto-fill added: `${cellKey}::${studentId}` set (for the ✨ highlight)
  // plus a plain-language summary that stays put until you Save or dismiss it.
  const [autoAdded, setAutoAdded] = useState<Set<string>>(new Set());
  const [autoSummary, setAutoSummary] = useState<
    { added: number; perWeek: { wk: number; n: number }[]; couldnt: string[] } | null
  >(null);
  const builderDataRef = useRef<Awaited<ReturnType<typeof fetchAllBuilderData>> | null>(null);

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

  // Flat result list for the global search (instructors first, then campers) so
  // ↑/↓ can walk the whole dropdown and Enter opens the highlighted row.
  const gResults = useMemo(() => {
    const ql = gQuery.trim().toLowerCase();
    if (!ql) return [] as ({ kind: "ins"; ins: Instructor } | { kind: "camp"; camp: Student })[];
    const ins = instructors
      .filter((i) => i.name.toLowerCase().includes(ql))
      .slice(0, 6)
      .map((i) => ({ kind: "ins" as const, ins: i }));
    const camp = students
      .filter((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(ql))
      .slice(0, 10)
      .map((s) => ({ kind: "camp" as const, camp: s }));
    return [...ins, ...camp];
  }, [gQuery, instructors, students]);

  // Reset the keyboard highlight whenever the query changes.
  useEffect(() => { setGActiveIndex(0); }, [gQuery]);

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

  const placedCount = useMemo(() => {
    const m = new Map<string, number>();
    Object.values(assignments).forEach((ids) => ids.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1)));
    return m;
  }, [assignments]);

  const unplacedStudents = useMemo(
    () =>
      students
        .filter((s) => s.active !== false && !placedCount.get(s.id))
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)),
    [students, placedCount]
  );

  function addKid(studentId: string) {
    if (!picker) return;
    const k = `${picker.instructorId}__${picker.date}__${picker.hhmm}`;
    // Same guard as drag-and-drop: don't silently book over an instructor's time off.
    if (offByCell.has(k) && !confirm("That's the instructor's time off. Schedule a lesson there anyway?")) {
      return;
    }
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
      fireConfetti();
      setBuilding(false);
      setAutoAdded(new Set());
      setAutoSummary(null);
      const sl = await fetchAllScheduleSlots();
      setSlots(sl);
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Save failed", kind: "error" });
    } finally {
      setSaving(false);
    }
  }

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

  function moveAssignmentFromTo(fromKey: string | null, id: string, toKey: string) {
    if (fromKey === toKey) return;
    if (offByCellRef.current.has(toKey) && !confirm("That's the instructor's time off. Schedule a lesson there anyway?")) {
      return;
    }
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

  function startChipDrag(e: React.PointerEvent, fromKey: string | null, id: string) {
    if (!building || (e.button && e.button !== 0)) return;
    dragRef.current = { id, fromKey, startX: e.clientX, startY: e.clientY, active: false };
  }

  // ----- Auto-fill (ported from the builder) -----
  async function openAuto() {
    setAutoBusy(true);
    try {
      const bd = builderDataRef.current ?? (await fetchAllBuilderData());
      builderDataRef.current = bd;
      setHasEnrollment(Object.keys(bd.enrollment).length > 0);
      setShowAuto(true);
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Couldn't load data for Auto-fill", kind: "error" });
    } finally {
      setAutoBusy(false);
    }
  }

  function runAuto(opts: { scope: "current" | "all"; config: AutoConfig; targetWeek: number; useEnrollment: boolean }) {
    const bd = builderDataRef.current;
    if (!bd) return;
    if (opts.config.mode === "rebuild" && !confirm("Rebuild clears the chosen week(s) and re-assigns everyone. Continue?")) return;
    setShowAuto(false);
    const snapshot = structuredClone(assignmentsRef.current);
    const teaching = bd.instructors;
    const activeStudents = bd.students.filter((s) => s.active !== false);
    const weeksToRun = opts.scope === "all" ? bd.weeks.map((w) => w.week_number) : [opts.targetWeek];
    let working = { ...assignmentsRef.current };
    const unplaced: string[] = [];
    for (const wk of weeksToRun) {
      const weekObj = bd.weeks.find((w) => w.week_number === wk);
      if (!weekObj) continue;
      const prior = computePrior(working, bd.dateToWeek, wk);
      const lessonsByStudent = opts.useEnrollment && bd.enrollment[wk] ? bd.enrollment[wk] : undefined;
      const res = autoAssignWeek({
        days: getWeekDays(weekObj),
        instructors: teaching,
        students: activeStudents,
        assignments: working,
        offCells: bd.offCells,
        requestedByStudent: bd.requestedByStudent,
        priorByStudent: prior,
        config: opts.config,
        lessonsByStudent,
      });
      working = res.assignments;
      res.report.unplaced.forEach((u) => unplaced.push(u.name));
    }
    setAssignments(working);
    const couldnt = Array.from(new Set(unplaced));

    // Diff against the pre-fill snapshot so we can show exactly what changed.
    const added = new Set<string>();
    const perWeek = new Map<number, number>();
    for (const [k, ids] of Object.entries(working)) {
      const before = new Set(snapshot[k] ?? []);
      for (const id of ids) {
        if (before.has(id)) continue;
        added.add(`${k}::${id}`);
        const date = k.split("__")[1];
        const wk = bd.dateToWeek[date];
        if (wk != null) perWeek.set(wk, (perWeek.get(wk) ?? 0) + 1);
      }
    }
    setAutoAdded(added);
    setAutoSummary({
      added: added.size,
      perWeek: Array.from(perWeek.entries()).map(([wk, n]) => ({ wk, n })).sort((a, b) => a.wk - b.wk),
      couldnt,
    });

    setToast({
      msg: `✨ Auto-fill added ${added.size} lesson${added.size === 1 ? "" : "s"}${couldnt.length ? ` · ${couldnt.length} couldn't place` : ""} — review & Save`,
      kind: couldnt.length ? "error" : "success",
      undo: () => {
        setAssignments(snapshot);
        setAutoAdded(new Set());
        setAutoSummary(null);
        setToast({ msg: "Undone ✓", kind: "success" });
      },
    });
  }

  // Publish/hide a week's schedule to instructors (availability is unaffected).
  async function togglePublish(weekNumber: number) {
    const wk = weeks.find((w) => w.week_number === weekNumber);
    if (!wk) return;
    const next = !wk.schedule_published;
    setWeeks((prev) => prev.map((w) => (w.week_number === weekNumber ? { ...w, schedule_published: next } : w)));
    try {
      await setWeekPublished(weekNumber, next);
      setToast({ msg: next ? `Week ${weekNumber} is now visible to instructors ✓` : `Week ${weekNumber} hidden from instructors`, kind: "success" });
      if (next) fireConfetti();
    } catch (e) {
      setWeeks((prev) => prev.map((w) => (w.week_number === weekNumber ? { ...w, schedule_published: !next } : w)));
      setToast({ msg: (e as Error).message ?? "Couldn't update visibility", kind: "error" });
    }
  }

  // Admin: mark an instructor off (or clear) for one slot, straight from the
  // build grid. Persists immediately and updates the orange time-off overlay.
  async function toggleOff(instructorId: string, date: string, hh: string, weekNumber: number) {
    const key = `${instructorId}__${date}__${hh}`;
    const isOffNow = offByCell.has(key);
    const start = `${hh}:00`;
    if (!isOffNow) {
      const hasLesson = (assignmentsRef.current[key]?.length ?? 0) > 0;
      if (hasLesson && !confirm("This slot has a lesson scheduled. Mark the instructor off here anyway?")) return;
    }
    const next = !isOffNow;
    // Optimistic overlay update.
    setOff((prev) =>
      next
        ? [...prev, { instructor_id: instructorId, week_number: weekNumber, lesson_date: date, start_time: start }]
        : prev.filter((o) => !(o.instructor_id === instructorId && o.lesson_date === date && hhmm(o.start_time) === hh))
    );
    try {
      await setInstructorSlotOff(instructorId, date, start, weekNumber, next);
      const nm = instructors.find((i) => i.id === instructorId)?.name ?? "Instructor";
      setToast({ msg: next ? `${nm} marked off ✓` : `${nm}'s time off cleared`, kind: "success" });
    } catch (e) {
      // Roll back on failure.
      setOff((prev) =>
        next
          ? prev.filter((o) => !(o.instructor_id === instructorId && o.lesson_date === date && hhmm(o.start_time) === hh))
          : [...prev, { instructor_id: instructorId, week_number: weekNumber, lesson_date: date, start_time: start }]
      );
      setToast({ msg: (e as Error).message ?? "Couldn't update time off", kind: "error" });
    }
  }

  // Copy one instructor's chosen week to all later weeks (needs a selected instructor).
  function copyWeekToLater(weekNumber: number) {
    if (!instructorFilter) return;
    if (!confirm(`Copy this instructor's Week ${weekNumber} to every later week (overwrites their later weeks)?`)) return;
    const snapshot = structuredClone(assignmentsRef.current);
    const wk = weeks.find((w) => w.week_number === weekNumber);
    if (!wk) return;
    setAssignments((prev) => copyInstructorWeekToLater(prev, instructorFilter, wk, weeks));
    toastWithUndo(`Copied Week ${weekNumber} to later weeks — review & Save`, "success", snapshot);
  }

  useEffect(() => { assignmentsRef.current = assignments; }, [assignments]);
  useEffect(() => { studentsByIdRef.current = studentsById; }, [studentsById]);
  useEffect(() => { offByCellRef.current = offByCell; }, [offByCell]);

  useEffect(() => {
    function autoScrollTick() {
      autoScrollRaf.current = requestAnimationFrame(autoScrollTick);
      if (!dragRef.current?.active) return;
      const { x, y } = pointerPosRef.current;
      const margin = 72;
      const speed = 14;
      if (y < margin) window.scrollBy(0, -speed);
      else if (y > window.innerHeight - margin) window.scrollBy(0, speed);
      const scroller = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest("[data-hscroll]") as HTMLElement | null;
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (x < r.left + margin) scroller.scrollLeft -= speed;
        else if (x > r.right - margin) scroller.scrollLeft += speed;
      }
    }
    function move(e: PointerEvent) {
      const d = dragRef.current;
      if (!d) return;
      pointerPosRef.current = { x: e.clientX, y: e.clientY };
      if (!d.active) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
        d.active = true;
        setDraggingId(d.id);
        const s = studentsByIdRef.current.get(d.id);
        setGhost({ x: e.clientX, y: e.clientY, label: s ? `${s.first_name} ${s.last_name}` : "" });
        document.body.style.userSelect = "none";
        if (autoScrollRaf.current == null) autoScrollRaf.current = requestAnimationFrame(autoScrollTick);
      } else {
        setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
      }
      e.preventDefault();
      const cell = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest("[data-cell]")?.getAttribute("data-cell") ?? null;
      dragOverRef.current = cell;
      setDragOverKey(cell);
    }
    function end() {
      const d = dragRef.current;
      dragRef.current = null;
      if (autoScrollRaf.current != null) { cancelAnimationFrame(autoScrollRaf.current); autoScrollRaf.current = null; }
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

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/admin" />
        <ConfigNotice />
      </main>
    );
  }

  const ready = !loading && weeks.length > 0 && instructors.length > 0;

  function gSelect(idx: number) {
    const r = gResults[idx];
    if (!r) return;
    if (r.kind === "ins") jumpToInstructor(r.ins.id);
    else jumpToCamper(r.camp.id, `${r.camp.first_name} ${r.camp.last_name}`);
  }

  function onGKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (gResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setGActiveIndex((i) => (i + 1) % gResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setGActiveIndex((i) => (i - 1 + gResults.length) % gResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      gSelect(gActiveIndex);
    }
  }

  function jumpToInstructor(instructorId: string) {
    setGQuery("");
    setView("allweeks");
    const firstWeek = weeks[0]?.week_number;
    if (firstWeek == null) return;
    // wait for the detailed grid to render, then scroll + flash the row
    setTimeout(() => {
      const el = document.getElementById(`ins-${instructorId}-w${firstWeek}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-4", "ring-brand-aqua");
      setTimeout(() => el.classList.remove("ring-4", "ring-brand-aqua"), 1800);
    }, 60);
  }

  // Scroll to and flash every cell where a camper appears across the season.
  function jumpToCamper(studentId: string, name: string) {
    setGQuery("");
    setView("allweeks");
    setInstructorFilter("");
    setGroupFilter(null);
    setTimeout(() => {
      // Clear any highlight lingering from a previous search so only this kid pulses.
      document.querySelectorAll(".kid-flash").forEach((el) => el.classList.remove("kid-flash"));
      const els = Array.from(document.querySelectorAll(`[data-kid="${studentId}"]`)) as HTMLElement[];
      if (els.length === 0) {
        setToast({ msg: `${name.split(" ")[0]} isn't scheduled yet.`, kind: "error" });
        return;
      }
      // Center the cell both vertically AND horizontally — most kids' first lesson
      // is in Week 1, so without inline-centering every search lands in the same
      // spot and the new kid's pill stays scrolled off to the side.
      els[0].scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      // Force-restart the flash animation even if the class was just present.
      els.forEach((el) => {
        el.classList.remove("kid-flash");
        void el.offsetWidth;
        el.classList.add("kid-flash");
      });
      setTimeout(() => els.forEach((el) => el.classList.remove("kid-flash")), 2400);
      setToast({ msg: `${name} — ${els.length} lesson${els.length === 1 ? "" : "s"} highlighted`, kind: "success" });
    }, 80);
  }

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
            onKeyDown={onGKeyDown}
            placeholder="🔍 Search campers or instructors…"
            className="w-full rounded-full border-2 border-brand-green bg-white px-5 py-2.5 text-sm"
          />
          {gQuery.trim() ? (
            <ul className="absolute z-30 mt-1 max-h-96 w-full overflow-auto rounded-2xl border-2 border-brand-green bg-white shadow-lg">
              {gResults.length === 0 ? (
                <li className="px-4 py-3 text-center text-sm text-brand-text/50">No matches found</li>
              ) : null}
              {gResults.map((r, idx) => {
                const active = gActiveIndex === idx;
                const prev = gResults[idx - 1];
                const header =
                  r.kind === "ins" && idx === 0 ? "Instructors" : r.kind === "camp" && prev?.kind !== "camp" ? "Campers" : null;
                return (
                  <li key={r.kind === "ins" ? `ins-${r.ins.id}` : r.camp.id}>
                    {header ? (
                      <div className="bg-brand-aqualight px-4 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-text/60">{header}</div>
                    ) : null}
                    {r.kind === "ins" ? (
                      <button
                        data-idx={idx}
                        onClick={() => jumpToInstructor(r.ins.id)}
                        onMouseMove={() => setGActiveIndex(idx)}
                        className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${active ? "bg-brand-sand" : "hover:bg-brand-sand"}`}
                      >
                        <span className="text-base">🏊</span>
                        <span className="flex-1 truncate font-semibold">{r.ins.name}</span>
                        <span className="text-xs text-brand-text/40">Go to schedule →</span>
                      </button>
                    ) : (() => {
                      const s = r.camp;
                      const g = groupByLevel(s.group_level);
                      return (
                        <button
                          data-idx={idx}
                          onClick={() => jumpToCamper(s.id, `${s.first_name} ${s.last_name}`)}
                          onMouseMove={() => setGActiveIndex(idx)}
                          className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${active ? "bg-brand-sand" : "hover:bg-brand-sand"}`}
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
                      );
                    })()}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {loading ? (
          <CampLoader />
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
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={openAuto} disabled={autoBusy} className="camp-btn-orange px-4 py-1.5 text-sm disabled:opacity-50">
                      {autoBusy ? "Loading…" : "✨ Auto-fill"}
                    </button>
                    <button onClick={saveBuild} disabled={saving} className="camp-btn px-4 py-1.5 text-sm">
                      {saving ? "Saving…" : "💾 Save schedule"}
                    </button>
                    <button onClick={() => { setBuilding(false); setAutoAdded(new Set()); setAutoSummary(null); }} className="camp-btn-ghost px-4 py-1.5 text-sm">
                      Cancel
                    </button>
                    <span className="text-xs font-semibold text-brand-orange">Editing — drag, tap a slot, or Auto-fill</span>
                  </div>
                ) : (
                  <button onClick={() => setBuilding(true)} className="camp-btn-orange px-4 py-1.5 text-sm">
                    🧩 Build schedule
                  </button>
                )
              ) : null}
              {view === "allweeks" ? (
                <select
                  value={instructorFilter}
                  onChange={(e) => setInstructorFilter(e.target.value)}
                  className="rounded-full border-2 border-brand-green bg-white px-4 py-1.5 text-sm font-semibold"
                  title="Focus on one instructor"
                >
                  <option value="">All instructors</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
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

            {building ? (
              <div className="mt-3 space-y-3">
                {autoSummary ? (
                  <div className="rounded-2xl border-2 border-brand-aqua bg-brand-aqualight/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg">✨</span>
                      <span className="font-display text-lg text-brand-green">
                        Auto-fill added {autoSummary.added} lesson{autoSummary.added === 1 ? "" : "s"}
                      </span>
                      <button
                        onClick={() => { setAutoAdded(new Set()); setAutoSummary(null); }}
                        className="ml-auto rounded-full border border-brand-green/40 bg-white px-3 py-1 text-xs font-bold text-brand-green hover:bg-brand-sand"
                      >
                        Got it — hide highlights
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-brand-text/70">
                      Every lesson it just placed is marked with a <span className="font-bold text-brand-green">✨</span> and an aqua ring below. Nothing is saved yet — review, then tap <strong>💾 Save schedule</strong>.
                    </p>
                    {autoSummary.perWeek.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {autoSummary.perWeek.map((p) => (
                          <span key={p.wk} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand-green ring-1 ring-brand-green/20">
                            Wk {p.wk}: {p.n}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {autoSummary.couldnt.length > 0 ? (
                      <div className="mt-2 rounded-xl border border-brand-orange/40 bg-brand-orange/10 p-2">
                        <span className="text-xs font-bold text-brand-orange">
                          {autoSummary.couldnt.length} couldn&apos;t be placed (no open slot):
                        </span>
                        <span className="ml-1 text-xs text-brand-text/70">{autoSummary.couldnt.join(", ")}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {instructorFilter ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-green/20 bg-brand-green/5 p-3 text-sm">
                    <span className="font-semibold text-brand-green">Copy a week to all later weeks:</span>
                    {weeks.map((w) => (
                      <button
                        key={w.week_number}
                        onClick={() => copyWeekToLater(w.week_number)}
                        className="rounded-full border border-brand-green/40 bg-white px-3 py-1 text-xs font-bold text-brand-green hover:bg-brand-sand"
                      >
                        Wk {w.week_number} →
                      </button>
                    ))}
                  </div>
                ) : null}
                {unplacedStudents.length > 0 ? (
                  <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange/5 p-3">
                    <button onClick={() => setPoolOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
                      <span className="text-lg">🛟</span>
                      <span className="font-display text-lg text-brand-orange">{unplacedStudents.length} still need a spot</span>
                      <span className="ml-auto text-sm font-semibold text-brand-orange/70">{poolOpen ? "Hide ▲" : "Show ▼"}</span>
                    </button>
                    {poolOpen ? (
                      <>
                        <p className="mt-1 text-xs text-brand-text/60">Drag a camper into any open time below to schedule them.</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {unplacedStudents.map((s) => (
                            <span
                              key={s.id}
                              onPointerDown={(e) => startChipDrag(e, null, s.id)}
                              style={{ touchAction: "none" }}
                              className={`flex cursor-grab items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold active:cursor-grabbing ${levelPill(s.level)} ${draggingId === s.id ? "opacity-40" : ""}`}
                            >
                              {s.first_name} {s.last_name}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

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
                instructors={instructorFilter ? instructors.filter((i) => i.id === instructorFilter) : instructors}
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
                onToggleOff={toggleOff}
                onTogglePublish={togglePublish}
                autoAdded={building ? autoAdded : undefined}
                dragOverKey={dragOverKey}
                draggingId={draggingId}
                onChipPointerDown={startChipDrag}
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

      {showAuto && builderDataRef.current ? (
        <AutoFillModal
          weeks={builderDataRef.current.weeks}
          hasEnrollment={hasEnrollment}
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
  building = false, onAdd, onRemove, onToggleOff, autoAdded, dragOverKey, draggingId, onChipPointerDown,
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
  onToggleOff?: (instructorId: string, date: string, hh: string, weekNumber: number) => void;
  autoAdded?: Set<string>;
  dragOverKey?: string | null;
  draggingId?: string | null;
  onChipPointerDown?: (e: React.PointerEvent, cellKey: string, studentId: string) => void;
}) {
  // Header is not sticky-top: the page Nav is already sticky (z-30) and an
  // additional top-sticky header collides with it. Only the left column sticks.
  const cornerCls = "sticky left-0 z-20";

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-green/15" data-hscroll>
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
              <tr key={ins.id} id={`ins-${ins.id}-w${weekNumber}`} className={rowIdx % 2 ? "bg-brand-cream/40" : "bg-white"}>
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
                    const rawOff = offByCell.has(key);
                    const isOff = showOff && rawOff;
                    const offEmpty = isOff && kids.length === 0;
                    return (
                      <td
                        key={key}
                        data-cell={building ? key : undefined}
                        className={`min-w-[44px] border-t border-brand-green/10 p-1 align-top ${
                          i === 0 ? "border-l-2 border-brand-green/20" : "border-l border-brand-green/10"
                        } ${
                          building && dragOverKey === key
                            ? "bg-brand-aqua/30 ring-2 ring-inset ring-brand-green"
                            : isOff ? "bg-brand-orange/10" : kids.length === 0 && !building ? "bg-gray-50" : ""
                        }`}
                      >
                        {/* Off-time warning — shown in build mode too so you don't schedule over it */}
                        {building && rawOff ? (
                          <span className="mb-0.5 block rounded bg-brand-orange/20 px-1 text-center text-[10px] font-bold uppercase tracking-wide text-brand-orange">
                            Off
                          </span>
                        ) : null}
                        <KidPills
                          kids={kids}
                          offEmpty={offEmpty}
                          onPick={onPick}
                          onRemove={building && onRemove ? (s) => onRemove(ins.id, d, hhmm(t), s.id) : undefined}
                          cellKey={key}
                          draggingId={draggingId}
                          onChipPointerDown={building ? onChipPointerDown : undefined}
                          autoAdded={autoAdded}
                        />
                        {building && onAdd ? (
                          <div className="mt-0.5 flex items-stretch gap-0.5">
                            <button
                              onClick={() => onAdd(ins.id, d, hhmm(t))}
                              title="Add a camper"
                              className={`flex-1 rounded border border-dashed py-0.5 text-center text-[11px] font-bold hover:bg-brand-sand ${
                                rawOff ? "border-brand-orange/50 text-brand-orange/80" : "border-brand-green/40 text-brand-green/70"
                              }`}
                            >
                              +
                            </button>
                            {onToggleOff ? (
                              <button
                                onClick={() => onToggleOff(ins.id, d, hhmm(t), weekNumber)}
                                title={rawOff ? "Clear time off — instructor is available" : "Mark instructor off for this slot"}
                                aria-pressed={rawOff}
                                className={`shrink-0 rounded border px-1 py-0.5 text-[11px] font-bold leading-none transition ${
                                  rawOff
                                    ? "border-brand-orange bg-brand-orange text-white hover:brightness-110"
                                    : "border-brand-orange/40 text-brand-orange/70 hover:bg-brand-orange/10"
                                }`}
                              >
                                {rawOff ? "✓off" : "off"}
                              </button>
                            ) : null}
                          </div>
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
  onToggleOff?: (instructorId: string, date: string, hh: string, weekNumber: number) => void;
  onTogglePublish?: (weekNumber: number) => void;
  autoAdded?: Set<string>;
  dragOverKey?: string | null;
  draggingId?: string | null;
  onChipPointerDown?: (e: React.PointerEvent, cellKey: string, studentId: string) => void;
}) {
  const { instructors, weeks, kidsByCell, offByCell, studentsById, onPick, showOff, setShowOff, building, onAdd, onRemove, onToggleOff, onTogglePublish, autoAdded, dragOverKey, draggingId, onChipPointerDown } = props;

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
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-2xl text-brand-green">
                  {week.label ?? `Week ${week.week_number}`}
                </h2>
                <div className="flex items-center gap-2">
                  {onTogglePublish ? (
                    <button
                      onClick={() => onTogglePublish(week.week_number)}
                      title={week.schedule_published ? "Instructors can see this week — tap to hide" : "Hidden from instructors — tap to publish"}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        week.schedule_published
                          ? "bg-brand-green text-white hover:brightness-110"
                          : "border border-brand-orange/50 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20"
                      }`}
                    >
                      {week.schedule_published ? "👁 Visible to instructors" : "🙈 Hidden — tap to publish"}
                    </button>
                  ) : null}
                  <span className="text-xs font-semibold text-brand-text/60">
                    {total} lesson{total === 1 ? "" : "s"}
                  </span>
                </div>
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
                onToggleOff={onToggleOff}
                autoAdded={autoAdded}
                dragOverKey={dragOverKey}
                draggingId={draggingId}
                onChipPointerDown={onChipPointerDown}
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
  kids, offEmpty, onPick, onRemove, cellKey, draggingId, onChipPointerDown, autoAdded,
}: {
  kids: Student[];
  offEmpty: boolean;
  onPick: (s: Student) => void;
  onRemove?: (s: Student) => void;
  cellKey?: string;
  draggingId?: string | null;
  onChipPointerDown?: (e: React.PointerEvent, cellKey: string, studentId: string) => void;
  autoAdded?: Set<string>;
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
        const canDrag = Boolean(onChipPointerDown && cellKey);
        const isNew = Boolean(autoAdded && cellKey && autoAdded.has(`${cellKey}::${s.id}`));
        return (
          <span
            key={s.id}
            data-kid={s.id}
            onPointerDown={canDrag ? (e) => onChipPointerDown!(e, cellKey!, s.id) : undefined}
            style={canDrag ? { touchAction: "none" } : undefined}
            className={`flex items-center justify-between gap-0.5 rounded px-1 py-0.5 text-[11px] font-bold leading-tight ${levelPill(s.level)} ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${draggingId === s.id ? "opacity-40" : ""} ${isNew ? "ring-2 ring-brand-aqua ring-offset-1" : ""}`}
            title={isNew ? "Just added by Auto-fill" : undefined}
          >
            <button
              onClick={() => onPick(s)}
              title={`${s.first_name} ${s.last_name}${grp ? ` · ${grp.emoji} ${grp.name}` : ""}${s.level ? ` · ${s.level}` : ""}${isNew ? " · ✨ auto-filled" : ""} — tap for details`}
              className="flex-1 truncate text-left transition hover:brightness-90"
            >
              {isNew ? "✨ " : ""}{grp ? `${grp.emoji} ` : ""}{s.first_name} {s.last_name}
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
