import Link from "next/link";

export type TodoItem = {
  key: string;
  icon: string;
  title: string;
  desc: string;
  href: string;
};

/**
 * Friendly "here's what needs you right now" panel for the admin home. Shows a
 * short, actionable to-do list, or a cheerful all-clear when nothing's pending.
 */
export default function TodayPanel({ items, loading }: { items: TodoItem[]; loading: boolean }) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="camp-card mt-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-brand-green/10 bg-brand-sand/60 px-5 py-3">
        <h2 className="font-display text-2xl text-brand-green">👋 Today</h2>
        <span className="text-xs font-semibold text-brand-text/60">{today}</span>
      </div>
      <div className="p-4">
        {loading ? (
          <p className="px-1 py-6 text-center text-sm text-brand-text/60">Checking your camp…</p>
        ) : items.length === 0 ? (
          <div className="px-1 py-6 text-center">
            <p className="text-4xl">🎉</p>
            <p className="mt-2 font-display text-xl text-brand-green">You&apos;re all caught up!</p>
            <p className="mt-1 text-sm text-brand-text/70">
              Everything looks great — nothing needs you right now.
            </p>
          </div>
        ) : (
          <>
            <p className="px-1 pb-2 text-sm font-semibold text-brand-text/70">
              {items.length === 1 ? "One thing needs you:" : `${items.length} things need you:`}
            </p>
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.key}>
                  <Link
                    href={it.href}
                    className="group flex items-center gap-3 rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-3 transition hover:border-brand-orange hover:bg-brand-orange/10"
                  >
                    <span className="text-2xl">{it.icon}</span>
                    <span className="flex-1">
                      <span className="block font-semibold text-brand-text">{it.title}</span>
                      <span className="block text-xs text-brand-text/60">{it.desc}</span>
                    </span>
                    <span className="text-xl text-brand-orange transition group-hover:translate-x-0.5">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
