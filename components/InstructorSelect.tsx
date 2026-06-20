"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Instructor } from "@/lib/types";

export default function InstructorSelect({
  instructors,
}: {
  instructors: Instructor[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? instructors.filter((i) => i.name.toLowerCase().includes(q))
      : instructors;
    return list;
  }, [query, instructors]);

  function go(slug: string | null) {
    if (slug) router.push(`/instructor/${slug}`);
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search your name…"
        className="w-full rounded-full border-2 border-brand-green bg-white px-5 py-3 text-base text-brand-text outline-none focus:ring-2 focus:ring-brand-aqua"
        aria-label="Search for your name"
      />
      {open && filtered.length > 0 ? (
        <ul className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-2xl border-2 border-brand-green bg-white py-1 shadow-lg">
          {filtered.map((i) => (
            <li key={i.id}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(i.slug)}
                className="flex w-full items-center justify-between px-5 py-2.5 text-left hover:bg-brand-sand"
              >
                <span className="font-semibold text-brand-text">{i.name}</span>
                {i.role === "guard" ? (
                  <span className="rounded-full bg-brand-aqua px-2 py-0.5 text-xs font-bold text-brand-text">
                    Guard
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query && filtered.length === 0 ? (
        <div className="absolute z-10 mt-2 w-full rounded-2xl border-2 border-brand-green bg-white px-5 py-3 text-sm text-brand-text/70 shadow-lg">
          No instructor found
        </div>
      ) : null}
    </div>
  );
}
