/**
 * Generates a single, self-contained SQL file (supabase/setup.sql) that the
 * aquatics director can paste into the Supabase SQL editor ONCE to create the
 * schema and load all seed data (instructors, students, Week 1 schedule).
 *
 * Built from the same source data the app/seed script uses, so it stays in
 * sync. Run: npx tsx scripts/genSeedSql.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  instructors,
  students,
  week1Lessons,
  week1Unavailable,
  WEEK1,
  WEEK1_NUMBER,
  TIME_SLOTS,
  week1Date,
} from "../lib/seedData";
import { detectSpecialNeeds } from "../lib/specialNeeds";
import { matchStudent, type MatchableStudent } from "../lib/matchStudent";

function q(v: string | null | number | boolean): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${v.replace(/'/g, "''")}'`;
}

const matchable: MatchableStudent[] = students.map((s, i) => ({
  id: String(i),
  first_name: s.first,
  last_name: s.last,
}));

const lines: string[] = [];
lines.push("-- ============================================================");
lines.push("-- Country Day Camp Swim Portal — full setup (schema + seed)");
lines.push("-- Paste this entire file into the Supabase SQL editor and Run.");
lines.push("-- Idempotent: safe to run more than once.");
lines.push("-- ============================================================");
lines.push("");

// --- Schema (reuse the canonical schema.sql) ---
lines.push("-- ---------- SCHEMA ----------");
lines.push(readFileSync("supabase/schema.sql", "utf8").trim());
lines.push("");

// --- Seed data ---
lines.push("-- ---------- SEED DATA ----------");
lines.push("begin;");
lines.push("");

// Weeks
lines.push("-- Weeks");
lines.push(
  `insert into weeks (week_number, start_date, end_date, label) values ` +
    `(${WEEK1.week_number}, ${q(WEEK1.start_date)}, ${q(WEEK1.end_date)}, ${q(WEEK1.label)}) ` +
    `on conflict (week_number) do update set start_date = excluded.start_date, end_date = excluded.end_date, label = excluded.label;`
);
lines.push("");

// Instructors
lines.push("-- Instructors");
for (const i of instructors) {
  lines.push(
    `insert into instructors (name, slug, role) values (${q(i.name)}, ${q(i.slug)}, ${q(i.role)}) ` +
      `on conflict (slug) do update set name = excluded.name, role = excluded.role;`
  );
}
lines.push("");

// Students (idempotent on first_name+last_name)
lines.push("-- Students");
for (const s of students) {
  const special = s.special_needs ?? detectSpecialNeeds(s.goals);
  lines.push(
    `insert into students (first_name, last_name, gender, age, level, goals, special_needs) values (` +
      `${q(s.first)}, ${q(s.last)}, ${q(s.gender)}, ${q(s.age)}, ${q(s.level)}, ${q(s.goals)}, ${special}) ` +
      `on conflict (first_name, last_name) do update set ` +
      `gender = excluded.gender, age = excluded.age, level = excluded.level, ` +
      `goals = excluded.goals, special_needs = excluded.special_needs;`
  );
}
lines.push("");

// Replace Week 1 schedule + availability
lines.push("-- Week 1 schedule (replace)");
lines.push(`delete from schedule_slots where week_number = ${WEEK1_NUMBER};`);
lines.push(`delete from instructor_availability where week_number = ${WEEK1_NUMBER};`);
lines.push("");

for (const lesson of week1Lessons) {
  const { start, end } = TIME_SLOTS[lesson.slot];
  const date = week1Date(lesson.day);
  for (const name of lesson.students) {
    const { student } = matchStudent(name, matchable);
    const seed = student ? students[parseInt(student.id, 10)] : null;
    const instrSub = `(select id from instructors where name = ${q(lesson.instructor)})`;
    const studentSub = seed
      ? `(select id from students where first_name = ${q(seed.first)} and last_name = ${q(seed.last)})`
      : "NULL";
    const rawName = seed ? "NULL" : q(name);
    lines.push(
      `insert into schedule_slots (instructor_id, student_id, student_name_raw, lesson_date, start_time, end_time, week_number) values (` +
        `${instrSub}, ${studentSub}, ${rawName}, ${q(date)}, ${q(start)}, ${q(end)}, ${WEEK1_NUMBER});`
    );
  }
}
lines.push("");

lines.push("-- Week 1 instructor unavailability");
for (const u of week1Unavailable) {
  const instrSub = `(select id from instructors where name = ${q(u.instructor)})`;
  for (const day of u.days) {
    const date = week1Date(day);
    for (const slot of u.slots) {
      lines.push(
        `insert into instructor_availability (instructor_id, lesson_date, start_time, is_available, week_number) values (` +
          `${instrSub}, ${q(date)}, ${q(TIME_SLOTS[slot].start)}, false, ${WEEK1_NUMBER});`
      );
    }
  }
}
lines.push("");
lines.push("commit;");
lines.push("");

writeFileSync("supabase/setup.sql", lines.join("\n"));
console.log(`Wrote supabase/setup.sql (${lines.length} lines)`);
