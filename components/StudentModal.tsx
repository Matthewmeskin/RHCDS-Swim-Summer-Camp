"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Student, SwimLevel, Level } from "@/lib/types";
import LevelBadge from "./LevelBadge";
import SpecialNeedsBanner from "./SpecialNeedsBanner";
import { SWIM_GROUPS, groupByLevel } from "@/lib/groups";
import { saveStudent, saveStaffNotes, fetchSwimLevels } from "@/lib/data";

const LEVELS: Level[] = ["Non-Swimmer", "Beginner", "Intermediate", "Advanced"];
const inputCls =
  "w-full rounded-lg border border-brand-green/30 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-aqua";

type Form = {
  first_name: string;
  last_name: string;
  gender: string;
  age: string;
  level: Level | "";
  group_level: number | null;
  goals: string;
  parent_notes: string;
  staff_notes: string;
  special_needs: boolean;
  active: boolean;
};

function toForm(s: Student): Form {
  return {
    first_name: s.first_name ?? "",
    last_name: s.last_name ?? "",
    gender: s.gender ?? "",
    age: s.age != null ? String(s.age) : "",
    level: (s.level as Level | null) ?? "",
    group_level: s.group_level ?? null,
    goals: s.goals ?? "",
    parent_notes: s.parent_notes ?? "",
    staff_notes: s.staff_notes ?? "",
    special_needs: s.special_needs ?? false,
    active: s.active !== false,
  };
}

export default function StudentModal({
  student,
  onClose,
  adminEdit = false,
  onSaved,
}: {
  student: Student | null;
  onClose: () => void;
  /** When true (admin), all swimmer details are editable. Otherwise staff can
   *  view everything but only edit staff notes. */
  adminEdit?: boolean;
  /** Called after a successful save with the updated student (to refresh lists). */
  onSaved?: (updated: Student) => void;
}) {
  const [levels, setLevels] = useState<SwimLevel[]>([]);
  const [f, setF] = useState<Form>(() => (student ? toForm(student) : ({} as Form)));
  const [staffNote, setStaffNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof Form, v: unknown) => {
    setF((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };

  useEffect(() => {
    if (student) {
      setF(toForm(student));
      setStaffNote(student.staff_notes ?? "");
      setSaved(false);
    }
  }, [student]);

  useEffect(() => {
    if (!student) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [student, onClose]);

  useEffect(() => {
    if (levels.length === 0) fetchSwimLevels().then(setLevels).catch(() => {});
  }, [levels.length]);

  if (!student) return null;

  const grp = groupByLevel(adminEdit ? f.group_level : student.group_level);
  const info = levels.find((l) => l.level === (adminEdit ? f.group_level : student.group_level));

  async function saveAll() {
    if (!student) return;
    if (!f.first_name.trim() || !f.last_name.trim()) return;
    setSaving(true);
    try {
      await saveStudent({
        id: student.id,
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        gender: f.gender.trim() || null,
        age: f.age ? parseInt(f.age, 10) : null,
        level: (f.level || null) as Level | null,
        group_level: f.group_level,
        goals: f.goals.trim() || null,
        parent_notes: f.parent_notes.trim() || null,
        staff_notes: f.staff_notes.trim() || null,
        special_needs: f.special_needs,
        active: f.active,
      });
      setSaved(true);
      onSaved?.({
        ...student,
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        gender: f.gender.trim() || null,
        age: f.age ? parseInt(f.age, 10) : null,
        level: (f.level || null) as Level | null,
        group_level: f.group_level,
        goals: f.goals.trim() || null,
        parent_notes: f.parent_notes.trim() || null,
        staff_notes: f.staff_notes.trim() || null,
        special_needs: f.special_needs,
        active: f.active,
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveStaff() {
    if (!student) return;
    setSaving(true);
    try {
      const val = staffNote.trim() || null;
      await saveStaffNotes(student.id, val);
      setSaved(true);
      onSaved?.({ ...student, staff_notes: val });
    } finally {
      setSaving(false);
    }
  }

  const fullName = `${student.first_name} ${student.last_name}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={fullName}
        className="relative max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-3xl bg-brand-cream p-6 shadow-2xl sm:rounded-3xl sm:border-2 sm:border-brand-green"
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-brand-sand text-xl font-bold text-brand-text hover:bg-brand-green hover:text-white"
        >
          ×
        </button>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-brand-sand sm:hidden" />

        {/* Name */}
        {adminEdit ? (
          <div className="grid grid-cols-2 gap-2 pr-10">
            <input className={inputCls} value={f.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="First name" />
            <input className={inputCls} value={f.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Last name" />
          </div>
        ) : (
          <h2 className="font-display text-3xl text-brand-green">{fullName}</h2>
        )}

        {/* Details table */}
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-brand-sand">
            <Row label="Swim group">
              {adminEdit ? (
                <select
                  value={f.group_level ?? ""}
                  onChange={(e) => set("group_level", e.target.value ? parseInt(e.target.value, 10) : null)}
                  className={inputCls}
                >
                  <option value="">— No group —</option>
                  {SWIM_GROUPS.map((g) => (
                    <option key={g.level} value={g.level}>Level {g.level}: {g.emoji} {g.name}</option>
                  ))}
                </select>
              ) : grp ? (
                <span className="rounded-full px-3 py-0.5 text-sm font-bold text-white" style={{ backgroundColor: grp.color }}>
                  {grp.emoji} {grp.name}
                </span>
              ) : (
                <span className="italic text-brand-text/50">Not assigned</span>
              )}
            </Row>
            <Row label="Level">
              {adminEdit ? (
                <select value={f.level} onChange={(e) => set("level", e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              ) : (
                <LevelBadge level={student.level} />
              )}
            </Row>
            <Row label="Age">
              {adminEdit ? (
                <input type="number" className={inputCls} value={f.age} onChange={(e) => set("age", e.target.value)} />
              ) : (
                <span>{student.age ?? "—"}</span>
              )}
            </Row>
            <Row label="Gender">
              {adminEdit ? (
                <input className={inputCls} value={f.gender} onChange={(e) => set("gender", e.target.value)} />
              ) : (
                <span>{student.gender ?? "—"}</span>
              )}
            </Row>
          </tbody>
        </table>

        {!adminEdit && student.special_needs ? (
          <div className="mt-3"><SpecialNeedsBanner /></div>
        ) : null}

        {/* Goals */}
        <Section title="Goals">
          {adminEdit ? (
            <textarea rows={2} className={inputCls} value={f.goals} onChange={(e) => set("goals", e.target.value)} />
          ) : student.goals && student.goals.trim() ? (
            <p className="text-sm leading-relaxed text-brand-text">{student.goals}</p>
          ) : (
            <p className="text-sm italic text-brand-text/60">No goals on file.</p>
          )}
        </Section>

        {/* Parent notes */}
        <Section title="Parent notes">
          {adminEdit ? (
            <textarea rows={2} className={inputCls} value={f.parent_notes} onChange={(e) => set("parent_notes", e.target.value)} placeholder="Parent preferences / requests…" />
          ) : student.parent_notes && student.parent_notes.trim() ? (
            <p className="rounded-lg bg-brand-sand/60 px-2 py-1 text-sm leading-relaxed text-brand-text">{student.parent_notes}</p>
          ) : (
            <p className="text-sm italic text-brand-text/50">None.</p>
          )}
        </Section>

        {/* Staff notes — editable by admin AND staff */}
        <Section title="Staff notes">
          {adminEdit ? (
            <textarea rows={2} className={inputCls} value={f.staff_notes} onChange={(e) => set("staff_notes", e.target.value)} placeholder="Internal aquatics-staff notes…" />
          ) : (
            <>
              <textarea
                rows={3}
                className={inputCls}
                value={staffNote}
                onChange={(e) => { setStaffNote(e.target.value); setSaved(false); }}
                placeholder="What you worked on, what's next, reminders…"
              />
              <div className="mt-2 flex items-center gap-3">
                <button onClick={saveStaff} disabled={saving} className="camp-btn px-4 py-1.5 text-sm">
                  {saving ? "Saving…" : "Save staff notes"}
                </button>
                {saved ? <span className="text-xs font-semibold text-brand-green">Saved ✓</span> : null}
              </div>
            </>
          )}
        </Section>

        {/* What to teach (level guide) */}
        {grp && info ? (
          <div className="mt-4 rounded-xl border border-brand-green/15 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: grp.color }}>
              {grp.emoji} {grp.name} — what to teach
            </p>
            {info.overview ? (
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-brand-text">{info.overview}</p>
            ) : null}
            {info.assessment ? (
              <p className="mt-2 rounded-lg bg-brand-sand/60 px-2 py-1 text-sm text-brand-text">
                <span className="font-bold">Pass: </span>{info.assessment}
              </p>
            ) : null}
            <Link href={`/levels#level-${grp.level}`} className="mt-2 inline-block text-sm font-bold text-brand-green underline">
              Full level guide →
            </Link>
          </div>
        ) : null}

        {/* Admin: special needs / active + Save */}
        {adminEdit ? (
          <>
            <div className="mt-4 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={f.special_needs} onChange={(e) => set("special_needs", e.target.checked)} /> Special needs
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={saveAll} disabled={saving} className="camp-btn flex-1 py-2.5">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={onClose} className="camp-btn-ghost">Close</button>
              {saved ? <span className="text-xs font-semibold text-brand-green">Saved ✓</span> : null}
            </div>
          </>
        ) : (
          <button onClick={onClose} className="camp-btn mt-6 w-full">Close</button>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th className="w-28 py-2 pr-3 text-left align-middle text-xs font-bold uppercase tracking-wide text-brand-green">
        {label}
      </th>
      <td className="py-2 align-middle text-brand-text">{children}</td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-green">{title}</h3>
      {children}
    </div>
  );
}
