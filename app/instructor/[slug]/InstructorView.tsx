"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Nav from "@/components/Nav";
import LevelBadge from "@/components/LevelBadge";
import CalendarGrid from "@/components/CalendarGrid";
import StudentModal from "@/components/StudentModal";
import AvailabilityEditor from "@/components/AvailabilityEditor";
import ConfigNotice from "@/components/ConfigNotice";
import { fireConfetti } from "@/lib/confetti";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  fetchInstructorWeek,
  fetchWeeks,
  type InstructorWeekData,
} from "@/lib/data";
import type { Student, Week } from "@/lib/types";
import { parseISODate, formatDayHeader } from "@/lib/format";
import { groupByLevel } from "@/lib/groups";
import { buildWeekIcs, downloadIcs, type CalendarLesson } from "@/lib/icsExport";

function weekDays(data: InstructorWeekData): string[] {
  // Prefer the week's start..end range; fall back to dates present in data.
  if (data.week?.start_date && data.week?.end_date) {
    const out: string[] = [];
    const start = parseISODate(data.week.start_date);
    const end = parseISODate(data.week.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      out.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`
      );
    }
    return out;
  }
  const set = new Set<string>();
  data.slots.forEach((s) => set.add(s.lesson_date));
  data.availability.forEach((a) => set.add(a.lesson_date));
  return Array.from(set).sort();
}

export default function InstructorView() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const isPrint = searchParams.get("print") === "true";
  const weekParam = searchParams.get("week");

  const [weeks, setWeeks] = useState<Week[]>([]);
  const [weekNumber, setWeekNumber] = useState<number | null>(
    weekParam ? parseInt(weekParam, 10) : null
  );
  const [data, setData] = useState<InstructorWeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [editingAvail, setEditingAvail] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    fetchWeeks().then(setWeeks).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    fetchInstructorWeek(slug, weekNumber)
      .then((res) => {
        if (!res) {
          setNotFound(true);
          return;
        }
        setData(res);
        if (weekNumber == null && res.week) setWeekNumber(res.week.week_number);
      })
      .catch((e) => setError(e.message ?? "Could not load schedule"))
      .finally(() => setLoading(false));
  }, [slug, weekNumber, refreshTick]);

  // Deduplicated list of students this week.
  const myStudents = useMemo<Student[]>(() => {
    if (!data) return [];
    const map = new Map<string, Student>();
    for (const s of data.slots) {
      if (s.students) map.set(s.students.id, s.students);
    }
    return Array.from(map.values()).sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
    );
  }, [data]);

  // Days this instructor is lifeguarding (3:30–4:30pm), sorted.
  const dutyDays = useMemo(() => {
    const set = new Set<string>();
    data?.duties.forEach((d) => set.add(d.lesson_date));
    return Array.from(set).sort();
  }, [data]);

  // Slots that already have a lesson (locked in the availability editor).
  const lessonKeys = useMemo(() => {
    const set = new Set<string>();
    data?.slots.forEach((s) =>
      set.add(`${s.lesson_date}__${s.start_time.slice(0, 5)}`)
    );
    return set;
  }, [data]);

  // Slots the instructor is currently marked off.
  const initialOff = useMemo(() => {
    const set = new Set<string>();
    data?.availability.forEach((a) => {
      if (!a.is_available) set.add(`${a.lesson_date}__${a.start_time.slice(0, 5)}`);
    });
    return set;
  }, [data]);

  const handleExport = useCallback(() => {
    if (!data) return;
    // Group sibling pairs sharing a date+time into one event.
    const byKey = new Map<string, CalendarLesson>();
    for (const s of data.slots) {
      const k = `${s.lesson_date}__${s.start_time}`;
      const name = s.students
        ? `${s.students.first_name} ${s.students.last_name}`
        : s.student_name_raw ?? "Swim lesson";
      const existing = byKey.get(k);
      if (existing) {
        existing.studentNames.push(name);
      } else {
        byKey.set(k, {
          studentNames: [name],
          level: s.students?.level ?? null,
          goals: s.students?.goals ?? null,
          lessonDate: s.lesson_date,
          startTime: s.start_time,
          endTime: s.end_time,
        });
      }
    }
    try {
      const ics = buildWeekIcs(data.instructor.name, Array.from(byKey.values()));
      downloadIcs(`${slug}-swim-week.ics`, ics);
    } catch (e) {
      setError((e as Error).message ?? "Could not build calendar");
    }
  }, [data, slug]);

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/" />
        <ConfigNotice />
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/" />
        <div className="mx-auto max-w-4xl px-4 py-6">
          {/* header */}
          <div className="mb-4">
            <div className="h-9 w-56 animate-pulse rounded-lg bg-brand-sand/70" />
            <div className="mt-2 h-5 w-24 animate-pulse rounded-full bg-brand-sand/60" />
          </div>
          {/* week selector */}
          <div className="mb-4 flex items-center gap-2">
            <div className="h-5 w-12 animate-pulse rounded bg-brand-sand/50" />
            <div className="h-9 w-52 animate-pulse rounded-full bg-brand-sand/60" />
          </div>
          {/* students card */}
          <div className="camp-card mb-6 p-4">
            <div className="mb-3 h-7 w-52 animate-pulse rounded bg-brand-sand/70" />
            <div className="flex flex-wrap gap-2">
              {["w-28", "w-20", "w-32", "w-24"].map((w, i) => (
                <div key={i} className={`h-8 ${w} animate-pulse rounded-full bg-brand-sand/50`} />
              ))}
            </div>
          </div>
          {/* grid */}
          <div className="overflow-hidden rounded-xl border border-brand-green/15">
            <div className="h-10 animate-pulse bg-brand-aqua/40" />
            {[0, 1, 2].map((r) => (
              <div key={r} className="h-12 animate-pulse border-t border-brand-green/10 bg-white/50" />
            ))}
          </div>
          <span className="sr-only">Loading schedule…</span>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/" />
        <div className="camp-card mx-auto mt-8 max-w-md p-6 text-center">
          <p className="text-brand-text">
            We couldn&apos;t find that instructor. Head back and pick your name.
          </p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/" />
        <p className="p-8 text-center text-brand-orange">{error}</p>
      </main>
    );
  }

  const days = weekDays(data);
  const isGuard = data.instructor.role === "guard";
  const hasLessons = data.slots.length > 0;

  return (
    <main className={`min-h-screen ${isPrint ? "p-6" : ""}`}>
      {!isPrint ? <Nav backHref="/" /> : null}

      <div className="mx-auto max-w-4xl px-4 py-6 print:px-0">
        {/* Print header with logo */}
        {isPrint ? (
          <div className="mb-4 flex items-center gap-3">
            <Image src="/camp-logo.png" alt="Country Day Camp" width={48} height={48} />
            <span className="font-display text-2xl">Country Day Camp · Swim Portal</span>
          </div>
        ) : null}

        <header className="mb-4">
          <h1 className="font-display text-4xl text-brand-green">
            {data.instructor.name}
          </h1>
          <span className="mt-1 inline-block rounded-full bg-brand-sand px-3 py-0.5 text-xs font-bold capitalize text-brand-text">
            {data.instructor.role}
          </span>
        </header>

        {/* Week selector */}
        {!isPrint && weeks.length > 0 ? (
          <div className="no-print mb-4 flex items-center gap-2">
            <label htmlFor="week" className="text-sm font-semibold text-brand-text">
              Week:
            </label>
            <select
              id="week"
              value={weekNumber ?? ""}
              onChange={(e) => setWeekNumber(parseInt(e.target.value, 10))}
              className="rounded-full border-2 border-brand-green bg-white px-4 py-1.5 text-sm font-semibold"
            >
              {weeks.map((w) => (
                <option key={w.week_number} value={w.week_number}>
                  {w.label ?? `Week ${w.week_number}`}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {data.week && data.week.schedule_published === false ? (
          <div className="camp-card mb-6 border-l-4 border-brand-orange p-4">
            <p className="font-display text-xl text-brand-green">📅 Schedule coming soon</p>
            <p className="mt-1 text-sm text-brand-text/70">
              This week&apos;s lesson schedule hasn&apos;t been posted yet. You can still set your
              availability below — we&apos;ll let you know when your schedule is ready.
            </p>
          </div>
        ) : isGuard ? (
          <div className="camp-card mb-6 p-4">
            <p className="text-sm font-semibold text-brand-text">
              Guards do not have assigned lesson slots this week.
            </p>
          </div>
        ) : (
          <section className="camp-card mb-6 p-4">
            <h2 className="mb-3 font-display text-2xl text-brand-green">
              My Students This Week
            </h2>
            {myStudents.length === 0 ? (
              <p className="text-sm text-brand-text/60">
                No students assigned this week.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {myStudents.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelected(s)}
                      className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-brand-text shadow-sm ring-1 ring-brand-green/20 hover:ring-brand-green"
                    >
                      {(() => {
                        const grp = groupByLevel(s.group_level);
                        return grp ? (
                          <span title={grp.name} className="text-base leading-none">{grp.emoji}</span>
                        ) : null;
                      })()}
                      {s.first_name} {s.last_name}
                      <LevelBadge level={s.level} />
                      {s.special_needs ? <span title="Special needs note">⚠️</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {dutyDays.length > 0 ? (
          <section className="camp-card mb-6 border-l-4 border-brand-aqua p-4">
            <h2 className="font-display text-xl text-brand-green">🛟 Lifeguard duty this week</h2>
            <p className="mt-1 text-sm text-brand-text/70">
              You&apos;re on the deck lifeguarding swim camp <strong>3:30–4:30pm</strong> (before lessons) on:
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {dutyDays.map((d) => {
                const { day, date } = formatDayHeader(d);
                return (
                  <li key={d} className="rounded-full bg-brand-aqua/20 px-3 py-1 text-sm font-bold text-brand-text">
                    {day} {date}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="camp-card mb-6 p-3 sm:p-4">
          <CalendarGrid
            days={days}
            slots={data.slots}
            availability={data.availability}
            onSelectStudent={setSelected}
          />
        </section>

        {!isPrint && editingAvail && data.week ? (
          <AvailabilityEditor
            instructorId={data.instructor.id}
            instructorName={data.instructor.name}
            instructorSlug={data.instructor.slug}
            weekNumber={data.week.week_number}
            days={days}
            lessonKeys={lessonKeys}
            initialOff={initialOff}
            onClose={() => setEditingAvail(false)}
            onSaved={() => {
              setEditingAvail(false);
              setRequestSent(true);
              fireConfetti();
            }}
          />
        ) : null}

        {!isPrint && requestSent ? (
          <div className="no-print mb-3 rounded-xl border border-brand-green/20 bg-brand-green/10 px-4 py-2 text-sm font-semibold text-brand-green">
            ✓ Request submitted — the office will review it and you&apos;ll be notified once it&apos;s approved or denied.
          </div>
        ) : null}

        {!isPrint ? (
          <div className="no-print flex flex-col gap-2 sm:flex-row">
            {!editingAvail && data.week ? (
              <button
                onClick={() => { setEditingAvail(true); setRequestSent(false); }}
                className="camp-btn-ghost w-full sm:w-auto"
              >
                🗓️ Request availability change
              </button>
            ) : null}
            <a href="/levels" className="camp-btn-ghost w-full text-center sm:w-auto">
              📘 Swim level guide
            </a>
            {isGuard ? false : hasLessons ? (
              <button onClick={handleExport} className="camp-btn w-full sm:flex-1">
                📅 Export My Week to Calendar
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <StudentModal
        student={selected}
        onClose={() => setSelected(null)}
        onSaved={(u) => setSelected(u)}
      />
    </main>
  );
}
