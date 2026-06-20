import Papa from "papaparse";
import { detectSpecialNeeds } from "./specialNeeds";
import type { Level } from "./types";

/**
 * Parser for the CampSite students CSV export.
 * Columns: Last name, First name, Gender, Age, Level, Goals for Lessons
 */

export interface ParsedStudent {
  last_name: string;
  first_name: string;
  gender: string | null;
  age: number | null;
  level: Level | null;
  goals: string;
  special_needs: boolean;
  /** Optional — only present if the export includes a preferences/notes column. */
  parent_notes: string | null;
}

export interface ParseStudentsResult {
  students: ParsedStudent[];
  warnings: string[];
}

const VALID_LEVELS: Level[] = ["Non-Swimmer", "Beginner", "Intermediate", "Advanced"];

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.trim().toLowerCase();
    if (keys.some((target) => norm === target)) {
      return (row[k] ?? "").trim();
    }
  }
  return "";
}

function normalizeLevel(raw: string): Level | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  const found = VALID_LEVELS.find((l) => l.toLowerCase() === v);
  if (found) return found;
  // Common variants
  if (v.includes("non")) return "Non-Swimmer";
  if (v.startsWith("begin")) return "Beginner";
  if (v.startsWith("inter")) return "Intermediate";
  if (v.startsWith("adv")) return "Advanced";
  return null;
}

export function parseStudents(csvText: string): ParseStudentsResult {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const students: ParsedStudent[] = [];
  const warnings: string[] = [];

  data.forEach((row, idx) => {
    const last_name = pick(row, ["last name", "last", "lastname"]);
    const first_name = pick(row, ["first name", "first", "firstname"]);

    if (!last_name && !first_name) return; // skip blank lines

    if (!first_name || !last_name) {
      warnings.push(`Row ${idx + 2}: missing first or last name — skipped`);
      return;
    }

    const ageRaw = pick(row, ["age"]);
    const age = ageRaw ? parseInt(ageRaw, 10) : null;
    const levelRaw = pick(row, ["level"]);
    const level = normalizeLevel(levelRaw);
    if (levelRaw && !level) {
      warnings.push(`Row ${idx + 2} (${first_name} ${last_name}): unknown level "${levelRaw}"`);
    }
    const goals = pick(row, ["goals for lessons", "goals", "goals for lesson"]);
    const parentNotes =
      pick(row, [
        "parent notes",
        "parent preferences",
        "preferences",
        "instructor preference",
        "instructor preferences",
        "notes",
      ]) || null;

    students.push({
      last_name,
      first_name,
      gender: pick(row, ["gender"]) || null,
      age: Number.isNaN(age as number) ? null : age,
      level,
      goals,
      special_needs: detectSpecialNeeds(`${goals} ${parentNotes ?? ""}`),
      parent_notes: parentNotes,
    });
  });

  return { students, warnings };
}
