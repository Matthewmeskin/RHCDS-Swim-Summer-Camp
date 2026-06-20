"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import Dropzone from "@/components/Dropzone";
import Toast, { type ToastKind } from "@/components/Toast";
import LevelBadge from "@/components/LevelBadge";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { parseStudents, type ParsedStudent } from "@/lib/parseStudents";
import { importStudents } from "@/lib/importActions";

export default function StudentImportPage() {
  const [parsed, setParsed] = useState<ParsedStudent[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const result = parseStudents(text);
      setParsed(result.students);
      setWarnings(result.warnings);
      setToast(null);
    };
    reader.readAsText(file);
  }

  async function confirm() {
    setImporting(true);
    try {
      const res = await importStudents(parsed);
      setToast({
        msg: `${res.inserted} students imported · ${res.updated} updated · ${res.errors} errors`,
        kind: res.errors > 0 ? "error" : "success",
      });
      if (res.errors === 0) setParsed([]);
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

  const specialCount = parsed.filter((s) => s.special_needs).length;

  return (
    <main className="min-h-screen">
      <Nav backHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Import Students</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          CampSite export columns: Last name, First name, Gender, Age, Level, Goals
          for Lessons.
        </p>

        <div className="mt-6">
          <Dropzone onFile={handleFile} hint="Drag & drop students.csv, or tap to choose" />
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

        {parsed.length > 0 ? (
          <section className="mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl text-brand-green">
                Preview ({parsed.length} students)
              </h2>
              {specialCount > 0 ? (
                <span className="text-sm font-semibold text-brand-amber">
                  ⚠️ {specialCount} auto-flagged special needs
                </span>
              ) : null}
            </div>
            <p className="text-xs text-brand-text/60">Showing first 5 rows.</p>

            <div className="mt-2 overflow-x-auto rounded-2xl border-2 border-brand-green">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-brand-aqua text-brand-text">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Age</th>
                    <th className="p-2 text-left">Level</th>
                    <th className="p-2 text-left">Special</th>
                    <th className="p-2 text-left">Goals</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 5).map((s, i) => (
                    <tr key={i} className={i % 2 ? "bg-brand-cream" : "bg-white"}>
                      <td className="p-2 font-semibold">
                        {s.first_name} {s.last_name}
                      </td>
                      <td className="p-2">{s.age ?? "—"}</td>
                      <td className="p-2">
                        <LevelBadge level={s.level} />
                      </td>
                      <td className="p-2">{s.special_needs ? "⚠️" : ""}</td>
                      <td className="max-w-xs truncate p-2 text-brand-text/70">
                        {s.goals}
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
              {importing ? "Importing…" : `Confirm import of ${parsed.length} students`}
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
