"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import CampLoader from "@/components/CampLoader";
import EmptyState from "@/components/EmptyState";
import LevelBadge from "@/components/LevelBadge";
import Toast, { type ToastKind } from "@/components/Toast";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  fetchInstructorsAll,
  fetchAllStudents,
  saveInstructor,
  saveStudent,
} from "@/lib/data";
import type { Instructor, Student, Role, Level } from "@/lib/types";
import { SWIM_GROUPS, groupByLevel } from "@/lib/groups";

const ROLES: Role[] = ["instructor", "guard", "admin"];
const LEVELS: Level[] = ["Non-Swimmer", "Beginner", "Intermediate", "Advanced"];

type Tab = "instructors" | "students";

export default function RosterPage() {
  const [tab, setTab] = useState<Tab>("instructors");
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingInstr, setEditingInstr] = useState<Partial<Instructor> | null>(null);
  const [editingStudent, setEditingStudent] = useState<Partial<Student> | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind; undo?: () => void } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [i, s] = await Promise.all([fetchInstructorsAll(), fetchAllStudents()]);
      setInstructors(i);
      setStudents(s);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (isSupabaseConfigured) load();
  }, []);

  const filteredInstr = useMemo(() => {
    const q = query.trim().toLowerCase();
    return instructors.filter((i) => (q ? i.name.toLowerCase().includes(q) : true));
  }, [instructors, query]);
  const filteredStud = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) =>
      q ? `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) : true
    );
  }, [students, query]);

  async function setActive(kind: Tab, rec: Instructor | Student, value: boolean) {
    if (kind === "instructors") {
      const i = rec as Instructor;
      await saveInstructor({ id: i.id, name: i.name, role: i.role, email: i.email, slug: i.slug, active: value });
    } else {
      await saveStudent({ ...(rec as Student), active: value });
    }
  }

  async function quickToggleActive(kind: Tab, rec: Instructor | Student) {
    const wasActive = (rec as { active?: boolean }).active !== false;
    const name =
      kind === "instructors"
        ? (rec as Instructor).name
        : `${(rec as Student).first_name} ${(rec as Student).last_name}`;
    try {
      await setActive(kind, rec, !wasActive);
      await load();
      setToast({
        msg: wasActive ? `Archived ${name}` : `Restored ${name} ✓`,
        kind: "success",
        undo: () => {
          setActive(kind, rec, wasActive)
            .then(load)
            .then(() => setToast({ msg: "Undone ✓", kind: "success" }))
            .catch((e) => setToast({ msg: (e as Error).message ?? "Undo failed", kind: "error" }));
        },
      });
    } catch (e) {
      setToast({ msg: (e as Error).message ?? "Update failed", kind: "error" });
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
        <h1 className="font-display text-4xl text-brand-green">Roster</h1>

        <div className="mt-4 flex gap-2">
          {(["instructors", "students"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold capitalize ${
                tab === t ? "bg-brand-green text-white" : "bg-brand-sand text-brand-text"
              }`}
            >
              {t} ({t === "instructors" ? instructors.length : students.length})
            </button>
          ))}
          <button
            onClick={() =>
              tab === "instructors"
                ? setEditingInstr({ role: "instructor", active: true, email: null })
                : setEditingStudent({ active: true, special_needs: false })
            }
            className="camp-btn ml-auto px-4 py-1.5 text-sm"
          >
            + Add {tab === "instructors" ? "instructor" : "student"}
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${tab}…`}
          className="mt-3 w-full rounded-full border-2 border-brand-green bg-white px-5 py-2.5 text-sm"
        />

        {loading ? (
          <CampLoader />
        ) : tab === "instructors" ? (
          <ul className="mt-4 divide-y divide-brand-sand rounded-2xl border-2 border-brand-green bg-white">
            {filteredInstr.length === 0 ? (
              <li className="px-4 py-6">
                <EmptyState
                  emoji="🧑‍🏫"
                  title={query ? "No matches" : "No instructors yet"}
                  message={query ? "Try a different name." : "Add your first instructor to get started."}
                  actionLabel={query ? undefined : "+ Add instructor"}
                  onAction={query ? undefined : () => setEditingInstr({ role: "instructor", active: true, email: null })}
                />
              </li>
            ) : filteredInstr.map((i) => (
              <li key={i.id} className="flex items-center gap-2 px-4 py-2.5">
                <span className={`font-semibold ${i.active === false ? "text-brand-text/40 line-through" : ""}`}>
                  {i.name}
                </span>
                {i.role !== "instructor" ? (
                  <span className="rounded-full bg-brand-aqua px-2 py-0.5 text-xs font-bold capitalize text-brand-text">
                    {i.role}
                  </span>
                ) : null}
                <div className="ml-auto flex items-center gap-3 text-sm">
                  <button onClick={() => quickToggleActive("instructors", i)} className="font-semibold text-brand-text/60 hover:underline">
                    {i.active === false ? "Reactivate" : "Deactivate"}
                  </button>
                  <button onClick={() => setEditingInstr(i)} className="font-bold text-brand-green hover:underline">
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-4 divide-y divide-brand-sand rounded-2xl border-2 border-brand-green bg-white">
            {filteredStud.length === 0 ? (
              <li className="px-4 py-6">
                <EmptyState
                  emoji="🧑‍🎓"
                  title={query ? "No matches" : "No campers yet"}
                  message={query ? "Try a different name." : "Import your camper roster to get started."}
                  actionHref={query ? undefined : "/admin/import/students"}
                  actionLabel={query ? undefined : "Import roster"}
                />
              </li>
            ) : filteredStud.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-4 py-2.5">
                {(() => {
                  const g = groupByLevel(s.group_level);
                  return g ? <span title={g.name} className="text-base leading-none">{g.emoji}</span> : null;
                })()}
                <span className={`font-semibold ${s.active === false ? "text-brand-text/40 line-through" : ""}`}>
                  {s.first_name} {s.last_name}
                </span>
                <LevelBadge level={s.level} />
                {s.special_needs ? <span title="Special needs">⚠️</span> : null}
                <div className="ml-auto flex items-center gap-3 text-sm">
                  <button onClick={() => quickToggleActive("students", s)} className="font-semibold text-brand-text/60 hover:underline">
                    {s.active === false ? "Reactivate" : "Deactivate"}
                  </button>
                  <button onClick={() => setEditingStudent(s)} className="font-bold text-brand-green hover:underline">
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editingInstr ? (
        <InstructorEditor
          value={editingInstr}
          onClose={() => setEditingInstr(null)}
          onSaved={() => {
            setEditingInstr(null);
            setToast({ msg: "Instructor saved ✓", kind: "success" });
            load();
          }}
          onError={(m) => setToast({ msg: m, kind: "error" })}
        />
      ) : null}

      {editingStudent ? (
        <StudentEditor
          value={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaved={() => {
            setEditingStudent(null);
            setToast({ msg: "Student saved ✓", kind: "success" });
            load();
          }}
          onError={(m) => setToast({ msg: m, kind: "error" })}
        />
      ) : null}

      {toast ? (
        <Toast
          message={toast.msg}
          kind={toast.kind}
          onDismiss={() => setToast(null)}
          action={toast.undo ? { label: "Undo", onClick: toast.undo } : undefined}
        />
      ) : null}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-brand-green">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-brand-green/30 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-aqua";

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-auto rounded-t-3xl bg-brand-cream p-5 shadow-2xl sm:rounded-3xl sm:border-2 sm:border-brand-green">
        <h2 className="mb-3 font-display text-2xl text-brand-green">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function InstructorEditor({
  value, onClose, onSaved, onError,
}: {
  value: Partial<Instructor>;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(value.name ?? "");
  const [role, setRole] = useState<Role>((value.role as Role) ?? "instructor");
  const [email, setEmail] = useState(value.email ?? "");
  const [phone, setPhone] = useState(value.phone ?? "");
  const [active, setActive] = useState(value.active !== false);
  const [busy, setBusy] = useState(false);

  // Imported questionnaire answers (read-only reference).
  const INFO_LABELS: [string, string][] = [
    ["gender_pref", "Gender preference"],
    ["age_pref", "Age preference"],
    ["ability_pref", "Swim-ability preference"],
    ["limitations", "Limitations"],
    ["special_needs_ok", "OK with special needs"],
    ["experience", "Prior experience"],
    ["fill_time", "How they want to fill time"],
    ["notes", "Other notes"],
  ];
  const info = value.info ?? null;
  const infoRows = info ? INFO_LABELS.filter(([k]) => info[k]) : [];

  async function save() {
    if (!name.trim()) return onError("Name is required");
    setBusy(true);
    try {
      await saveInstructor({ id: value.id, name: name.trim(), role, email: email.trim() || null, slug: value.slug, active, phone: phone.trim() || null });
      onSaved();
    } catch (e) {
      onError((e as Error).message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title={value.id ? "Edit instructor" : "Add instructor"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Role">
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Email (optional)"><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Cell phone (optional)"><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 310-555-1234" /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>

        {infoRows.length > 0 ? (
          <div className="rounded-xl border border-brand-green/15 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-green">From their info form</p>
            <dl className="mt-2 space-y-2">
              {infoRows.map(([k, label]) => (
                <div key={k}>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-brand-text/50">{label}</dt>
                  <dd className="text-sm text-brand-text/80">{info![k]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={busy} className="camp-btn flex-1">{busy ? "Saving…" : "Save"}</button>
          <button onClick={onClose} className="camp-btn-ghost">Cancel</button>
        </div>
      </div>
    </Shell>
  );
}

function StudentEditor({
  value, onClose, onSaved, onError,
}: {
  value: Partial<Student>;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [f, setF] = useState({
    first_name: value.first_name ?? "",
    last_name: value.last_name ?? "",
    gender: value.gender ?? "",
    age: value.age != null ? String(value.age) : "",
    level: (value.level as Level | "") ?? "",
    group_level: value.group_level ?? null,
    goals: value.goals ?? "",
    parent_notes: value.parent_notes ?? "",
    staff_notes: value.staff_notes ?? "",
    special_needs: value.special_needs ?? false,
    active: value.active !== false,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.first_name.trim() || !f.last_name.trim()) return onError("First and last name are required");
    setBusy(true);
    try {
      await saveStudent({
        id: value.id,
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        gender: f.gender.trim() || null,
        age: f.age ? parseInt(f.age, 10) : null,
        level: (f.level || null) as Level | null,
        group_level: f.group_level,
        goals: f.goals.trim() || null,
        parent_notes: f.parent_notes.trim() || null,
        staff_notes: f.staff_notes.trim() || null,
        special_needs: f.special_needs,
        active: f.active,
      });
      onSaved();
    } catch (e) {
      onError((e as Error).message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title={value.id ? "Edit student" : "Add student"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="First name"><input className={inputCls} value={f.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
          <Field label="Last name"><input className={inputCls} value={f.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
          <Field label="Gender"><input className={inputCls} value={f.gender} onChange={(e) => set("gender", e.target.value)} /></Field>
          <Field label="Age"><input type="number" className={inputCls} value={f.age} onChange={(e) => set("age", e.target.value)} /></Field>
        </div>
        <Field label="Level">
          <select className={inputCls} value={f.level} onChange={(e) => set("level", e.target.value)}>
            <option value="">—</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Swim group">
          <select
            className={inputCls}
            value={f.group_level ?? ""}
            onChange={(e) => set("group_level", e.target.value ? parseInt(e.target.value, 10) : null)}
          >
            <option value="">— No group —</option>
            {SWIM_GROUPS.map((g) => (
              <option key={g.level} value={g.level}>Level {g.level}: {g.emoji} {g.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Goals"><textarea rows={2} className={inputCls} value={f.goals} onChange={(e) => set("goals", e.target.value)} /></Field>
        <Field label="Parent notes"><textarea rows={2} className={inputCls} value={f.parent_notes} onChange={(e) => set("parent_notes", e.target.value)} /></Field>
        <Field label="Staff notes"><textarea rows={2} className={inputCls} value={f.staff_notes} onChange={(e) => set("staff_notes", e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.special_needs} onChange={(e) => set("special_needs", e.target.checked)} /> Special needs
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active
        </label>
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={busy} className="camp-btn flex-1">{busy ? "Saving…" : "Save"}</button>
          <button onClick={onClose} className="camp-btn-ghost">Cancel</button>
        </div>
      </div>
    </Shell>
  );
}
