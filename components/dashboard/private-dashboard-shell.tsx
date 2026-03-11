import Link from "next/link";
import type { ReactNode } from "react";

export type PrivateDashboardNavItem = {
  href: string;
  label: string;
  description: string;
  current?: boolean;
};

type PrivateDashboardShellProps = {
  organizationName: string;
  organizationSlug: string;
  userEmail?: string | null;
  userRole: string;
  title: string;
  description: string;
  uploadHref: string;
  navItems: PrivateDashboardNavItem[];
  children: ReactNode;
};

export function PrivateDashboardShell({
  organizationName,
  organizationSlug,
  userEmail,
  userRole,
  title,
  description,
  uploadHref,
  navItems,
  children,
}: PrivateDashboardShellProps) {
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel h-fit p-5 lg:sticky lg:top-6">
        <Link href="/app" className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--color-accent)] text-sm font-semibold text-white">
            CL
          </span>
          <div>
            <p className="font-semibold tracking-[-0.04em]">Convertilabs</p>
            <p className="text-sm text-[color:var(--color-muted)]">Private app</p>
          </div>
        </Link>

        <div className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            Organizacion actual
          </p>
          <p className="mt-3 text-xl font-semibold tracking-[-0.04em]">
            {organizationName}
          </p>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">
            /app/o/{organizationSlug}
          </p>
          <p className="mt-3 text-sm text-[color:var(--color-muted)]">
            Rol: {userRole}
          </p>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            {userEmail ?? "Cuenta autenticada"}
          </p>
        </div>

        <div className="mt-6 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-2xl border px-4 py-3 transition ${
                item.current
                  ? "border-transparent bg-[color:var(--color-accent)] text-white"
                  : "border-[color:var(--color-border)] bg-white/55 hover:bg-white/90"
              }`}
            >
              <p className="text-sm font-semibold">{item.label}</p>
              <p
                className={`mt-1 text-xs ${
                  item.current
                    ? "text-white/80"
                    : "text-[color:var(--color-muted)]"
                }`}
              >
                {item.description}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm leading-7 text-[color:var(--color-muted)]">
          Todo el contenido privado se resuelve desde SSR con contexto de organizacion
          real. La UI puede crecer despues sin aflojar tenant isolation.
        </div>
      </aside>

      <main className="space-y-6">
        <section className="panel px-6 py-8 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <span className="eyebrow">Private app</span>
              <div className="space-y-2">
                <h1 className="text-4xl font-semibold tracking-[-0.06em]">
                  {title}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[color:var(--color-muted)]">
                  {description}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={uploadHref}
                className="rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
              >
                Subir primer documento
              </Link>
              <form action="/logout" method="post">
                <button
                  type="submit"
                  className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-5 py-3 text-sm font-semibold"
                >
                  Cerrar sesion
                </button>
              </form>
            </div>
          </div>
        </section>

        {children}
      </main>
    </div>
  );
}
