"use server";

import {
  enqueueSelectedDocumentExtractionsAction,
  failDocumentUploadAction,
  finalizeDocumentUploadAction,
  prepareDocumentUploadAction,
} from "@/app/app/o/[slug]/documents/actions";
import {
  archiveOrganizationCostCenterAction,
  assignOrganizationDocumentCostCenterAction,
  createOrganizationCostCenterAction,
} from "../cost-centers/actions";

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
