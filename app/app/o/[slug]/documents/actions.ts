"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { runDocumentClassification } from "@/modules/accounting/classification-runner";
import { enqueueDocumentProcessing } from "@/modules/documents/processing";
import { resolveDocumentProcessingProvider, type DocumentProcessingProvider } from "@/modules/documents/processing-provider";
import { isPaidAIAllowed } from "@/lib/llm/provider-policy";
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
import { inspectStoredDocumentUpload } from "@/modules/documents/upload-recovery";

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
  processingProvider?: DocumentProcessingProvider;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  fileHash?: string | null;
  sourceSurface?: "mobile_field" | null;
};

type FinalizeDocumentUploadInput = {
  slug: string;
  documentId: string;
  uploadLeaseToken?: string | null;
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
  uploadRequired: boolean;
  uploadLeaseToken: string | null;
  shouldEnqueue: boolean;
  message: string;
};

type FinalizeDocumentUploadSuccess = {
  ok: true;
  documentId: string;
  shouldEnqueue: boolean;
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
  is_duplicate: boolean;
  upload_state: "upload" | "resume" | "busy" | "existing";
  upload_lease_token: string | null;
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
  triggeredBy?: "upload";
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
      triggeredBy: input.triggeredBy ?? "manual_retry",
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
  const fileHash = input.fileHash?.trim().toLowerCase();
  if (!fileHash || !/^[0-9a-f]{64}$/.test(fileHash)) {
    return { ok: false, message: "No se pudo identificar el archivo para evitar duplicados. Volvé a seleccionar la foto o PDF." };
  }
  let provider: DocumentProcessingProvider;
  try {
    provider = resolveDocumentProcessingProvider(input.processingProvider === undefined
      ? null : { processing_provider: input.processingProvider });
    if (provider === "openai" && !isPaidAIAllowed()) {
      return { ok: false, message: "La API paga está deshabilitada en este programa. Seleccioná Codex en mi PC." };
    }
  } catch {
    return { ok: false, message: "Seleccioná un proveedor de procesamiento válido." };
  }
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

  const { data, error } = await userSupabase
    .rpc("prepare_document_upload_with_hash", {
      p_org_id: organization.id,
      p_original_filename: input.originalFilename,
      p_mime_type: input.mimeType,
      p_file_size: input.fileSize,
      p_file_hash: fileHash,
      p_processing_provider: provider,
      p_source_surface: input.sourceSurface ?? "web",
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

  const existingResult = (shouldEnqueue: boolean, message: string): PrepareDocumentUploadSuccess => ({
    ok: true, documentId: row.document_id, storageBucket: row.storage_bucket, storagePath: row.storage_path,
    uploadToken: "", signedUploadUrl: "", uploadRequired: false, uploadLeaseToken: row.upload_lease_token,
    shouldEnqueue, message,
  });
  if (row.upload_state === "existing") {
    return existingResult(false, "Este archivo ya tiene un documento. Conservamos su estado y abrimos el existente.");
  }
  if (row.upload_state === "busy" || !row.upload_lease_token) {
    return { ok: false, message: `La carga ${row.document_id} sigue reservada. Volvé a seleccionar el mismo archivo en cinco minutos para retomarla.` };
  }
  if (row.upload_state === "resume") {
    const stored = await inspectStoredDocumentUpload({ supabase: serviceSupabase, bucket: row.storage_bucket,
      path: row.storage_path, fileHash, fileSize: input.fileSize });
    if (stored === "match") {
      const finished = await finishVerifiedDocumentUpload(userSupabase, row.document_id, row.upload_lease_token);
      if (!finished.ok) return finished;
      revalidateDocumentSurfaces(input.slug, row.document_id);
      return existingResult(finished.shouldEnqueue, "El original ya estaba guardado. Recuperamos la misma carga sin subir otra copia.");
    }
    if (stored !== "missing") {
      await userSupabase.rpc("finish_document_upload_with_lease", { p_document_id: row.document_id,
        p_upload_lease_token: row.upload_lease_token, p_error_message: "No se pudo verificar el original para retomar la carga." });
      return { ok: false, message: `No se pudo verificar el original de ${row.document_id}. No lo sobrescribimos; volvé a intentar o revisá ese documento.` };
    }
  }
  const { data: signedUpload, error: signedUploadError } = await serviceSupabase.storage
    .from(row.storage_bucket)
    .createSignedUploadUrl(row.storage_path, {
      upsert: false,
    });

  if (signedUploadError || !signedUpload?.token || !signedUpload.signedUrl) {
    await userSupabase.rpc("finish_document_upload_with_lease", { p_document_id: row.document_id,
      p_upload_lease_token: row.upload_lease_token, p_error_message: "No se pudo preparar la subida al almacenamiento privado." });
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
    uploadRequired: true,
    uploadLeaseToken: row.upload_lease_token,
    shouldEnqueue: true,
    message: row.upload_state === "resume" ? "Retomando el mismo documento." : "Carga preparada.",
  };
}

async function finishVerifiedDocumentUpload(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>, documentId: string, uploadLeaseToken: string,
): Promise<FinalizeDocumentUploadSuccess | UploadActionError> {
  const { data, error } = await supabase.rpc("finish_document_upload_with_lease", {
    p_document_id: documentId, p_upload_lease_token: uploadLeaseToken, p_error_message: null,
  }).single();
  if (error || !data) return { ok: false, message: error?.message ?? "No se pudo finalizar la misma reserva de carga." };
  const row = data as { status: string; current_draft_id: string | null; current_processing_run_id: string | null };
  return { ok: true, documentId, shouldEnqueue: row.status === "uploaded" && !row.current_draft_id && !row.current_processing_run_id };
}

export async function finalizeDocumentUploadAction(
  input: FinalizeDocumentUploadInput,
): Promise<FinalizeDocumentUploadSuccess | UploadActionError> {
  const { organization, authState } = await requireOrganizationDashboardPage(input.slug);
  const supabase = await getSupabaseServerClient();
  const { data: document, error } = await supabase.from("documents")
    .select("status, file_hash, file_size, storage_bucket, storage_path, metadata, current_draft_id, current_processing_run_id")
    .eq("id", input.documentId).eq("organization_id", organization.id).eq("uploaded_by", authState.user?.id ?? "").maybeSingle();
  if (error || !document || !input.uploadLeaseToken || document.metadata?.upload_lease_token !== input.uploadLeaseToken) {
    return { ok: false, message: "La reserva de carga cambió. Volvé a seleccionar el archivo para recuperar el documento existente." };
  }
  if (document.status === "uploading" && !document.current_draft_id && !document.current_processing_run_id) {
    const stored = await inspectStoredDocumentUpload({ supabase: getSupabaseServiceRoleClient(), bucket: document.storage_bucket,
      path: document.storage_path, fileHash: document.file_hash, fileSize: document.file_size });
    if (stored !== "match") {
      await supabase.rpc("finish_document_upload_with_lease", { p_document_id: input.documentId,
        p_upload_lease_token: input.uploadLeaseToken, p_error_message: "El original no pudo verificarse por SHA-256." });
      return { ok: false, message: `No pudimos verificar el original. Volvé a seleccionar el mismo archivo para retomar ${input.documentId}.` };
    }
  } else if (document.status === "error") {
    return { ok: false, message: "Volvé a seleccionar el mismo archivo para retomar la carga fallida." };
  }
  const result = await finishVerifiedDocumentUpload(supabase, input.documentId, input.uploadLeaseToken);
  revalidateDocumentSurfaces(input.slug, input.documentId);
  return result;
}

export async function failDocumentUploadAction(
  input: FailDocumentUploadInput,
): Promise<{ ok: true } | UploadActionError> {
  const { organization, authState } = await requireOrganizationDashboardPage(input.slug);
  const supabase = await getSupabaseServerClient();
  const document = await supabase.from("documents").select("id").eq("id", input.documentId)
    .eq("organization_id", organization.id).eq("uploaded_by", authState.user?.id ?? "").maybeSingle();
  if (document.error || !document.data) return { ok: false, message: "No encontramos esta carga en tu organización." };
  const { error } = await supabase.rpc("finish_document_upload_with_lease", {
    p_document_id: input.documentId,
    p_upload_lease_token: input.uploadLeaseToken ?? null,
    p_error_message: input.errorMessage ?? "No se pudo completar la carga.",
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
