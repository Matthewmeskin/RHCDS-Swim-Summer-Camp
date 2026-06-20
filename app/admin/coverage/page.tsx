"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import LevelBadge from "@/components/LevelBadge";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  fetchWeeks,
  fetchAllStudents,
  fetchAllScheduleSlots,
  type SlotLite,
} from "@/lib/data";
import { getWeekDays } from "@/lib/builder";
import { formatDayHeader, formatSlotLabel } from "@/lib/format";
import type { Student, Week } from "@/lib/types";

const SLOT_TIMES = ["16:30:00", "17:00:00", "17:30:00"];

export default function CoveragePage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [slots, setSlots] = useState<SlotLite[]>([]);
  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    Promise.all([fetchWeeks(), fetchAllStudents(), fetchAllScheduleSlots()])
      .then(([w, s, sl]) => {
        setWeeks(w);
        setStudents(s.filter((x) => x.active !== false));
        setSlots(sl);
        if (w[0]) setWeek(w[0].week_number);
      })
      .finally(() => setLoading(false));
  }, []);

  const weekObj = weeks.find((w) => w.week_number === week) ?? null;
  const days = useMemo(() => getWeekDays(weekObj), [weekObj]);

  // Per cell: kid count + distinct instructor count.
  const cells = useMemo(() => {
    const m = new Map<string, { kids: number; instr: Set<string> }>();
    for (const s of slots) {
      if (s.week_number !== week) continue;
      const k = `${s.lesson_date}__${s.start_time.slice(0, 5)}`;
      const cur = m.get(k) ?? { kids: 0, instr: new Set<string>() };
      if (s.student_id) cur.kids++;
      if (s.instructor_id) cur.instr.add(s.instructor_id);
      m.set(k, cur);
    }
    return m;
  }, [slots, week]);

  const placedThisWeek = useMemo(() => {
    const set = new Set<string>();
    slots.forEach((s) => {
      if (s.week_number === week && s.student_id) set.add(s.student_id);
    });
    return set;
  }, [slots, week]);

  const placedEver = useMemo(() => {
    const set = new Set<string>();
    slots.forEach((s) => s.student_id && set.add(s.student_id));
    return set;
  }, [slots]);

  const unplacedThisWeek = students.filter((s) => !placedThisWeek.has(s.id));
  const neverPlaced = students.filter((s) => !placedEver.has(s.id));

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/admin" />
        <ConfigNotice />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Nav backHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Coverage</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Spot empty slots, low coverage, and kids who aren&apos;t scheduled.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <label className="text-sm font-semibold">Week:</label>
          <select
            value={week}
            onChange={(e) => setWeek(parseInt(e.target.value, 10))}
            className="rounded-full border-2 border-brand-green bg-white px-4 py-1.5 text-sm font-semibold"
          >
            {weeks.map((w) => (
              <option key={w.week_number} value={w.week_number}>
                {w.label ?? `Week ${w.week_number}`}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="mt-8 text-center text-brand-text/60">Loading…</p>
        ) : (
          <>
            {/* Coverage grid: kids / instructors per slot */}
            <section className="mt-4">
              <h2 className="mb-2 font-display text-2xl text-brand-green">
                Kids · Instructors per slot
              </h2>
              <div className="overflow-x-auto rounded-xl border border-brand-green/15">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr>
                      <th className="w-14 bg-gradient-to-b from-brand-aqualight to-brand-aqua p-2" />
                      {days.map((d) => {
                        const { day, date } = formatDayHeader(d);
                        return (
                          <th key={d} className="border-l border-white/40 bg-gradient-to-b from-brand-aqualight to-brand-aqua p-2 text-center text-sm font-bold text-brand-text">
                            <span className="block uppercase tracking-wide">{day}</span>
                            <span className="block text-xs font-semibold text-brand-text/75">{date}</span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {SLOT_TIMES.map((time, rowIdx) => (
                      <tr key={time} className={rowIdx % 2 ? "bg-brand-cream/60" : "bg-white"}>
                        <th className="border-t border-brand-green/10 p-2 text-center text-sm font-bold text-brand-green">
                          {formatSlotLabel(time)}
                        </th>
                        {days.map((d) => {
                          const c = cells.get(`${d}__${time.slice(0, 5)}`);
                          const kids = c?.kids ?? 0;
                          const instr = c?.instr.size ?? 0;
                          const empty = kids === 0;
                          return (
                            <td key={d} className={`border-l border-t border-brand-green/10 p-2 text-center text-sm ${empty ? "bg-gray-50 text-brand-text/40" : "font-semibold text-brand-text"}`}>
                              {empty ? "—" : `${kids} · ${instr}`}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs text-brand-text/50">Each cell shows kids · instructors working that slot.</p>
            </section>

            <CoverList
              title={`Not scheduled in Week ${week}`}
              subtitle="Active kids with no lesson this week."
              students={unplacedThisWeek}
              tone="orange"
            />
            <CoverList
              title="Never scheduled all summer"
              subtitle="Active kids with no lesson in any week — likely need placing."
              students={neverPlaced}
              tone="red"
            />
          </>
        )}
      </div>
    </main>
  );
}

function CoverList({
  title, subtitle, students, tone,
}: {
  title: string;
  subtitle: string;
  students: Student[];
  tone: "orange" | "red";
}) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-2xl text-brand-green">
        {title}{" "}
        <span className={tone === "red" ? "text-brand-orange" : "text-brand-text/60"}>
          ({students.length})
        </span>
      </h2>
      <p className="text-sm text-brand-text/70">{subtitle}</p>
      {students.length === 0 ? (
        <p className="mt-2 text-sm text-brand-text/50">None 🎉</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {students.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm ring-1 ring-brand-green/20">
              {s.first_name} {s.last_name}
              <LevelBadge level={s.level} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
