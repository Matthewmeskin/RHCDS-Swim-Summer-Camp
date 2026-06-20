"use client";

import type { Student, InstructorAvailability } from "@/lib/types";
import type { SlotWithStudent } from "@/lib/data";
import { formatDayHeader, formatSlotLabel } from "@/lib/format";

const SLOT_TIMES = ["16:30:00", "17:00:00", "17:30:00"];

export interface CellPill {
  key: string;
  label: string;
  student: Student | null;
}

function key(date: string, time: string) {
  return `${date}__${time.slice(0, 5)}`;
}

export default function CalendarGrid({
  days,
  slots,
  availability,
  onSelectStudent,
}: {
  days: string[]; // ISO dates
  slots: SlotWithStudent[];
  availability: InstructorAvailability[];
  onSelectStudent: (s: Student) => void;
}) {
  // Group lesson slots by date+time.
  const lessonMap = new Map<string, CellPill[]>();
  for (const s of slots) {
    const k = key(s.lesson_date, s.start_time);
    const arr = lessonMap.get(k) ?? [];
    const label = s.students
      ? `${s.students.first_name} ${s.students.last_name}`
      : s.student_name_raw ?? "Unknown";
    arr.push({ key: s.id, label, student: s.students });
    lessonMap.set(k, arr);
  }

  // Set of unavailable date+time keys.
  const offSet = new Set<string>();
  for (const a of availability) {
    if (!a.is_available) offSet.add(key(a.lesson_date, a.start_time));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            <th className="w-16 border border-brand-green bg-brand-aqua p-2 text-xs font-bold text-brand-text" />
            {days.map((d) => {
              const { day, date } = formatDayHeader(d);
              return (
                <th
                  key={d}
                  className="border border-brand-green bg-brand-aqua p-2 text-center text-sm font-bold text-brand-text"
                >
                  <span className="block">{day}</span>
                  <span className="block text-xs font-semibold">{date}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {SLOT_TIMES.map((time, rowIdx) => (
            <tr key={time} className={rowIdx % 2 === 0 ? "bg-white" : "bg-brand-cream"}>
              <th className="border border-brand-green p-2 text-center align-middle text-sm font-bold text-brand-green">
                {formatSlotLabel(time)}
              </th>
              {days.map((d) => {
                const k = key(d, time);
                const pills = lessonMap.get(k);
                const isOff = offSet.has(k);

                return (
                  <td
                    key={k}
                    className={`border border-brand-green p-1.5 align-top ${
                      isOff && !pills ? "bg-gray-100" : ""
                    }`}
                  >
                    {pills && pills.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {pills.map((p) =>
                          p.student ? (
                            <button
                              key={p.key}
                              onClick={() => onSelectStudent(p.student as Student)}
                              className="rounded-full bg-brand-green px-2 py-1 text-left text-xs font-semibold text-white hover:brightness-110"
                            >
                              {p.label}
                            </button>
                          ) : (
                            <span
                              key={p.key}
                              title="No matching student record"
                              className="rounded-full bg-brand-orange px-2 py-1 text-left text-xs font-semibold text-white"
                            >
                              {p.label}
                            </span>
                          )
                        )}
                      </div>
                    ) : isOff ? (
                      <span className="block text-center text-xs font-semibold text-gray-400">
                        Off
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
