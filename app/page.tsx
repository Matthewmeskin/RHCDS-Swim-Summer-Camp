"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import InstructorLogin from "@/components/InstructorLogin";
import ConfigNotice from "@/components/ConfigNotice";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export default function LandingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <Landing />
    </Suspense>
  );
}

function Landing() {
  const params = useSearchParams();
  const loginMsg =
    params.get("login") === "unknown"
      ? "That email isn't recognized as an instructor or admin."
      : params.get("login") === "error"
        ? "That login link was invalid or expired. Please request a new one."
        : null;

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
                Sign in to see your schedule
              </p>
            </div>

            <div className="px-8 pb-8 pt-2">
              {loginMsg ? (
                <p className="mb-3 rounded-lg bg-brand-orange/15 px-3 py-2 text-sm text-brand-orange">
                  {loginMsg}
                </p>
              ) : null}
              <InstructorLogin />
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
