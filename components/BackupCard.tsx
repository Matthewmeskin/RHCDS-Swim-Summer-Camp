"use client";

import { useEffect, useState } from "react";
import { fetchFullBackup } from "@/lib/data";
import { fireConfetti } from "@/lib/confetti";
import { formatRelative } from "@/lib/format";

/**
 * Reassurance card: one tap saves a complete copy of all camp data to the
 * director's device. Remembers when the last backup was taken.
 */
export default function BackupCard() {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setLast(localStorage.getItem("lastBackupAt"));
  }, []);

  async function download() {
    setBusy(true);
    setMsg(null);
    try {
      const backup = await fetchFullBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `swim-camp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      localStorage.setItem("lastBackupAt", now);
      setLast(now);
      const count = Object.values(backup.tables).reduce((n, rows) => n + (rows as unknown[]).length, 0);
      setMsg(`Saved a backup of ${count.toLocaleString()} records to your device ✓`);
      fireConfetti();
    } catch (e) {
      setMsg((e as Error).message ?? "Couldn't make a backup — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="camp-card-sand mt-8 flex flex-wrap items-center gap-4 p-5">
      <div className="text-3xl">🛟</div>
      <div className="min-w-[200px] flex-1">
        <h2 className="font-display text-xl text-brand-green">Your data is safe</h2>
        <p className="text-sm text-brand-text/70">
          Save a complete copy of everything any time — keep it somewhere safe for peace of mind.
        </p>
        {msg ? (
          <p className="mt-1 text-sm font-semibold text-brand-green">{msg}</p>
        ) : last ? (
          <p className="mt-1 text-xs text-brand-text/50">Last backup {formatRelative(last)}</p>
        ) : (
          <p className="mt-1 text-xs text-brand-text/50">No backup downloaded yet on this device.</p>
        )}
      </div>
      <button onClick={download} disabled={busy} className="camp-btn shrink-0 disabled:opacity-50">
        {busy ? "Saving…" : "⬇️ Download a backup"}
      </button>
    </section>
  );
}
