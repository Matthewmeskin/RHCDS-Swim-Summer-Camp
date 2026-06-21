"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Nav from "@/components/Nav";
import ConfigNotice from "@/components/ConfigNotice";
import CampLoader from "@/components/CampLoader";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { fetchWeekDeck, fetchDefaultWeekNumber, type DeckLesson } from "@/lib/data";
import { formatDayHeader, formatSlotLabel } from "@/lib/format";
import { groupByLevel } from "@/lib/groups";

const WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function PoolDeckSheetsPage() {
  const [week, setWeek] = useState(1);
  const [lessons, setLessons] = useState<DeckLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [who, setWho] = useState("all");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    fetchDefaultWeekNumber()
      .then((d) => d != null && setWeek(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    fetchWeekDeck(week)
      .then(setLessons)
      .catch(() => setLessons([]))
      .finally(() => setLoading(false));
  }, [week]);

  // Group lessons by instructor, sorted by name.
  const byInstructor = useMemo(() => {
    const m = new Map<string, { name: string; lessons: DeckLesson[] }>();
    for (const l of lessons) {
      if (!l.instructorId) continue;
      if (!m.has(l.instructorId)) m.set(l.instructorId, { name: l.instructorName, lessons: [] });
      m.get(l.instructorId)!.lessons.push(l);
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [lessons]);

  const sheets = who === "all" ? byInstructor : byInstructor.filter((s) => s.id === who);

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
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Controls — hidden when printing */}
        <div className="no-print">
          <h1 className="font-display text-4xl text-brand-green">Pool-Deck Sheets</h1>
          <p className="mt-1 text-sm text-brand-text/70">
            A clean, laminate-ready lesson sheet for each instructor to carry on deck. Pick a week,
            then print — choose <strong>Save as PDF</strong> to email instead.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Week:
              <select
                value={week}
                onChange={(e) => setWeek(parseInt(e.target.value, 10))}
                className="rounded-full border-2 border-brand-green bg-white px-4 py-1.5"
              >
                {WEEK_OPTIONS.map((w) => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              Instructor:
              <select
                value={who}
                onChange={(e) => setWho(e.target.value)}
                className="rounded-full border-2 border-brand-green bg-white px-4 py-1.5"
              >
                <option value="all">Everyone</option>
                {byInstructor.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <button
              onClick={() => window.print()}
              disabled={sheets.length === 0}
              className="camp-btn ml-auto px-5 py-1.5 text-sm disabled:opacity-40"
            >
              🖨️ Print {who === "all" ? "all sheets" : "sheet"}
            </button>
          </div>
        </div>

        {loading ? (
          <CampLoader />
        ) : sheets.length === 0 ? (
          <p className="mt-10 text-center text-brand-text/60">
            No lessons scheduled for Week {week} yet.
          </p>
        ) : (
          sheets.map((s) => <InstructorSheet key={s.id} name={s.name} lessons={s.lessons} week={week} />)
        )}
      </div>
    </main>
  );
}

function InstructorSheet({
  name,
  lessons,
  week,
}: {
  name: string;
  lessons: DeckLesson[];
  week: number;
}) {
  // Group by day, then by start time.
  const days = useMemo(() => {
    const byDate = new Map<string, Map<string, DeckLesson[]>>();
    for (const l of lessons) {
      if (!byDate.has(l.date)) byDate.set(l.date, new Map());
      const times = byDate.get(l.date)!;
      if (!times.has(l.start)) times.set(l.start, []);
      times.get(l.start)!.push(l);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, times]) => ({
        date,
        slots: Array.from(times.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      }));
  }, [lessons]);

  return (
    <section className="print-sheet camp-card mt-6 p-6">
      <header className="flex items-center gap-3 border-b-2 border-brand-green/25 pb-3">
        <Image src="/camp-logo.png" alt="" width={44} height={44} className="rounded-full" />
        <div>
          <h2 className="font-display text-3xl leading-none text-brand-green">{name}</h2>
          <p className="mt-1 text-sm font-semibold text-brand-text/60">
            Week {week} · Pool-deck schedule
          </p>
        </div>
        <span className="ml-auto text-xs font-semibold text-brand-text/50">
          {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {days.map(({ date, slots }) => {
          const { day, date: dlabel } = formatDayHeader(date);
          return (
            <div key={date} className="break-inside-avoid rounded-xl border border-brand-green/15 p-3">
              <h3 className="font-display text-xl text-brand-green">
                {day} <span className="text-sm font-normal text-brand-text/50">{dlabel}</span>
              </h3>
              <ul className="mt-2 space-y-1.5">
                {slots.map(([time, kids]) => (
                  <li key={time} className="flex gap-2 text-sm">
                    <span className="w-12 shrink-0 font-bold text-brand-text">{formatSlotLabel(time)}</span>
                    <span className="flex-1 space-y-0.5">
                      {kids.map((k, i) => {
                        const g = groupByLevel(k.groupLevel);
                        return (
                          <span key={i} className="block">
                            {g ? <span title={g.name}>{g.emoji} </span> : null}
                            <span className="font-semibold text-brand-text">{k.studentName}</span>
                            {k.age != null ? <span className="text-brand-text/50"> · {k.age}</span> : null}
                            {k.special ? <span title="Needs extra support"> ⭐</span> : null}
                          </span>
                        );
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-brand-text/40">⭐ = needs extra support · numbers = camper age</p>
    </section>
  );
}
