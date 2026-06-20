import { requireSupabase } from "./supabaseClient";
import type { ParsedStudent } from "./parseStudents";
import type { ParseScheduleResult } from "./parseSchedule";
import { matchStudent, type MatchableStudent } from "./matchStudent";

export interface StudentImportResult {
  inserted: number;
  updated: number;
  errors: number;
  errorMessages: string[];
}

/** Upserts students on (first_name, last_name); reports insert vs update counts. */
export async function importStudents(
  parsed: ParsedStudent[]
): Promise<StudentImportResult> {
  const db = requireSupabase();

  const { data: existing, error: exErr } = await db
    .from("students")
    .select("first_name, last_name");
  if (exErr) throw exErr;

  const existingSet = new Set(
    (existing ?? []).map(
      (s: { first_name: string; last_name: string }) =>
        `${s.first_name.toLowerCase()}|${s.last_name.toLowerCase()}`
    )
  );

  let inserted = 0;
  let updated = 0;
  for (const s of parsed) {
    const key = `${s.first_name.toLowerCase()}|${s.last_name.toLowerCase()}`;
    if (existingSet.has(key)) updated++;
    else inserted++;
  }

  const rows = parsed.map((s) => ({
    first_name: s.first_name,
    last_name: s.last_name,
    gender: s.gender,
    age: s.age,
    level: s.level,
    goals: s.goals,
    special_needs: s.special_needs,
  }));

  const errorMessages: string[] = [];
  const { error } = await db
    .from("students")
    .upsert(rows, { onConflict: "first_name,last_name" });
  if (error) {
    errorMessages.push(error.message);
    return { inserted: 0, updated: 0, errors: rows.length, errorMessages };
  }

  await db.from("import_logs").insert({
    file_type: "students",
    rows_inserted: inserted,
    rows_updated: updated,
    warnings: [],
  });

  return { inserted, updated, errors: 0, errorMessages };
}

export interface ScheduleImportResult {
  slotsInserted: number;
  unavailableInserted: number;
  warnings: string[];
}

/**
 * Replaces a week's schedule with freshly parsed data.
 * Deletes existing slots + availability for the week, then inserts.
 */
export async function importSchedule(
  weekNumber: number,
  parsed: ParseScheduleResult
): Promise<ScheduleImportResult> {
  const db = requireSupabase();

  const [{ data: instrRows, error: iErr }, { data: studRows, error: sErr }] =
    await Promise.all([
      db.from("instructors").select("id, name"),
      db.from("students").select("id, first_name, last_name"),
    ]);
  if (iErr) throw iErr;
  if (sErr) throw sErr;

  const instrByName = new Map(
    (instrRows ?? []).map((r: { id: string; name: string }) => [
      r.name.toLowerCase(),
      r.id,
    ])
  );
  const matchable: MatchableStudent[] = (studRows ?? []) as MatchableStudent[];

  const warnings = [...parsed.warnings.map((w) => w.message)];

  const slotRows: Record<string, unknown>[] = [];
  for (const lesson of parsed.lessons) {
    const instructor_id = instrByName.get(lesson.instructorName.toLowerCase()) ?? null;
    if (!instructor_id) warnings.push(`Unknown instructor: ${lesson.instructorName}`);
    for (const name of lesson.studentNames) {
      const { student } = matchStudent(name, matchable);
      if (!student) warnings.push(`Unmatched student: ${name}`);
      slotRows.push({
        instructor_id,
        student_id: student?.id ?? null,
        student_name_raw: student ? null : name,
        lesson_date: lesson.lessonDate,
        start_time: lesson.startTime,
        end_time: lesson.endTime,
        week_number: weekNumber,
      });
    }
  }

  const availRows: Record<string, unknown>[] = parsed.unavailable.map((u) => ({
    instructor_id: instrByName.get(u.instructorName.toLowerCase()) ?? null,
    lesson_date: u.lessonDate,
    start_time: u.startTime,
    is_available: false,
    week_number: weekNumber,
  }));

  // Replace the week.
  const del1 = await db.from("schedule_slots").delete().eq("week_number", weekNumber);
  if (del1.error) throw del1.error;
  const del2 = await db
    .from("instructor_availability")
    .delete()
    .eq("week_number", weekNumber);
  if (del2.error) throw del2.error;

  if (slotRows.length) {
    const { error } = await db.from("schedule_slots").insert(slotRows);
    if (error) throw error;
  }
  if (availRows.length) {
    const { error } = await db.from("instructor_availability").insert(availRows);
    if (error) throw error;
  }

  await db.from("import_logs").insert({
    file_type: "schedule",
    week_number: weekNumber,
    rows_inserted: slotRows.length,
    rows_updated: 0,
    warnings,
  });

  return {
    slotsInserted: slotRows.length,
    unavailableInserted: availRows.length,
    warnings,
  };
}

/** Ensures a weeks row exists for the given number (so FKs resolve). */
export async function ensureWeek(
  weekNumber: number,
  year: number
): Promise<void> {
  const db = requireSupabase();
  const { data } = await db
    .from("weeks")
    .select("week_number")
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (data) return;
  await db.from("weeks").insert({
    week_number: weekNumber,
    label: `Week ${weekNumber}`,
  });
}
