import Image from "next/image";
import Link from "next/link";

export default function Nav({
  backHref,
  subtitle,
}: {
  backHref?: string;
  subtitle?: string;
}) {
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
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Country Day Camp"
            width={48}
            height={48}
            className="h-12 w-12 rounded-full bg-white shadow-sm ring-2 ring-white/40"
            priority
          />
        </Link>
        <div className="ml-auto text-right">
          <span className="font-display text-2xl leading-none drop-shadow-sm">
            Swim Portal
          </span>
          {subtitle ? (
            <span className="block font-body text-xs text-white/80">{subtitle}</span>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
