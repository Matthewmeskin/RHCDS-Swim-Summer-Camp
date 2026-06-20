import type { Level } from "@/lib/types";

const STYLES: Record<string, string> = {
  "Non-Swimmer": "bg-brand-orange text-white",
  Beginner: "bg-brand-yellow text-brand-text",
  Intermediate: "bg-brand-green text-white",
  Advanced: "bg-brand-aqua text-brand-text",
};

export default function LevelBadge({
  level,
  className = "",
}: {
  level: Level | string | null;
  className?: string;
}) {
  if (!level) return null;
  const style = STYLES[level] ?? "bg-gray-300 text-brand-text";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-bold ${style} ${className}`}
    >
      {level}
    </span>
  );
}
