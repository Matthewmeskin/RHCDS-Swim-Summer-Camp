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
import { groupByLevel } from "@/lib/groups";

export default function RosterImportPage() {
  const [parsed, setParsed] = useState<ParsedStudent[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const [result, setResult] = useState<string[] | null>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseStudents(String(reader.result ?? ""));
      setParsed(res.students);
      setWarnings(res.warnings);
      setResult(null);
      setToast(null);
    };
    reader.readAsText(file);
  }

  async function confirm() {
    setImporting(true);
    try {
      const r = await importStudents(parsed);
      setToast({
        msg: `${r.inserted} added · ${r.updated} updated · ${r.groupsAssigned} grouped · ${r.instructorsMatched} instructor matches`,
        kind: r.errors > 0 ? "error" : "success",
      });
      setResult(
        r.unmatchedInstructors.length
          ? [`Preferred-instructor names not on roster: ${r.unmatchedInstructors.join(", ")}`]
          : []
      );
      if (r.errors === 0) setParsed([]);
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
  const groupedCount = parsed.filter((s) => s.group_level != null).length;

  return (
    <main className="min-h-screen">
      <Nav backHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Import Roster</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          One CSV for everything — students, their swim group, and parent
          preferences. Columns are auto-detected; include whatever you have.
        </p>

        <div className="mt-3 rounded-xl bg-brand-sand/60 p-3 text-xs text-brand-text/80">
          <p className="font-bold text-brand-green">Recognized columns (any subset)</p>
          <ul className="mt-1 list-disc pl-4">
            <li><strong>Name:</strong> “First name” + “Last name”</li>
            <li><strong>Details:</strong> “Gender”, “Age”, “Level”, “Goals”</li>
            <li><strong>Swim group:</strong> “Swim group”, “Group”, or “Swim level” (a number 1–6 or the animal name)</li>
            <li><strong>Preferred instructor:</strong> “Preferred instructor”, “Requested instructor”, “Coach”</li>
            <li><strong>Notes:</strong> “Parent notes”, “Preferences”, “Notes”</li>
          </ul>
        </div>

        <div className="mt-6">
          <Dropzone onFile={handleFile} hint="Drag & drop roster.csv, or tap to choose" />
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
              <h2 className="font-display text-2xl text-brand-green">Preview ({parsed.length})</h2>
              <span className="text-sm font-semibold text-brand-text/70">
                {groupedCount} grouped
                {specialCount > 0 ? ` · ⚠️ ${specialCount} special needs` : ""}
              </span>
            </div>
            <p className="text-xs text-brand-text/60">Showing first 6 rows.</p>

            <div className="mt-2 overflow-x-auto rounded-2xl border-2 border-brand-green">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-brand-aqua text-brand-text">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Age</th>
                    <th className="p-2 text-left">Level</th>
                    <th className="p-2 text-left">Group</th>
                    <th className="p-2 text-left">Preferred</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 6).map((s, i) => {
                    const g = groupByLevel(s.group_level);
                    return (
                      <tr key={i} className={i % 2 ? "bg-brand-cream" : "bg-white"}>
                        <td className="p-2 font-semibold">
                          {s.first_name} {s.last_name}{s.special_needs ? " ⚠️" : ""}
                        </td>
                        <td className="p-2">{s.age ?? "—"}</td>
                        <td className="p-2"><LevelBadge level={s.level} /></td>
                        <td className="p-2">
                          {g ? (
                            <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: g.color }}>
                              {g.emoji} {g.name}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-2 text-brand-text/70">{s.preferred_instructor_raw ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button onClick={confirm} disabled={importing} className="camp-btn mt-4 w-full sm:w-auto">
              {importing ? "Importing…" : `Import ${parsed.length} campers`}
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
