"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { runDocumentClassification } from "@/modules/accounting/classification-runner";
import { enqueueDocumentProcessing } from "@/modules/documents/processing";
import {
  type DocumentSpreadsheetLedgerKind,
} from "@/modules/documents/spreadsheet-batch-import";
import { enqueueDocumentSpreadsheetImport } from "@/modules/documents/spreadsheet-import-background";
import {
  formatDocumentSpreadsheetImportStatusMessage,
  isDocumentSpreadsheetImportType,
  summarizeDocumentSpreadsheetImportRun,
} from "@/modules/documents/spreadsheet-import-runs";
import { cancelSpreadsheetImport, loadSpreadsheetImportRun } from "@/modules/spreadsheets";
import { validateDocumentUploadCandidate } from "@/modules/documents/upload";
import { resolveMissingFxRates } from "@/modules/documents/spreadsheet-fx-resolution";

function buildPaths(slug: string, documentId?: string) {
  return {
    documents: `/app/o/${slug}/documents`,
    reviewQueue: `/app/o/${slug}/review`,
    review: documentId ? `/app/o/${slug}/documents/${documentId}` : null,
    field: `/app/o/${slug}/field`,
    fieldUpload: `/app/o/${slug}/field/upload`,
    fieldActivity: `/app/o/${slug}/field/activity`,
    fieldProjects: `/app/o/${slug}/field/projects`,
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
  for (const path of Object.values(paths)) {
    if (path) {
      revalidatePath(path);
    }
  }
}

function isAcceptedSpreadsheetFile(fileName: string, mimeType: string) {
  const normalizedName = fileName.toLowerCase();
  const normalizedMime = mimeType.toLowerCase();

  return (
    normalizedName.endsWith(".csv")
    || normalizedName.endsWith(".tsv")
    || normalizedName.endsWith(".xlsx")
    || normalizedName.endsWith(".xls")
    || normalizedMime.includes("text/csv")
    || normalizedMime.includes("tab-separated")
    || normalizedMime.includes("spreadsheetml.sheet")
    || normalizedMime.includes("ms-excel")
  );
}

type PrepareDocumentUploadInput = {
  slug: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  fileHash?: string | null;
  sourceSurface?: "mobile_field" | null;
};

type FinalizeDocumentUploadInput = {
  slug: string;
  documentId: string;
};

type FailDocumentUploadInput = FinalizeDocumentUploadInput & {
  errorMessage?: string;
};

type PrepareDocumentUploadSuccess = {
  ok: true;
  documentId: string;
  storageBucket: string;
  storagePath: string;
  uploadToken: string;
  signedUploadUrl: string;
};

type FinalizeDocumentUploadSuccess = {
  ok: true;
  documentId: string;
};

type UploadActionError = {
  ok: false;
  message: string;
};

type PrepareDocumentUploadRpcRow = {
  document_id: string;
  storage_bucket: string;
  storage_path: string;
  status: string;
};

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
    message: result.ok
      ? "Criterios activos reaplicados sobre este documento."
      : result.message,
  };
}

export async function runSelectedDocumentClassificationFromListAction(input: {
  slug: string;
  documentIds: string[];
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!canRunClassification(organization.role)) {
    return {
      ok: false,
      completedCount: 0,
      failedCount: input.documentIds.length,
      message: "Tu rol no puede ejecutar clasificacion contable.",
    };
  }

  const uniqueDocumentIds = Array.from(new Set(input.documentIds.filter(Boolean)));

  if (uniqueDocumentIds.length === 0) {
    return {
      ok: false,
      completedCount: 0,
      failedCount: 0,
      message: "Selecciona al menos un documento listo para reaplicar criterios.",
    };
  }

  const allowedDocumentIds = await filterOrganizationDocumentIds(organization.id, uniqueDocumentIds);

  if (allowedDocumentIds.length === 0) {
    return {
      ok: false,
      completedCount: 0,
      failedCount: uniqueDocumentIds.length,
      message: "No encontramos documentos validos de esta organizacion para reaplicar criterios.",
    };
  }

  const results = await Promise.all(allowedDocumentIds.map((documentId) =>
    runDocumentClassification({
      organizationId: organization.id,
      documentId,
      actorId: authState.user?.id ?? null,
    })));
  const completedCount = results.filter((result) => result.ok).length;
  const failedMessages = results
    .filter((result) => !result.ok)
    .map((result) => result.message)
    .filter(Boolean);
  const failedCount = uniqueDocumentIds.length - completedCount;

  revalidateDocumentSurfaces(input.slug);

  if (completedCount === 0) {
    return {
      ok: false,
      completedCount,
      failedCount,
      message: failedMessages[0] ?? "No pudimos reaplicar criterios a los documentos seleccionados.",
    };
  }

  const failureSuffix =
    failedCount > 0
      ? ` ${failedCount} documento(s) no pudieron clasificarse.${failedMessages[0] ? ` ${failedMessages[0]}` : ""}`
      : "";

  return {
    ok: failedCount === 0,
    completedCount,
    failedCount,
    message: `${completedCount}/${uniqueDocumentIds.length} documento(s) reevaluados con criterios activos.${failureSuffix}`.trim(),
  };
}

export async function retryMissingFxRatesAction(input: {
  slug: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!canRunClassification(organization.role)) {
    return {
      ok: false,
      resolvedCount: 0,
      failedCount: 0,
      message: "Tu rol no puede reintentar la obtencion de cotizaciones BCU.",
    };
  }

  const result = await resolveMissingFxRates({
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
  });

  revalidateDocumentSurfaces(input.slug);

  return {
    ok: result.failedCount === 0,
    resolvedCount: result.resolvedCount,
    failedCount: result.failedCount,
    message:
      result.requestedCount === 0
        ? "No habia documentos bloqueados por cotizacion pendiente."
        : result.failedCount > 0
          ? `Se resolvieron ${result.resolvedCount} documento(s) y ${result.failedCount} siguen bloqueados por falta de tasa.`
          : `Se resolvieron ${result.resolvedCount} documento(s) con cotizacion BCU.`
  };
}

export async function prepareDocumentUploadAction(
  input: PrepareDocumentUploadInput,
): Promise<PrepareDocumentUploadSuccess | UploadActionError> {
  const validation = validateDocumentUploadCandidate({
    name: input.originalFilename,
    type: input.mimeType,
    size: input.fileSize,
  });

  if (!validation.success) {
    return {
      ok: false,
      message: validation.message,
    };
  }

  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const userSupabase = await getSupabaseServerClient();
  const serviceSupabase = getSupabaseServiceRoleClient();

  if (input.fileHash?.trim()) {
    const { data: duplicateDocument, error: duplicateError } = await serviceSupabase
      .from("documents")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("file_hash", input.fileHash.trim())
      .in("status", [
        "uploading",
        "uploaded",
        "queued",
        "extracting",
        "extracted",
        "draft_ready",
        "classified",
        "classified_with_open_revision",
        "needs_review",
        "approved",
        "duplicate",
        "archived",
      ])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      return {
        ok: false,
        message: duplicateError.message ?? "No se pudo validar si el archivo ya existia.",
      };
    }

    if (duplicateDocument?.id) {
      return {
        ok: false,
        message: `El archivo ya fue cargado previamente en la organizacion. Documento existente: ${duplicateDocument.id}.`,
      };
    }
  }

  const { data, error } = await userSupabase
    .rpc("prepare_document_upload", {
      p_org_id: organization.id,
      p_original_filename: input.originalFilename,
      p_mime_type: input.mimeType,
      p_file_size: input.fileSize,
      p_direction: "unknown",
    })
    .single();

  const row = data as PrepareDocumentUploadRpcRow | null;

  if (error || !row?.document_id || !row.storage_bucket || !row.storage_path) {
    return {
      ok: false,
      message:
        error?.message
        ?? "No se pudo preparar la metadata del documento para la subida.",
    };
  }

  if (input.fileHash?.trim() || input.sourceSurface === "mobile_field") {
    const updatePayload: {
      file_hash?: string;
      upload_source?: string;
      metadata?: Record<string, unknown>;
    } = {};

    if (input.fileHash?.trim()) {
      updatePayload.file_hash = input.fileHash.trim();
    }

    if (input.sourceSurface === "mobile_field") {
      updatePayload.upload_source = "mobile_field";
      updatePayload.metadata = {
        source_surface: "mobile_field",
      };
    }

    const { error: fileHashError } = await serviceSupabase
      .from("documents")
      .update(updatePayload)
      .eq("id", row.document_id)
      .eq("organization_id", organization.id);

    if (fileHashError) {
      return {
        ok: false,
        message:
          fileHashError.message
          ?? "No se pudo registrar la metadata del archivo antes de subirlo.",
      };
    }
  }

  const { data: signedUpload, error: signedUploadError } = await serviceSupabase.storage
    .from(row.storage_bucket)
    .createSignedUploadUrl(row.storage_path, {
      upsert: false,
    });

  if (signedUploadError || !signedUpload?.token || !signedUpload.signedUrl) {
    return {
      ok: false,
      message:
        signedUploadError?.message
        ?? "No se pudo preparar el token de subida al bucket privado.",
    };
  }

  return {
    ok: true,
    documentId: row.document_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    uploadToken: signedUpload.token,
    signedUploadUrl: signedUpload.signedUrl,
  };
}

export async function finalizeDocumentUploadAction(
  input: FinalizeDocumentUploadInput,
): Promise<FinalizeDocumentUploadSuccess | UploadActionError> {
  await requireOrganizationDashboardPage(input.slug);
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("complete_document_upload", {
    p_document_id: input.documentId,
  });

  if (error) {
    return {
      ok: false,
      message:
        error.message
        ?? "El archivo subio, pero no pudimos cerrar el estado del documento.",
    };
  }

  revalidateDocumentSurfaces(input.slug, input.documentId);

  return {
    ok: true,
    documentId: input.documentId,
  };
}

export async function failDocumentUploadAction(
  input: FailDocumentUploadInput,
): Promise<{ ok: true } | UploadActionError> {
  await requireOrganizationDashboardPage(input.slug);
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("fail_document_upload", {
    p_document_id: input.documentId,
    p_error_message: input.errorMessage ?? null,
  });

  if (error) {
    return {
      ok: false,
      message:
        error.message
        ?? "No pudimos registrar el error de upload en este momento.",
    };
  }

  revalidateDocumentSurfaces(input.slug, input.documentId);

  return {
    ok: true,
  };
}

export async function importDocumentSpreadsheetBatchAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ledgerKindValue = String(formData.get("ledgerKind") ?? "purchase");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canRunExtraction(organization.role)) {
    return {
      ok: false,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      message: "Tu rol no puede importar documentos desde planilla.",
    };
  }

  const spreadsheet = formData.get("spreadsheet");

  if (!(spreadsheet instanceof File) || spreadsheet.size === 0) {
    return {
      ok: false,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      message: "Selecciona una planilla mensual valida antes de importar.",
    };
  }

  if (!isAcceptedSpreadsheetFile(spreadsheet.name, spreadsheet.type)) {
    return {
      ok: false,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      message: "La importacion mensual admite .csv, .tsv, .xlsx y .xls en variantes compatibles.",
    };
  }

  const ledgerKind: DocumentSpreadsheetLedgerKind =
    ledgerKindValue === "sale" ? "sale" : "purchase";
  const result = await enqueueDocumentSpreadsheetImport({
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    file: spreadsheet,
    ledgerKind,
  });

  revalidateDocumentSurfaces(slug);

  return {
    ok: result.ok,
    runId: result.runId,
    importableRowsDetected: result.importableRowsDetected,
    message: result.message,
  };
}

export async function loadDocumentSpreadsheetImportStatusesAction(input: {
  slug: string;
  runIds: string[];
}) {
  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const supabase = getSupabaseServiceRoleClient();
  const uniqueRunIds = Array.from(new Set(input.runIds.filter(Boolean))).slice(0, 12);

  if (uniqueRunIds.length === 0) {
    return [];
  }

  const runs = await Promise.all(uniqueRunIds.map((runId) =>
    loadSpreadsheetImportRun(supabase, organization.id, runId)));

  return runs
    .filter((run): run is NonNullable<typeof run> => Boolean(run))
    .filter((run) => isDocumentSpreadsheetImportType(run.importType))
    .map((run) => {
      const summary = summarizeDocumentSpreadsheetImportRun(run);

      return {
        ...summary,
        message: formatDocumentSpreadsheetImportStatusMessage(summary),
      };
    });
}

export async function cancelDocumentSpreadsheetImportAction(input: {
  slug: string;
  runId: string;
}) {
  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const supabase = getSupabaseServiceRoleClient();
  const existingRun = await loadSpreadsheetImportRun(supabase, organization.id, input.runId);

  if (!existingRun || !isDocumentSpreadsheetImportType(existingRun.importType)) {
    throw new Error("No encontramos una importacion documental en segundo plano para cancelar.");
  }

  const run = await cancelSpreadsheetImport({
    supabase,
    organizationId: organization.id,
    runId: input.runId,
  });

  revalidateDocumentSurfaces(input.slug);

  return {
    ok: true,
    message: `Importacion cancelada para ${run.fileName}.`,
  };
}
