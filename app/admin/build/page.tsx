"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Nav from "@/components/Nav";
import LevelBadge from "@/components/LevelBadge";
import Toast, { type ToastKind } from "@/components/Toast";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { formatDayHeader } from "@/lib/format";
import type { Student } from "@/lib/types";
import {
  BUILDER_SLOTS,
  cellKey,
  fetchBuilderData,
  ensureWeekWithDates,
  saveWeekSchedule,
  carryForward,
  latestPriorWeekWithSlots,
  type BuilderData,
} from "@/lib/builder";

const WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const LEVEL_ORDER: Record<string, number> = {
  "Non-Swimmer": 0,
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
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
  const [week, setWeek] = useState(2);
  const [startDate, setStartDate] = useState("");
  const [data, setData] = useState<BuilderData | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [instructorId, setInstructorId] = useState<string>("");
  const [picker, setPicker] = useState<{ date: string; start: string } | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  const load = useCallback(async (wk: number) => {
    setLoading(true);
    try {
      const d = await fetchBuilderData(wk);
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
    if (isSupabaseConfigured) load(week);
  }, [week, load]);

  const studentsById = useMemo(() => {
    const m = new Map<string, Student>();
    (data?.students ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [data]);

  // Count how many cells each student is placed in this week.
  const placedCount = useMemo(() => {
    const m = new Map<string, number>();
    Object.values(assignments).forEach((ids) =>
      ids.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1))
    );
    return m;
  }, [assignments]);

  const unassignedCount = useMemo(() => {
    if (!data) return 0;
    return data.students.filter((s) => !placedCount.get(s.id)).length;
  }, [data, placedCount]);

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
    const k = cellKey(instructorId, date, start);
    setAssignments((prev) => ({
      ...prev,
      [k]: (prev[k] ?? []).filter((id) => id !== studentId),
    }));
  }

  async function handleCarryForward() {
    if (!data?.week) return;
    const src = await latestPriorWeekWithSlots(week);
    if (src == null) {
      setToast({ msg: "No earlier week with a schedule to copy", kind: "error" });
      return;
    }
    if (
      Object.keys(assignments).length > 0 &&
      !confirm(`Replace the current draft with Week ${src}'s pairings (mapped day-for-day)?`)
    )
      return;
    try {
      const copied = await carryForward(src, data.week);
      setAssignments(copied);
      setToast({ msg: `Copied Week ${src} → Week ${week}. Review, then Save.`, kind: "success" });
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Copy failed", kind: "error" });
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const n = await saveWeekSchedule(week, assignments);
      setToast({ msg: `Saved · ${n} lesson slots for Week ${week}`, kind: "success" });
      load(week);
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Save failed", kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateWeek() {
    if (!startDate) return;
    try {
      await ensureWeekWithDates(week, startDate);
      load(week);
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Could not create week", kind: "error" });
    }
  }

  // Last names of kids already assigned to the selected instructor this week
  // (for sibling-grouping hints).
  const instructorLastNames = useMemo(() => {
    const set = new Set<string>();
    if (!instructorId) return set;
    for (const [k, ids] of Object.entries(assignments)) {
      if (!k.startsWith(`${instructorId}__`)) continue;
      ids.forEach((id) => {
        const s = studentsById.get(id);
        if (s) set.add(s.last_name.toLowerCase());
      });
    }
    return set;
  }, [assignments, instructorId, studentsById]);

  // A student is a "top" suggestion if they're returning to this instructor or
  // a parent requested this instructor.
  const topScore = useCallback(
    (studentId: string) => {
      if (!data) return 1;
      const returning = data.priorByStudent[studentId]?.instructorId === instructorId;
      const requested = data.requestedByStudent[studentId]?.instructorId === instructorId;
      return returning || requested ? 0 : 1;
    },
    [data, instructorId]
  );

  // Picker list: suggestions-first ordering.
  const pickerList = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const list = data.students.filter((s) =>
      q ? `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) : true
    );
    return list.sort((a, b) => {
      const at = topScore(a.id);
      const bt = topScore(b.id);
      if (at !== bt) return at - bt;
      // siblings of kids already with this instructor next
      const aSib = instructorLastNames.has(a.last_name.toLowerCase()) ? 0 : 1;
      const bSib = instructorLastNames.has(b.last_name.toLowerCase()) ? 0 : 1;
      if (aSib !== bSib) return aSib - bSib;
      const aPlaced = placedCount.get(a.id) ? 1 : 0;
      const bPlaced = placedCount.get(b.id) ? 1 : 0;
      if (aPlaced !== bPlaced) return aPlaced - bPlaced; // unplaced first
      const al = LEVEL_ORDER[a.level ?? ""] ?? 9;
      const bl = LEVEL_ORDER[b.level ?? ""] ?? 9;
      if (al !== bl) return al - bl;
      return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    });
  }, [data, query, placedCount, topScore, instructorLastNames]);

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/admin" />
        <ConfigNotice />
      </main>
    );
  }

  const instructorName =
    data?.instructors.find((i) => i.id === instructorId)?.name ?? "";

  return (
    <main className="min-h-screen pb-28">
      <Nav backHref="/admin" />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Schedule Builder</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Assign kids to instructors. Use <strong>Copy last week</strong> to keep
          instructors consistent, then adjust.
        </p>

        {/* Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            Week:
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
          <button onClick={handleCarryForward} className="camp-btn-ghost px-4 py-1.5 text-sm">
            ↩ Copy last week
          </button>
          <div className="ml-auto text-sm font-semibold text-brand-text/70">
            {unassignedCount} kid{unassignedCount === 1 ? "" : "s"} not yet placed
          </div>
        </div>

        {loading ? (
          <p className="mt-10 text-center text-brand-text/60">Loading…</p>
        ) : !data?.week || data.days.length === 0 ? (
          <div className="camp-card mt-6 p-6">
            <h2 className="font-display text-2xl text-brand-green">Set up Week {week}</h2>
            <p className="mt-1 text-sm text-brand-text/70">
              This week has no dates yet. Pick the Monday (first lesson day) — the
              week runs five days from there.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-full border-2 border-brand-green bg-white px-4 py-1.5"
              />
              <button onClick={handleCreateWeek} disabled={!startDate} className="camp-btn px-5 py-2 text-sm">
                Create Week {week}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Instructor picker */}
            <div className="mt-5 flex items-center gap-2">
              <label className="text-sm font-semibold">Editing:</label>
              <select
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                className="rounded-full border-2 border-brand-green bg-white px-4 py-1.5 font-semibold"
              >
                {data.instructors.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>

            {/* Grid for selected instructor */}
            <div className="mt-3 overflow-x-auto rounded-xl border border-brand-green/15">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr>
                    <th className="w-16 bg-gradient-to-b from-brand-aqualight to-brand-aqua p-2" />
                    {data.days.map((d) => {
                      const { day, date } = formatDayHeader(d);
                      return (
                        <th key={d} className="border-l border-white/40 bg-gradient-to-b from-brand-aqualight to-brand-aqua p-2 text-center text-sm font-bold text-brand-text">
                          <span className="block uppercase tracking-wide">{day}</span>
                          <span className="block text-xs font-semibold text-brand-text/75">{date}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {BUILDER_SLOTS.map((slot, rowIdx) => (
                    <tr key={slot.start} className={rowIdx % 2 ? "bg-brand-cream/60" : "bg-white"}>
                      <th className="border-t border-brand-green/10 p-2 text-center align-middle text-sm font-bold text-brand-green">
                        {slot.label}
                      </th>
                      {data.days.map((d) => {
                        const k = cellKey(instructorId, d, slot.start);
                        const ids = assignments[k] ?? [];
                        const isOff = data.offCells.has(k);
                        return (
                          <td key={k} className={`border-l border-t border-brand-green/10 p-1.5 align-top ${isOff && ids.length === 0 ? "bg-gray-50" : ""}`}>
                            <div className="flex flex-col gap-1">
                              {ids.map((id) => {
                                const s = studentsById.get(id);
                                if (!s) return null;
                                return (
                                  <span key={id} className={`flex items-center justify-between gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${pillClass(s.level)}`}>
                                    <span className="truncate">{s.first_name} {s.last_name}</span>
                                    <button
                                      onClick={() => removeStudent(d, slot.start, id)}
                                      aria-label="Remove"
                                      className="shrink-0 rounded-full px-1 leading-none hover:bg-black/20"
                                    >×</button>
                                  </span>
                                );
                              })}
                              <button
                                onClick={() => { setPicker({ date: d, start: slot.start }); setQuery(""); }}
                                className="rounded-lg border border-dashed border-brand-green/40 px-2 py-1 text-xs font-semibold text-brand-green/70 hover:bg-brand-sand"
                              >
                                {isOff && ids.length === 0 ? "Off · + add" : "+ add"}
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
            <p className="mt-2 text-xs text-brand-text/50">
              Tip: grey cells are slots {instructorName} marked unavailable — you can still place a kid there if needed.
            </p>
          </>
        )}
      </div>

      {/* Sticky save bar */}
      {data?.week && data.days.length > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-brand-green/15 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <span className="text-sm text-brand-text/70">
              Draft for <strong>Week {week}</strong> — saving replaces this week’s schedule.
            </span>
            <button onClick={handleSave} disabled={saving} className="camp-btn ml-auto px-6 py-2.5">
              {saving ? "Saving…" : "Save schedule"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Student picker modal */}
      {picker ? (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center">
          <button aria-label="Close" onClick={() => setPicker(null)} className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md rounded-t-3xl bg-brand-cream p-5 shadow-2xl sm:rounded-3xl sm:border-2 sm:border-brand-green">
            <h3 className="font-display text-2xl text-brand-green">Add a student</h3>
            <p className="text-xs text-brand-text/60">
              {instructorName} · {formatDayHeader(picker.date).day} {formatDayHeader(picker.date).date} · {BUILDER_SLOTS.find((s) => s.start === picker.start)?.label}
            </p>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students…"
              className="mt-3 w-full rounded-full border-2 border-brand-green bg-white px-4 py-2 text-sm"
            />
            <ul className="mt-3 max-h-72 divide-y divide-brand-sand overflow-auto rounded-xl border border-brand-green/15 bg-white">
              {pickerList.map((s) => {
                const prior = data?.priorByStudent[s.id];
                const returningToYou = prior?.instructorId === instructorId;
                const priorName = prior
                  ? data?.instructors.find((i) => i.id === prior.instructorId)?.name
                  : null;
                const requested = data?.requestedByStudent[s.id];
                const requestedYou = requested?.instructorId === instructorId;
                const siblingHere = instructorLastNames.has(s.last_name.toLowerCase());
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
                        <span className="camp-pill bg-brand-green text-white" title="Parent requested you">
                          ⭐ Requested
                        </span>
                      ) : requested ? (
                        <span className="camp-pill bg-brand-yellow text-brand-text" title={`Parent requested ${requested.name}`}>
                          ⭐ {requested.name.split(" ")[0]}
                        </span>
                      ) : null}
                      {returningToYou ? (
                        <span className="camp-pill bg-brand-green text-white">↩ Yours</span>
                      ) : priorName ? (
                        <span className="camp-pill bg-brand-sand text-brand-text/70">last: {priorName.split(" ")[0]}</span>
                      ) : null}
                      {siblingHere ? (
                        <span className="camp-pill bg-brand-aqua text-brand-text" title="Sibling already with this instructor">
                          👫 sib
                        </span>
                      ) : null}
                      {placed > 0 ? (
                        <span className="camp-pill bg-brand-amber/30 text-brand-text/70">{placed}×</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
              {pickerList.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-brand-text/50">No students</li>
              ) : null}
            </ul>
            <button onClick={() => setPicker(null)} className="camp-btn-ghost mt-3 w-full">Done</button>
          </div>
        </div>
      ) : null}

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} /> : null}
    </main>
  );
}
