"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { fetchSwimLevels } from "@/lib/data";
import { groupByLevel } from "@/lib/groups";
import type { SwimLevel } from "@/lib/types";

export default function LevelsGuidePage() {
  const [levels, setLevels] = useState<SwimLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    fetchSwimLevels()
      .then(setLevels)
      .finally(() => setLoading(false));
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/" />
        <ConfigNotice />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Nav backHref="/" />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Swim Level Guide</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          The 6 camp swim groups — what to teach, the games that help, and what a
          swimmer must do to pass to the next group.
        </p>

        {/* Jump links */}
        <div className="mt-4 flex flex-wrap gap-2">
          {levels.map((l) => {
            const g = groupByLevel(l.level);
            return (
              <a
                key={l.level}
                href={`#level-${l.level}`}
                className="rounded-full px-3 py-1 text-sm font-bold text-white"
                style={{ backgroundColor: g?.color ?? "#407A5B" }}
              >
                {l.emoji} {l.name}
              </a>
            );
          })}
        </div>

        {loading ? (
          <p className="mt-8 text-center text-brand-text/60">Loading…</p>
        ) : (
          <div className="mt-6 space-y-5">
            {levels.map((l) => {
              const g = groupByLevel(l.level);
              const color = g?.color ?? "#407A5B";
              return (
                <section
                  key={l.level}
                  id={`level-${l.level}`}
                  className="scroll-mt-20 overflow-hidden rounded-2xl border-2 bg-white"
                  style={{ borderColor: color }}
                >
                  <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ backgroundColor: color }}>
                    <span className="text-3xl">{l.emoji}</span>
                    <div>
                      <h2 className="font-display text-2xl leading-none">
                        Level {l.level}: {l.name}
                      </h2>
                    </div>
                  </div>
                  <div className="space-y-4 p-4">
                    {l.overview ? (
                      <div>
                        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-green">
                          What to teach
                        </h3>
                        <Bullets text={l.overview} />
                      </div>
                    ) : null}
                    {l.assessment ? (
                      <div className="rounded-xl bg-brand-sand/60 p-3">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-brand-green">
                          ✅ Assessment to pass
                        </h3>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {l.assessment.split(/\s*·\s*/).map((a, i) => (
                            <span key={i} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-text ring-1 ring-brand-green/20">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {l.games ? (
                      <div>
                        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-green">
                          Games &amp; activities
                        </h3>
                        <SkillList text={l.games} color={color} />
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

/** Renders newline/bullet text as a clean bulleted list. */
function Bullets({ text }: { text: string }) {
  const items = text
    .split(/\n+/)
    .map((s) => s.replace(/^[•\-•]\s*/, "").trim())
    .filter(Boolean);
  return (
    <ul className="space-y-1 text-sm leading-relaxed text-brand-text">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-0.5 text-brand-green">•</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** Renders "Skill → games" lines with the skill bolded. */
function SkillList({ text, color }: { text: string; color: string }) {
  const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return (
    <ul className="space-y-1.5 text-sm leading-relaxed text-brand-text">
      {lines.map((line, i) => {
        const m = line.match(/^(.*?)(→|:)\s*(.*)$/);
        return (
          <li key={i} className="flex gap-2">
            <span className="mt-0.5" style={{ color }}>•</span>
            {m ? (
              <span>
                <span className="font-bold">{m[1].trim()}</span>
                <span className="text-brand-text/50"> — </span>
                <span className="text-brand-text/90">{m[3]}</span>
              </span>
            ) : (
              <span>{line}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
