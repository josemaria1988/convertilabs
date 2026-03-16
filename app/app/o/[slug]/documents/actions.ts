"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { runDocumentClassification } from "@/modules/accounting/classification-runner";
import { enqueueDocumentProcessing } from "@/modules/documents/processing";

function buildPaths(slug: string, documentId?: string) {
  return {
    dashboard: `/app/o/${slug}/dashboard`,
    documents: `/app/o/${slug}/documents`,
    review: documentId ? `/app/o/${slug}/documents/${documentId}` : null,
  };
}

function canRunExtraction(role: string) {
  return role !== "viewer";
}

function canRunClassification(role: string) {
  return ["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role);
}

function revalidateDocumentSurfaces(slug: string, documentId?: string) {
  const paths = buildPaths(slug, documentId);
  revalidatePath(paths.dashboard);
  revalidatePath(paths.documents);

  if (paths.review) {
    revalidatePath(paths.review);
  }
}

async function filterOrganizationDocumentIds(organizationId: string, documentIds: string[]) {
  if (documentIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", documentIds);

  if (error) {
    throw new Error(error.message);
  }

  return (((data as Array<{ id: string }> | null) ?? [])).map((row) => row.id);
}

export async function enqueueDocumentExtractionAction(input: {
  slug: string;
  documentId: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!canRunExtraction(organization.role)) {
    return {
      ok: false,
      message: "Tu rol no puede encolar extracciones documentales.",
    };
  }

  const allowedDocumentIds = await filterOrganizationDocumentIds(organization.id, [input.documentId]);

  if (!allowedDocumentIds.includes(input.documentId)) {
    return {
      ok: false,
      message: "No encontramos ese documento dentro de la organizacion actual.",
    };
  }

  const result = await enqueueDocumentProcessing({
    documentId: input.documentId,
    requestedBy: authState.user?.id ?? null,
    triggeredBy: "manual_retry",
  });

  revalidateDocumentSurfaces(input.slug, input.documentId);

  return {
    ok: result.ok,
    message: result.ok
      ? "Extraccion encolada. El documento seguira procesandose en background."
      : result.message,
    runId: result.ok ? result.runId : null,
  };
}

export async function enqueueSelectedDocumentExtractionsAction(input: {
  slug: string;
  documentIds: string[];
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!canRunExtraction(organization.role)) {
    return {
      ok: false,
      queuedCount: 0,
      failedCount: input.documentIds.length,
      message: "Tu rol no puede encolar extracciones documentales.",
    };
  }

  const uniqueDocumentIds = Array.from(new Set(input.documentIds.filter(Boolean)));

  if (uniqueDocumentIds.length === 0) {
    return {
      ok: false,
      queuedCount: 0,
      failedCount: 0,
      message: "Selecciona al menos un documento para procesar.",
    };
  }

  const allowedDocumentIds = await filterOrganizationDocumentIds(organization.id, uniqueDocumentIds);

  if (allowedDocumentIds.length === 0) {
    return {
      ok: false,
      queuedCount: 0,
      failedCount: uniqueDocumentIds.length,
      message: "No encontramos documentos validos de esta organizacion para procesar.",
    };
  }

  const results = await Promise.all(allowedDocumentIds.map((documentId) =>
    enqueueDocumentProcessing({
      documentId,
      requestedBy: authState.user?.id ?? null,
      triggeredBy: "manual_retry",
    })));
  const queuedCount = results.filter((result) => result.ok).length;
  const failedMessages = results
    .filter((result) => !result.ok)
    .map((result) => result.message)
    .filter(Boolean);
  const failedCount = uniqueDocumentIds.length - queuedCount;

  revalidateDocumentSurfaces(input.slug);

  if (queuedCount === 0) {
    return {
      ok: false,
      queuedCount,
      failedCount,
      message: failedMessages[0] ?? "No pudimos encolar la extraccion de los documentos seleccionados.",
    };
  }

  const failureSuffix =
    failedCount > 0
      ? ` ${failedCount} documento(s) no pudieron encolarse.${failedMessages[0] ? ` ${failedMessages[0]}` : ""}`
      : "";

  return {
    ok: failedCount === 0,
    queuedCount,
    failedCount,
    message: `${queuedCount}/${uniqueDocumentIds.length} documento(s) quedaron en cola para extraccion.${failureSuffix}`.trim(),
  };
}

export async function runDocumentClassificationFromListAction(input: {
  slug: string;
  documentId: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!canRunClassification(organization.role)) {
    return {
      ok: false,
      message: "Tu rol no puede ejecutar clasificacion contable.",
    };
  }

  const allowedDocumentIds = await filterOrganizationDocumentIds(organization.id, [input.documentId]);

  if (!allowedDocumentIds.includes(input.documentId)) {
    return {
      ok: false,
      message: "No encontramos ese documento dentro de la organizacion actual.",
    };
  }

  const result = await runDocumentClassification({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
  });

  revalidateDocumentSurfaces(input.slug, input.documentId);

  return {
    ok: result.ok,
    message: result.message,
  };
}
