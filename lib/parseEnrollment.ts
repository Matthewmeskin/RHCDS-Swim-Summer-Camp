import Papa from "papaparse";

/**
 * Parser for a (flexible) enrollment CSV — who's enrolled, in which week, and
 * how many lessons. Column names are auto-detected.
 *
 *   - Name:    "First name"+"Last name", or a single "Name"/"Student"/"Child".
 *   - Week:    "Week"/"Session"/"Wk" (a number 1–8, or "Week 3"). Omit to apply
 *              to every week.
 *   - Lessons: "Lessons"/"Lessons per week"/"Sessions"/"Days"/"Count"
 *              (defaults to 1).
 */

export interface ParsedEnrollment {
  first_name: string;
  last_name: string;
  week: number | null; // null = all weeks
  lessons: number;
}

export interface ParseEnrollmentResult {
  rows: ParsedEnrollment[];
  warnings: string[];
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    if (keys.includes(k.trim().toLowerCase())) return (row[k] ?? "").trim();
  }
  return "";
}

function splitName(full: string): { first: string; last: string } {
  const p = full.trim().split(/\s+/);
  return p.length === 1 ? { first: p[0], last: "" } : { first: p[0], last: p.slice(1).join(" ") };
}

function parseWeek(raw: string): number | null {
  const m = raw.match(/(\d{1,2})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 8 ? n : null;
}

export function parseEnrollment(csvText: string): ParseEnrollmentResult {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: ParsedEnrollment[] = [];
  const warnings: string[] = [];

  data.forEach((row, idx) => {
    let first = pick(row, ["first name", "first", "firstname"]);
    let last = pick(row, ["last name", "last", "lastname"]);
    if (!first && !last) {
      const full = pick(row, ["name", "student", "student name", "child", "camper"]);
      if (full) ({ first, last } = splitName(full));
    }
    if (!first && !last) return;

    const weekRaw = pick(row, ["week", "week number", "session", "wk"]);
    const week = weekRaw ? parseWeek(weekRaw) : null;
    if (weekRaw && week === null) {
      warnings.push(`Row ${idx + 2} (${first} ${last}): unrecognized week "${weekRaw}"`);
    }

    const lessonsRaw = pick(row, [
      "lessons", "lessons per week", "sessions", "days", "days per week", "count", "# of lessons",
    ]);
    const lessons = lessonsRaw ? Math.max(1, parseInt(lessonsRaw, 10) || 1) : 1;

    rows.push({ first_name: first, last_name: last, week, lessons });
  });

  return { rows, warnings };
}
