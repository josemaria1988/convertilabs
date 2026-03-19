import type { SpreadsheetImportRunRecord } from "@/modules/spreadsheets";

export type DocumentSpreadsheetImportRunStage =
  | "queued"
  | "extracting_rows"
  | "preview_ready"
  | "importing_rows"
  | "materializing_rows"
  | "resolving_fx"
  | "completed"
  | "cancelled"
  | "failed";

export type DocumentSpreadsheetImportRunProgress = {
  stage: DocumentSpreadsheetImportRunStage;
  percent: number;
  totalRowsDetected: number | null;
  importableRowsDetected: number | null;
  skippedRowsDetected: number | null;
  processedRows: number;
  importedCount: number;
  failedCount: number;
  skippedCount: number;
  currentChunk: number;
  totalChunks: number;
  fxPendingCount: number;
  fxResolvedCount: number;
  fxFailedCount: number;
  currentMessage: string | null;
  latestErrorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type DocumentSpreadsheetImportRunSummary = {
  runId: string;
  fileName: string;
  ledgerKind: "purchase" | "sale";
  status: SpreadsheetImportRunRecord["status"];
  createdAt: string;
  updatedAt: string;
  warnings: string[];
  latestEventMessage: string | null;
  progress: DocumentSpreadsheetImportRunProgress;
  isTerminal: boolean;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function clampPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

export function isDocumentSpreadsheetImportType(value: string | null | undefined) {
  return value === "document_batch_import";
}

export function isDocumentSpreadsheetImportTerminalStatus(value: string | null | undefined) {
  return value === "preview_ready"
    || value === "completed"
    || value === "failed"
    || value === "cancelled";
}

export function parseDocumentSpreadsheetImportRunProgress(metadata: Record<string, unknown>) {
  const progress = asRecord(metadata.progress);

  return {
    stage:
      (asString(progress.stage) as DocumentSpreadsheetImportRunStage | null)
      ?? "queued",
    percent: clampPercent(asNumber(progress.percent)),
    totalRowsDetected: asNumber(progress.totalRowsDetected),
    importableRowsDetected: asNumber(progress.importableRowsDetected),
    skippedRowsDetected: asNumber(progress.skippedRowsDetected),
    processedRows: asNumber(progress.processedRows) ?? 0,
    importedCount: asNumber(progress.importedCount) ?? 0,
    failedCount: asNumber(progress.failedCount) ?? 0,
    skippedCount: asNumber(progress.skippedCount) ?? 0,
    currentChunk: asNumber(progress.currentChunk) ?? 0,
    totalChunks: asNumber(progress.totalChunks) ?? 0,
    fxPendingCount: asNumber(progress.fxPendingCount) ?? 0,
    fxResolvedCount: asNumber(progress.fxResolvedCount) ?? 0,
    fxFailedCount: asNumber(progress.fxFailedCount) ?? 0,
    currentMessage: asString(progress.currentMessage),
    latestErrorMessage: asString(progress.latestErrorMessage),
    startedAt: asString(progress.startedAt),
    finishedAt: asString(progress.finishedAt),
  } satisfies DocumentSpreadsheetImportRunProgress;
}

export function buildDocumentSpreadsheetImportRunMetadata(input: {
  existingMetadata?: Record<string, unknown> | null;
  ledgerKind?: "purchase" | "sale" | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  uploadedBy?: string | null;
  progress?: Partial<DocumentSpreadsheetImportRunProgress> | null;
}) {
  const existing = asRecord(input.existingMetadata);
  const previousProgress = parseDocumentSpreadsheetImportRunProgress(existing);
  const nextProgress = input.progress ?? {};

  return {
    ...existing,
    source_type: "document_spreadsheet_import",
    ledger_kind: input.ledgerKind ?? asString(existing.ledger_kind),
    storage_bucket: input.storageBucket ?? asString(existing.storage_bucket),
    storage_path: input.storagePath ?? asString(existing.storage_path),
    uploaded_by: input.uploadedBy ?? asString(existing.uploaded_by),
    progress: {
      ...previousProgress,
      ...nextProgress,
      percent: clampPercent(
        typeof nextProgress.percent === "number"
          ? nextProgress.percent
          : previousProgress.percent,
      ),
    },
  } satisfies Record<string, unknown>;
}

export function summarizeDocumentSpreadsheetImportRun(
  run: SpreadsheetImportRunRecord,
): DocumentSpreadsheetImportRunSummary {
  const ledgerKind = run.metadata.ledger_kind === "sale" ? "sale" : "purchase";
  const latestEventMessage = run.statusEvents.at(-1)?.message ?? null;
  const progress = parseDocumentSpreadsheetImportRunProgress(run.metadata);

  return {
    runId: run.id,
    fileName: run.fileName,
    ledgerKind,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    warnings: run.warnings,
    latestEventMessage,
    progress,
    isTerminal: isDocumentSpreadsheetImportTerminalStatus(run.status),
  };
}

export function formatDocumentSpreadsheetImportStatusMessage(
  summary: DocumentSpreadsheetImportRunSummary,
) {
  const progress = summary.progress;
  const side = summary.ledgerKind === "purchase" ? "compras" : "ventas";

  if (summary.status === "queued") {
    if (progress.importableRowsDetected !== null) {
      return [
        `Se detectaron ${progress.importableRowsDetected} fila(s) importables.`,
        "Esto puede demorar.",
        "La solicitud corre en segundo plano; puedes continuar con otra cosa mientras preparamos la vista previa auditada y te avisaremos cuando este pronta.",
      ].join(" ");
    }

    return `La planilla de ${side} quedo encolada. La solicitud corre en segundo plano y te avisaremos cuando termine.`;
  }

  if (
    progress.stage === "extracting_rows"
    || (
      progress.importableRowsDetected === null
      && !summary.isTerminal
    )
  ) {
    return progress.currentMessage
      ?? `Estamos leyendo ${summary.fileName} para detectar filas importables. Puedes seguir trabajando mientras preparamos el lote.`;
  }

  if (summary.status === "preview_ready" || progress.stage === "preview_ready") {
    return progress.currentMessage
      ?? `La vista previa de ${summary.fileName} ya esta lista. Ahora puedes revisar el lote y decidir que documentos aceptar o rechazar antes de materializarlo.`;
  }

  if (!summary.isTerminal && progress.stage === "resolving_fx") {
    return progress.currentMessage
      ?? `Intentando resolver cotizaciones BCU. ${progress.fxResolvedCount} documento(s) resueltos, ${progress.fxPendingCount} pendiente(s), ${progress.fxFailedCount} sin tasa por ahora.`;
  }

  if (!summary.isTerminal && progress.stage === "materializing_rows") {
    return progress.currentMessage
      ?? `Estamos materializando los documentos aceptados del lote ${summary.fileName}.`;
  }

  if (!summary.isTerminal && progress.importableRowsDetected !== null) {
    const rowsDetected = progress.importableRowsDetected;
    const chunkMessage =
      progress.totalChunks > 0
        ? ` Procesamos ${progress.currentChunk}/${progress.totalChunks} bloque(s).`
        : "";

    return [
      `Se detectaron ${rowsDetected} fila(s) importables.`,
      "Esto puede demorar.",
      "La solicitud corre en segundo plano; puedes continuar con otra cosa mientras preparamos la vista previa auditada y te avisaremos cuando este pronta.",
      progress.processedRows > 0
        ? ` Avance: ${progress.processedRows}/${rowsDetected} fila(s) tratadas.${chunkMessage}`
        : "",
    ].join(" ").trim();
  }

  if (summary.status === "completed" && progress.failedCount === 0) {
    return progress.currentMessage
      ?? `Importacion finalizada con exito. ${progress.importedCount} documento(s) quedaron listos para clasificacion.${progress.fxPendingCount > 0 ? ` ${progress.fxPendingCount} documento(s) siguen bloqueados por falta de cotizacion.` : ""}`;
  }

  if (summary.status === "completed") {
    return progress.currentMessage
      ?? `Importacion finalizada con observaciones. ${progress.importedCount} documento(s) importados, ${progress.failedCount} fila(s) con error y ${progress.skippedCount} omitida(s).`;
  }

  if (summary.status === "cancelled") {
    return progress.currentMessage
      ?? "La auditoria del lote fue cancelada o descartada.";
  }

  return progress.latestErrorMessage
    ?? progress.currentMessage
    ?? latestEventMessage(summary)
    ?? "La importacion en segundo plano fallo.";
}

function latestEventMessage(summary: DocumentSpreadsheetImportRunSummary) {
  return summary.latestEventMessage;
}
