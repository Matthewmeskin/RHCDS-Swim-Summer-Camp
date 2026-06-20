"use client";

import { useState } from "react";
import { formatDayHeader, formatSlotLabel } from "@/lib/format";
import { saveInstructorAvailability } from "@/lib/data";

const SLOT_TIMES = ["16:30:00", "17:00:00", "17:30:00"];

function k(date: string, time: string) {
  return `${date}__${time.slice(0, 5)}`;
}

/**
 * Lets an instructor mark which slots they're OFF for the week, from their own
 * (login-free) link. Slots where they already have a lesson are locked.
 */
export default function AvailabilityEditor({
  instructorId,
  weekNumber,
  days,
  lessonKeys,
  initialOff,
  onSaved,
  onClose,
}: {
  instructorId: string;
  weekNumber: number;
  days: string[];
  lessonKeys: Set<string>;
  initialOff: Set<string>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [off, setOff] = useState<Set<string>>(new Set(initialOff));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const offSlots = Array.from(off).map((key) => {
        const [date, hhmm] = key.split("__");
        return { date, start: `${hhmm}:00` };
      });
      await saveInstructorAvailability(instructorId, weekNumber, offSlots);
      onSaved();
    } catch (e) {
      setError((e as Error).message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="camp-card mb-6 p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-2xl text-brand-green">Update my availability</h2>
        <button onClick={onClose} className="text-sm font-bold text-brand-text/60 hover:text-brand-text">
          Cancel
        </button>
      </div>
      <p className="mb-3 text-sm text-brand-text/70">
        Tap a slot to mark yourself <strong>Off</strong>. Green = available. Slots
        where you already have a lesson are locked.
      </p>

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
                <th className="border-t border-brand-green/10 p-2 text-center align-middle text-sm font-bold text-brand-green">
                  {formatSlotLabel(time)}
                </th>
                {days.map((d) => {
                  const key = k(d, time);
                  const hasLesson = lessonKeys.has(key);
                  const isOff = off.has(key);
                  return (
                    <td key={key} className="border-l border-t border-brand-green/10 p-1.5">
                      {hasLesson ? (
                        <span className="block rounded-lg bg-brand-green/15 px-2 py-2 text-center text-[11px] font-semibold text-brand-green">
                          Lesson
                        </span>
                      ) : (
                        <button
                          onClick={() => toggle(key)}
                          className={`w-full rounded-lg px-2 py-2 text-center text-[11px] font-bold transition ${
                            isOff
                              ? "bg-gray-200 text-gray-500"
                              : "bg-brand-green/15 text-brand-green hover:bg-brand-green/25"
                          }`}
                        >
                          {isOff ? "Off" : "Available"}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? <p className="mt-2 text-sm text-brand-orange">{error}</p> : null}

      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={saving} className="camp-btn">
          {saving ? "Saving…" : "Save availability"}
        </button>
        <button onClick={onClose} className="camp-btn-ghost">Cancel</button>
      </div>
    </section>
  );
}
