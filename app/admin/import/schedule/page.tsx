"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import Dropzone from "@/components/Dropzone";
import Toast, { type ToastKind } from "@/components/Toast";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { parseSchedule, type ParseScheduleResult } from "@/lib/parseSchedule";
import { formatDayHeader, formatSlotLabel } from "@/lib/format";
import { ensureWeek, importSchedule } from "@/lib/importActions";

const WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function ScheduleImportPage() {
  const [week, setWeek] = useState(1);
  const [year, setYear] = useState(2025);
  const [parsed, setParsed] = useState<ParseScheduleResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setParsed(parseSchedule(text, year));
      setToast(null);
    };
    reader.readAsText(file);
  }

  async function confirm() {
    if (!parsed) return;
    setImporting(true);
    try {
      await ensureWeek(week, year);
      const res = await importSchedule(week, parsed);
      setToast({
        msg: `${res.slotsInserted} slots imported · ${res.unavailableInserted} unavailable slots recorded · ${res.warnings.length} warnings`,
        kind: res.warnings.length > 0 ? "error" : "success",
      });
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Import failed", kind: "error" });
    } finally {
      setImporting(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/admin" />
        <ConfigNotice />
      </main>
    );
  }

  // Flatten lessons into one preview row per student.
  const previewRows =
    parsed?.lessons.flatMap((l) =>
      l.studentNames.map((name) => ({
        instructor: l.instructorName,
        date: l.lessonDate,
        time: l.startTime,
        student: name,
      }))
    ) ?? [];

  return (
    <main className="min-h-screen">
      <Nav backHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Import Schedule</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Google Sheets grid export. Pick the week, then drop the CSV. Existing
          slots for that week are replaced.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            Week:
            <select
              value={week}
              onChange={(e) => setWeek(parseInt(e.target.value, 10))}
              className="rounded-full border-2 border-brand-green bg-white px-4 py-1.5"
            >
              {WEEK_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            Year:
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
              className="w-24 rounded-full border-2 border-brand-green bg-white px-4 py-1.5"
            />
          </label>
        </div>

        <div className="mt-6">
          <Dropzone onFile={handleFile} hint="Drag & drop schedule.csv, or tap to choose" />
        </div>

        {parsed ? (
          <section className="mt-6">
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
              <span>{previewRows.length} lesson slots</span>
              <span>{parsed.unavailable.length} unavailable</span>
              <span>{parsed.instructors.length} instructors</span>
              <span className={parsed.warnings.length ? "text-brand-orange" : ""}>
                {parsed.warnings.length} warnings
              </span>
            </div>

            {parsed.warnings.length > 0 ? (
              <div className="mt-2 rounded-xl bg-brand-sand p-3 text-sm">
                <ul className="ml-4 list-disc">
                  {parsed.warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <h2 className="mt-4 font-display text-2xl text-brand-green">
              Preview parsed slots
            </h2>
            <div className="mt-2 max-h-96 overflow-auto rounded-2xl border-2 border-brand-green">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 bg-brand-aqua text-brand-text">
                  <tr>
                    <th className="p-2 text-left">Instructor</th>
                    <th className="p-2 text-left">Day</th>
                    <th className="p-2 text-left">Time</th>
                    <th className="p-2 text-left">Student</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => {
                    const { day, date } = formatDayHeader(r.date);
                    return (
                      <tr key={i} className={i % 2 ? "bg-brand-cream" : "bg-white"}>
                        <td className="p-2">{r.instructor}</td>
                        <td className="p-2">
                          {day} {date}
                        </td>
                        <td className="p-2">{formatSlotLabel(r.time)}</td>
                        <td className="p-2 font-semibold">{r.student}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              onClick={confirm}
              disabled={importing || previewRows.length === 0}
              className="camp-btn mt-4 w-full sm:w-auto"
            >
              {importing
                ? "Importing…"
                : `Confirm import to Week ${week} (${year})`}
            </button>
          </section>
        ) : null}
      </div>

      {toast ? (
        <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />
      ) : null}
    </main>
  );
}
