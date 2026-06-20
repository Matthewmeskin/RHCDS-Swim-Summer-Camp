"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import Dropzone from "@/components/Dropzone";
import Toast, { type ToastKind } from "@/components/Toast";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { parseEnrollment, type ParsedEnrollment } from "@/lib/parseEnrollment";
import { importEnrollment } from "@/lib/importActions";

export default function EnrollmentImportPage() {
  const [rows, setRows] = useState<ParsedEnrollment[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseEnrollment(String(reader.result ?? ""));
      setRows(res.rows);
      setWarnings(res.warnings);
      setUnmatched([]);
      setToast(null);
    };
    reader.readAsText(file);
  }

  async function confirm() {
    setImporting(true);
    try {
      const r = await importEnrollment(rows);
      setToast({
        msg: `${r.studentsMatched} kids enrolled · ${r.rowsWritten} week-rows · ${r.unmatchedStudents.length} unmatched`,
        kind: r.unmatchedStudents.length ? "error" : "success",
      });
      setUnmatched(r.unmatchedStudents);
      if (r.unmatchedStudents.length === 0) setRows([]);
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

  return (
    <main className="min-h-screen">
      <Nav backHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Import Enrollment</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Tells Auto-fill who attends each week and how many lessons. Columns are
          auto-detected.
        </p>

        <div className="mt-3 rounded-xl bg-brand-sand/60 p-3 text-xs text-brand-text/80">
          <p className="font-bold text-brand-green">Recognized columns (any subset)</p>
          <ul className="mt-1 list-disc pl-4">
            <li><strong>Name:</strong> “First name” + “Last name”, or a single “Name”/“Student”</li>
            <li><strong>Week:</strong> “Week”/“Session” (1–8, or “Week 3”). Omit to enroll in every week.</li>
            <li><strong>Lessons:</strong> “Lessons”/“Sessions”/“Days” per week (defaults to 1)</li>
          </ul>
        </div>

        <div className="mt-6">
          <Dropzone onFile={handleFile} hint="Drag & drop enrollment.csv, or tap to choose" />
        </div>

        {warnings.length > 0 ? (
          <div className="mt-4 rounded-xl bg-brand-sand p-3 text-sm">
            <p className="font-bold text-brand-orange">Parse warnings</p>
            <ul className="ml-4 list-disc">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <section className="mt-6">
            <h2 className="font-display text-2xl text-brand-green">Preview ({rows.length} rows)</h2>
            <p className="text-xs text-brand-text/60">Showing first 5 rows. “All” = every week.</p>
            <div className="mt-2 overflow-x-auto rounded-2xl border-2 border-brand-green">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-brand-aqua text-brand-text">
                  <tr>
                    <th className="p-2 text-left">Student</th>
                    <th className="p-2 text-left">Week</th>
                    <th className="p-2 text-left">Lessons</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-brand-cream" : "bg-white"}>
                      <td className="p-2 font-semibold">{r.first_name} {r.last_name}</td>
                      <td className="p-2">{r.week ?? "All"}</td>
                      <td className="p-2">{r.lessons}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={confirm} disabled={importing} className="camp-btn mt-4 w-full sm:w-auto">
              {importing ? "Importing…" : `Import enrollment (${rows.length} rows)`}
            </button>
          </section>
        ) : null}

        {unmatched.length > 0 ? (
          <div className="mt-4 rounded-xl bg-brand-amber/15 p-3 text-sm text-brand-text">
            <p className="font-bold">Unmatched kids (not enrolled):</p>
            <p>{unmatched.join(", ")}</p>
          </div>
        ) : null}
      </div>

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} /> : null}
    </main>
  );
}
