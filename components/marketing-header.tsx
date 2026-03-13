import Link from "next/link";
import { ConvertilabsLogo } from "@/components/convertilabs-logo";
import { marketingNav } from "@/lib/navigation";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-background)]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/">
            <ConvertilabsLogo subtitle="Infraestructura contable y fiscal" />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-[0.95rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.88)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[rgba(24,39,77,0.92)]"
            >
              Ingresar
            </Link>
            <Link
              href="/contact"
              className="rounded-[0.95rem] border border-[rgba(124,157,255,0.22)] bg-[linear-gradient(180deg,rgba(104,143,255,0.95),rgba(72,115,235,0.95))] px-4 py-3 text-sm font-medium text-white transition hover:brightness-110"
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
              className="shrink-0 rounded-[0.95rem] px-4 py-2 transition hover:bg-white/70"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
