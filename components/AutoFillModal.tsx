"use client";

import { useState } from "react";
import type { AutoConfig } from "@/lib/autoSchedule";

/** Auto-fill options dialog (shared by the schedule editor). */
export default function AutoFillModal({
  weeks,
  hasEnrollment,
  onClose,
  onRun,
}: {
  weeks: { week_number: number; label: string | null }[];
  hasEnrollment: boolean;
  onClose: () => void;
  onRun: (opts: {
    scope: "current" | "all";
    config: AutoConfig;
    targetWeek: number;
    useEnrollment: boolean;
  }) => void;
}) {
  const [scope, setScope] = useState<"current" | "all">("all");
  const [targetWeek, setTargetWeek] = useState(weeks[0]?.week_number ?? 1);
  const [lessonsPerKid, setLessonsPerKid] = useState(1);
  const [maxPerSlot, setMaxPerSlot] = useState(2);
  const [mode, setMode] = useState<"fill" | "rebuild">("fill");
  const [useEnrollment, setUseEnrollment] = useState(hasEnrollment);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-t-3xl bg-brand-cream p-5 shadow-2xl sm:rounded-3xl sm:border-2 sm:border-brand-green">
        <h2 className="font-display text-2xl text-brand-green">✨ Auto-fill schedule</h2>
        <p className="mt-1 text-sm text-brand-text/70">
          Generates a draft using availability, parent requests, prior-week consistency, siblings and
          the ratio cap. Review and edit before saving — nothing is saved automatically.
        </p>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-brand-green">Apply to</span>
            <div className="mt-1 flex gap-2">
              <button onClick={() => setScope("current")} className={`flex-1 rounded-full px-3 py-1.5 font-bold ${scope === "current" ? "bg-brand-green text-white" : "bg-brand-sand text-brand-text"}`}>One week</button>
              <button onClick={() => setScope("all")} className={`flex-1 rounded-full px-3 py-1.5 font-bold ${scope === "all" ? "bg-brand-green text-white" : "bg-brand-sand text-brand-text"}`}>All weeks</button>
            </div>
          </div>

          {scope === "current" ? (
            <label className="flex items-center justify-between">
              <span className="font-semibold">Week</span>
              <select value={targetWeek} onChange={(e) => setTargetWeek(parseInt(e.target.value, 10))} className="rounded-full border-2 border-brand-green bg-white px-3 py-1">
                {weeks.map((w) => (
                  <option key={w.week_number} value={w.week_number}>{w.label ?? `Week ${w.week_number}`}</option>
                ))}
              </select>
            </label>
          ) : null}

          {hasEnrollment ? (
            <label className="flex items-center gap-2 rounded-xl bg-brand-sand/60 px-3 py-2 font-semibold">
              <input type="checkbox" checked={useEnrollment} onChange={(e) => setUseEnrollment(e.target.checked)} />
              Use enrollment (only enrolled kids, their lesson counts)
            </label>
          ) : null}

          <label className={`flex items-center justify-between ${useEnrollment ? "opacity-40" : ""}`}>
            <span className="font-semibold">Lessons per kid {useEnrollment ? "(from enrollment)" : ""}</span>
            <input type="number" min={1} max={5} disabled={useEnrollment} value={lessonsPerKid} onChange={(e) => setLessonsPerKid(parseInt(e.target.value, 10) || 1)} className="w-20 rounded-full border-2 border-brand-green bg-white px-3 py-1 disabled:bg-gray-100" />
          </label>
          <label className="flex items-center justify-between">
            <span className="font-semibold">Max kids per slot</span>
            <input type="number" min={1} max={6} value={maxPerSlot} onChange={(e) => setMaxPerSlot(parseInt(e.target.value, 10) || 1)} className="w-20 rounded-full border-2 border-brand-green bg-white px-3 py-1" />
          </label>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-brand-green">Mode</span>
            <div className="mt-1 flex gap-2">
              <button onClick={() => setMode("fill")} className={`flex-1 rounded-full px-3 py-1.5 font-bold ${mode === "fill" ? "bg-brand-green text-white" : "bg-brand-sand text-brand-text"}`}>Fill gaps</button>
              <button onClick={() => setMode("rebuild")} className={`flex-1 rounded-full px-3 py-1.5 font-bold ${mode === "rebuild" ? "bg-brand-orange text-white" : "bg-brand-sand text-brand-text"}`}>Rebuild</button>
            </div>
            <p className="mt-1 text-xs text-brand-text/60">
              {mode === "fill" ? "Keeps current lessons, only adds kids who need slots." : "Clears the chosen week(s) and re-assigns everyone."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={() => onRun({ scope, config: { lessonsPerKid, maxPerSlot, mode }, targetWeek, useEnrollment })} className="camp-btn flex-1">
            Generate draft
          </button>
          <button onClick={onClose} className="camp-btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}
