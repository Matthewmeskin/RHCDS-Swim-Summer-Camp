"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchInstructors, fetchAllStudents } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { groupByLevel } from "@/lib/groups";
import type { Instructor, Student } from "@/lib/types";
import StudentModal from "@/components/StudentModal";

/**
 * System-wide search. Mounts in the Nav and is available on every admin page.
 * Open with the search button or ⌘K / Ctrl+K. Finds any camper (opens their
 * popup with ability, group & notes) or instructor (jumps to their schedule).
 */
export default function GlobalSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (loaded || !isSupabaseConfigured) return;
    try {
      const [ins, st] = await Promise.all([fetchInstructors(), fetchAllStudents()]);
      setInstructors(ins);
      setStudents(st);
    } finally {
      setLoaded(true);
    }
  }, [loaded]);

  // ⌘K / Ctrl+K to open, Esc to close — admin pages only.
  useEffect(() => {
    if (!isAdmin) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin]);

  useEffect(() => {
    if (open) {
      load();
      // focus once the overlay is painted
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    setQuery("");
  }, [open, load]);

  if (!isAdmin) return null;

  const ql = query.trim().toLowerCase();
  const insMatches = ql ? instructors.filter((i) => i.name.toLowerCase().includes(ql)).slice(0, 6) : [];
  const campMatches = ql
    ? students.filter((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(ql)).slice(0, 12)
    : [];

  function pickInstructor(i: Instructor) {
    setOpen(false);
    if (i.slug) router.push(`/instructor/${i.slug}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search (⌘K)"
        title="Search campers & instructors (⌘K)"
        className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/25"
      >
        <span className="text-base leading-none">🔍</span>
        <span className="hidden sm:inline">Search</span>
        <span className="hidden rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold sm:inline">⌘K</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[10vh]">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-lg rounded-2xl border-2 border-brand-green bg-brand-cream p-4 text-brand-text shadow-2xl">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any camper or instructor…"
              className="w-full rounded-full border-2 border-brand-green bg-white px-5 py-2.5 text-sm text-brand-text"
            />

            {ql ? (
              <ul className="mt-3 max-h-[55vh] overflow-auto rounded-xl border border-brand-green/15 bg-white">
                {insMatches.length > 0 ? (
                  <li className="bg-brand-aqualight px-4 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-text/60">
                    Instructors
                  </li>
                ) : null}
                {insMatches.map((i) => (
                  <li key={`ins-${i.id}`}>
                    <button
                      onClick={() => pickInstructor(i)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-brand-sand"
                    >
                      <span className="text-base">🏊</span>
                      <span className="flex-1 truncate font-semibold">{i.name}</span>
                      <span className="text-xs text-brand-text/40">{i.slug ? "Go to schedule →" : "No schedule link"}</span>
                    </button>
                  </li>
                ))}

                {campMatches.length > 0 ? (
                  <li className="bg-brand-aqualight px-4 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-text/60">
                    Campers
                  </li>
                ) : null}
                {campMatches.map((s) => {
                  const g = groupByLevel(s.group_level);
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => setSelected(s)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-brand-sand"
                      >
                        {g ? (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: g.color }}
                          >
                            {g.emoji}
                          </span>
                        ) : null}
                        <span className="flex-1 truncate font-semibold">{s.first_name} {s.last_name}</span>
                        {g ? <span className="text-xs text-brand-text/60">{g.name}</span> : null}
                        {s.level ? <span className="text-xs text-brand-text/40">{s.level}</span> : null}
                      </button>
                    </li>
                  );
                })}

                {insMatches.length === 0 && campMatches.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-brand-text/50">
                    {loaded ? "No matches found" : "Loading…"}
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-3 px-1 text-xs text-brand-text/50">
                Type a name — campers open their info &amp; notes, instructors jump to their schedule.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {selected ? (
        <StudentModal
          student={selected}
          adminEdit
          onClose={() => setSelected(null)}
          onSaved={(u) => {
            setSelected(u);
            setStudents((prev) => prev.map((s) => (s.id === u.id ? u : s)));
          }}
        />
      ) : null}
    </>
  );
}
