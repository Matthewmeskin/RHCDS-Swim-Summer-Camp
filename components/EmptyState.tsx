import Link from "next/link";

/**
 * Warm, reassuring empty state: a big emoji, a friendly line, and an optional
 * next-step button — so a blank screen never feels like something went wrong.
 */
export default function EmptyState({
  emoji = "🌊",
  title,
  message,
  actionHref,
  actionLabel,
  onAction,
}: {
  emoji?: string;
  title: string;
  message?: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mt-8 flex flex-col items-center px-4 py-10 text-center">
      <div className="text-5xl">{emoji}</div>
      <h3 className="mt-3 font-display text-2xl text-brand-green">{title}</h3>
      {message ? <p className="mt-1 max-w-sm text-sm text-brand-text/70">{message}</p> : null}
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="camp-btn mt-4">
          {actionLabel}
        </Link>
      ) : actionLabel && onAction ? (
        <button onClick={onAction} className="camp-btn mt-4">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
