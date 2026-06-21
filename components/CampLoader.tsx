"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// Playful, on-brand loading lines that cycle while data loads.
const MESSAGES = [
  "Diving in…",
  "Blowing up the floaties…",
  "Grabbing the kickboards…",
  "Lining up the lanes…",
  "Rounding up the campers…",
];

/**
 * Camp-themed loading state: the camp logo bobbing on animated water ripples
 * with a rotating message. Pass a fixed `label` to skip the rotation.
 */
export default function CampLoader({ label }: { label?: string }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (label) return;
    const t = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 1400);
    return () => clearInterval(t);
  }, [label]);

  return (
    <div className="flex flex-col items-center justify-center py-16" role="status" aria-live="polite">
      <div className="relative inline-block">
        <Image
          src="/camp-logo.png"
          alt=""
          width={72}
          height={72}
          priority
          className="camp-loader-logo rounded-full drop-shadow-md"
        />
        <span className="camp-loader-ripple" aria-hidden="true" />
        <span className="camp-loader-ripple camp-loader-ripple-2" aria-hidden="true" />
        <span className="camp-loader-ripple camp-loader-ripple-3" aria-hidden="true" />
        <span className="camp-bubble camp-bubble-1" aria-hidden="true" />
        <span className="camp-bubble camp-bubble-2" aria-hidden="true" />
        <span className="camp-bubble camp-bubble-3" aria-hidden="true" />
      </div>
      <p className="mt-5 font-display text-lg text-brand-green">{label ?? MESSAGES[i]}</p>
      <span className="sr-only">Loading</span>
    </div>
  );
}
