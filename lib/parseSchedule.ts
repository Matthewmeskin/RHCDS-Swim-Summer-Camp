import Papa from "papaparse";

/**
 * Schedule CSV parser for the Country Day Camp Swim Portal.
 *
 * The Google Sheets export is a "wide grid" with a repeating block per
 * instructor:
 *
 *   Instructor Name,,,,,,
 *   Time,Jun-22,Jun-23,Jun-24,Jun-25,Jun-26
 *   4:30 - 5:00,[student | X | blank],...
 *   5:00 - 5:30,...
 *   5:30 - 6:00,...
 *   [blank row]
 *   Next Instructor Name,,,,,,
 *   ...
 *
 * This module is intentionally UI-free and dependency-light so it can be
 * unit tested in isolation (see parseSchedule.test.ts).
 */

export interface ParsedLesson {
  instructorName: string;
  /** Raw student cell text, before sibling splitting. */
  cellRaw: string;
  /** Individual student names after splitting siblings. */
  studentNames: string[];
  lessonDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS
  endTime: string; // HH:MM:SS
}

export interface ParsedUnavailability {
  instructorName: string;
  lessonDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS
}

export interface ParseWarning {
  type: "unknown_time" | "unparseable_date" | "empty_instructor";
  message: string;
  context?: string;
}

export interface ParseScheduleResult {
  lessons: ParsedLesson[];
  unavailable: ParsedUnavailability[];
  warnings: ParseWarning[];
  /** Distinct instructor names encountered, in order. */
  instructors: string[];
}

/** Maps a "start - end" label (or just a start) to normalized times. */
const TIME_SLOTS: Record<string, { start: string; end: string }> = {
  "4:30": { start: "16:30:00", end: "17:00:00" },
  "5:00": { start: "17:00:00", end: "17:30:00" },
  "5:30": { start: "17:30:00", end: "18:00:00" },
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Normalizes a time label like "4:30 - 5:00", "4:30-5:00", or "4:30" to a
 * canonical start key ("4:30"). Returns null if not a recognized slot.
 */
export function normalizeTimeLabel(label: string): string | null {
  const start = label.split(/[-–—]/)[0].trim();
  // Collapse "4:30 PM" etc. to "4:30"
  const m = start.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const key = `${parseInt(m[1], 10)}:${m[2]}`;
  return TIME_SLOTS[key] ? key : null;
}

/**
 * Parses a header date token like "Jun-22", "Jun 22", "6/22" into an ISO
 * date string for the given year. Returns null if unparseable.
 */
export function parseHeaderDate(token: string, year: number): string | null {
  const t = token.trim();
  if (!t) return null;

  // "Jun-22" / "Jun 22" / "June 22"
  const named = t.match(/^([A-Za-z]{3,})[-\s]+(\d{1,2})$/);
  if (named) {
    const mon = MONTHS[named[1].slice(0, 3).toLowerCase()];
    const day = parseInt(named[2], 10);
    if (mon && day >= 1 && day <= 31) return isoDate(year, mon, day);
  }

  // "6/22" / "6-22"
  const numeric = t.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (numeric) {
    const mon = parseInt(numeric[1], 10);
    const day = parseInt(numeric[2], 10);
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
      return isoDate(year, mon, day);
    }
  }

  return null;
}

function isoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** True if a cell should be treated as an empty (no lesson) slot. */
function isEmptyCell(cell: string): boolean {
  return cell.trim() === "";
}

/** True if a cell marks the instructor unavailable. */
function isUnavailableCell(cell: string): boolean {
  return cell.trim().toUpperCase() === "X";
}

/** True if a row looks like the "Time, Jun-22, ..." header row. */
function isHeaderRow(cells: string[]): boolean {
  return cells[0]?.trim().toLowerCase() === "time";
}

/** True if a row is the start of an instructor block (name + empty rest). */
function isInstructorRow(cells: string[]): boolean {
  const first = cells[0]?.trim() ?? "";
  if (!first) return false;
  if (isHeaderRow(cells)) return false;
  if (normalizeTimeLabel(first)) return false;
  // The rest of the row should be empty for an instructor header.
  return cells.slice(1).every((c) => (c ?? "").trim() === "");
}

/**
 * Splits a student cell into individual names, handling sibling pairs joined
 * by " & " or " and ".
 */
export function splitStudentNames(cell: string): string[] {
  return cell
    .split(/\s+(?:&|and)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parses the full schedule CSV text into structured lessons + unavailability.
 *
 * @param csvText Raw CSV string (Google Sheets export).
 * @param year    Calendar year for the header date tokens (e.g. 2025).
 */
export function parseSchedule(csvText: string, year: number): ParseScheduleResult {
  const { data } = Papa.parse<string[]>(csvText, {
    skipEmptyLines: false,
  });

  const lessons: ParsedLesson[] = [];
  const unavailable: ParsedUnavailability[] = [];
  const warnings: ParseWarning[] = [];
  const instructors: string[] = [];

  let currentInstructor: string | null = null;
  let dateColumns: (string | null)[] = []; // ISO date per column index (1-based cols)

  for (const rawRow of data) {
    const cells = (rawRow ?? []).map((c) => (c ?? "").toString());

    // Fully blank row resets nothing structurally but separates blocks.
    if (cells.every((c) => c.trim() === "")) {
      continue;
    }

    if (isInstructorRow(cells)) {
      currentInstructor = cells[0].trim();
      if (!instructors.includes(currentInstructor)) {
        instructors.push(currentInstructor);
      }
      dateColumns = [];
      continue;
    }

    if (isHeaderRow(cells)) {
      dateColumns = cells.map((c, i) => {
        if (i === 0) return null;
        if (!c.trim()) return null;
        const iso = parseHeaderDate(c, year);
        if (!iso) {
          warnings.push({
            type: "unparseable_date",
            message: `Could not parse date header "${c}"`,
            context: currentInstructor ?? undefined,
          });
        }
        return iso;
      });
      continue;
    }

    // Otherwise: a time row (4:30 - 5:00, ...).
    const timeKey = normalizeTimeLabel(cells[0]);
    if (!timeKey) {
      warnings.push({
        type: "unknown_time",
        message: `Unrecognized row label "${cells[0]}"`,
        context: currentInstructor ?? undefined,
      });
      continue;
    }

    if (!currentInstructor) {
      warnings.push({
        type: "empty_instructor",
        message: `Time row "${cells[0]}" found before any instructor name`,
      });
      continue;
    }

    const { start, end } = TIME_SLOTS[timeKey];

    for (let col = 1; col < cells.length; col++) {
      const iso = dateColumns[col];
      if (!iso) continue; // no date for this column

      const cell = cells[col];
      if (isEmptyCell(cell)) continue;

      if (isUnavailableCell(cell)) {
        unavailable.push({
          instructorName: currentInstructor,
          lessonDate: iso,
          startTime: start,
        });
        continue;
      }

      lessons.push({
        instructorName: currentInstructor,
        cellRaw: cell.trim(),
        studentNames: splitStudentNames(cell),
        lessonDate: iso,
        startTime: start,
        endTime: end,
      });
    }
  }

  return { lessons, unavailable, warnings, instructors };
}
