import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSpreadsheetBatchSubmission } from "@/modules/spreadsheets/batch";
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

export function chooseSpreadsheetImportMode(preview: SpreadsheetParseResult) {
  if (
    preview.totalSheets > 4
    || preview.totalRows > 140
    || preview.totalCells > 2_500
    || preview.sheets.some((sheet) => sheet.truncatedForAnalysis)
  ) {
    return "batch" satisfies SpreadsheetImportRunMode;
  }

  return "interactive" satisfies SpreadsheetImportRunMode;
}

export function canRetrySpreadsheetImportRun(run: SpreadsheetImportRunRecord) {
  return ["failed", "cancelled", "completed"].includes(run.status);
}

export function canCancelSpreadsheetImportRun(run: SpreadsheetImportRunRecord) {
  return ["preview_ready", "queued", "in_progress"].includes(run.status);
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

async function queueBatchImport(input: {
  supabase: SupabaseClient;
  run: SpreadsheetImportRunRecord;
  organizationId: string;
  preview: SpreadsheetParseResult;
}) {
  const batch = await createSpreadsheetBatchSubmission({
    previews: [
      {
        customId: input.run.id,
        preview: input.preview,
      },
    ],
    metadata: {
      organization_id: input.organizationId,
      job_type: "spreadsheet_import_backfill",
    },
  });
  const events = appendSpreadsheetStatusEvent(
    input.run.statusEvents,
    "queued",
    `Import enviado a Batch API con batch ${batch.batchId}.`,
  );

  return updateSpreadsheetImportRun(input.supabase, {
    organizationId: input.organizationId,
    runId: input.run.id,
    status: "queued",
    batchId: batch.batchId,
    estimatedCostUsd: batch.estimatedCostUsd,
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
  });
  const mode = input.preferredMode ?? chooseSpreadsheetImportMode(preview);
  const initialEvents = [
    {
      code: "preview_ready",
      message: `Planilla parseada con ${preview.totalSheets} sheet(s) y ${preview.totalRows} filas analizadas.`,
      createdAt: new Date().toISOString(),
    },
  ];
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

  if (mode === "batch" && process.env.OPENAI_API_KEY) {
    try {
      return await queueBatchImport({
        supabase: input.supabase,
        run,
        organizationId: input.organizationId,
        preview,
      });
    } catch (error) {
      const failedEvents = appendSpreadsheetStatusEvent(
        run.statusEvents,
        "failed",
        error instanceof Error ? error.message : "No se pudo encolar el batch de planillas.",
      );

      return updateSpreadsheetImportRun(input.supabase, {
        organizationId: input.organizationId,
        runId: run.id,
        status: "failed",
        warnings: [
          ...preview.warnings,
          error instanceof Error ? error.message : "No se pudo encolar el batch de planillas.",
        ],
        statusEvents: failedEvents,
      });
    }
  }

  if (mode === "batch" && !process.env.OPENAI_API_KEY) {
    const events = appendSpreadsheetStatusEvent(
      run.statusEvents,
      "fallback_interactive",
      "No hay OPENAI_API_KEY disponible, se usa interpretacion heuristica interactiva.",
    );
    await updateSpreadsheetImportRun(input.supabase, {
      organizationId: input.organizationId,
      runId: run.id,
      statusEvents: events,
    });
  }

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

  const mode = input.preferredMode ?? run.runMode;
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

  if (mode === "batch" && process.env.OPENAI_API_KEY) {
    return queueBatchImport({
      supabase: input.supabase,
      run: refreshedRun,
      organizationId: input.organizationId,
      preview: run.preview,
    });
  }

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
