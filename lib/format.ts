const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Parses an ISO date (YYYY-MM-DD) as a local date, avoiding TZ drift. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

/** "Mon Jun 23" */
export function formatDayHeader(iso: string): { day: string; date: string } {
  const d = parseISODate(iso);
  return {
    day: DAY_NAMES[d.getDay()],
    date: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`,
  };
}

/** "16:30:00" -> "4:30" (no am/pm, matches the camp's row labels) */
export function formatSlotLabel(time: string): string {
  const [hRaw, m] = time.split(":");
  let h = parseInt(hRaw, 10);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m}`;
}

/** Returns [start, end] hour/minute numbers for ics. */
export function timeParts(time: string): { h: number; m: number } {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  return { h, m };
}

export function dateParts(iso: string): { y: number; mo: number; d: number } {
  const [y, mo, d] = iso.split("-").map((n) => parseInt(n, 10));
  return { y, mo, d };
}
