"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

/**
 * Gates admin pages behind a Supabase session. Redirects to /admin/login when
 * signed out, and shows a slim "signed in as … · Sign out" bar when signed in.
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "in" | "out">("checking");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setState("out");
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setEmail(data.session.user.email ?? null);
        setState("in");
      } else {
        setState("out");
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setEmail(session.user.email ?? null);
        setState("in");
      } else {
        setState("out");
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state === "out") router.replace("/admin/login");
  }, [state, router]);

  if (state !== "in") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-brand-text/60">
          {state === "checking" ? "Checking your session…" : "Redirecting to login…"}
        </p>
      </main>
    );
  }

  async function signOut() {
    await supabase?.auth.signOut();
    router.replace("/admin/login");
  }

  return (
    <>
      <div className="no-print flex items-center justify-end gap-3 bg-brand-green/10 px-4 py-1 text-xs text-brand-text">
        <span className="mr-auto truncate">Signed in as {email}</span>
        <Link href="/admin/account" className="font-bold text-brand-green hover:underline">
          Account
        </Link>
        <button
          onClick={signOut}
          className="font-bold text-brand-green hover:underline"
        >
          Sign out
        </button>
      </div>
      {children}
    </>
  );
}
