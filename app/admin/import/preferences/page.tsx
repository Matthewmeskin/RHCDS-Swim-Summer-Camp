"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import Dropzone from "@/components/Dropzone";
import Toast, { type ToastKind } from "@/components/Toast";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { parsePreferences, type ParsedPreference } from "@/lib/parsePreferences";
import { importPreferences } from "@/lib/importActions";

export default function PreferencesImportPage() {
  const [rows, setRows] = useState<ParsedPreference[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const [result, setResult] = useState<string[] | null>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const res = parsePreferences(String(reader.result ?? ""));
      setRows(res.rows);
      setWarnings(res.warnings);
      setResult(null);
      setToast(null);
    };
    reader.readAsText(file);
  }

  async function confirm() {
    setImporting(true);
    try {
      const r = await importPreferences(rows);
      setToast({
        msg: `${r.updated} kids updated · ${r.matchedInstructors} instructor matches · ${r.unmatchedStudents.length} unmatched`,
        kind: r.unmatchedStudents.length > 0 ? "error" : "success",
      });
      const lines: string[] = [];
      if (r.unmatchedStudents.length)
        lines.push(`Unmatched kids: ${r.unmatchedStudents.join(", ")}`);
      if (r.unmatchedInstructors.length)
        lines.push(
          `Instructor names not on roster (kept as a note): ${r.unmatchedInstructors.join(", ")}`
        );
      setResult(lines);
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
        <h1 className="font-display text-4xl text-brand-green">Import Parent Preferences</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Adds parent notes and a requested instructor to each kid. Columns are
          auto-detected — include a name plus a preference and/or notes column.
        </p>

        <div className="mt-3 rounded-xl bg-brand-sand/60 p-3 text-xs text-brand-text/80">
          <p className="font-bold text-brand-green">Recognized columns (any subset)</p>
          <ul className="mt-1 list-disc pl-4">
            <li><strong>Name:</strong> “First name” + “Last name”, or a single “Name”/“Student”/“Child” column</li>
            <li><strong>Preferred instructor:</strong> “Preferred instructor”, “Instructor preference”, “Requested instructor”, “Coach”</li>
            <li><strong>Notes:</strong> “Parent notes”, “Preferences”, “Notes”, “Comments”</li>
          </ul>
        </div>

        <div className="mt-6">
          <Dropzone onFile={handleFile} hint="Drag & drop preferences.csv, or tap to choose" />
        </div>

        {warnings.length > 0 ? (
          <div className="mt-4 rounded-xl bg-brand-sand p-3 text-sm">
            <p className="font-bold text-brand-orange">Parse warnings</p>
            <ul className="ml-4 list-disc">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <section className="mt-6">
            <h2 className="font-display text-2xl text-brand-green">
              Preview ({rows.length} rows)
            </h2>
            <p className="text-xs text-brand-text/60">Showing first 5 rows.</p>
            <div className="mt-2 overflow-x-auto rounded-2xl border-2 border-brand-green">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-brand-aqua text-brand-text">
                  <tr>
                    <th className="p-2 text-left">Student</th>
                    <th className="p-2 text-left">Preferred instructor</th>
                    <th className="p-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-brand-cream" : "bg-white"}>
                      <td className="p-2 font-semibold">
                        {r.first_name} {r.last_name}
                      </td>
                      <td className="p-2">{r.preferred_instructor_raw ?? "—"}</td>
                      <td className="max-w-xs truncate p-2 text-brand-text/70">
                        {r.parent_notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={confirm}
              disabled={importing}
              className="camp-btn mt-4 w-full sm:w-auto"
            >
              {importing ? "Importing…" : `Apply preferences to ${rows.length} kids`}
            </button>
          </section>
        ) : null}

        {result && result.length > 0 ? (
          <div className="mt-4 rounded-xl bg-brand-amber/15 p-3 text-sm text-brand-text">
            {result.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
        ) : null}
      </div>

      {toast ? (
        <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />
      ) : null}
    </main>
  );
}
