import { requireSupabase } from "./supabaseClient";
import type {
  Instructor,
  Student,
  Week,
  ScheduleSlot,
  InstructorAvailability,
} from "./types";

export interface SlotWithStudent extends ScheduleSlot {
  students: Student | null;
}

export interface InstructorWeekData {
  instructor: Instructor;
  week: Week | null;
  slots: SlotWithStudent[];
  availability: InstructorAvailability[];
}

export async function fetchInstructors(): Promise<Instructor[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("instructors")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Instructor[];
}

export async function fetchWeeks(): Promise<Week[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("weeks")
    .select("*")
    .order("week_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Week[];
}

/** The latest week that has any schedule data, falling back to max week. */
export async function fetchDefaultWeekNumber(): Promise<number | null> {
  const db = requireSupabase();
  const { data: slot } = await db
    .from("schedule_slots")
    .select("week_number")
    .order("week_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (slot?.week_number != null) return slot.week_number;

  const { data: wk } = await db
    .from("weeks")
    .select("week_number")
    .order("week_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return wk?.week_number ?? null;
}

export async function fetchInstructorBySlug(
  slug: string
): Promise<Instructor | null> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("instructors")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Instructor) ?? null;
}

export async function fetchInstructorWeek(
  slug: string,
  weekNumber: number | null
): Promise<InstructorWeekData | null> {
  const db = requireSupabase();
  const instructor = await fetchInstructorBySlug(slug);
  if (!instructor) return null;

  const wk =
    weekNumber ?? (await fetchDefaultWeekNumber()) ?? null;

  let week: Week | null = null;
  if (wk != null) {
    const { data } = await db
      .from("weeks")
      .select("*")
      .eq("week_number", wk)
      .maybeSingle();
    week = (data as Week) ?? null;
  }

  let slots: SlotWithStudent[] = [];
  let availability: InstructorAvailability[] = [];

  if (wk != null) {
    const { data: slotData, error: slotErr } = await db
      .from("schedule_slots")
      .select("*, students(*)")
      .eq("instructor_id", instructor.id)
      .eq("week_number", wk)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (slotErr) throw slotErr;
    slots = (slotData ?? []) as SlotWithStudent[];

    const { data: availData, error: availErr } = await db
      .from("instructor_availability")
      .select("*")
      .eq("instructor_id", instructor.id)
      .eq("week_number", wk);
    if (availErr) throw availErr;
    availability = (availData ?? []) as InstructorAvailability[];
  }

  return { instructor, week, slots, availability };
}

export interface AdminStats {
  instructorCount: number;
  studentCount: number;
  slotsThisWeek: number;
}

export async function fetchAdminStats(weekNumber: number | null): Promise<AdminStats> {
  const db = requireSupabase();
  const [{ count: instructorCount }, { count: studentCount }] = await Promise.all([
    db.from("instructors").select("*", { count: "exact", head: true }),
    db.from("students").select("*", { count: "exact", head: true }),
  ]);

  let slotsThisWeek = 0;
  if (weekNumber != null) {
    const { count } = await db
      .from("schedule_slots")
      .select("*", { count: "exact", head: true })
      .eq("week_number", weekNumber);
    slotsThisWeek = count ?? 0;
  }

  return {
    instructorCount: instructorCount ?? 0,
    studentCount: studentCount ?? 0,
    slotsThisWeek,
  };
}

/** Unmatched raw student names in the schedule for a week (QA warnings). */
export async function fetchUnmatchedNames(weekNumber: number | null): Promise<string[]> {
  if (weekNumber == null) return [];
  const db = requireSupabase();
  const { data, error } = await db
    .from("schedule_slots")
    .select("student_name_raw")
    .eq("week_number", weekNumber)
    .not("student_name_raw", "is", null);
  if (error) throw error;
  const names = (data ?? [])
    .map((r: { student_name_raw: string | null }) => r.student_name_raw)
    .filter((n): n is string => Boolean(n));
  return Array.from(new Set(names));
}

/**
 * Replaces an instructor's unavailability for a week. `offSlots` are the slots
 * the instructor is marking themselves OFF (everything else = available).
 */
export async function saveInstructorAvailability(
  instructorId: string,
  weekNumber: number,
  offSlots: { date: string; start: string }[]
): Promise<void> {
  const db = requireSupabase();
  const del = await db
    .from("instructor_availability")
    .delete()
    .eq("instructor_id", instructorId)
    .eq("week_number", weekNumber);
  if (del.error) throw del.error;

  if (offSlots.length) {
    const rows = offSlots.map((o) => ({
      instructor_id: instructorId,
      lesson_date: o.date,
      start_time: o.start,
      is_available: false,
      week_number: weekNumber,
    }));
    const { error } = await db.from("instructor_availability").insert(rows);
    if (error) throw error;
  }

  // Record that this instructor submitted availability for the week (so the
  // admin can see "set" vs "fully available but not touched").
  await db
    .from("availability_submissions")
    .upsert(
      { instructor_id: instructorId, week_number: weekNumber, updated_at: new Date().toISOString() },
      { onConflict: "instructor_id,week_number" }
    );
}

/** instructorId -> ISO timestamp they last submitted availability for a week. */
export async function fetchAvailabilitySubmissions(
  weekNumber: number
): Promise<Record<string, string>> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("availability_submissions")
    .select("instructor_id, updated_at")
    .eq("week_number", weekNumber);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const r of data ?? []) {
    if (r.instructor_id) out[r.instructor_id] = r.updated_at as string;
  }
  return out;
}

export async function fetchAllStudents(): Promise<Student[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("students")
    .select("*")
    .order("last_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Student[];
}
