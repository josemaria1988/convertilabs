import type { ReactNode } from "react";
import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { workspaceNav } from "@/lib/navigation";

type WorkspaceShellProps = {
  activePath: string;
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function WorkspaceShell({
  activePath,
  title,
  description,
  children,
  actions,
}: WorkspaceShellProps) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="panel h-fit p-5 lg:sticky lg:top-6">
          <LoadingLink href="/app" pendingLabel="Abriendo..." className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--color-accent)] text-sm font-semibold text-white">
              CL
            </span>
            <div>
              <p className="font-semibold tracking-[-0.04em]">Convertilabs</p>
              <p className="text-sm text-[color:var(--color-muted)]">Workspace</p>
            </div>
          </LoadingLink>

          <div className="space-y-2">
            {workspaceNav.map((item) => {
              const isActive = item.href === activePath;

              return (
                <LoadingLink
                  key={item.href}
                  href={item.href}
                  pendingLabel="Abriendo..."
                  className={`block rounded-2xl border px-4 py-3 transition ${
                    isActive
                      ? "border-transparent bg-[color:var(--color-accent)] text-white"
                      : "border-[color:var(--color-border)] bg-white/55 hover:bg-white/90"
                  }`}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  {item.description ? (
                    <p
                      className={`mt-1 text-xs ${
                        isActive ? "text-white/80" : "text-[color:var(--color-muted)]"
                      }`}
                    >
                      {item.description}
                    </p>
                  ) : null}
                </LoadingLink>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm text-[color:var(--color-muted)]">
            API y auth pueden vivir dentro del repo al inicio. Cuando haga falta,
            separamos servicios sin cambiar el front.
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
                {actions}
                <form action="/logout" method="post">
                  <SubmitButton
                    pendingLabel="Cerrando..."
                    className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-4 py-2 text-sm font-medium"
                  >
                    Cerrar sesion
                  </SubmitButton>
                </form>
              </div>
            </div>
          </section>

          {children}
        </main>
      </div>
    </div>
  );
}
