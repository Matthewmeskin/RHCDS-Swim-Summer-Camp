"use client";

import { useEffect, useState } from "react";
import { fireConfetti } from "@/lib/confetti";

const TOUR_KEY = "tourSeenV1";

type Step = { emoji: string; title: string; body: string };

const STEPS: Step[] = [
  {
    emoji: "👋",
    title: "Welcome to your Swim Portal!",
    body: "This is your home base for the whole summer. Let me show you around in about a minute — and don't worry, you genuinely can't break anything.",
  },
  {
    emoji: "🧭",
    title: "Start with “Today”",
    body: "The Today box at the top always tells you exactly what needs you right now — and shows a 🎉 when you're all caught up. When in doubt, start there.",
  },
  {
    emoji: "🧩",
    title: "Build the schedule",
    body: "“Build the Schedule” assigns campers to instructors. Try Auto-fill, then tweak by hand. Nothing is saved until you press Save — and every change has a one-tap Undo.",
  },
  {
    emoji: "🔑",
    title: "Give instructors access",
    body: "In “Instructor Access,” each instructor signs in with their name + a short code. Tap “Set up codes,” then copy, share, or text them out.",
  },
  {
    emoji: "🏊",
    title: "Print pool-deck sheets",
    body: "“Pool-Deck Sheets” prints a clean lesson sheet for each instructor to carry on deck — laminate-ready, or save as a PDF to email.",
  },
  {
    emoji: "🛟",
    title: "You really can't break it",
    body: "Nervous? Tap “Download a backup” any time for a full copy, and Undo is everywhere. Explore freely — mistakes are easy to undo.",
  },
  {
    emoji: "📲",
    title: "Take it with you",
    body: "Add the portal to your phone's home screen so it opens like a real app. Look for “Put it on your phone” near the bottom of this page.",
  },
];

export default function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setStep(0);
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    localStorage.setItem(TOUR_KEY, "1");
    setOpen(false);
  }
  function finish() {
    close();
    fireConfetti();
  }
  function reopen() {
    setStep(0);
    setOpen(true);
  }

  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  return (
    <>
      {/* Always-available re-open button */}
      <button
        onClick={reopen}
        className="no-print fixed bottom-4 right-4 z-40 rounded-full bg-brand-green px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
      >
        ❓ Take the tour
      </button>

      {open ? (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome tour"
        >
          <button aria-label="Close tour" onClick={close} className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">
            <div className="text-5xl">{s.emoji}</div>
            <h2 className="mt-3 font-display text-2xl text-brand-green">{s.title}</h2>
            <p className="mt-2 text-brand-text/80">{s.body}</p>

            {/* Progress dots */}
            <div className="mt-5 flex justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to step ${i + 1}`}
                  onClick={() => setStep(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === step ? "w-5 bg-brand-green" : "w-2 bg-brand-green/25 hover:bg-brand-green/50"
                  }`}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2">
              {step > 0 ? (
                <button onClick={() => setStep((v) => v - 1)} className="camp-btn-ghost px-5 py-2 text-sm">
                  ← Back
                </button>
              ) : (
                <button onClick={close} className="px-3 py-2 text-sm font-semibold text-brand-text/50 hover:text-brand-green">
                  Skip
                </button>
              )}
              {isLast ? (
                <button onClick={finish} className="camp-btn ml-auto px-6 py-2 text-sm">
                  Let&apos;s go! 🎉
                </button>
              ) : (
                <button onClick={() => setStep((v) => v + 1)} className="camp-btn ml-auto px-6 py-2 text-sm">
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
