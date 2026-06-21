"use client";

export type ToastKind = "success" | "error";

export default function Toast({
  message,
  kind = "success",
  onDismiss,
  action,
}: {
  message: string;
  kind?: ToastKind;
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      role="status"
      className={`fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg ${
        kind === "success" ? "bg-brand-green" : "bg-brand-orange"
      }`}
    >
      <span>{message}</span>
      {action ? (
        <button
          onClick={action.onClick}
          className="ml-3 rounded-full bg-white/25 px-3 py-0.5 font-bold text-white transition hover:bg-white/40"
        >
          {action.label}
        </button>
      ) : null}
      {onDismiss ? (
        <button onClick={onDismiss} className="ml-3 text-white/80 hover:text-white" aria-label="Dismiss">
          ×
        </button>
      ) : null}
    </div>
  );
}
