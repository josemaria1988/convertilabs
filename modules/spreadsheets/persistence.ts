import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import type {
  SpreadsheetFileKind,
  SpreadsheetImportRunRecord,
  SpreadsheetImportRunMode,
  SpreadsheetImportRunStatus,
  SpreadsheetImportType,
  SpreadsheetInterpretationResult,
  SpreadsheetParseResult,
  SpreadsheetImportStatusEvent,
} from "@/modules/spreadsheets/types";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function asStatusEvents(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is SpreadsheetImportStatusEvent => {
        const candidate = asRecord(entry);
        return typeof candidate.code === "string" && typeof candidate.message === "string";
      })
    : [];
}

function asSpreadsheetFileKind(value: unknown): SpreadsheetFileKind {
  switch (value) {
    case "csv":
    case "tsv":
    case "xlsx":
    case "xls":
      return value;
    default:
      return "unknown";
  }
}

function asSpreadsheetImportType(value: unknown): SpreadsheetImportType {
  switch (value) {
    case "historical_vat_liquidation":
    case "journal_template_import":
    case "chart_of_accounts_import":
    case "mixed":
      return value;
    default:
      return "unsupported";
  }
}

function asSpreadsheetImportRunMode(value: unknown): SpreadsheetImportRunMode {
  return value === "batch" ? "batch" : "interactive";
}

function asSpreadsheetImportRunStatus(value: unknown): SpreadsheetImportRunStatus {
  switch (value) {
    case "queued":
    case "in_progress":
    case "completed":
    case "failed":
    case "cancelled":
      return value;
    default:
      return "preview_ready";
  }
}

function mapRunRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    sourceDocumentId: asString(row.source_document_id),
    fileName: String(row.file_name ?? ""),
    fileKind: asSpreadsheetFileKind(row.file_kind),
    importType: asSpreadsheetImportType(row.import_type),
    runMode: asSpreadsheetImportRunMode(row.run_mode),
    status: asSpreadsheetImportRunStatus(row.status),
    providerCode: asString(row.provider_code),
    modelCode: asString(row.model_code),
    promptVersion: asString(row.prompt_version),
    schemaVersion: asString(row.schema_version),
    batchId: asString(row.batch_id),
    responseId: asString(row.response_id),
    estimatedCostUsd:
      typeof row.estimated_cost_usd === "number"
        ? row.estimated_cost_usd
        : null,
    warnings: asStringArray(row.warnings_json),
    preview: row.preview_json ? row.preview_json as SpreadsheetParseResult : null,
    result: row.result_json ? row.result_json as SpreadsheetInterpretationResult : null,
    detectedMapping: asRecord(row.detected_mapping_json),
    statusEvents: asStatusEvents(row.status_events_json),
    retryCount:
      typeof row.retry_count === "number"
        ? row.retry_count
        : 0,
    confirmedAt: asString(row.confirmed_at),
    confirmedBy: asString(row.confirmed_by),
    metadata: asRecord(row.metadata_json),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  } satisfies SpreadsheetImportRunRecord;
}

export function appendSpreadsheetStatusEvent(
  events: SpreadsheetImportStatusEvent[],
  code: string,
  message: string,
) {
  return [
    ...events,
    {
      code,
      message,
      createdAt: new Date().toISOString(),
    },
  ];
}

export async function createSpreadsheetImportRun(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    sourceDocumentId?: string | null;
    fileName: string;
    fileKind: string;
    importType: SpreadsheetImportType;
    runMode: SpreadsheetImportRunMode;
    status: SpreadsheetImportRunStatus;
    preview: SpreadsheetParseResult | null;
    result: SpreadsheetInterpretationResult | null;
    warnings: string[];
    detectedMapping?: Record<string, unknown>;
    providerCode?: string | null;
    modelCode?: string | null;
    promptVersion?: string | null;
    schemaVersion?: string | null;
    batchId?: string | null;
    responseId?: string | null;
    estimatedCostUsd?: number | null;
    statusEvents?: SpreadsheetImportStatusEvent[];
    retryCount?: number;
    metadata?: Record<string, unknown>;
  },
) {
  const payload = {
    organization_id: input.organizationId,
    source_document_id: input.sourceDocumentId ?? null,
    file_name: input.fileName,
    file_kind: input.fileKind,
    import_type: input.importType,
    run_mode: input.runMode,
    status: input.status,
    provider_code: input.providerCode ?? null,
    model_code: input.modelCode ?? null,
    prompt_version: input.promptVersion ?? null,
    schema_version: input.schemaVersion ?? null,
    batch_id: input.batchId ?? null,
    response_id: input.responseId ?? null,
    estimated_cost_usd: input.estimatedCostUsd ?? null,
    warnings_json: input.warnings,
    preview_json: input.preview,
    result_json: input.result,
    detected_mapping_json: input.detectedMapping ?? {},
    status_events_json: input.statusEvents ?? [],
    retry_count: input.retryCount ?? 0,
    metadata_json: input.metadata ?? {},
  };
  const { data, error } = await supabase
    .from("organization_spreadsheet_import_runs")
    .insert(payload)
    .select(
      "id, organization_id, source_document_id, file_name, file_kind, import_type, run_mode, status, provider_code, model_code, prompt_version, schema_version, batch_id, response_id, estimated_cost_usd, warnings_json, preview_json, result_json, detected_mapping_json, status_events_json, retry_count, confirmed_at, confirmed_by, metadata_json, created_at, updated_at",
    )
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el import run de planilla.");
  }

  return mapRunRow(data as Record<string, unknown>);
}

export async function updateSpreadsheetImportRun(
  supabase: SupabaseClient,
  input: {
    runId: string;
    organizationId: string;
    status?: SpreadsheetImportRunStatus;
    importType?: SpreadsheetImportType;
    result?: SpreadsheetInterpretationResult | null;
    warnings?: string[];
    detectedMapping?: Record<string, unknown>;
    providerCode?: string | null;
    modelCode?: string | null;
    promptVersion?: string | null;
    schemaVersion?: string | null;
    batchId?: string | null;
    responseId?: string | null;
    estimatedCostUsd?: number | null;
    statusEvents?: SpreadsheetImportStatusEvent[];
    retryCount?: number;
    confirmedAt?: string | null;
    confirmedBy?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.status) {
    patch.status = input.status;
  }

  if (input.importType) {
    patch.import_type = input.importType;
  }

  if (input.result !== undefined) {
    patch.result_json = input.result;
  }

  if (input.warnings) {
    patch.warnings_json = input.warnings;
  }

  if (input.detectedMapping) {
    patch.detected_mapping_json = input.detectedMapping;
  }

  if (input.providerCode !== undefined) {
    patch.provider_code = input.providerCode;
  }

  if (input.modelCode !== undefined) {
    patch.model_code = input.modelCode;
  }

  if (input.promptVersion !== undefined) {
    patch.prompt_version = input.promptVersion;
  }

  if (input.schemaVersion !== undefined) {
    patch.schema_version = input.schemaVersion;
  }

  if (input.batchId !== undefined) {
    patch.batch_id = input.batchId;
  }

  if (input.responseId !== undefined) {
    patch.response_id = input.responseId;
  }

  if (input.estimatedCostUsd !== undefined) {
    patch.estimated_cost_usd = input.estimatedCostUsd;
  }

  if (input.statusEvents) {
    patch.status_events_json = input.statusEvents;
  }

  if (input.retryCount !== undefined) {
    patch.retry_count = input.retryCount;
  }

  if (input.confirmedAt !== undefined) {
    patch.confirmed_at = input.confirmedAt;
  }

  if (input.confirmedBy !== undefined) {
    patch.confirmed_by = input.confirmedBy;
  }

  if (input.metadata) {
    patch.metadata_json = input.metadata;
  }

  const { data, error } = await supabase
    .from("organization_spreadsheet_import_runs")
    .update(patch)
    .eq("id", input.runId)
    .eq("organization_id", input.organizationId)
    .select(
      "id, organization_id, source_document_id, file_name, file_kind, import_type, run_mode, status, provider_code, model_code, prompt_version, schema_version, batch_id, response_id, estimated_cost_usd, warnings_json, preview_json, result_json, detected_mapping_json, status_events_json, retry_count, confirmed_at, confirmed_by, metadata_json, created_at, updated_at",
    )
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar el import run de planilla.");
  }

  return mapRunRow(data as Record<string, unknown>);
}

export async function loadSpreadsheetImportRun(
  supabase: SupabaseClient,
  organizationId: string,
  runId: string,
) {
  const { data, error } = await supabase
    .from("organization_spreadsheet_import_runs")
    .select(
      "id, organization_id, source_document_id, file_name, file_kind, import_type, run_mode, status, provider_code, model_code, prompt_version, schema_version, batch_id, response_id, estimated_cost_usd, warnings_json, preview_json, result_json, detected_mapping_json, status_events_json, retry_count, confirmed_at, confirmed_by, metadata_json, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", runId)
    .limit(1)
    .maybeSingle();

  if (error && isMissingSupabaseRelationError(error, "organization_spreadsheet_import_runs")) {
    return null;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRunRow(data as Record<string, unknown>) : null;
}

export async function listOrganizationSpreadsheetImportRuns(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 12,
) {
  const { data, error } = await supabase
    .from("organization_spreadsheet_import_runs")
    .select(
      "id, organization_id, source_document_id, file_name, file_kind, import_type, run_mode, status, provider_code, model_code, prompt_version, schema_version, batch_id, response_id, estimated_cost_usd, warnings_json, preview_json, result_json, detected_mapping_json, status_events_json, retry_count, confirmed_at, confirmed_by, metadata_json, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error && isMissingSupabaseRelationError(error, "organization_spreadsheet_import_runs")) {
    return [];
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data as Record<string, unknown>[] | null) ?? []).map((row) => mapRunRow(row));
}

export async function confirmSpreadsheetImportRun(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    runId: string;
    confirmedBy: string | null;
    statusEvents: SpreadsheetImportStatusEvent[];
  },
) {
  return updateSpreadsheetImportRun(supabase, {
    organizationId: input.organizationId,
    runId: input.runId,
    confirmedAt: new Date().toISOString(),
    confirmedBy: input.confirmedBy,
    statusEvents: input.statusEvents,
  });
}
