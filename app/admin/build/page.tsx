"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Nav from "@/components/Nav";
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
  type AllBuilderData,
} from "@/lib/builder";

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
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

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
    const k = cellKey(instructorId, date, start);
    setAssignments((prev) => ({
      ...prev,
      [k]: (prev[k] ?? []).filter((id) => id !== studentId),
    }));
  }

  function copyToLater(week: Week) {
    if (!data) return;
    if (!confirm(`Copy ${instructorName}'s Week ${week.week_number} to every later week (overwrites their later weeks)?`)) return;
    setAssignments((prev) => copyInstructorWeekToLater(prev, instructorId, week, data.weeks));
    setToast({ msg: `Copied Week ${week.week_number} to later weeks for ${instructorName}.`, kind: "success" });
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
    const list = data.students.filter((s) =>
      q ? `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) : true
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
          instructor — and adjust from there.
        </p>

        {loading ? (
          <p className="mt-10 text-center text-brand-text/60">Loading…</p>
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
              <span className="ml-auto text-sm font-semibold text-brand-text/70">
                {unplacedCount} kid{unplacedCount === 1 ? "" : "s"} unplaced all summer
              </span>
            </div>

            {/* All weeks for the selected instructor */}
            <div className="mt-4 space-y-6">
              {data.weeks.map((week) => {
                const days = getWeekDays(week);
                return (
                  <section key={week.week_number} className="camp-card overflow-hidden">
                    <div className="flex items-center justify-between gap-2 border-b border-brand-green/10 bg-brand-sand/50 px-3 py-2">
                      <h2 className="font-display text-xl text-brand-green">
                        {week.label ?? `Week ${week.week_number}`}
                      </h2>
                      <button
                        onClick={() => copyToLater(week)}
                        className="rounded-full border border-brand-green/30 bg-white px-3 py-1 text-xs font-bold text-brand-green hover:bg-brand-sand"
                        title="Copy this week to all later weeks for this instructor"
                      >
                        ↓ Copy to later weeks
                      </button>
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
                                  <td key={k} className={`border-l border-t border-brand-green/10 p-1 align-top ${isOff && ids.length === 0 ? "bg-gray-50" : ""}`}>
                                    <div className="flex flex-col gap-1">
                                      {ids.map((id) => {
                                        const s = studentsById.get(id);
                                        if (!s) return null;
                                        return (
                                          <span key={id} className={`flex items-center justify-between gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${pillClass(s.level)}`}>
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

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} /> : null}
    </main>
  );
}
