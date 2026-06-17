import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { LoadingLink } from "@/components/ui/loading-link";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationAgendaPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Agenda",
};

export default async function OrganizationAgendaPage({
  params,
}: OrganizationAgendaPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Agenda"
      toolbarLabel="Agenda"
      description="Tareas, vencimientos y obligaciones operativas de la empresa."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "agenda")}
    >
      <div className="space-y-4">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
                Agenda
              </h1>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Todavia no hay tareas publicadas en el modelo operativo. Los vencimientos reales disponibles hoy viven en dinero, IVA y cierre.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="metric-card">
              <span className="metric-card__label">Tareas</span>
              <span className="metric-card__value">0</span>
              <p className="metric-card__hint">No hay tareas creadas en este corte.</p>
            </article>
            <LoadingLink
              href={`/app/o/${organization.slug}/open-items`}
              pendingLabel="Abriendo..."
              className="metric-card"
            >
              <span className="metric-card__label">Dinero</span>
              <span className="metric-card__value">Abrir</span>
              <p className="metric-card__hint">Vencimientos de cobros y pagos con saldo vivo.</p>
            </LoadingLink>
            <LoadingLink
              href={`/app/o/${organization.slug}/close`}
              pendingLabel="Abriendo..."
              className="metric-card"
            >
              <span className="metric-card__label">Cierre</span>
              <span className="metric-card__value">Abrir</span>
              <p className="metric-card__hint">Bloqueos y validaciones mensuales ya trazables.</p>
            </LoadingLink>
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Proximas entradas</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                La agenda va a consolidar tareas, obligaciones fiscales, procesos y dependencias humanas.
              </p>
            </div>
            <span className="ui-filter">Pendiente</span>
          </div>
          <div className="mt-4 rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
            No se muestran recordatorios hasta que exista una tarea, obligacion o vencimiento materializado.
          </div>
        </section>
      </div>
    </PrivateDashboardShell>
  );
}
