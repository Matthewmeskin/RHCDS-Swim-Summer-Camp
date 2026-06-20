import type { Student } from "./types";

/**
 * Fuzzy-matches a raw student name (from the schedule grid) to a student
 * record. Matching is primarily on first name, with last-name disambiguation
 * when the raw cell includes one.
 */

export interface MatchableStudent {
  id: string;
  first_name: string;
  last_name: string;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MatchResult {
  student: MatchableStudent | null;
  /** Confidence: "exact" (first+last), "first" (first name only), or "none". */
  confidence: "exact" | "first" | "none";
}

export function matchStudent(
  raw: string,
  students: MatchableStudent[]
): MatchResult {
  const tokens = norm(raw).split(" ").filter(Boolean);
  if (tokens.length === 0) return { student: null, confidence: "none" };

  const first = tokens[0];
  const last = tokens.length > 1 ? tokens.slice(1).join(" ") : null;

  const byFirst = students.filter((s) => norm(s.first_name) === first);

  if (byFirst.length === 0) {
    return { student: null, confidence: "none" };
  }

  if (last) {
    const exact = byFirst.find((s) => norm(s.last_name) === last);
    if (exact) return { student: exact, confidence: "exact" };
    // Try last-name prefix match (handles "Di Pietra" vs "DiPietra" quirks).
    const prefix = byFirst.find(
      (s) => norm(s.last_name).startsWith(last) || last.startsWith(norm(s.last_name))
    );
    if (prefix) return { student: prefix, confidence: "exact" };
  }

  if (byFirst.length === 1) {
    return { student: byFirst[0], confidence: "first" };
  }

  // Ambiguous first-name-only match — return first candidate but mark as
  // lower confidence so the importer can surface it.
  return { student: byFirst[0], confidence: "first" };
}
