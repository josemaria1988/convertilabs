import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/dashboard/account-menu";
import { LoadingLink } from "@/components/ui/loading-link";

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
            item.current ? (
              <div
                key={item.href}
                className="block rounded-2xl border border-transparent bg-[color:var(--color-accent)] px-4 py-3 text-white"
              >
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="mt-1 text-xs text-white/80">
                  {item.description}
                </p>
              </div>
            ) : (
              <LoadingLink
                key={item.href}
                href={item.href}
                pendingLabel="Abriendo..."
                className="block rounded-2xl border border-[color:var(--color-border)] bg-white/55 px-4 py-3 transition hover:bg-white/90 hover:shadow-[0_10px_24px_rgba(31,29,26,0.06)]"
              >
                <span className="block">
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className="mt-1 block text-xs text-[color:var(--color-muted)]">
                    {item.description}
                  </span>
                </span>
              </LoadingLink>
            )
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm leading-7 text-[color:var(--color-muted)]">
          Todo el contenido privado se resuelve desde SSR con contexto de organizacion
          real. La UI puede crecer despues sin aflojar tenant isolation.
        </div>
      </aside>

      <main className="space-y-6 pt-1">
        <div className="flex justify-end">
          <AccountMenu
            organizationName={organizationName}
            userEmail={userEmail}
          />
        </div>

        <header className="px-1">
          <h1 className="text-4xl font-semibold tracking-[-0.06em]">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-8 text-[color:var(--color-muted)]">
            {description}
          </p>
        </header>

        {children}
      </main>
    </div>
  );
}
