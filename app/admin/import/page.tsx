"use client";

import Link from "next/link";
import Nav from "@/components/Nav";

/** All data imports live here, off the main dashboard. */
const IMPORTS: { href: string; icon: string; title: string; desc: string }[] = [
  {
    href: "/admin/import/students",
    icon: "🧑‍🎓",
    title: "Import Roster",
    desc: "One CSV — students, swim groups (🐙🐠🐟🐢🐬🦈), and parent preferences.",
  },
  {
    href: "/admin/import/schedule",
    icon: "🗓️",
    title: "Import Schedule",
    desc: "Upload the Google Sheets schedule grid for a week.",
  },
  {
    href: "/admin/import/enrollment",
    icon: "📝",
    title: "Import Enrollment",
    desc: "Who attends each week & how many lessons — powers Auto-fill.",
  },
  {
    href: "/admin/import/levels",
    icon: "🐬",
    title: "Import Swim Groups",
    desc: "Assign each camper's swim group (1–6) in bulk.",
  },
  {
    href: "/admin/import/preferences",
    icon: "💬",
    title: "Import Parent Preferences",
    desc: "Goals, gender/age/level, and parent notes per camper.",
  },
];

export default function ImportHub() {
  return (
    <main className="min-h-screen">
      <Nav backHref="/admin" />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Imports</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Bring data in from spreadsheets. You only need these at setup or when something changes —
          day-to-day work happens on the Master Schedule.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {IMPORTS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="camp-card block p-6 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="text-3xl">{it.icon}</div>
              <h2 className="mt-2 font-display text-2xl text-brand-green">{it.title}</h2>
              <p className="mt-1 text-sm text-brand-text/70">{it.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
