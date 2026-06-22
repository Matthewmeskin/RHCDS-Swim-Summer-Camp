"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import CampLoader from "@/components/CampLoader";
import Toast, { type ToastKind } from "@/components/Toast";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { fireConfetti } from "@/lib/confetti";
import {
  fetchAvailabilityRequests,
  fetchInstructorOffSlots,
  decideAvailabilityRequest,
  type AvailabilityRequestRow,
} from "@/lib/data";
import { formatOffSlot, formatOffSlots, formatRelative } from "@/lib/format";

type Slot = { date: string; start: string };
const slotKey = (s: Slot) => `${s.date}__${s.start}`;
const slotLabel = formatOffSlot;

/** What changes if this request is approved (it replaces the week's off-time). */
function computeImpact(current: Slot[], requested: Slot[]) {
  const cur = new Set(current.map(slotKey));
  const req = new Set(requested.map(slotKey));
  const added = requested.filter((s) => !cur.has(slotKey(s))); // becomes newly OFF
  const removed = current.filter((s) => !req.has(slotKey(s))); // frees back ON
  const kept = requested.filter((s) => cur.has(slotKey(s)));
  return { added, removed, kept };
}

export default function RequestsPage() {
  const [pending, setPending] = useState<AvailabilityRequestRow[]>([]);
  const [recent, setRecent] = useState<AvailabilityRequestRow[]>([]);
  const [currentOff, setCurrentOff] = useState<Record<string, Slot[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        fetchAvailabilityRequests(["pending"]),
        fetchAvailabilityRequests(["approved", "denied"]),
      ]);
      setPending(p);
      setRecent(r.slice(0, 15));
      // Pull each instructor's current off-time so we can show the impact.
      const offMap: Record<string, Slot[]> = {};
      await Promise.all(
        p.map(async (req) => {
          offMap[req.id] = await fetchInstructorOffSlots(req.instructor_id, req.week_number);
        })
      );
      setCurrentOff(offMap);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (isSupabaseConfigured) load();
  }, []);

  async function decide(req: AvailabilityRequestRow, approve: boolean) {
    setBusy(req.id);
    try {
      const { added, kept } = computeImpact(currentOff[req.id] ?? [], (req.off_slots ?? []) as Slot[]);
      const decided = await decideAvailabilityRequest(req.id, approve, notes[req.id]?.trim() || null);
      // Alert the instructor (via n8n: email).
      fetch("/api/notify-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "decision",
          instructor: decided.instructors?.name,
          slug: decided.instructors?.slug,
          week: decided.week_number,
          status: decided.status,
          email: decided.contact_email,
          phone: decided.contact_phone,
          offSlots: formatOffSlots(decided.off_slots ?? []),
          newOff: formatOffSlots(added),
          alreadyOff: formatOffSlots(kept),
          decisionNote: decided.decision_note,
        }),
      }).catch(() => {});
      setToast({
        msg: approve ? "Approved & applied ✓" : "Denied — no change made ✓",
        kind: "success",
      });
      if (approve) fireConfetti();
      load();
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Failed", kind: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <Nav backHref="/admin" />
        <ConfigNotice />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Nav backHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-4xl text-brand-green">Availability Requests</h1>
        <p className="mt-1 text-sm text-brand-text/70">
          Instructors request changes from their link. Each card shows exactly how
          their <strong>off time</strong> changes — approving applies it and notifies
          them; denying keeps things as they are.
        </p>

        {loading ? (
          <CampLoader />
        ) : (
          <>
            <section className="mt-6">
              <h2 className="mb-2 font-display text-2xl text-brand-green">
                Pending{" "}
                <span className="text-brand-orange">({pending.length})</span>
              </h2>
              {pending.length === 0 ? (
                <p className="text-sm text-brand-text/50">Nothing waiting 🎉</p>
              ) : (
                <ul className="space-y-4">
                  {pending.map((req) => {
                    const requested = (req.off_slots ?? []) as Slot[];
                    const current = currentOff[req.id] ?? [];
                    const { added, removed, kept } = computeImpact(current, requested);
                    const noChange = added.length === 0 && removed.length === 0;
                    return (
                      <li key={req.id} className="camp-card p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-display text-xl text-brand-green">
                            {req.instructors?.name ?? "Instructor"}
                          </span>
                          <span className="text-xs text-brand-text/60">
                            Week {req.week_number} · {formatRelative(req.created_at)}
                          </span>
                        </div>

                        <div className="mt-1 text-sm text-brand-text/80">
                          Contact:{" "}
                          {req.contact_email ? <span className="font-semibold">{req.contact_email}</span> : null}
                          {req.contact_email && req.contact_phone ? " · " : ""}
                          {req.contact_phone ? <span className="font-semibold">{req.contact_phone}</span> : null}
                        </div>
                        {req.note ? (
                          <p className="mt-1 rounded-lg bg-brand-sand/60 px-2 py-1 text-sm italic text-brand-text">
                            “{req.note}”
                          </p>
                        ) : null}

                        {/* Impact: what changes if approved */}
                        <div className="mt-3 rounded-xl border border-brand-green/15 bg-brand-cream/50 p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-brand-green">
                            If approved
                          </p>

                          {noChange ? (
                            <p className="mt-1 text-sm text-brand-text/70">
                              No change to their off time — this matches what&apos;s already set.
                            </p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {added.length > 0 ? (
                                <div>
                                  <p className="text-xs font-bold text-brand-orange">
                                    🆕 New time off — they’ll stop teaching these ({added.length})
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {added.map((s, i) => (
                                      <span key={i} className="rounded-full bg-brand-orange px-2 py-0.5 text-[11px] font-bold text-white">
                                        {slotLabel(s)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {kept.length > 0 ? (
                                <div>
                                  <p className="text-xs font-bold text-brand-text/60">
                                    ✓ Already off — given before ({kept.length})
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {kept.map((s, i) => (
                                      <span key={i} className="rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                                        {slotLabel(s)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {removed.length > 0 ? (
                                <div>
                                  <p className="text-xs font-bold text-brand-green">
                                    🟢 Back ON — these free up again ({removed.length})
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {removed.map((s, i) => (
                                      <span key={i} className="rounded-full bg-brand-green px-2 py-0.5 text-[11px] font-bold text-white">
                                        {slotLabel(s)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )}

                          <p className="mt-2 border-t border-brand-green/10 pt-2 text-xs text-brand-text/60">
                            Resulting off-time for Week {req.week_number}:{" "}
                            <span className="font-semibold text-brand-text/80">
                              {requested.length === 0
                                ? "fully available (no times off)"
                                : `${requested.length} slot${requested.length === 1 ? "" : "s"} — ${formatOffSlots(requested)}`}
                            </span>
                          </p>
                        </div>

                        <input
                          value={notes[req.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [req.id]: e.target.value }))}
                          placeholder="Optional note to the instructor (shown in their email)…"
                          className="mt-3 w-full rounded-lg border border-brand-green/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-aqua"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => decide(req, true)}
                            disabled={busy === req.id}
                            className="camp-btn flex-1 px-5 py-2.5 text-sm"
                          >
                            {busy === req.id ? "…" : "✓ Approve & apply"}
                          </button>
                          <button
                            onClick={() => decide(req, false)}
                            disabled={busy === req.id}
                            className="camp-btn-orange flex-1 px-5 py-2.5 text-sm"
                          >
                            ✕ Deny
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {recent.length > 0 ? (
              <section className="mt-8">
                <h2 className="mb-2 font-display text-2xl text-brand-green">Recent decisions</h2>
                <ul className="divide-y divide-brand-sand rounded-2xl border-2 border-brand-green bg-white">
                  {recent.map((req) => (
                    <li key={req.id} className="px-4 py-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {req.instructors?.name} · Week {req.week_number}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            req.status === "approved"
                              ? "bg-brand-green text-white"
                              : "bg-brand-orange/20 text-brand-orange"
                          }`}
                        >
                          {req.status}
                          {req.decided_at ? ` · ${formatRelative(req.decided_at)}` : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-brand-text/60">
                        Requested off: {formatOffSlots(req.off_slots ?? [])}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} /> : null}
    </main>
  );
}
