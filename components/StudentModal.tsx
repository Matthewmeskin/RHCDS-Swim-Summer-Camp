"use client";

import { useEffect } from "react";
import type { Student } from "@/lib/types";
import LevelBadge from "./LevelBadge";
import SpecialNeedsBanner from "./SpecialNeedsBanner";

export default function StudentModal({
  student,
  onClose,
}: {
  student: Student | null;
  onClose: () => void;
}) {
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

        <button onClick={onClose} className="camp-btn mt-6 w-full">
          Close
        </button>
      </div>
    </div>
  );
}
