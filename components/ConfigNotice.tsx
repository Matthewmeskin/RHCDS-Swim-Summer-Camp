export default function ConfigNotice() {
  return (
    <div className="camp-card mx-auto mt-8 max-w-xl p-6 text-center">
      <h2 className="font-display text-2xl text-brand-green">Almost there!</h2>
      <p className="mt-2 text-sm text-brand-text">
        Supabase isn&apos;t configured yet. Add{" "}
        <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
        to <code className="rounded bg-white px-1">.env.local</code>, then restart
        the dev server.
      </p>
    </div>
  );
}
