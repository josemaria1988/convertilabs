import Link from "next/link";
import { marketingNav } from "@/lib/navigation";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-background)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--color-accent)] text-sm font-semibold text-white">
            CL
          </span>
          <div>
            <p className="text-lg font-semibold tracking-[-0.04em]">Convertilabs</p>
            <p className="text-sm text-[color:var(--color-muted)]">
              Finance ops for modern teams
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 text-sm text-[color:var(--color-muted)] md:flex">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 transition hover:bg-white/70 hover:text-[color:var(--color-foreground)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium"
          >
            Login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full bg-[color:var(--color-foreground)] px-4 py-2 text-sm font-medium text-white transition hover:bg-black/85"
          >
            Ver dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
