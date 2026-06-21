"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import Dropzone from "@/components/Dropzone";
import Toast, { type ToastKind } from "@/components/Toast";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { parseLevels, type ParsedLevel } from "@/lib/parseLevels";
import { importLevels } from "@/lib/importActions";
import { groupByLevel } from "@/lib/groups";

export default function LevelsImportPage() {
  const [rows, setRows] = useState<ParsedLevel[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const [result, setResult] = useState<string[] | null>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseLevels(String(reader.result ?? ""));
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
      const r = await importLevels(rows);
      setToast({
        msg: `${r.updated} kids assigned · ${r.unmatchedStudents.length} unmatched`,
        kind: r.unmatchedStudents.length > 0 ? "error" : "success",
      });
      setResult(
        r.unmatchedStudents.length ? [`Unmatched kids: ${r.unmatchedStudents.join(", ")}`] : []
      );
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
        <h1 className="font-display text-4xl text-brand-green">Import Swim Groups</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Assign each camper to a swim group (1–6) in bulk. Columns are
          auto-detected — include a name plus a group column.
        </p>

        <div className="mt-3 rounded-xl bg-brand-sand/60 p-3 text-xs text-brand-text/80">
          <p className="font-bold text-brand-green">Recognized columns (any subset)</p>
          <ul className="mt-1 list-disc pl-4">
            <li><strong>Name:</strong> “First name” + “Last name”, or a single “Name”/“Student”/“Child” column</li>
            <li><strong>Group:</strong> “Swim group”, “Group”, “Group level”, “Swim level”, or “Level”</li>
          </ul>
          <p className="mt-1">
            Group values can be a number <strong>1–6</strong>, “Level 3”/“L3”, or the
            animal name: 🐙 Octopus · 🐠 Clownfish · 🐟 Stingrays · 🐢 Sea Turtles ·
            🐬 Dolphins · 🦈 Sharks.
          </p>
        </div>

        <div className="mt-6">
          <Dropzone onFile={handleFile} hint="Drag & drop groups.csv, or tap to choose" />
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
            <h2 className="font-display text-2xl text-brand-green">Preview ({rows.length} rows)</h2>
            <p className="text-xs text-brand-text/60">Showing first 8 rows.</p>
            <div className="mt-2 overflow-x-auto rounded-2xl border-2 border-brand-green">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-brand-aqua text-brand-text">
                  <tr>
                    <th className="p-2 text-left">Student</th>
                    <th className="p-2 text-left">Swim group</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((r, i) => {
                    const g = groupByLevel(r.group_level);
                    return (
                      <tr key={i} className={i % 2 ? "bg-brand-cream" : "bg-white"}>
                        <td className="p-2 font-semibold">{r.first_name} {r.last_name}</td>
                        <td className="p-2">
                          {g ? (
                            <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: g.color }}>
                              {g.emoji} Level {g.level}: {g.name}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button onClick={confirm} disabled={importing} className="camp-btn mt-4 w-full sm:w-auto">
              {importing ? "Importing…" : `Assign groups to ${rows.length} kids`}
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

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} /> : null}
    </main>
  );
}
