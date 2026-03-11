import Link from "next/link";
import { marketingNav } from "@/lib/navigation";
import { siteConfig } from "@/lib/site";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-background)]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--color-accent)] text-sm font-semibold text-white">
              CL
            </span>
            <div>
              <p className="text-lg font-semibold tracking-[-0.04em]">Convertilabs</p>
              <p className="text-sm text-[color:var(--color-muted)]">
                {siteConfig.tagline}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-[color:var(--color-border)] bg-white/70 px-4 py-2 text-sm font-medium"
            >
              Ingresar
            </Link>
            <Link
              href="/contact"
              className="rounded-full bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[color:var(--color-accent-strong)]"
            >
              Solicitar demo
            </Link>
          </div>
        </div>

        <nav className="mobile-nav order-3 -mx-1 mt-4 flex gap-1 overflow-x-auto pb-1 text-sm text-[color:var(--color-muted)] md:mx-0 md:mt-4 md:justify-center md:overflow-visible md:pb-0">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full px-4 py-2 transition hover:bg-white/70 hover:text-[color:var(--color-foreground)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
