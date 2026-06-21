"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  fetchInstructors,
  fetchWeeks,
  fetchAllScheduleSlots,
  type SlotLite,
} from "@/lib/data";
import { parseISODate } from "@/lib/format";
import type { Instructor, Week } from "@/lib/types";

/** Heatmap tint for a lesson count — denser weeks read darker. */
function cellClass(count: number): string {
  if (count === 0) return "bg-gray-50 text-brand-text/30";
  if (count <= 2) return "bg-brand-green/15 text-brand-green";
  if (count <= 5) return "bg-brand-green/35 text-brand-green";
  if (count <= 9) return "bg-brand-green/60 text-white";
  return "bg-brand-green text-white";
}

function weekShort(w: Week): string {
  const d = parseISODate(w.start_date);
  const mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  return `${mo} ${d.getDate()}`;
}

export default function MasterSchedulePage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [slots, setSlots] = useState<SlotLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    Promise.all([fetchInstructors(), fetchWeeks(), fetchAllScheduleSlots()])
      .then(([ins, w, sl]) => {
        setInstructors(ins);
        setWeeks(w);
        setSlots(sl);
      })
      .finally(() => setLoading(false));
  }, []);

  // counts[`${instructorId}__${weekNumber}`] = number of lessons (kids placed).
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slots) {
      if (!s.instructor_id || s.week_number == null || !s.student_id) continue;
      const k = `${s.instructor_id}__${s.week_number}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [slots]);

  const rowTotal = (id: string) =>
    weeks.reduce((sum, w) => sum + (counts.get(`${id}__${w.week_number}`) ?? 0), 0);
  const colTotal = (wk: number) =>
    instructors.reduce((sum, i) => sum + (counts.get(`${i.id}__${wk}`) ?? 0), 0);
  const grandTotal = useMemo(
    () => Array.from(counts.values()).reduce((a, b) => a + b, 0),
    [counts]
  );

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
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Master Schedule</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Every instructor across all {weeks.length} weeks — the whole summer at a
          glance. Each cell is the number of lessons scheduled that week.
        </p>

        {loading ? (
          <p className="mt-8 text-center text-brand-text/60">Loading…</p>
        ) : (
          <>
            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-brand-text/60">
              <span className="font-semibold">Lessons / week:</span>
              <span className="rounded px-2 py-0.5 bg-gray-50 text-brand-text/40">0</span>
              <span className="rounded px-2 py-0.5 bg-brand-green/15 text-brand-green">1–2</span>
              <span className="rounded px-2 py-0.5 bg-brand-green/35 text-brand-green">3–5</span>
              <span className="rounded px-2 py-0.5 bg-brand-green/60 text-white">6–9</span>
              <span className="rounded px-2 py-0.5 bg-brand-green text-white">10+</span>
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-brand-green/15">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[150px] bg-gradient-to-b from-brand-aqualight to-brand-aqua p-2 text-left text-brand-text">
                      Instructor
                    </th>
                    {weeks.map((w) => (
                      <th
                        key={w.week_number}
                        className="border-l border-white/40 bg-gradient-to-b from-brand-aqualight to-brand-aqua p-2 text-center text-brand-text"
                      >
                        <span className="block font-bold">Wk {w.week_number}</span>
                        <span className="block text-[11px] font-semibold text-brand-text/70">
                          {weekShort(w)}
                        </span>
                      </th>
                    ))}
                    <th className="border-l border-white/40 bg-gradient-to-b from-brand-aqualight to-brand-aqua p-2 text-center font-bold text-brand-text">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {instructors.map((ins, rowIdx) => (
                    <tr key={ins.id} className={rowIdx % 2 ? "bg-brand-cream/40" : "bg-white"}>
                      <th
                        className={`sticky left-0 z-10 border-t border-brand-green/10 p-2 text-left font-semibold text-brand-green ${
                          rowIdx % 2 ? "bg-brand-cream" : "bg-white"
                        }`}
                      >
                        {ins.slug ? (
                          <Link href={`/instructor/${ins.slug}`} className="hover:underline">
                            {ins.name}
                          </Link>
                        ) : (
                          ins.name
                        )}
                      </th>
                      {weeks.map((w) => {
                        const c = counts.get(`${ins.id}__${w.week_number}`) ?? 0;
                        return (
                          <td
                            key={w.week_number}
                            className={`border-l border-t border-brand-green/10 p-2 text-center font-semibold ${cellClass(c)}`}
                          >
                            {c === 0 ? "—" : c}
                          </td>
                        );
                      })}
                      <td className="border-l border-t border-brand-green/10 bg-brand-sand/40 p-2 text-center font-bold text-brand-text">
                        {rowTotal(ins.id)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-brand-aqualight/40">
                    <th className="sticky left-0 z-10 border-t-2 border-brand-green/30 bg-brand-aqualight/80 p-2 text-left font-bold text-brand-text">
                      Total
                    </th>
                    {weeks.map((w) => (
                      <td
                        key={w.week_number}
                        className="border-l border-t-2 border-brand-green/30 p-2 text-center font-bold text-brand-text"
                      >
                        {colTotal(w.week_number)}
                      </td>
                    ))}
                    <td className="border-l border-t-2 border-brand-green/30 bg-brand-green p-2 text-center font-bold text-white">
                      {grandTotal}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="mt-2 text-xs text-brand-text/50">
              Counts are placed lessons (a kid in a slot). Tap an instructor to open
              their week-by-week schedule.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
