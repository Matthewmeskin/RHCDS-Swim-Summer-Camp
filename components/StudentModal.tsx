"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Student, SwimLevel } from "@/lib/types";
import LevelBadge from "./LevelBadge";
import SpecialNeedsBanner from "./SpecialNeedsBanner";
import { formatRelative } from "@/lib/format";
import { SWIM_GROUPS, groupByLevel } from "@/lib/groups";
import {
  fetchInstructorNotes,
  saveInstructorNote,
  saveStudentNotes,
  fetchSwimLevels,
  type InstructorNoteRow,
} from "@/lib/data";

export default function StudentModal({
  student,
  onClose,
  instructorId,
  adminEdit = false,
}: {
  student: Student | null;
  onClose: () => void;
  /** When set, this instructor can add/edit their own progress note. */
  instructorId?: string;
  /** When true (admin), parent + staff notes become editable. */
  adminEdit?: boolean;
}) {
  const [notes, setNotes] = useState<InstructorNoteRow[]>([]);
  const [myNote, setMyNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [parentNote, setParentNote] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [groupLevel, setGroupLevel] = useState<number | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);
  const [levels, setLevels] = useState<SwimLevel[]>([]);

  useEffect(() => {
    setParentNote(student?.parent_notes ?? "");
    setStaffNote(student?.staff_notes ?? "");
    setGroupLevel(student?.group_level ?? null);
    setCardSaved(false);
  }, [student]);

  useEffect(() => {
    if (levels.length === 0) fetchSwimLevels().then(setLevels).catch(() => {});
  }, [levels.length]);

  async function saveCardNotes() {
    if (!student) return;
    setSavingCard(true);
    try {
      await saveStudentNotes(student.id, {
        parent_notes: parentNote.trim() || null,
        staff_notes: staffNote.trim() || null,
        group_level: groupLevel,
      });
      setCardSaved(true);
    } finally {
      setSavingCard(false);
    }
  }

  useEffect(() => {
    if (!student) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [student, onClose]);

  useEffect(() => {
    setNoteSaved(false);
    if (!student) return;
    fetchInstructorNotes(student.id)
      .then((rows) => {
        setNotes(rows);
        const mine = rows.find((r) => r.instructor_id === instructorId);
        setMyNote(mine?.note ?? "");
      })
      .catch(() => setNotes([]));
  }, [student, instructorId]);

  async function saveNote() {
    if (!student || !instructorId) return;
    setSavingNote(true);
    try {
      await saveInstructorNote(student.id, instructorId, myNote.trim());
      setNoteSaved(true);
      const rows = await fetchInstructorNotes(student.id);
      setNotes(rows);
    } finally {
      setSavingNote(false);
    }
  }

  if (!student) return null;

  const fullName = `${student.first_name} ${student.last_name}`;
  const hasGoals = Boolean(student.goals && student.goals.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      {/* Large tap-to-close backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${fullName} goals`}
        className="relative w-full max-w-lg rounded-t-3xl bg-brand-cream p-6 shadow-2xl sm:rounded-3xl sm:border-2 sm:border-brand-green"
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-brand-sand text-xl font-bold text-brand-text hover:bg-brand-green hover:text-white"
        >
          ×
        </button>

        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-brand-sand sm:hidden" />

        <h2 className="font-display text-3xl text-brand-green">{fullName}</h2>

        <div className="mt-2 flex items-center gap-3">
          {student.age != null ? (
            <span className="text-sm font-semibold text-brand-text/80">
              Age {student.age}
            </span>
          ) : null}
          <LevelBadge level={student.level} />
        </div>

        {/* Swim group + what the instructor needs to know for that level */}
        {(() => {
          const grp = groupByLevel(groupLevel);
          const info = levels.find((l) => l.level === groupLevel);
          return (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-brand-green">
                  Swim group
                </h3>
                {grp ? (
                  <span
                    className="rounded-full px-3 py-0.5 text-sm font-bold text-white"
                    style={{ backgroundColor: grp.color }}
                  >
                    {grp.emoji} {grp.name}
                  </span>
                ) : (
                  <span className="text-sm italic text-brand-text/50">Not assigned</span>
                )}
              </div>

              {adminEdit ? (
                <select
                  value={groupLevel ?? ""}
                  onChange={(e) => {
                    setGroupLevel(e.target.value ? parseInt(e.target.value, 10) : null);
                    setCardSaved(false);
                  }}
                  className="mt-2 w-full rounded-lg border border-brand-green/30 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
                >
                  <option value="">— No group —</option>
                  {SWIM_GROUPS.map((g) => (
                    <option key={g.level} value={g.level}>
                      Level {g.level}: {g.emoji} {g.name}
                    </option>
                  ))}
                </select>
              ) : null}

              {grp && info ? (
                <div className="mt-2 rounded-xl border border-brand-green/15 bg-white p-3">
                  {info.overview ? (
                    <>
                      <p className="text-xs font-bold uppercase tracking-wide text-brand-green">
                        What to teach
                      </p>
                      <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-brand-text">
                        {info.overview}
                      </p>
                    </>
                  ) : null}
                  {info.assessment ? (
                    <p className="mt-2 rounded-lg bg-brand-sand/60 px-2 py-1 text-sm text-brand-text">
                      <span className="font-bold">Pass: </span>
                      {info.assessment}
                    </p>
                  ) : null}
                  <Link
                    href={`/levels#level-${grp.level}`}
                    className="mt-2 inline-block text-sm font-bold text-brand-green underline"
                  >
                    Full level guide →
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })()}

        {student.special_needs ? (
          <div className="mt-4">
            <SpecialNeedsBanner />
          </div>
        ) : null}

        <div className="mt-4">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-brand-green">
            Goals
          </h3>
          {hasGoals ? (
            <p className="text-base leading-relaxed text-brand-text">
              {student.goals}
            </p>
          ) : (
            <p className="italic text-brand-text/60">
              No goals on file — contact the aquatics director
            </p>
          )}
        </div>

        {adminEdit ? (
          <div className="mt-4 rounded-xl border border-brand-green/15 bg-white p-3">
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-brand-green">
              Parent notes
            </h3>
            <textarea
              value={parentNote}
              onChange={(e) => { setParentNote(e.target.value); setCardSaved(false); }}
              rows={2}
              placeholder="Parent preferences / requests…"
              className="w-full rounded-lg border border-brand-green/30 p-2 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
            />
            <h3 className="mb-1 mt-3 text-sm font-bold uppercase tracking-wide text-brand-green">
              Staff notes
            </h3>
            <textarea
              value={staffNote}
              onChange={(e) => { setStaffNote(e.target.value); setCardSaved(false); }}
              rows={2}
              placeholder="Internal aquatics-staff notes (not parent-facing)…"
              className="w-full rounded-lg border border-brand-green/30 p-2 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
            />
            <div className="mt-2 flex items-center gap-3">
              <button onClick={saveCardNotes} disabled={savingCard} className="camp-btn px-4 py-1.5 text-sm">
                {savingCard ? "Saving…" : "Save notes"}
              </button>
              {cardSaved ? <span className="text-xs font-semibold text-brand-green">Saved ✓</span> : null}
            </div>
          </div>
        ) : (
          <>
            {student.parent_notes && student.parent_notes.trim() ? (
              <div className="mt-4 rounded-xl border border-brand-green/15 bg-brand-sand/60 p-3">
                <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-brand-green">
                  Parent notes
                </h3>
                <p className="text-sm leading-relaxed text-brand-text">
                  {student.parent_notes}
                </p>
              </div>
            ) : null}

            {student.staff_notes && student.staff_notes.trim() ? (
              <div className="mt-3 rounded-xl border border-brand-green/15 bg-white p-3">
                <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-brand-green">
                  Staff notes
                </h3>
                <p className="text-sm leading-relaxed text-brand-text">
                  {student.staff_notes}
                </p>
              </div>
            ) : null}
          </>
        )}

        {/* Instructor progress notes */}
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-brand-green">
            Progress notes
          </h3>

          {instructorId ? (
            <div className="rounded-xl border border-brand-green/15 bg-white p-3">
              <label className="text-xs font-semibold text-brand-text/70">
                Your note for {student.first_name}
              </label>
              <textarea
                value={myNote}
                onChange={(e) => {
                  setMyNote(e.target.value);
                  setNoteSaved(false);
                }}
                rows={3}
                placeholder="What you worked on, what's next…"
                className="mt-1 w-full rounded-lg border border-brand-green/30 p-2 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={saveNote}
                  disabled={savingNote}
                  className="camp-btn px-4 py-1.5 text-sm"
                >
                  {savingNote ? "Saving…" : "Save note"}
                </button>
                {noteSaved ? (
                  <span className="text-xs font-semibold text-brand-green">Saved ✓</span>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Notes from other instructors (and yours when viewing as admin) */}
          <ul className="mt-2 space-y-2">
            {notes
              .filter((n) => n.instructor_id !== instructorId && n.note && n.note.trim())
              .map((n) => (
                <li key={n.id} className="rounded-xl border border-brand-green/15 bg-brand-sand/40 p-3">
                  <div className="mb-0.5 flex items-center justify-between text-xs font-semibold text-brand-text/70">
                    <span>{n.instructors?.name ?? "Instructor"}</span>
                    <span>{formatRelative(n.updated_at)}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-brand-text">{n.note}</p>
                </li>
              ))}
          </ul>

          {notes.length === 0 && !instructorId ? (
            <p className="text-sm italic text-brand-text/50">No progress notes yet.</p>
          ) : null}
        </div>

        <button onClick={onClose} className="camp-btn mt-6 w-full">
          Close
        </button>
      </div>
    </div>
  );
}
