"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  archiveOrganizationCostCenter,
  assignDocumentCostCenter,
  canArchiveOrganizationCostCenter,
  canAssignOrganizationCostCenter,
  canCreateOrganizationCostCenter,
  createOrganizationCostCenter,
  type CostCenterAssignmentSource,
} from "@/modules/cost-centers/service";

function revalidateCostCenterPaths(slug: string, documentId?: string) {
  revalidatePath(`/app/o/${slug}/field`);
  revalidatePath(`/app/o/${slug}/field/upload`);
  revalidatePath(`/app/o/${slug}/field/activity`);
  revalidatePath(`/app/o/${slug}/field/projects`);
  revalidatePath(`/app/o/${slug}/documents`);
  revalidatePath(`/app/o/${slug}/documents/pending-assignment`);
  revalidatePath(`/app/o/${slug}/review`);
  revalidatePath(`/app/o/${slug}/settings`);

  if (documentId) {
    revalidatePath(`/app/o/${slug}/documents/${documentId}`);
  }
}

export async function createOrganizationCostCenterAction(input: {
  slug: string;
  name: string;
  description?: string | null;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!canCreateOrganizationCostCenter(organization.role)) {
    return {
      ok: false,
      message: "Tu rol no puede crear proyectos o centros de costo.",
      costCenter: null,
    };
  }

  try {
    const costCenter = await createOrganizationCostCenter({
      organizationId: organization.id,
      actorId: authState.user?.id ?? null,
      name: input.name,
      description: input.description ?? null,
    });

    revalidateCostCenterPaths(input.slug);

    return {
      ok: true,
      message: "Proyecto creado y disponible en desktop y app de campo.",
      costCenter,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo crear el proyecto.",
      costCenter: null,
    };
  }
}

export async function archiveOrganizationCostCenterAction(input: {
  slug: string;
  costCenterId: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!canArchiveOrganizationCostCenter(organization.role)) {
    return {
      ok: false,
      message: "Tu rol no puede archivar proyectos o centros de costo.",
      costCenter: null,
    };
  }

  try {
    const costCenter = await archiveOrganizationCostCenter({
      organizationId: organization.id,
      costCenterId: input.costCenterId,
      actorId: authState.user?.id ?? null,
    });

    revalidateCostCenterPaths(input.slug);

    return {
      ok: true,
      message: "Proyecto archivado. Los documentos historicos conservan la relacion.",
      costCenter,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo archivar el proyecto.",
      costCenter: null,
    };
  }
}

export async function assignOrganizationDocumentCostCenterAction(input: {
  slug: string;
  documentId: string;
  costCenterId: string | null;
  sourceSurface?: CostCenterAssignmentSource;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!canAssignOrganizationCostCenter(organization.role)) {
    return {
      ok: false,
      message: "Tu rol no puede asociar documentos a proyectos.",
      assignment: null,
    };
  }

  try {
    const assignment = await assignDocumentCostCenter({
      organizationId: organization.id,
      documentId: input.documentId,
      costCenterId: input.costCenterId,
      actorId: authState.user?.id ?? null,
      assignmentSource: input.sourceSurface,
    });

    revalidateCostCenterPaths(input.slug, input.documentId);

    return {
      ok: true,
      message: input.costCenterId
        ? "Proyecto actualizado en el documento."
        : "Proyecto removido del documento.",
      assignment,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo actualizar el proyecto del documento.",
      assignment: null,
    };
  }
}
