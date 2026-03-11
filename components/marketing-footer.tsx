import Link from "next/link";
import { marketingNav } from "@/lib/navigation";
import { siteConfig } from "@/lib/site";

const appLinks = [
  { href: "/login", label: "Ingreso" },
  { href: "/dashboard", label: "Panel" },
  { href: "/documents", label: "Documentos" },
  { href: "/journal-entries", label: "Asientos" },
  { href: "/tax", label: "Impuestos" },
];

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[color:var(--color-border)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="text-lg font-semibold tracking-[-0.04em]">{siteConfig.name}</p>
          <p className="max-w-md text-sm text-[color:var(--color-muted)]">
            Infraestructura contable y fiscal para Uruguay, desde el ingreso
            documental hasta los flujos tributarios estructurados.
          </p>
          <p className="text-sm text-[color:var(--color-muted)]">
            {siteConfig.contactEmail}
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            Sitio
          </p>
          <div className="space-y-2 text-sm">
            {marketingNav.map((item) => (
              <Link key={item.href} href={item.href} className="block hover:underline">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            Aplicacion
          </p>
          <div className="space-y-2 text-sm">
            {appLinks.map((item) => (
              <Link key={item.href} href={item.href} className="block hover:underline">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[color:var(--color-border)] px-6 py-4 text-center text-sm text-[color:var(--color-muted)]">
        {year} {siteConfig.name}. Disenado para operaciones contables y fiscales en Uruguay.
      </div>
    </footer>
  );
}
