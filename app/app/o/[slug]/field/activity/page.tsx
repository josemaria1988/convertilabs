import type { Metadata } from "next";
import { FieldActivityList } from "@/components/mobile/field-activity-list";
import { FieldStatusSummary } from "@/components/mobile/field-status-summary";
import { LoadingLink } from "@/components/ui/loading-link";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  buildFieldMobileActivityCards,
  buildFieldMobileSummary,
} from "@/modules/presentation/field-mobile";
import { loadFieldWorkspaceData, readOptionalSearchParam } from "../data";

type OrganizationFieldActivityPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    costCenterId?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Campo | Actividad",
};

export default async function OrganizationFieldActivityPage({
  params,
  searchParams,
}: OrganizationFieldActivityPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { organization } = await requireOrganizationDashboardPage(slug);
  const workspace = await loadFieldWorkspaceData({
    organizationId: organization.id,
    organizationSlug: organization.slug,
    costCenterId: readOptionalSearchParam(resolvedSearchParams.costCenterId),
    limit: 80,
  });
  const summaryCards = buildFieldMobileSummary(workspace.filteredDocuments);
  const cards = buildFieldMobileActivityCards({
    items: workspace.filteredDocuments,
    organizationSlug: organization.slug,
    costCenterNameById: workspace.costCenterNameById,
    workUnitNameById: workspace.workUnitNameById,
  });
  const selectedProject = workspace.activeCostCenterId
    ? workspace.costCenters.find((item) => item.id === workspace.activeCostCenterId) ?? null
    : null;
  const activeProjects = workspace.costCenters.filter((item) => item.isActive);

  return (
    <div className="space-y-4">
      <section className="field-panel">
        <div className="field-panel__header">
          <div>
            <p className="field-panel__eyebrow">Seguimiento</p>
            <h1 className="field-panel__title">
              {selectedProject
                ? `Actividad de ${selectedProject.name}`
                : "Actividad reciente de campo"}
            </h1>
            <p className="field-panel__description">
              Sigue documentos que estan procesando, listos para revisar o bloqueados sin abrir la cola experta completa.
            </p>
          </div>
          <LoadingLink
            href={`/app/o/${organization.slug}/review`}
            pendingLabel="Abriendo..."
            className="ui-button ui-button--secondary min-h-[42px] w-full sm:w-auto"
          >
            Abrir revision completa
          </LoadingLink>
        </div>

        <div className="field-filter-row mt-4">
          <LoadingLink
            href={`/app/o/${organization.slug}/field/activity`}
            pendingLabel="Filtrando..."
            className="field-filter-chip"
            data-current={selectedProject ? undefined : "true"}
          >
            Todo
          </LoadingLink>
          {activeProjects.map((project) => (
            <LoadingLink
              key={project.id}
              href={`/app/o/${organization.slug}/field/activity?costCenterId=${project.id}`}
              pendingLabel="Filtrando..."
              className="field-filter-chip"
              data-current={workspace.activeCostCenterId === project.id ? "true" : undefined}
            >
              {project.name}
            </LoadingLink>
          ))}
        </div>
      </section>

      <FieldStatusSummary cards={summaryCards} />

      <FieldActivityList
        title={selectedProject ? "Actividad filtrada" : "Actividad completa"}
        description={
          selectedProject
            ? "Vista acotada a un proyecto para controlar carga, procesamiento y bloqueos."
            : "Lista operativa de documentos recientes en el carril mobile."
        }
        emptyMessage={
          selectedProject
            ? "Todavia no hay documentos asociados a este proyecto."
            : "Todavia no hay actividad reciente en este workspace."
        }
        cards={cards}
      />
    </div>
  );
}
