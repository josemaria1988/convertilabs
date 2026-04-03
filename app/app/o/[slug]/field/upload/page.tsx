import type { Metadata } from "next";
import { FieldActivityList } from "@/components/mobile/field-activity-list";
import { FieldUploadSheet } from "@/components/mobile/field-upload-sheet";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildFieldMobileActivityCards } from "@/modules/presentation/field-mobile";
import {
  assignFieldDocumentToProjectAction,
  enqueueFieldDocumentExtractionsAction,
  failFieldDocumentUploadAction,
  finalizeFieldDocumentUploadAction,
  prepareFieldDocumentUploadAction,
} from "../actions";
import { loadFieldWorkspaceData, readOptionalSearchParam } from "../data";

type OrganizationFieldUploadPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    costCenterId?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Campo | Subir",
};

export default async function OrganizationFieldUploadPage({
  params,
  searchParams,
}: OrganizationFieldUploadPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { organization } = await requireOrganizationDashboardPage(slug);
  const workspace = await loadFieldWorkspaceData({
    organizationId: organization.id,
    organizationSlug: organization.slug,
    costCenterId: readOptionalSearchParam(resolvedSearchParams.costCenterId),
    limit: 18,
  });
  const recentCards = buildFieldMobileActivityCards({
    items: workspace.filteredDocuments,
    organizationSlug: organization.slug,
    costCenterNameById: workspace.costCenterNameById,
    limit: 5,
  });
  const selectedProject = workspace.activeCostCenterId
    ? workspace.costCenters.find((item) => item.id === workspace.activeCostCenterId) ?? null
    : null;

  return (
    <div className="space-y-4">
      {selectedProject ? (
        <section className="field-panel">
          <div className="field-panel__header">
            <div>
              <p className="field-panel__eyebrow">Proyecto activo</p>
              <h1 className="field-panel__title">{selectedProject.name}</h1>
              <p className="field-panel__description">
                La carga nueva quedara asociada a este proyecto salvo que cambies la seleccion antes de subir.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <FieldUploadSheet
        slug={organization.slug}
        costCenters={workspace.costCenters}
        initialCostCenterId={workspace.activeCostCenterId}
        prepareUploadAction={prepareFieldDocumentUploadAction.bind(null, organization.slug)}
        finalizeUploadAction={finalizeFieldDocumentUploadAction.bind(null, organization.slug)}
        failUploadAction={failFieldDocumentUploadAction.bind(null, organization.slug)}
        enqueueExtractionsAction={enqueueFieldDocumentExtractionsAction.bind(null, organization.slug)}
        assignCostCenterAction={assignFieldDocumentToProjectAction.bind(null, organization.slug)}
      />

      <FieldActivityList
        title="Ultimos movimientos"
        description={
          selectedProject
            ? "Actividad reciente del proyecto seleccionado para verificar la carga y el procesamiento."
            : "Ultimos documentos para validar que la carga entro al workflow real."
        }
        emptyMessage={
          selectedProject
            ? "Todavia no hay actividad para este proyecto."
            : "Todavia no hay documentos recientes para mostrar."
        }
        cards={recentCards}
      />
    </div>
  );
}
