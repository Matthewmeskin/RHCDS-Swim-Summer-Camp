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
    <nav className="no-print bg-brand-green text-white">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="mr-1 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none hover:bg-white/15"
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
            className="h-12 w-12 rounded-full bg-white/90"
            priority
          />
        </Link>
        <div className="ml-auto text-right">
          <span className="font-display text-2xl leading-none">Swim Portal</span>
          {subtitle ? (
            <span className="block font-body text-xs text-white/80">{subtitle}</span>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
