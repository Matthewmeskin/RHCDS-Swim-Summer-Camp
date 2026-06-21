"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import GlobalSearch from "@/components/GlobalSearch";

export default function Nav({
  backHref,
  subtitle,
}: {
  backHref?: string;
  subtitle?: string;
}) {
  // In the admin area the logo should go to the admin dashboard, not the
  // public/staff sign-in page at "/".
  const pathname = usePathname();
  const homeHref = pathname?.startsWith("/admin") ? "/admin" : "/";
  return (
    <nav className="no-print sticky top-0 z-30 border-b border-black/10 bg-gradient-to-r from-brand-green to-[#356b4f] text-white shadow-md">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="-ml-1 mr-0.5 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none transition hover:bg-white/15"
          >
            ‹
          </Link>
        ) : null}
        <Link href={homeHref} className="flex items-center gap-3">
          <Image
            src="/camp-logo.png"
            alt="Country Day Camp"
            width={48}
            height={48}
            className="h-12 w-12 rounded-full bg-white shadow-sm ring-2 ring-white/40"
            priority
          />
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <GlobalSearch />
          <div className="text-right">
            <span className="font-display text-2xl leading-none drop-shadow-sm">
              Swim Portal
            </span>
            {subtitle ? (
              <span className="block font-body text-xs text-white/80">{subtitle}</span>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
