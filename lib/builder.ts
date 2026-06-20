import { requireSupabase } from "./supabaseClient";
import { fetchInstructors, fetchAllStudents } from "./data";
import type { Instructor, Student, Week, InstructorAvailability } from "./types";
import { parseISODate } from "./format";

export const BUILDER_SLOTS = [
  { start: "16:30:00", end: "17:00:00", label: "4:30" },
  { start: "17:00:00", end: "17:30:00", label: "5:00" },
  { start: "17:30:00", end: "18:00:00", label: "5:30" },
];

/** cellKey identifies one instructor + day + slot. */
export function cellKey(instructorId: string, date: string, start: string): string {
  return `${instructorId}__${date}__${start.slice(0, 5)}`;
}

export interface PriorPairing {
  instructorId: string;
  weekNumber: number;
}

export interface RequestedInstructor {
  instructorId: string;
  name: string;
}

export interface BuilderData {
  week: Week | null;
  instructors: Instructor[]; // teaching instructors (guards excluded)
  students: Student[];
  days: string[]; // ISO dates for the target week
  /** cellKey -> studentIds currently assigned for the target week. */
  assignments: Record<string, string[]>;
  /** studentId -> their most recent prior instructor (for consistency hints). */
  priorByStudent: Record<string, PriorPairing>;
  /** studentId -> instructor a parent requested in goals/parent_notes. */
  requestedByStudent: Record<string, RequestedInstructor>;
  /** Set of cellKeys the instructor marked unavailable. */
  offCells: Set<string>;
}

/**
 * Scans a kid's goals + parent_notes for a requested instructor name.
 * Prefers a full-name match; falls back to a first name only when that first
 * name is unique among instructors (avoids "Drew"/"Ellie" ambiguity).
 */
export function detectRequestedInstructor(
  text: string,
  instructors: Instructor[]
): RequestedInstructor | null {
  if (!text.trim()) return null;
  const hay = text.toLowerCase();

  for (const i of instructors) {
    const full = i.name.toLowerCase();
    if (full && new RegExp(`\\b${escapeRe(full)}\\b`).test(hay)) {
      return { instructorId: i.id, name: i.name };
    }
  }

  const firstCounts = new Map<string, number>();
  for (const i of instructors) {
    const f = i.name.split(/\s+/)[0].toLowerCase();
    firstCounts.set(f, (firstCounts.get(f) ?? 0) + 1);
  }
  for (const i of instructors) {
    const f = i.name.split(/\s+/)[0].toLowerCase();
    if (f.length < 4 || firstCounts.get(f) !== 1) continue;
    if (new RegExp(`\\b${escapeRe(f)}\\b`).test(hay)) {
      return { instructorId: i.id, name: i.name };
    }
  }
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function weekDays(week: Week | null): string[] {
  if (!week?.start_date || !week?.end_date) return [];
  const out: string[] = [];
  const start = parseISODate(week.start_date);
  const end = parseISODate(week.end_date);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  }
  return out;
}

async function fetchWeek(weekNumber: number): Promise<Week | null> {
  const db = requireSupabase();
  const { data } = await db
    .from("weeks")
    .select("*")
    .eq("week_number", weekNumber)
    .maybeSingle();
  return (data as Week) ?? null;
}

export async function fetchBuilderData(weekNumber: number): Promise<BuilderData> {
  const db = requireSupabase();
  const [instructorsAll, students, week] = await Promise.all([
    fetchInstructors(),
    fetchAllStudents(),
    fetchWeek(weekNumber),
  ]);

  const instructors = instructorsAll.filter((i) => i.role !== "guard");

  // Existing assignments for this week.
  const assignments: Record<string, string[]> = {};
  const { data: slots } = await db
    .from("schedule_slots")
    .select("instructor_id, student_id, lesson_date, start_time")
    .eq("week_number", weekNumber);
  for (const s of slots ?? []) {
    if (!s.instructor_id || !s.student_id) continue;
    const k = cellKey(s.instructor_id, s.lesson_date, s.start_time);
    (assignments[k] ||= []).push(s.student_id);
  }

  // Unavailable cells for this week.
  const offCells = new Set<string>();
  const { data: avail } = await db
    .from("instructor_availability")
    .select("instructor_id, lesson_date, start_time, is_available")
    .eq("week_number", weekNumber);
  for (const a of (avail ?? []) as InstructorAvailability[]) {
    if (!a.is_available && a.instructor_id) {
      offCells.add(cellKey(a.instructor_id, a.lesson_date, a.start_time));
    }
  }

  // Prior pairings: each student's most recent instructor before this week.
  const priorByStudent: Record<string, PriorPairing> = {};
  const { data: prior } = await db
    .from("schedule_slots")
    .select("instructor_id, student_id, week_number")
    .lt("week_number", weekNumber)
    .not("student_id", "is", null)
    .not("instructor_id", "is", null)
    .order("week_number", { ascending: false });
  for (const p of prior ?? []) {
    const sid = p.student_id as string;
    if (!priorByStudent[sid]) {
      priorByStudent[sid] = {
        instructorId: p.instructor_id as string,
        weekNumber: p.week_number as number,
      };
    }
  }

  // Parent-requested instructors parsed from goals + parent_notes.
  const requestedByStudent: Record<string, RequestedInstructor> = {};
  for (const s of students) {
    const text = `${s.goals ?? ""} ${s.parent_notes ?? ""}`;
    const req = detectRequestedInstructor(text, instructors);
    if (req) requestedByStudent[s.id] = req;
  }

  return {
    week,
    instructors,
    students,
    days: weekDays(week),
    assignments,
    priorByStudent,
    requestedByStudent,
    offCells,
  };
}

/** Creates or updates a week row with Mon–Fri dates from a start date. */
export async function ensureWeekWithDates(
  weekNumber: number,
  startISO: string
): Promise<Week> {
  const db = requireSupabase();
  const start = parseISODate(startISO);
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  const endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  const label = `Week ${weekNumber}`;
  const { data, error } = await db
    .from("weeks")
    .upsert(
      { week_number: weekNumber, start_date: startISO, end_date: endISO, label },
      { onConflict: "week_number" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Week;
}

const slotEnd: Record<string, string> = Object.fromEntries(
  BUILDER_SLOTS.map((s) => [s.start.slice(0, 5), s.end])
);

/**
 * Replaces the target week's lesson slots with the builder's assignments.
 * (Availability rows are left untouched.)
 */
export async function saveWeekSchedule(
  weekNumber: number,
  assignments: Record<string, string[]>
): Promise<number> {
  const db = requireSupabase();
  const rows: Record<string, unknown>[] = [];
  for (const [k, studentIds] of Object.entries(assignments)) {
    const [instructorId, date, hhmm] = k.split("__");
    const end = slotEnd[hhmm];
    for (const studentId of studentIds) {
      rows.push({
        instructor_id: instructorId,
        student_id: studentId,
        student_name_raw: null,
        lesson_date: date,
        start_time: `${hhmm}:00`,
        end_time: end,
        week_number: weekNumber,
      });
    }
  }

  const del = await db.from("schedule_slots").delete().eq("week_number", weekNumber);
  if (del.error) throw del.error;
  if (rows.length) {
    const { error } = await db.from("schedule_slots").insert(rows);
    if (error) throw error;
  }

  await db.from("import_logs").insert({
    file_type: "schedule",
    week_number: weekNumber,
    rows_inserted: rows.length,
    rows_updated: 0,
    warnings: ["Built in app schedule builder"],
  });
  return rows.length;
}

/**
 * Builds an in-memory assignment map for `targetWeek` by copying a source
 * week's pairings, mapped day-for-day (Mon→Mon, etc.). Not saved until the
 * director hits Save, so they can review first.
 */
export async function carryForward(
  sourceWeekNumber: number,
  targetWeek: Week
): Promise<Record<string, string[]>> {
  const db = requireSupabase();
  const source = await fetchWeek(sourceWeekNumber);
  if (!source?.start_date || !targetWeek.start_date) return {};

  const { data: slots } = await db
    .from("schedule_slots")
    .select("instructor_id, student_id, lesson_date, start_time")
    .eq("week_number", sourceWeekNumber);

  const srcStart = parseISODate(source.start_date);
  const tgtStart = parseISODate(targetWeek.start_date);
  const dayMs = 24 * 60 * 60 * 1000;

  const out: Record<string, string[]> = {};
  for (const s of slots ?? []) {
    if (!s.instructor_id || !s.student_id) continue;
    const offset = Math.round(
      (parseISODate(s.lesson_date).getTime() - srcStart.getTime()) / dayMs
    );
    const tgt = new Date(tgtStart);
    tgt.setDate(tgt.getDate() + offset);
    const tgtISO = `${tgt.getFullYear()}-${String(tgt.getMonth() + 1).padStart(2, "0")}-${String(tgt.getDate()).padStart(2, "0")}`;
    const k = cellKey(s.instructor_id, tgtISO, s.start_time);
    (out[k] ||= []).push(s.student_id);
  }
  return out;
}

/** The most recent week (< given) that has any lesson slots. */
export async function latestPriorWeekWithSlots(
  weekNumber: number
): Promise<number | null> {
  const db = requireSupabase();
  const { data } = await db
    .from("schedule_slots")
    .select("week_number")
    .lt("week_number", weekNumber)
    .order("week_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.week_number ?? null;
}
