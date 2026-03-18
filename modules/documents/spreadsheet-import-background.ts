import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getInngestConfigStatus } from "@/lib/env";
import { inngest } from "@/lib/inngest/client";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  appendSpreadsheetStatusEvent,
  createSpreadsheetImportRun,
  loadSpreadsheetImportRun,
  updateSpreadsheetImportRun,
  type SpreadsheetFileKind,
  type SpreadsheetImportRunRecord,
} from "@/modules/spreadsheets";
import {
  buildDocumentSpreadsheetImportRunMetadata,
  summarizeDocumentSpreadsheetImportRun,
  type DocumentSpreadsheetImportRunStage,
  type DocumentSpreadsheetImportRunProgress,
} from "@/modules/documents/spreadsheet-import-runs";
import {
  extractDocumentSpreadsheetRows,
  persistDocumentSpreadsheetImportRow,
  preflightDocumentSpreadsheetImport,
  type DocumentSpreadsheetLedgerKind,
} from "@/modules/documents/spreadsheet-batch-import";
import {
  documentSpreadsheetImportsStorageBucket,
  documentsStorageBucket,
} from "@/modules/documents/upload";

export const DOCUMENT_SPREADSHEET_STANDARD_LIMIT = 300;

const DOCUMENT_SPREADSHEET_IMPORT_CHUNK_SIZE = 25;
const DOCUMENT_SPREADSHEET_ALLOWED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/tab-separated-values",
  "application/octet-stream",
] as const;

type InngestStepLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run(id: string, fn: () => unknown): Promise<any>;
};

type InngestLoggerLike = {
  info(message: string, data?: Record<string, unknown>): void;
  warn?(message: string, data?: Record<string, unknown>): void;
  error?(message: string, data?: Record<string, unknown>): void;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function sanitizeFileNameFragment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    || "spreadsheet";
}

function inferSpreadsheetFileKind(fileName: string, mimeType: string | null | undefined): SpreadsheetFileKind {
  const normalizedName = fileName.toLowerCase();
  const normalizedMime = (mimeType ?? "").toLowerCase();

  if (normalizedName.endsWith(".csv") || normalizedMime.includes("text/csv")) {
    return "csv";
  }

  if (normalizedName.endsWith(".tsv") || normalizedMime.includes("tab-separated")) {
    return "tsv";
  }

  if (normalizedName.endsWith(".xlsx") || normalizedMime.includes("spreadsheetml.sheet")) {
    return "xlsx";
  }

  if (normalizedName.endsWith(".xls") || normalizedMime.includes("ms-excel")) {
    return "xls";
  }

  return "unknown";
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function buildStoragePath(input: {
  organizationId: string;
  fileName: string;
}) {
  const timestamp = new Date().toISOString().slice(0, 10);

  return [
    "background",
    input.organizationId,
    "document-spreadsheet-imports",
    `${timestamp}-${randomUUID()}-${sanitizeFileNameFragment(input.fileName)}`,
  ].join("/");
}

function buildQueuedMessage(importableRowsDetected: number) {
  return [
    `Se detectaron ${importableRowsDetected} fila(s) importables.`,
    "Esto puede demorar.",
    "La solicitud corre en segundo plano; puedes continuar con otra cosa mientras preparamos todo y te avisaremos cuando este pronta.",
  ].join(" ");
}

function buildLimitExceededMessage(importableRowsDetected: number) {
  return [
    `Se detectaron ${importableRowsDetected} fila(s) importables.`,
    `El flujo estandar admite hasta ${DOCUMENT_SPREADSHEET_STANDARD_LIMIT} filas por archivo.`,
    "Divide la planilla en lotes mas chicos y vuelve a intentar.",
  ].join(" ");
}

function getProgress(run: SpreadsheetImportRunRecord) {
  const metadata = asRecord(run.metadata);
  const progress = asRecord(metadata.progress);
  const stageValue = asString(progress.stage);
  const stage: DocumentSpreadsheetImportRunStage =
    stageValue === "queued"
    || stageValue === "extracting_rows"
    || stageValue === "importing_rows"
    || stageValue === "completed"
    || stageValue === "failed"
      ? stageValue
      : "queued";

  return {
    stage,
    percent: typeof progress.percent === "number" ? progress.percent : 0,
    totalRowsDetected: typeof progress.totalRowsDetected === "number" ? progress.totalRowsDetected : null,
    importableRowsDetected: typeof progress.importableRowsDetected === "number" ? progress.importableRowsDetected : null,
    skippedRowsDetected: typeof progress.skippedRowsDetected === "number" ? progress.skippedRowsDetected : null,
    processedRows: typeof progress.processedRows === "number" ? progress.processedRows : 0,
    importedCount: typeof progress.importedCount === "number" ? progress.importedCount : 0,
    failedCount: typeof progress.failedCount === "number" ? progress.failedCount : 0,
    skippedCount: typeof progress.skippedCount === "number" ? progress.skippedCount : 0,
    currentChunk: typeof progress.currentChunk === "number" ? progress.currentChunk : 0,
    totalChunks: typeof progress.totalChunks === "number" ? progress.totalChunks : 0,
    currentMessage: asString(progress.currentMessage),
    latestErrorMessage: asString(progress.latestErrorMessage),
    startedAt: asString(progress.startedAt),
    finishedAt: asString(progress.finishedAt),
  } satisfies DocumentSpreadsheetImportRunProgress;
}

async function patchRun(input: {
  supabase: SupabaseClient;
  run: SpreadsheetImportRunRecord;
  status?: SpreadsheetImportRunRecord["status"];
  warnings?: string[];
  detectedMapping?: Record<string, unknown>;
  progress?: Partial<DocumentSpreadsheetImportRunProgress>;
  eventCode?: string;
  eventMessage?: string;
  metadataPatch?: Record<string, unknown>;
}) {
  const metadata = {
    ...buildDocumentSpreadsheetImportRunMetadata({
      existingMetadata: input.run.metadata,
      progress: input.progress ?? null,
    }),
    ...(input.metadataPatch ?? {}),
  };
  const statusEvents = input.eventCode && input.eventMessage
    ? appendSpreadsheetStatusEvent(
      input.run.statusEvents,
      input.eventCode,
      input.eventMessage,
    )
    : input.run.statusEvents;

  return updateSpreadsheetImportRun(input.supabase, {
    organizationId: input.run.organizationId,
    runId: input.run.id,
    status: input.status,
    warnings: input.warnings ?? input.run.warnings,
    detectedMapping: input.detectedMapping,
    statusEvents,
    metadata,
  });
}

async function loadRunFileBytes(run: SpreadsheetImportRunRecord) {
  const metadata = asRecord(run.metadata);
  const storageBucket = asString(metadata.storage_bucket) ?? documentsStorageBucket;
  const storagePath = asString(metadata.storage_path);
  const expectedSizeBytes =
    typeof metadata.file_size_bytes === "number"
      ? metadata.file_size_bytes
      : null;

  if (!storagePath) {
    throw new Error("No encontramos la ruta privada de la planilla a procesar.");
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: fileBlob, error } = await supabase.storage
    .from(storageBucket)
    .download(storagePath);

  if (error || !fileBlob) {
    throw new Error(error?.message ?? "No se pudo descargar la planilla privada.");
  }

  const bytes = await fileBlob.arrayBuffer();

  if (expectedSizeBytes !== null && bytes.byteLength !== expectedSizeBytes) {
    throw new Error(
      `La planilla privada se descargo con un tamano inesperado (${bytes.byteLength} bytes vs ${expectedSizeBytes} esperados).`,
    );
  }

  return bytes;
}

async function ensureDocumentSpreadsheetImportBucket(supabase: SupabaseClient) {
  const existingBucket = await supabase.storage.getBucket(documentSpreadsheetImportsStorageBucket);

  if (!existingBucket.error) {
    return;
  }

  const createdBucket = await supabase.storage.createBucket(documentSpreadsheetImportsStorageBucket, {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: [...DOCUMENT_SPREADSHEET_ALLOWED_MIME_TYPES],
  });

  if (createdBucket.error && !/already exists/i.test(createdBucket.error.message ?? "")) {
    throw new Error(createdBucket.error.message ?? "No se pudo crear el bucket privado para planillas.");
  }
}

export async function enqueueDocumentSpreadsheetImport(input: {
  organizationId: string;
  actorId: string | null;
  file: File;
  ledgerKind: DocumentSpreadsheetLedgerKind;
}) {
  const mimeType = input.file.type || null;
  const bytes = await input.file.arrayBuffer();
  const preflight = await preflightDocumentSpreadsheetImport({
    fileName: input.file.name,
    mimeType,
    bytes,
    ledgerKind: input.ledgerKind,
  });

  if (preflight.importableRowsDetected === 0) {
    return {
      ok: false as const,
      runId: null,
      importableRowsDetected: 0,
      message: "La planilla no dejo filas importables para crear documentos.",
    };
  }

  if (preflight.importableRowsDetected > DOCUMENT_SPREADSHEET_STANDARD_LIMIT) {
    return {
      ok: false as const,
      runId: null,
      importableRowsDetected: preflight.importableRowsDetected,
      message: buildLimitExceededMessage(preflight.importableRowsDetected),
    };
  }

  if (!getInngestConfigStatus().configured) {
    return {
      ok: false as const,
      runId: null,
      importableRowsDetected: preflight.importableRowsDetected,
      message: "Inngest no esta configurado en este entorno. No pudimos encolar la importacion.",
    };
  }

  const supabase = getSupabaseServiceRoleClient();
  await ensureDocumentSpreadsheetImportBucket(supabase);
  const storagePath = buildStoragePath({
    organizationId: input.organizationId,
    fileName: input.file.name,
  });
  const { error: uploadError } = await supabase.storage
    .from(documentSpreadsheetImportsStorageBucket)
    .upload(storagePath, new Uint8Array(bytes), {
      upsert: false,
      contentType: mimeType ?? "application/octet-stream",
    });

  if (uploadError) {
    throw new Error(uploadError.message ?? "No se pudo guardar la planilla privada.");
  }

  const queuedMessage = buildQueuedMessage(preflight.importableRowsDetected);
  const run = await createSpreadsheetImportRun(supabase, {
    organizationId: input.organizationId,
    fileName: input.file.name,
    fileKind: inferSpreadsheetFileKind(input.file.name, mimeType),
    importType: "document_batch_import",
    runMode: "batch",
    status: "queued",
    preview: null,
    result: null,
    warnings: preflight.warnings,
    detectedMapping: preflight.detectedHeaders,
    statusEvents: [{
      code: "queued",
      message: queuedMessage,
      createdAt: new Date().toISOString(),
    }],
    metadata: {
      ...buildDocumentSpreadsheetImportRunMetadata({
        ledgerKind: input.ledgerKind,
        storageBucket: documentSpreadsheetImportsStorageBucket,
        storagePath,
        uploadedBy: input.actorId,
        progress: {
          stage: "queued",
          percent: 5,
          totalRowsDetected: preflight.totalRowsDetected,
          importableRowsDetected: preflight.importableRowsDetected,
          skippedRowsDetected: preflight.skippedRowsDetected,
          processedRows: 0,
          importedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          currentChunk: 0,
          totalChunks: 0,
          currentMessage: queuedMessage,
          latestErrorMessage: null,
          startedAt: null,
          finishedAt: null,
        },
      }),
      mime_type: mimeType,
      file_size_bytes: input.file.size,
      preflight_sheet_name: preflight.sheetName,
      preflight_headers: preflight.detectedHeaders,
      preflight_row_limit: DOCUMENT_SPREADSHEET_STANDARD_LIMIT,
    },
  });

  try {
    await inngest.send({
      name: "documents/spreadsheet-import.requested",
      data: {
        runId: run.id,
        organizationId: input.organizationId,
        requestedBy: input.actorId,
      },
    });
  } catch (error) {
    const failureMessage = error instanceof Error
      ? error.message
      : "No se pudo encolar la importacion documental.";

    await patchRun({
      supabase,
      run,
      status: "failed",
      progress: {
        stage: "failed",
        percent: 100,
        latestErrorMessage: failureMessage,
        currentMessage: failureMessage,
        finishedAt: new Date().toISOString(),
      },
      eventCode: "enqueue_failed",
      eventMessage: failureMessage,
    });

    return {
      ok: false as const,
      runId: run.id,
      importableRowsDetected: preflight.importableRowsDetected,
      message: failureMessage,
    };
  }

  return {
    ok: true as const,
    runId: run.id,
    importableRowsDetected: preflight.importableRowsDetected,
    message: queuedMessage,
  };
}

export async function processDocumentSpreadsheetImportRunFromInngest(input: {
  runId: string;
  organizationId: string;
  step: InngestStepLike;
  logger?: InngestLoggerLike;
}) {
  const supabase = getSupabaseServiceRoleClient();
  let run = await input.step.run("load-document-spreadsheet-import-run", async () => {
    return loadSpreadsheetImportRun(supabase, input.organizationId, input.runId);
  });

  if (!run) {
    throw new Error("No encontramos la corrida de importacion documental.");
  }

  if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
    return summarizeDocumentSpreadsheetImportRun(run);
  }

  const startedAt = getProgress(run).startedAt ?? new Date().toISOString();
  run = await patchRun({
    supabase,
    run,
    status: "in_progress",
    progress: {
      stage: "extracting_rows",
      percent: 10,
      startedAt,
      currentMessage: "Estamos leyendo la planilla y preparando las filas importables en segundo plano.",
      latestErrorMessage: null,
    },
    eventCode: "extracting_rows",
    eventMessage: "Leyendo la planilla y preparando las filas importables.",
  });

  let extracted: Awaited<ReturnType<typeof extractDocumentSpreadsheetRows>> | null = null;

  try {
    const metadata = asRecord(run.metadata);
    const ledgerKind = metadata.ledger_kind === "sale" ? "sale" : "purchase";
    const mimeType = asString(metadata.mime_type);

    extracted = await input.step.run("extract-document-spreadsheet-rows", async () => {
      const bytes = await loadRunFileBytes(run!);

      return extractDocumentSpreadsheetRows({
        fileName: run!.fileName,
        mimeType,
        bytes,
        ledgerKind,
        provider: process.env.OPENAI_API_KEY ? "auto" : "heuristic",
      });
    });

    if (!extracted) {
      throw new Error("No se pudo obtener el resultado de extraccion para esta planilla.");
    }

    if (extracted.rows.length === 0) {
      throw new Error("La planilla no dejo filas importables para crear documentos.");
    }

    if (extracted.rows.length > DOCUMENT_SPREADSHEET_STANDARD_LIMIT) {
      throw new Error(buildLimitExceededMessage(extracted.rows.length));
    }

    const resolvedExtraction = extracted;

    const totalChunks = Math.max(
      1,
      Math.ceil(resolvedExtraction.rows.length / DOCUMENT_SPREADSHEET_IMPORT_CHUNK_SIZE),
    );
    run = await patchRun({
      supabase,
      run,
      warnings: [...new Set([
        ...run.warnings,
        ...resolvedExtraction.warnings,
      ])],
      detectedMapping: resolvedExtraction.detectedHeaders,
      progress: {
        stage: "importing_rows",
        percent: 20,
        totalRowsDetected: resolvedExtraction.rows.length + resolvedExtraction.skippedRows.length,
        importableRowsDetected: resolvedExtraction.rows.length,
        skippedRowsDetected: resolvedExtraction.skippedRows.length,
        processedRows: 0,
        importedCount: 0,
        failedCount: 0,
        skippedCount: resolvedExtraction.skippedRows.length,
        currentChunk: 0,
        totalChunks,
        currentMessage: buildQueuedMessage(resolvedExtraction.rows.length),
      },
      metadataPatch: {
        extracted_sheet_name: resolvedExtraction.sheetName,
        extracted_headers: resolvedExtraction.detectedHeaders,
      },
      eventCode: "rows_detected",
      eventMessage: `Se detectaron ${resolvedExtraction.rows.length} fila(s) importables para procesar en ${totalChunks} bloque(s).`,
    });

    const importedDocumentIds: string[] = [];
    const failedRows: Array<{ rowNumber: number; reason: string }> = [];
    let processedRows = 0;

    for (const [chunkIndex, chunk] of chunkArray(
      resolvedExtraction.rows,
      DOCUMENT_SPREADSHEET_IMPORT_CHUNK_SIZE,
    ).entries()) {
      for (const row of chunk) {
        const persisted = await input.step.run(
          `persist-document-spreadsheet-row-${row.rowNumber}`,
          async () => {
            try {
              const documentId = await persistDocumentSpreadsheetImportRow({
                supabase,
                organizationId: run!.organizationId,
                actorId: asString(asRecord(run!.metadata).uploaded_by),
                fileName: run!.fileName,
                row,
              });

              return {
                ok: true as const,
                documentId,
              };
            } catch (error) {
              return {
                ok: false as const,
                reason: error instanceof Error
                  ? error.message
                  : "No se pudo importar la fila.",
              };
            }
          },
        );

        if (persisted.ok) {
          importedDocumentIds.push(persisted.documentId);
        } else {
          failedRows.push({
            rowNumber: row.rowNumber,
            reason: persisted.reason,
          });
        }
      }

      processedRows += chunk.length;
      const currentChunk = chunkIndex + 1;
      const progressMessage = `Procesamos ${processedRows}/${resolvedExtraction.rows.length} fila(s) en ${currentChunk}/${totalChunks} bloque(s).`;

      run = await patchRun({
        supabase,
        run,
        progress: {
          stage: "importing_rows",
          percent: Math.min(
            95,
            20 + Math.round((processedRows / Math.max(1, resolvedExtraction.rows.length)) * 75),
          ),
          processedRows,
          importedCount: importedDocumentIds.length,
          failedCount: failedRows.length,
          skippedCount: resolvedExtraction.skippedRows.length,
          currentChunk,
          totalChunks,
          currentMessage: progressMessage,
        },
        metadataPatch: {
          failed_rows_preview: failedRows.slice(0, 25),
        },
        eventCode: "chunk_processed",
        eventMessage: progressMessage,
      });
    }

    const finishedAt = new Date().toISOString();
    const completedMessage = failedRows.length === 0
      ? `Importacion finalizada con exito. ${importedDocumentIds.length} documento(s) quedaron listos para clasificacion.`
      : `Importacion finalizada con observaciones. ${importedDocumentIds.length} documento(s) importados, ${failedRows.length} fila(s) con error y ${resolvedExtraction.skippedRows.length} omitida(s).`;

    run = await patchRun({
      supabase,
      run,
      status: "completed",
      progress: {
        stage: "completed",
        percent: 100,
        processedRows: resolvedExtraction.rows.length,
        importedCount: importedDocumentIds.length,
        failedCount: failedRows.length,
        skippedCount: resolvedExtraction.skippedRows.length,
        currentChunk: Math.max(1, Math.ceil(resolvedExtraction.rows.length / DOCUMENT_SPREADSHEET_IMPORT_CHUNK_SIZE)),
        totalChunks: Math.max(1, Math.ceil(resolvedExtraction.rows.length / DOCUMENT_SPREADSHEET_IMPORT_CHUNK_SIZE)),
        currentMessage: completedMessage,
        latestErrorMessage: failedRows.length > 0 ? failedRows[0]?.reason ?? null : null,
        finishedAt,
      },
      metadataPatch: {
        imported_document_count: importedDocumentIds.length,
        failed_row_count: failedRows.length,
        skipped_row_count: resolvedExtraction.skippedRows.length,
        failed_rows_preview: failedRows.slice(0, 50),
        skipped_rows_preview: resolvedExtraction.skippedRows.slice(0, 50),
      },
      eventCode: failedRows.length === 0 ? "completed" : "completed_with_warnings",
      eventMessage: completedMessage,
    });

    input.logger?.info("Document spreadsheet import completed.", {
      runId: run.id,
      importedCount: importedDocumentIds.length,
      failedCount: failedRows.length,
      skippedCount: resolvedExtraction.skippedRows.length,
    });

    return summarizeDocumentSpreadsheetImportRun(run);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "No se pudo completar la importacion documental en segundo plano.";
    const finishedAt = new Date().toISOString();

    run = await patchRun({
      supabase,
      run,
      status: "failed",
      progress: {
        stage: "failed",
        percent: 100,
        currentMessage: message,
        latestErrorMessage: message,
        finishedAt,
      },
      metadataPatch: {
        failed_row_count: extracted?.rows.length ?? 0,
      },
      eventCode: "failed",
      eventMessage: message,
    });

    input.logger?.error?.("Document spreadsheet import failed.", {
      runId: run.id,
      error: message,
    });

    return summarizeDocumentSpreadsheetImportRun(run);
  }
}
