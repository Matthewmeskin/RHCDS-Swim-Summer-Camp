"use client";

export type ToastKind = "success" | "error";

export default function Toast({
  message,
  kind = "success",
  onDismiss,
}: {
  message: string;
  kind?: ToastKind;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="status"
      className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg ${
        kind === "success" ? "bg-brand-green" : "bg-brand-orange"
      }`}
    >
      <span>{message}</span>
      {onDismiss ? (
        <button onClick={onDismiss} className="ml-3 text-white/80 hover:text-white">
          ×
        </button>
      ) : null}
    </div>
  );
}
