import Papa from "papaparse";

/**
 * Parser for a "swim group / level" CSV. Maps each camper to one of the 6
 * groups (1–6). The group column is auto-detected and values can be a number
 * (1–6), a "Level 3"/"L3"/"Group 3" phrase, or the animal name
 * (e.g. "Octopus", "Red Octopus", "Sea Turtles", "Dolphins", "Sharks").
 */

export interface ParsedLevel {
  first_name: string;
  last_name: string;
  group_level: number;
}

export interface ParseLevelsResult {
  rows: ParsedLevel[];
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

/** Resolve a free-text group value to a level number 1–6, or null. */
export function resolveGroupLevel(raw: string): number | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;

  // Explicit number: "3", "level 3", "l3", "group 3", "grp3".
  const num = v.match(/(?:^|level|lvl|group|grp|l|g)\s*([1-6])(?:\b|$)/);
  if (num) return parseInt(num[1], 10);
  const bare = v.match(/\b([1-6])\b/);
  if (bare) return parseInt(bare[1], 10);

  // Animal / color names.
  if (v.includes("octopus")) return 1;
  if (v.includes("clown")) return 2; // clownfish / clown fish
  if (v.includes("stingray") || v.includes("sting ray") || /\bray\b/.test(v)) return 3;
  if (v.includes("turtle")) return 4; // sea turtles
  if (v.includes("dolphin")) return 5;
  if (v.includes("shark")) return 6;

  return null;
}

export function parseLevels(csvText: string): ParseLevelsResult {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: ParsedLevel[] = [];
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

    const raw = pick(row, [
      "swim group", "group", "groups", "group level", "swim level",
      "level", "band", "swim band", "skill group",
    ]);
    if (!raw) {
      warnings.push(`Row ${idx + 2} (${first} ${last}): no group column — skipped`);
      return;
    }
    const group_level = resolveGroupLevel(raw);
    if (group_level == null) {
      warnings.push(`Row ${idx + 2} (${first} ${last}): could not read group "${raw}" — skipped`);
      return;
    }
    rows.push({ first_name: first, last_name: last, group_level });
  });

  return { rows, warnings };
}
