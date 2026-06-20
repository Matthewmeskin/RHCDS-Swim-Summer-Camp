/**
 * Idempotent seed script for the Country Day Camp Swim Portal.
 *
 * Seeds:
 *   1. Week 1 (Jun 22-26, 2025)
 *   2. Instructors (upsert on slug)
 *   3. Students (only if the students table is empty — per spec)
 *   4. Week 1 schedule slots + instructor unavailability (replace week 1)
 *
 * Usage:
 *   npm run seed
 *
 * Env (loaded from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL        — required
 *   SUPABASE_SERVICE_ROLE_KEY       — preferred (bypasses RLS for seeding)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   — fallback (works with the v1 anon policies)
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
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

config({ path: ".env.local" });
config(); // also allow plain .env

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "✗ Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local"
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

async function seedWeeks() {
  const { error } = await db
    .from("weeks")
    .upsert([WEEK1], { onConflict: "week_number" });
  if (error) throw error;
  console.log("✓ Weeks seeded (Week 1)");
}

async function seedInstructors() {
  const rows = instructors.map((i) => ({
    name: i.name,
    slug: i.slug,
    role: i.role,
  }));
  const { error } = await db.from("instructors").upsert(rows, { onConflict: "slug" });
  if (error) throw error;
  console.log(`✓ Instructors seeded (${rows.length})`);
}

async function seedStudents() {
  const { count, error: countErr } = await db
    .from("students")
    .select("*", { count: "exact", head: true });
  if (countErr) throw countErr;

  if ((count ?? 0) > 0) {
    console.log(`• Students already present (${count}) — skipping student seed`);
    return;
  }

  const rows = students.map((s) => ({
    first_name: s.first,
    last_name: s.last,
    gender: s.gender,
    age: s.age,
    level: s.level,
    goals: s.goals,
    special_needs: s.special_needs ?? detectSpecialNeeds(s.goals),
  }));

  const { error } = await db.from("students").insert(rows);
  if (error) throw error;
  console.log(`✓ Students seeded (${rows.length})`);
}

async function seedSchedule() {
  // Load instructors + students to resolve names to ids.
  const { data: instrRows, error: iErr } = await db
    .from("instructors")
    .select("id, name");
  if (iErr) throw iErr;
  const instrByName = new Map(instrRows!.map((r) => [r.name, r.id]));

  const { data: studRows, error: sErr } = await db
    .from("students")
    .select("id, first_name, last_name");
  if (sErr) throw sErr;
  const matchable: MatchableStudent[] = studRows!;

  // Replace Week 1 data so re-runs are clean.
  await db.from("schedule_slots").delete().eq("week_number", WEEK1_NUMBER);
  await db.from("instructor_availability").delete().eq("week_number", WEEK1_NUMBER);

  const slotRows: any[] = [];
  const warnings: string[] = [];

  for (const lesson of week1Lessons) {
    const instructor_id = instrByName.get(lesson.instructor) ?? null;
    if (!instructor_id) warnings.push(`Unknown instructor: ${lesson.instructor}`);
    const { start, end } = TIME_SLOTS[lesson.slot];
    for (const name of lesson.students) {
      const { student } = matchStudent(name, matchable);
      if (!student) warnings.push(`Unmatched student: ${name}`);
      slotRows.push({
        instructor_id,
        student_id: student?.id ?? null,
        student_name_raw: student ? null : name,
        lesson_date: week1Date(lesson.day),
        start_time: start,
        end_time: end,
        week_number: WEEK1_NUMBER,
      });
    }
  }

  const availRows: any[] = [];
  for (const u of week1Unavailable) {
    const instructor_id = instrByName.get(u.instructor) ?? null;
    if (!instructor_id) warnings.push(`Unknown instructor (avail): ${u.instructor}`);
    for (const day of u.days) {
      for (const slot of u.slots) {
        availRows.push({
          instructor_id,
          lesson_date: week1Date(day),
          start_time: TIME_SLOTS[slot].start,
          is_available: false,
          week_number: WEEK1_NUMBER,
        });
      }
    }
  }

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
    week_number: WEEK1_NUMBER,
    rows_inserted: slotRows.length,
    rows_updated: 0,
    warnings,
  });

  console.log(
    `✓ Week 1 schedule seeded (${slotRows.length} slots, ${availRows.length} unavailable)`
  );
  if (warnings.length) {
    console.log(`  ⚠ ${warnings.length} warning(s):`);
    warnings.forEach((w) => console.log(`    - ${w}`));
  }
}

async function main() {
  console.log("Seeding Country Day Camp Swim Portal…\n");
  await seedWeeks();
  await seedInstructors();
  await seedStudents();
  await seedSchedule();
  console.log("\n✓ Seed complete.");
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err.message ?? err);
  process.exit(1);
});
