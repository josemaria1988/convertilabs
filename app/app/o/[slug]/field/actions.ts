"use server";

import { revalidatePath } from "next/cache";
import {
  enqueueSelectedDocumentExtractionsAction,
  failDocumentUploadAction,
  finalizeDocumentUploadAction,
  prepareDocumentUploadAction,
} from "@/app/app/o/[slug]/documents/actions";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  assignDocumentToWorkUnit,
  canMutateWorkUnit,
} from "@/modules/work";
import {
  archiveOrganizationCostCenterAction,
  assignOrganizationDocumentCostCenterAction,
  createOrganizationCostCenterAction,
} from "../cost-centers/actions";

function revalidateFieldDocumentAssignmentPaths(
  slug: string,
  documentId?: string | null,
  workUnitId?: string | null,
) {
  revalidatePath(`/app/o/${slug}/field`);
  revalidatePath(`/app/o/${slug}/field/upload`);
  revalidatePath(`/app/o/${slug}/field/activity`);
  revalidatePath(`/app/o/${slug}/documents`);
  revalidatePath(`/app/o/${slug}/review`);
  revalidatePath(`/app/o/${slug}/work`);
  revalidatePath(`/app/o/${slug}/money`);
  revalidatePath(`/app/o/${slug}/dashboard`);

  if (documentId) {
    revalidatePath(`/app/o/${slug}/documents/${documentId}`);
  }

  if (workUnitId) {
    revalidatePath(`/app/o/${slug}/work/${workUnitId}`);
  }
}

export async function createFieldCostCenterAction(input: {
  slug: string;
  name: string;
  description?: string | null;
}) {
  return createOrganizationCostCenterAction(input);
}

export async function archiveFieldCostCenterAction(input: {
  slug: string;
  costCenterId: string;
}) {
  return archiveOrganizationCostCenterAction(input);
}

export async function assignFieldDocumentCostCenterAction(input: {
  slug: string;
  documentId: string;
  costCenterId: string | null;
}) {
  return assignOrganizationDocumentCostCenterAction({
    ...input,
    sourceSurface: "mobile_field",
  });
}

export async function createFieldProjectAction(
  slug: string,
  input: {
    name: string;
    description?: string | null;
  },
) {
  const result = await createFieldCostCenterAction({
    slug,
    ...input,
  });

  return {
    ok: result.ok,
    message: result.message,
  };
}

export async function archiveFieldProjectAction(
  slug: string,
  input: {
    costCenterId: string;
  },
) {
  const result = await archiveFieldCostCenterAction({
    slug,
    ...input,
  });

  return {
    ok: result.ok,
    message: result.message,
  };
}

export async function assignFieldDocumentToProjectAction(
  slug: string,
  input: {
    documentId: string;
    costCenterId: string | null;
  },
) {
  const result = await assignFieldDocumentCostCenterAction({
    slug,
    ...input,
  });

  return {
    ok: result.ok,
    message: result.message,
  };
}

export async function assignFieldDocumentToWorkUnitAction(
  slug: string,
  input: {
    documentId: string;
    workUnitId: string | null;
  },
) {
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canMutateWorkUnit(organization.role)) {
    return {
      ok: false,
      message: "Tu rol no puede asociar documentos a trabajos.",
    };
  }

  try {
    const assignment = await assignDocumentToWorkUnit(getSupabaseServiceRoleClient(), {
      organizationId: organization.id,
      documentId: input.documentId,
      workUnitId: input.workUnitId,
      actorId: authState.user?.id ?? null,
    });

    revalidateFieldDocumentAssignmentPaths(
      organization.slug,
      input.documentId,
      input.workUnitId,
    );

    return {
      ok: true,
      message: input.workUnitId
        ? "Trabajo asociado al documento."
        : "Trabajo removido del documento.",
      assignment,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo actualizar el trabajo del documento.",
    };
  }
}

export async function prepareFieldDocumentUploadAction(
  slug: string,
  input: {
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    fileHash?: string | null;
    sourceSurface?: "mobile_field";
  },
) {
  const result = await prepareDocumentUploadAction({
    slug,
    ...input,
  });

  return {
    ok: result.ok,
    message: result.ok ? "Upload preparado." : result.message,
    documentId: result.ok ? result.documentId : undefined,
    signedUploadUrl: result.ok ? result.signedUploadUrl : undefined,
  };
}

export async function finalizeFieldDocumentUploadAction(
  slug: string,
  input: {
    documentId: string;
  },
) {
  const result = await finalizeDocumentUploadAction({
    slug,
    ...input,
  });

  return {
    ok: result.ok,
    message: result.ok
      ? "Documento cargado y listo para encolar."
      : result.message,
    documentId: result.ok ? result.documentId : undefined,
  };
}

export async function failFieldDocumentUploadAction(
  slug: string,
  input: {
    documentId: string;
    errorMessage?: string;
  },
) {
  const result = await failDocumentUploadAction({
    slug,
    ...input,
  });

  return {
    ok: result.ok,
    message: result.ok
      ? "Error de carga registrado."
      : result.message,
  };
}

export async function enqueueFieldDocumentExtractionsAction(
  slug: string,
  input: {
    documentIds: string[];
  },
) {
  return enqueueSelectedDocumentExtractionsAction({
    slug,
    ...input,
  });
}
