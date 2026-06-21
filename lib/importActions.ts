import { requireSupabase } from "./supabaseClient";
import type { ParsedStudent } from "./parseStudents";
import type { ParseScheduleResult } from "./parseSchedule";
import type { ParsedPreference } from "./parsePreferences";
import type { ParsedEnrollment } from "./parseEnrollment";
import type { ParsedLevel } from "./parseLevels";
import { matchStudent, type MatchableStudent } from "./matchStudent";
import { detectRequestedInstructor } from "./builder";
import { detectSpecialNeeds } from "./specialNeeds";
import type { Instructor } from "./types";

export interface StudentImportResult {
  inserted: number;
  updated: number;
  errors: number;
  errorMessages: string[];
  groupsAssigned: number;
  instructorsMatched: number;
  unmatchedInstructors: string[];
}

/**
 * All-in-one roster upsert on (first_name, last_name): demographics, level,
 * goals, parent notes, swim group, and a preferred instructor (matched to the
 * roster). Each optional column is only written when the file actually carried
 * it, so a routine re-import never wipes data added in-app.
 */
export async function importStudents(
  parsed: ParsedStudent[]
): Promise<StudentImportResult> {
  const db = requireSupabase();

  const [{ data: existing, error: exErr }, { data: instrRows, error: iErr }] =
    await Promise.all([
      db.from("students").select("first_name, last_name"),
      db.from("instructors").select("*"),
    ]);
  if (exErr) throw exErr;
  if (iErr) throw iErr;

  const existingSet = new Set(
    (existing ?? []).map(
      (s: { first_name: string; last_name: string }) =>
        `${s.first_name.toLowerCase()}|${s.last_name.toLowerCase()}`
    )
  );
  const instructors = (instrRows ?? []) as Instructor[];

  let inserted = 0;
  let updated = 0;
  for (const s of parsed) {
    const key = `${s.first_name.toLowerCase()}|${s.last_name.toLowerCase()}`;
    if (existingSet.has(key)) updated++;
    else inserted++;
  }

  // Only manage optional columns when the file actually carried them.
  const hasParentNotes = parsed.some((s) => s.parent_notes);
  const hasGroup = parsed.some((s) => s.group_level != null);
  const hasPreferred = parsed.some((s) => s.preferred_instructor_raw);

  let groupsAssigned = 0;
  let instructorsMatched = 0;
  const unmatchedInstructors: string[] = [];

  const rows = parsed.map((s) => {
    if (s.group_level != null) groupsAssigned++;
    let preferredId: string | null = null;
    if (s.preferred_instructor_raw) {
      const match = detectRequestedInstructor(s.preferred_instructor_raw, instructors);
      if (match) {
        preferredId = match.instructorId;
        instructorsMatched++;
      } else {
        unmatchedInstructors.push(s.preferred_instructor_raw);
      }
    }
    return {
      first_name: s.first_name,
      last_name: s.last_name,
      gender: s.gender,
      age: s.age,
      level: s.level,
      goals: s.goals,
      special_needs: s.special_needs,
      ...(hasParentNotes ? { parent_notes: s.parent_notes } : {}),
      ...(hasGroup ? { group_level: s.group_level } : {}),
      ...(hasPreferred ? { preferred_instructor_id: preferredId } : {}),
    };
  });

  const errorMessages: string[] = [];
  const { error } = await db
    .from("students")
    .upsert(rows, { onConflict: "first_name,last_name" });
  if (error) {
    errorMessages.push(error.message);
    return {
      inserted: 0, updated: 0, errors: rows.length, errorMessages,
      groupsAssigned: 0, instructorsMatched: 0, unmatchedInstructors: [],
    };
  }

  await db.from("import_logs").insert({
    file_type: "students",
    rows_inserted: inserted,
    rows_updated: updated,
    warnings: { groupsAssigned, instructorsMatched, unmatchedInstructors, kind: "roster" },
  });

  return {
    inserted, updated, errors: 0, errorMessages,
    groupsAssigned, instructorsMatched,
    unmatchedInstructors: Array.from(new Set(unmatchedInstructors)),
  };
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

export interface PreferencesImportResult {
  updated: number;
  matchedInstructors: number;
  unmatchedStudents: string[];
  unmatchedInstructors: string[];
}

/**
 * Applies a parent-preferences CSV: matches each row to a student and writes
 * parent_notes (+ preferred_instructor_id when a named instructor matches).
 */
export async function importPreferences(
  rows: ParsedPreference[]
): Promise<PreferencesImportResult> {
  const db = requireSupabase();

  const [{ data: studRows, error: sErr }, { data: instrRows, error: iErr }] =
    await Promise.all([
      db.from("students").select("id, first_name, last_name"),
      db.from("instructors").select("*"),
    ]);
  if (sErr) throw sErr;
  if (iErr) throw iErr;

  const matchable: MatchableStudent[] = (studRows ?? []) as MatchableStudent[];
  const instructors = (instrRows ?? []) as Instructor[];

  let updated = 0;
  let matchedInstructors = 0;
  const unmatchedStudents: string[] = [];
  const unmatchedInstructors: string[] = [];

  for (const row of rows) {
    const { student } = matchStudent(`${row.first_name} ${row.last_name}`, matchable);
    if (!student) {
      unmatchedStudents.push(`${row.first_name} ${row.last_name}`.trim());
      continue;
    }

    const payload: Record<string, unknown> = {};
    if (row.parent_notes) {
      payload.parent_notes = row.parent_notes;
      if (detectSpecialNeeds(row.parent_notes)) payload.special_needs = true;
    }
    if (row.preferred_instructor_raw) {
      const match = detectRequestedInstructor(row.preferred_instructor_raw, instructors);
      if (match) {
        payload.preferred_instructor_id = match.instructorId;
        matchedInstructors++;
      } else {
        unmatchedInstructors.push(row.preferred_instructor_raw);
        // Keep the request visible even if it doesn't match a roster name.
        const note = `Parent requested instructor: ${row.preferred_instructor_raw}`;
        payload.parent_notes = payload.parent_notes
          ? `${payload.parent_notes}\n${note}`
          : note;
      }
    }

    if (Object.keys(payload).length === 0) continue;

    const { error } = await db.from("students").update(payload).eq("id", student.id);
    if (error) throw error;
    updated++;
  }

  await db.from("import_logs").insert({
    file_type: "students",
    rows_inserted: 0,
    rows_updated: updated,
    warnings: { unmatchedStudents, unmatchedInstructors, kind: "preferences" },
  });

  return {
    updated,
    matchedInstructors,
    unmatchedStudents: Array.from(new Set(unmatchedStudents)),
    unmatchedInstructors: Array.from(new Set(unmatchedInstructors)),
  };
}

export interface LevelsImportResult {
  updated: number;
  unmatchedStudents: string[];
}

/** Applies a swim-group CSV: matches each row to a student and sets group_level. */
export async function importLevels(rows: ParsedLevel[]): Promise<LevelsImportResult> {
  const db = requireSupabase();
  const { data: studRows, error } = await db
    .from("students")
    .select("id, first_name, last_name");
  if (error) throw error;

  const matchable: MatchableStudent[] = (studRows ?? []) as MatchableStudent[];
  let updated = 0;
  const unmatched: string[] = [];

  for (const row of rows) {
    const { student } = matchStudent(`${row.first_name} ${row.last_name}`, matchable);
    if (!student) {
      unmatched.push(`${row.first_name} ${row.last_name}`.trim());
      continue;
    }
    const { error: uErr } = await db
      .from("students")
      .update({ group_level: row.group_level })
      .eq("id", student.id);
    if (uErr) throw uErr;
    updated++;
  }

  await db.from("import_logs").insert({
    file_type: "students",
    rows_inserted: 0,
    rows_updated: updated,
    warnings: { unmatchedStudents: unmatched, kind: "levels" },
  });

  return { updated, unmatchedStudents: Array.from(new Set(unmatched)) };
}

export interface EnrollmentImportResult {
  rowsWritten: number;
  studentsMatched: number;
  unmatchedStudents: string[];
}

/** Applies an enrollment CSV: which kids attend which weeks, and how many lessons. */
export async function importEnrollment(
  rows: ParsedEnrollment[]
): Promise<EnrollmentImportResult> {
  const db = requireSupabase();
  const [{ data: studRows, error: sErr }, { data: weekRows, error: wErr }] =
    await Promise.all([
      db.from("students").select("id, first_name, last_name"),
      db.from("weeks").select("week_number"),
    ]);
  if (sErr) throw sErr;
  if (wErr) throw wErr;

  const matchable: MatchableStudent[] = (studRows ?? []) as MatchableStudent[];
  const allWeeks = (weekRows ?? []).map((w: { week_number: number }) => w.week_number);

  const upserts: { student_id: string; week_number: number; lessons: number }[] = [];
  const unmatched: string[] = [];
  const matchedIds = new Set<string>();

  for (const row of rows) {
    const { student } = matchStudent(`${row.first_name} ${row.last_name}`, matchable);
    if (!student) {
      unmatched.push(`${row.first_name} ${row.last_name}`.trim());
      continue;
    }
    matchedIds.add(student.id);
    const weeks = row.week != null ? [row.week] : allWeeks;
    for (const wk of weeks) {
      upserts.push({ student_id: student.id, week_number: wk, lessons: row.lessons });
    }
  }

  if (upserts.length) {
    const { error } = await db
      .from("student_enrollment")
      .upsert(upserts, { onConflict: "student_id,week_number" });
    if (error) throw error;
  }

  return {
    rowsWritten: upserts.length,
    studentsMatched: matchedIds.size,
    unmatchedStudents: Array.from(new Set(unmatched)),
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
