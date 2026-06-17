import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { LoadingLink } from "@/components/ui/loading-link";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  listOrganizationCostCenters,
  loadOrganizationDocumentsCountByCostCenter,
} from "@/modules/cost-centers/service";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationWorkPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Trabajos",
};

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default async function OrganizationWorkPage({
  params,
}: OrganizationWorkPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const [projects, documentsCountByProjectId] = await Promise.all([
    listOrganizationCostCenters({
      organizationId: organization.id,
      includeArchived: true,
    }),
    loadOrganizationDocumentsCountByCostCenter(organization.id),
  ]);
  const activeProjects = projects.filter((project) => project.isActive);
  const archivedProjects = projects.filter((project) => !project.isActive);

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Trabajos"
      toolbarLabel="Trabajos"
      description="Trabajos, proyectos y centros de costo conectados al modelo madre."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "work")}
    >
      <div className="space-y-4">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
                Trabajos
              </h1>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Primer corte visible sobre los proyectos existentes. El detalle completo de trabajo se abre en el siguiente corte.
              </p>
            </div>
            <LoadingLink
              href={`/app/o/${organization.slug}/settings?tab=company`}
              pendingLabel="Abriendo..."
              className="ui-button ui-button--primary w-full sm:w-auto"
            >
              Administrar
            </LoadingLink>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="metric-card" data-tone={activeProjects.length > 0 ? "success" : undefined}>
              <span className="metric-card__label">Activos</span>
              <span className="metric-card__value">{activeProjects.length}</span>
              <p className="metric-card__hint">Disponibles para asociar documentos y actividad.</p>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">Archivados</span>
              <span className="metric-card__value">{archivedProjects.length}</span>
              <p className="metric-card__hint">Conservan trazabilidad historica.</p>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">Documentos asociados</span>
              <span className="metric-card__value">
                {Object.values(documentsCountByProjectId).reduce((sum, count) => sum + count, 0)}
              </span>
              <p className="metric-card__hint">Documentos que ya apuntan a un trabajo/proyecto.</p>
            </article>
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Trabajos activos</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Vista base para no perder el hilo operativo mientras llega el CRUD completo.
              </p>
            </div>
            <span className="ui-filter">{activeProjects.length}</span>
          </div>

          <div className="mt-4 space-y-3">
            {activeProjects.length === 0 ? (
              <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
                Todavia no hay trabajos activos. Crea el primero desde administracion para empezar a conectar documentos, dinero y margen.
              </div>
            ) : (
              activeProjects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-[6px] border border-[color:var(--color-border)] bg-white/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{project.name}</p>
                      <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                        {project.description ?? "Sin descripcion adicional."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="status-pill status-pill--info">
                        {documentsCountByProjectId[project.id] ?? 0} documento(s)
                      </span>
                      <span className={project.workUnitId ? "status-pill status-pill--success" : "status-pill status-pill--warning"}>
                        {project.workUnitId ? "Work unit" : "Puente pendiente"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 text-[12px] text-[color:var(--color-muted)]">
                    Actualizado {formatDate(project.updatedAt)}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </PrivateDashboardShell>
  );
}
