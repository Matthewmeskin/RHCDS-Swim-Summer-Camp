import { createEvents, type EventAttributes } from "ics";
import { dateParts, timeParts } from "./format";

export interface CalendarLesson {
  studentNames: string[];
  level?: string | null;
  goals?: string | null;
  lessonDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS
  endTime: string; // HH:MM:SS
}

const LOCATION = "Rolling Hills Country Day School — Swim Pool";

function durationMinutes(start: string, end: string): number {
  const s = timeParts(start);
  const e = timeParts(end);
  return e.h * 60 + e.m - (s.h * 60 + s.m);
}

/**
 * Builds an .ics calendar (one event per lesson) for an instructor's week.
 * Returns the ICS string, or throws on error.
 */
export function buildWeekIcs(
  instructorName: string,
  lessons: CalendarLesson[]
): string {
  const events: EventAttributes[] = lessons.map((l) => {
    const { y, mo, d } = dateParts(l.lessonDate);
    const { h, m } = timeParts(l.startTime);
    const title = l.studentNames.join(" & ") || "Swim lesson";
    const goalSnippet = (l.goals ?? "").slice(0, 120);
    const description = [l.level ? `Level: ${l.level}` : null, goalSnippet]
      .filter(Boolean)
      .join(" — ");

    return {
      title,
      start: [y, mo, d, h, m],
      duration: { minutes: durationMinutes(l.startTime, l.endTime) },
      location: LOCATION,
      description,
      calName: `${instructorName} — Swim Camp`,
    };
  });

  const { error, value } = createEvents(events);
  if (error) throw error;
  return value ?? "";
}

/** Triggers a client-side download of an .ics file. */
export function downloadIcs(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
