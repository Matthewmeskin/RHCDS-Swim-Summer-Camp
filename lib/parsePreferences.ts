import Papa from "papaparse";

/**
 * Parser for a "parent preferences" CSV. The format is flexible — column names
 * are auto-detected — so the director can export from almost anything.
 *
 * Recognized columns (case-insensitive, any subset):
 *   - Name:        "First name"/"First" + "Last name"/"Last", OR a single
 *                  "Name"/"Student"/"Child"/"Camper" column.
 *   - Instructor:  "Preferred instructor"/"Instructor preference"/
 *                  "Requested instructor"/"Instructor".
 *   - Notes:       "Parent notes"/"Preferences"/"Preference"/"Notes"/"Comments".
 */

export interface ParsedPreference {
  first_name: string;
  last_name: string;
  preferred_instructor_raw: string | null;
  parent_notes: string | null;
}

export interface ParsePreferencesResult {
  rows: ParsedPreference[];
  warnings: string[];
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.trim().toLowerCase();
    if (keys.includes(norm)) return (row[k] ?? "").trim();
  }
  return "";
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function parsePreferences(csvText: string): ParsePreferencesResult {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: ParsedPreference[] = [];
  const warnings: string[] = [];

  data.forEach((row, idx) => {
    let first = pick(row, ["first name", "first", "firstname"]);
    let last = pick(row, ["last name", "last", "lastname"]);

    if (!first && !last) {
      const full = pick(row, ["name", "student", "student name", "child", "child name", "camper"]);
      if (full) {
        const s = splitName(full);
        first = s.first;
        last = s.last;
      }
    }

    if (!first && !last) return; // blank line

    const preferred =
      pick(row, [
        "preferred instructor",
        "instructor preference",
        "instructor preferences",
        "requested instructor",
        "instructor",
        "coach",
      ]) || null;

    const notes =
      pick(row, [
        "parent notes",
        "preferences",
        "preference",
        "notes",
        "comments",
        "parent preferences",
      ]) || null;

    if (!preferred && !notes) {
      warnings.push(`Row ${idx + 2} (${first} ${last}): no preference or notes — skipped`);
      return;
    }

    rows.push({
      first_name: first,
      last_name: last,
      preferred_instructor_raw: preferred,
      parent_notes: notes,
    });
  });

  return { rows, warnings };
}
