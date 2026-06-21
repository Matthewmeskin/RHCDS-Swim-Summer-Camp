import { requireSupabase } from "./supabaseClient";
import type {
  Instructor,
  Student,
  Week,
  ScheduleSlot,
  InstructorAvailability,
  Role,
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

/** Active instructors only (public picker, builder, links). */
export async function fetchInstructors(): Promise<Instructor[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("instructors")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Instructor[];
}

/** Every instructor incl. inactive (roster management). */
export async function fetchInstructorsAll(): Promise<Instructor[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("instructors")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Instructor[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function saveInstructor(rec: {
  id?: string;
  name: string;
  role: Role;
  email: string | null;
  slug?: string | null;
  active?: boolean;
}): Promise<void> {
  const db = requireSupabase();
  const payload = {
    name: rec.name,
    role: rec.role,
    email: rec.email,
    slug: rec.slug || slugify(rec.name),
    active: rec.active ?? true,
  };
  if (rec.id) {
    const { error } = await db.from("instructors").update(payload).eq("id", rec.id);
    if (error) throw error;
  } else {
    const { error } = await db.from("instructors").insert(payload);
    if (error) throw error;
  }
}

/** Updates only a student's parent/staff notes (admin quick-edit). */
export async function saveStudentNotes(
  studentId: string,
  notes: { parent_notes: string | null; staff_notes: string | null }
): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("students").update(notes).eq("id", studentId);
  if (error) throw error;
}

export async function saveStudent(rec: Partial<Student> & { first_name: string; last_name: string }): Promise<void> {
  const db = requireSupabase();
  const payload = {
    first_name: rec.first_name,
    last_name: rec.last_name,
    gender: rec.gender ?? null,
    age: rec.age ?? null,
    level: rec.level ?? null,
    goals: rec.goals ?? null,
    special_needs: rec.special_needs ?? false,
    parent_notes: rec.parent_notes ?? null,
    staff_notes: rec.staff_notes ?? null,
    active: rec.active ?? true,
  };
  if (rec.id) {
    const { error } = await db.from("students").update(payload).eq("id", rec.id);
    if (error) throw error;
  } else {
    const { error } = await db.from("students").insert(payload);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Availability change requests (instructor proposes → admin approves/denies)
// ---------------------------------------------------------------------------

export async function createAvailabilityRequest(rec: {
  instructorId: string;
  weekNumber: number;
  offSlots: { date: string; start: string }[];
  email: string | null;
  phone: string | null;
  note: string | null;
}): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("availability_requests").insert({
    instructor_id: rec.instructorId,
    week_number: rec.weekNumber,
    off_slots: rec.offSlots,
    contact_email: rec.email,
    contact_phone: rec.phone,
    note: rec.note,
    status: "pending",
  });
  if (error) throw error;
}

export interface AvailabilityRequestRow {
  id: string;
  instructor_id: string;
  week_number: number;
  off_slots: { date: string; start: string }[];
  contact_email: string | null;
  contact_phone: string | null;
  note: string | null;
  status: "pending" | "approved" | "denied";
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  instructors: { name: string; slug: string | null } | null;
}

export async function fetchAvailabilityRequests(
  statuses: ("pending" | "approved" | "denied")[] = ["pending"]
): Promise<AvailabilityRequestRow[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("availability_requests")
    .select("*, instructors(name, slug)")
    .in("status", statuses)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AvailabilityRequestRow[];
}

/** The slots an instructor is currently OFF for a week (for request impact). */
export async function fetchInstructorOffSlots(
  instructorId: string,
  weekNumber: number
): Promise<{ date: string; start: string }[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("instructor_availability")
    .select("lesson_date, start_time")
    .eq("instructor_id", instructorId)
    .eq("week_number", weekNumber)
    .eq("is_available", false);
  if (error) throw error;
  return (data ?? []).map((r: { lesson_date: string; start_time: string }) => ({
    date: r.lesson_date,
    start: r.start_time,
  }));
}

export async function pendingRequestCount(): Promise<number> {
  const db = requireSupabase();
  const { count } = await db
    .from("availability_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

/** Approves (applies the change) or denies a request. Returns it for alerting. */
export async function decideAvailabilityRequest(
  requestId: string,
  approve: boolean,
  decisionNote: string | null
): Promise<AvailabilityRequestRow> {
  const db = requireSupabase();
  const { data: reqData, error: reqErr } = await db
    .from("availability_requests")
    .select("*, instructors(name, slug)")
    .eq("id", requestId)
    .single();
  if (reqErr) throw reqErr;
  const request = reqData as unknown as AvailabilityRequestRow;

  if (approve) {
    await saveInstructorAvailability(
      request.instructor_id,
      request.week_number,
      request.off_slots ?? []
    );
  }

  const { error } = await db
    .from("availability_requests")
    .update({
      status: approve ? "approved" : "denied",
      decision_note: decisionNote,
      decided_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (error) throw error;

  return { ...request, status: approve ? "approved" : "denied", decision_note: decisionNote };
}

export interface InstructorNoteRow {
  id: string;
  note: string | null;
  updated_at: string;
  instructor_id: string;
  instructors: { name: string } | null;
}

export async function fetchInstructorNotes(studentId: string): Promise<InstructorNoteRow[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("instructor_notes")
    .select("id, note, updated_at, instructor_id, instructors(name)")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InstructorNoteRow[];
}

export async function saveInstructorNote(
  studentId: string,
  instructorId: string,
  note: string
): Promise<void> {
  const db = requireSupabase();
  const { error } = await db
    .from("instructor_notes")
    .upsert(
      { student_id: studentId, instructor_id: instructorId, note, updated_at: new Date().toISOString() },
      { onConflict: "student_id,instructor_id" }
    );
  if (error) throw error;
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

  // Wave 1: instructor + (default week, only if not provided) in parallel.
  const [instructor, defaultWk] = await Promise.all([
    fetchInstructorBySlug(slug),
    weekNumber == null ? fetchDefaultWeekNumber() : Promise.resolve(null),
  ]);
  if (!instructor) return null;

  const wk = weekNumber ?? defaultWk ?? null;
  if (wk == null) {
    return { instructor, week: null, slots: [], availability: [] };
  }

  // Wave 2: week + slots + availability in parallel.
  const [weekRes, slotRes, availRes] = await Promise.all([
    db.from("weeks").select("*").eq("week_number", wk).maybeSingle(),
    db
      .from("schedule_slots")
      .select("*, students(*)")
      .eq("instructor_id", instructor.id)
      .eq("week_number", wk)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true }),
    db
      .from("instructor_availability")
      .select("*")
      .eq("instructor_id", instructor.id)
      .eq("week_number", wk),
  ]);

  if (slotRes.error) throw slotRes.error;
  if (availRes.error) throw availRes.error;

  return {
    instructor,
    week: (weekRes.data as Week) ?? null,
    slots: (slotRes.data ?? []) as SlotWithStudent[],
    availability: (availRes.data ?? []) as InstructorAvailability[],
  };
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

export interface SlotLite {
  student_id: string | null;
  instructor_id: string | null;
  lesson_date: string;
  start_time: string;
  week_number: number | null;
}

export async function fetchAllScheduleSlots(): Promise<SlotLite[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("schedule_slots")
    .select("student_id, instructor_id, lesson_date, start_time, week_number");
  if (error) throw error;
  return (data ?? []) as SlotLite[];
}

export interface OffLite {
  instructor_id: string | null;
  week_number: number | null;
  lesson_date: string;
  start_time: string;
}

/** All "off" availability rows (lite) — for the master-schedule time-off overlay. */
export async function fetchAllOffAvailability(): Promise<OffLite[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("instructor_availability")
    .select("instructor_id, week_number, lesson_date, start_time")
    .eq("is_available", false);
  if (error) throw error;
  return (data ?? []) as OffLite[];
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
