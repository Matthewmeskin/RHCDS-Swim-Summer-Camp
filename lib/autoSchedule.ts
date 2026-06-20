import { BUILDER_SLOTS, cellKey } from "./builder";
import type { Instructor, Student } from "./types";

/**
 * Greedy, explainable auto-scheduler. Produces a DRAFT the director reviews and
 * edits — it is never auto-saved. It honors, in priority order:
 *   parent-requested instructor → prior-week consistency → keeping siblings
 *   together → least-loaded instructor, while respecting availability (Off
 *   slots), the per-slot ratio cap, and never double-booking a kid.
 */

export interface AutoConfig {
  lessonsPerKid: number;
  maxPerSlot: number;
  mode: "fill" | "rebuild";
}

export interface AutoReport {
  placed: number;
  partial: number;
  unplaced: { name: string; reason: string }[];
}

export interface AutoResult {
  assignments: Record<string, string[]>;
  report: AutoReport;
}

function parseKey(k: string): { instr: string; date: string; hhmm: string } {
  const [instr, date, hhmm] = k.split("__");
  return { instr, date, hhmm };
}

/** studentId -> instructorId from the most recent week before `targetWeek`. */
export function computePrior(
  assignments: Record<string, string[]>,
  dateToWeek: Record<string, number>,
  targetWeek: number
): Record<string, string> {
  const best: Record<string, { wk: number; instr: string }> = {};
  for (const [k, ids] of Object.entries(assignments)) {
    const { instr, date } = parseKey(k);
    const wk = dateToWeek[date];
    if (wk == null || wk >= targetWeek) continue;
    for (const sid of ids) {
      if (!best[sid] || wk > best[sid].wk) best[sid] = { wk, instr };
    }
  }
  const out: Record<string, string> = {};
  for (const [sid, v] of Object.entries(best)) out[sid] = v.instr;
  return out;
}

export function autoAssignWeek(params: {
  days: string[];
  instructors: Instructor[]; // active teaching instructors (guards excluded)
  students: Student[]; // active students
  assignments: Record<string, string[]>; // whole-season draft
  offCells: Set<string>;
  requestedByStudent: Record<string, { instructorId: string }>;
  priorByStudent: Record<string, string>;
  config: AutoConfig;
  /** When set, only these kids are placed, each with their own lesson count. */
  lessonsByStudent?: Record<string, number>;
}): AutoResult {
  const { days, instructors, offCells, requestedByStudent, priorByStudent, config, lessonsByStudent } = params;
  const maxPerSlot = Math.max(1, config.maxPerSlot);
  const defaultPerKid = Math.max(1, config.lessonsPerKid);
  // When enrollment is provided, only place enrolled kids (with their counts).
  const students = lessonsByStudent
    ? params.students.filter((s) => lessonsByStudent[s.id] != null)
    : params.students;
  const lessonsFor = (sid: string) =>
    lessonsByStudent && lessonsByStudent[sid] != null
      ? Math.max(1, lessonsByStudent[sid])
      : defaultPerKid;

  const next: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(params.assignments)) next[k] = [...v];

  // Target-week cell keys per instructor (excluding Off slots).
  const openByInstr = new Map<string, string[]>();
  for (const i of instructors) {
    const keys: string[] = [];
    for (const d of days) {
      for (const s of BUILDER_SLOTS) {
        const k = cellKey(i.id, d, s.start);
        if (!offCells.has(k)) keys.push(k);
      }
    }
    openByInstr.set(i.id, keys);
  }
  const allTargetKeys = new Set<string>();
  for (const i of instructors) {
    for (const d of days) for (const s of BUILDER_SLOTS) allTargetKeys.add(cellKey(i.id, d, s.start));
  }

  // Rebuild: clear this week's cells first.
  if (config.mode === "rebuild") {
    for (const k of allTargetKeys) delete next[k];
  }

  // Track double-booking: studentId__date__hhmm, and per-kid days/placement count.
  const booked = new Set<string>();
  const kidDays = new Map<string, Set<string>>();
  const kidCount = new Map<string, number>();
  for (const k of allTargetKeys) {
    const { date, hhmm } = parseKey(k);
    for (const sid of next[k] ?? []) {
      booked.add(`${sid}__${date}__${hhmm}`);
      (kidDays.get(sid) ?? kidDays.set(sid, new Set()).get(sid)!).add(date);
      kidCount.set(sid, (kidCount.get(sid) ?? 0) + 1);
    }
  }

  const load = (instrId: string) =>
    (openByInstr.get(instrId) ?? []).reduce((n, k) => n + (next[k]?.length ?? 0), 0);

  // Siblings by last name.
  const siblings = new Map<string, Student[]>();
  for (const s of students) {
    const key = s.last_name.toLowerCase();
    (siblings.get(key) ?? siblings.set(key, []).get(key)!).push(s);
  }
  const instrTeachingSibThisWeek = (kid: Student): string | null => {
    for (const sib of siblings.get(kid.last_name.toLowerCase()) ?? []) {
      if (sib.id === kid.id) continue;
      for (const i of instructors) {
        for (const k of openByInstr.get(i.id) ?? []) {
          if ((next[k] ?? []).includes(sib.id)) return i.id;
        }
      }
    }
    return null;
  };

  // Order kids: special needs, requests, consistency, siblings, then name.
  const ordered = [...students].sort((a, b) => {
    const f = (s: Student) =>
      [
        s.special_needs ? 0 : 1,
        requestedByStudent[s.id] ? 0 : 1,
        priorByStudent[s.id] ? 0 : 1,
        (siblings.get(s.last_name.toLowerCase()) ?? []).length > 1 ? 0 : 1,
      ];
    const fa = f(a), fb = f(b);
    for (let i = 0; i < fa.length; i++) if (fa[i] !== fb[i]) return fa[i] - fb[i];
    return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
  });

  const report: AutoReport = { placed: 0, partial: 0, unplaced: [] };

  for (const kid of ordered) {
    const perKid = lessonsFor(kid.id);
    let need = perKid - (kidCount.get(kid.id) ?? 0);
    if (need <= 0) {
      report.placed++;
      continue;
    }

    // Ranked instructor candidates.
    const ranked: string[] = [];
    const seen = new Set<string>();
    const addCand = (id?: string | null) => {
      if (id && !seen.has(id) && instructors.some((i) => i.id === id)) {
        ranked.push(id);
        seen.add(id);
      }
    };
    addCand(requestedByStudent[kid.id]?.instructorId);
    addCand(priorByStudent[kid.id]);
    addCand(instrTeachingSibThisWeek(kid));
    instructors
      .filter((i) => !seen.has(i.id))
      .sort((a, b) => load(a.id) - load(b.id))
      .forEach((i) => addCand(i.id));

    for (const instrId of ranked) {
      if (need <= 0) break;
      const cells = (openByInstr.get(instrId) ?? [])
        .filter((k) => (next[k]?.length ?? 0) < maxPerSlot)
        .filter((k) => {
          const { date, hhmm } = parseKey(k);
          return !booked.has(`${kid.id}__${date}__${hhmm}`);
        })
        .sort((ka, kb) => {
          // Prefer a cell where a sibling already sits, then a fresh day, then least-loaded.
          const sib = (k: string) =>
            (next[k] ?? []).some((id) => {
              const o = students.find((s) => s.id === id);
              return o && o.id !== kid.id && o.last_name.toLowerCase() === kid.last_name.toLowerCase();
            })
              ? 0
              : 1;
          const freshDay = (k: string) =>
            (kidDays.get(kid.id) ?? new Set()).has(parseKey(k).date) ? 1 : 0;
          return (
            sib(ka) - sib(kb) ||
            freshDay(ka) - freshDay(kb) ||
            (next[ka]?.length ?? 0) - (next[kb]?.length ?? 0)
          );
        });

      for (const k of cells) {
        if (need <= 0) break;
        const { date, hhmm } = parseKey(k);
        next[k] = [...(next[k] ?? []), kid.id];
        booked.add(`${kid.id}__${date}__${hhmm}`);
        (kidDays.get(kid.id) ?? kidDays.set(kid.id, new Set()).get(kid.id)!).add(date);
        kidCount.set(kid.id, (kidCount.get(kid.id) ?? 0) + 1);
        need--;
      }
    }

    if (need === perKid - (kidCount.get(kid.id) ?? 0) && (kidCount.get(kid.id) ?? 0) === 0) {
      report.unplaced.push({ name: `${kid.first_name} ${kid.last_name}`, reason: "no open slot" });
    } else if (need > 0) {
      report.partial++;
    } else {
      report.placed++;
    }
  }

  return { assignments: next, report };
}
