import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { interpretSpreadsheetPreview } from "@/modules/spreadsheets/interpreter";
import { parseSpreadsheetFile } from "@/modules/spreadsheets/parser";
import {
  appendSpreadsheetStatusEvent,
  confirmSpreadsheetImportRun,
  createSpreadsheetImportRun,
  loadSpreadsheetImportRun,
  updateSpreadsheetImportRun,
} from "@/modules/spreadsheets/persistence";
import type {
  SpreadsheetImportRunMode,
  SpreadsheetImportRunRecord,
  SpreadsheetParseResult,
} from "@/modules/spreadsheets/types";

const SUPPORT_SPREADSHEET_ROW_LIMIT = 5_000;

export function chooseSpreadsheetImportMode(preview: SpreadsheetParseResult): SpreadsheetImportRunMode {
  // Auto stays interactive until spreadsheet batch runs can be rehydrated
  // back into a usable preview automatically.
  void preview;
  return "interactive" satisfies SpreadsheetImportRunMode;
}

export function canRetrySpreadsheetImportRun(run: SpreadsheetImportRunRecord) {
  return ["failed", "cancelled", "completed"].includes(run.status);
}

export function canCancelSpreadsheetImportRun(run: SpreadsheetImportRunRecord) {
  return ["preview_ready", "queued", "in_progress"].includes(run.status)
    || (run.status === "completed" && !run.confirmedAt);
}

async function completeInteractiveImport(input: {
  supabase: SupabaseClient;
  run: SpreadsheetImportRunRecord;
  organizationId: string;
  preview: SpreadsheetParseResult;
}) {
  const interpretation = await interpretSpreadsheetPreview({
    organizationId: input.organizationId,
    preview: input.preview,
    provider: process.env.OPENAI_API_KEY ? "auto" : "heuristic",
  });
  const events = appendSpreadsheetStatusEvent(
    input.run.statusEvents,
    "completed",
    `Import interpretado como ${interpretation.importType}.`,
  );

  return updateSpreadsheetImportRun(input.supabase, {
    organizationId: input.organizationId,
    runId: input.run.id,
    status: "completed",
    importType: interpretation.importType,
    result: interpretation,
    warnings: interpretation.warnings,
    detectedMapping: interpretation.mappingDetected,
    providerCode: interpretation.providerCode,
    modelCode: interpretation.modelCode,
    promptVersion: interpretation.promptVersion,
    schemaVersion: interpretation.schemaVersion,
    responseId: interpretation.responseId,
    estimatedCostUsd: interpretation.estimatedCostUsd,
    statusEvents: events,
  });
}

export async function runSpreadsheetImport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  actorId: string | null;
  fileName: string;
  mimeType?: string | null;
  bytes: ArrayBuffer | Uint8Array;
  preferredMode?: SpreadsheetImportRunMode | null;
}) {
  const preview = parseSpreadsheetFile({
    fileName: input.fileName,
    mimeType: input.mimeType ?? null,
    bytes: input.bytes,
    rowLimitForAnalysis: SUPPORT_SPREADSHEET_ROW_LIMIT,
  });
  const mode = chooseSpreadsheetImportMode(preview);
  const initialEvents = [
    {
      code: "preview_ready",
      message: `Planilla parseada con ${preview.totalSheets} sheet(s) y ${preview.totalRows} filas analizadas.`,
      createdAt: new Date().toISOString(),
    },
  ];

  if (input.preferredMode === "batch") {
    initialEvents.push({
      code: "fallback_interactive",
      message: "Batch API para planillas de soporte no esta habilitada todavia; se usa interpretacion interactiva.",
      createdAt: new Date().toISOString(),
    });
  }

  const run = await createSpreadsheetImportRun(input.supabase, {
    organizationId: input.organizationId,
    fileName: input.fileName,
    fileKind: preview.fileKind,
    importType: "unsupported",
    runMode: mode,
    status: "preview_ready",
    preview,
    result: null,
    warnings: preview.warnings,
    statusEvents: initialEvents,
    metadata: {
      uploaded_by: input.actorId,
      source_type: "spreadsheet_import",
    },
  });

  return completeInteractiveImport({
    supabase: input.supabase,
    run,
    organizationId: input.organizationId,
    preview,
  });
}

export async function retrySpreadsheetImport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  runId: string;
  preferredMode?: SpreadsheetImportRunMode | null;
}) {
  const run = await loadSpreadsheetImportRun(input.supabase, input.organizationId, input.runId);

  if (!run) {
    throw new Error("Import run no encontrado.");
  }

  if (!canRetrySpreadsheetImportRun(run)) {
    throw new Error("Este import run todavia no puede reintentarse.");
  }

  if (!run.preview) {
    throw new Error("No existe preview persistido para reintentar la planilla.");
  }

  const retryCount = run.retryCount + 1;
  const resetEvents = appendSpreadsheetStatusEvent(
    run.statusEvents,
    "retry",
    `Reintento #${retryCount} del import de planilla.`,
  );
  const refreshedRun = await updateSpreadsheetImportRun(input.supabase, {
    organizationId: input.organizationId,
    runId: run.id,
    status: "preview_ready",
    batchId: null,
    responseId: null,
    result: null,
    retryCount,
    statusEvents: resetEvents,
  });

  return completeInteractiveImport({
    supabase: input.supabase,
    run: refreshedRun,
    organizationId: input.organizationId,
    preview: run.preview,
  });
}

export async function cancelSpreadsheetImport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  runId: string;
}) {
  const run = await loadSpreadsheetImportRun(input.supabase, input.organizationId, input.runId);

  if (!run) {
    throw new Error("Import run no encontrado.");
  }

  if (!canCancelSpreadsheetImportRun(run)) {
    throw new Error("Este import run ya no puede cancelarse.");
  }

  const events = appendSpreadsheetStatusEvent(
    run.statusEvents,
    "cancelled",
    "Import de planilla cancelado por el usuario.",
  );

  return updateSpreadsheetImportRun(input.supabase, {
    organizationId: input.organizationId,
    runId: run.id,
    status: "cancelled",
    statusEvents: events,
  });
}

export async function confirmCompletedSpreadsheetImport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  runId: string;
  actorId: string | null;
}) {
  const run = await loadSpreadsheetImportRun(input.supabase, input.organizationId, input.runId);

  if (!run) {
    throw new Error("Import run no encontrado.");
  }

  if (run.status !== "completed") {
    throw new Error("Solo se pueden confirmar imports completados.");
  }

  const events = appendSpreadsheetStatusEvent(
    run.statusEvents,
    "confirmed",
    "Preview de planilla confirmado por el usuario.",
  );

  return confirmSpreadsheetImportRun(input.supabase, {
    organizationId: input.organizationId,
    runId: run.id,
    confirmedBy: input.actorId,
    statusEvents: events,
  });
}
