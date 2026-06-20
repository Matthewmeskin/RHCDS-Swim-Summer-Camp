"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Nav from "@/components/Nav";
import InstructorSelect from "@/components/InstructorSelect";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { fetchInstructors } from "@/lib/data";
import type { Instructor } from "@/lib/types";

export default function LandingPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    fetchInstructors()
      .then(setInstructors)
      .catch((e) => setError(e.message ?? "Could not load instructors"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen">
      <Nav />

      {!isSupabaseConfigured ? (
        <ConfigNotice />
      ) : (
        <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
          <div className="camp-card text-center">
            {/* Sunset hero band echoing the logo */}
            <div className="rounded-t-2xl bg-gradient-to-b from-brand-orange/15 via-brand-yellow/15 to-transparent px-8 pt-10 pb-6">
              <Image
                src="/camp-logo.png"
                alt="Country Day Camp"
                width={144}
                height={144}
                className="mx-auto h-32 w-32 rounded-full bg-white shadow-md ring-4 ring-white"
                priority
              />
              <h1 className="mt-5 font-display text-4xl text-brand-green sm:text-5xl">
                Welcome to Swim Camp
              </h1>
              <p className="mt-2 text-brand-text/70">
                Select your name to see your schedule
              </p>
            </div>

            <div className="px-8 pb-8 pt-2">
              {loading ? (
                <p className="text-sm text-brand-text/60">Loading instructors…</p>
              ) : error ? (
                <p className="text-sm text-brand-orange">{error}</p>
              ) : instructors.length === 0 ? (
                <p className="text-sm text-brand-text/60">
                  No instructors yet — run the seed script.
                </p>
              ) : (
                <InstructorSelect instructors={instructors} />
              )}
            </div>
          </div>

          <footer className="mt-8 text-center">
            <Link
              href="/admin"
              className="text-sm font-semibold text-brand-green underline-offset-2 hover:underline"
            >
              Admin
            </Link>
          </footer>
        </div>
      )}
    </main>
  );
}
