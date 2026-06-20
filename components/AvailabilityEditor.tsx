"use client";

import { useState } from "react";
import { formatDayHeader, formatSlotLabel } from "@/lib/format";
import { createAvailabilityRequest } from "@/lib/data";

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
  instructorName,
  instructorSlug,
  weekNumber,
  days,
  lessonKeys,
  initialOff,
  onSaved,
  onClose,
}: {
  instructorId: string;
  instructorName?: string;
  instructorSlug?: string | null;
  weekNumber: number;
  days: string[];
  lessonKeys: Set<string>;
  initialOff: Set<string>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [off, setOff] = useState<Set<string>>(new Set(initialOff));
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
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
    if (!email.trim() && !phone.trim()) {
      setError("Please add your email or cell so we can reach you about this request.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const offSlots = Array.from(off).map((key) => {
        const [date, hhmm] = key.split("__");
        return { date, start: `${hhmm}:00` };
      });
      await createAvailabilityRequest({
        instructorId,
        weekNumber,
        offSlots,
        email: email.trim() || null,
        phone: phone.trim() || null,
        note: message.trim() || null,
      });
      // Notify the office of the pending request (via n8n: Slack + email).
      fetch("/api/notify-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "request",
          instructor: instructorName,
          slug: instructorSlug,
          week: weekNumber,
          offCount: off.size,
          email: email.trim() || null,
          phone: phone.trim() || null,
          note: message.trim() || null,
        }),
      }).catch(() => {});
      onSaved();
    } catch (e) {
      setError((e as Error).message ?? "Could not submit request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="camp-card mb-6 p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-2xl text-brand-green">Request an availability change</h2>
        <button onClick={onClose} className="text-sm font-bold text-brand-text/60 hover:text-brand-text">
          Cancel
        </button>
      </div>
      <p className="mb-3 text-sm text-brand-text/70">
        Tap slots to mark yourself <strong>Off</strong> (green = available). This
        is a <strong>request</strong> — the aquatics office reviews it and you&apos;ll
        be notified once it&apos;s approved or denied. Slots where you already have a
        lesson are locked.
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

      {/* Contact + message so the office can follow up */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-green">Your email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-lg border border-brand-green/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
          />
        </label>
        <label className="text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-green">Cell (optional)</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className="mt-1 w-full rounded-lg border border-brand-green/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
          />
        </label>
      </div>
      <label className="mt-2 block text-sm">
        <span className="text-xs font-bold uppercase tracking-wide text-brand-green">Note (optional)</span>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Anything the office should know…"
          className="mt-1 w-full rounded-lg border border-brand-green/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
        />
      </label>

      {error ? <p className="mt-2 text-sm text-brand-orange">{error}</p> : null}

      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={saving} className="camp-btn">
          {saving ? "Sending…" : "Request approval"}
        </button>
        <button onClick={onClose} className="camp-btn-ghost">Cancel</button>
      </div>
    </section>
  );
}
