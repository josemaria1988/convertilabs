import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type DocumentSpreadsheetImportRow,
  persistDocumentSpreadsheetImportRow,
} from "@/modules/documents/spreadsheet-batch-import";
import {
  buildDocumentSpreadsheetImportRunMetadata,
  type DocumentSpreadsheetImportRunStage,
  isDocumentSpreadsheetImportType,
  parseDocumentSpreadsheetImportRunProgress,
} from "@/modules/documents/spreadsheet-import-runs";
import {
  appendSpreadsheetStatusEvent,
  listOrganizationSpreadsheetImportRuns,
  loadSpreadsheetImportRun,
  updateSpreadsheetImportRun,
} from "@/modules/spreadsheets";
import type { SpreadsheetImportRunRecord } from "@/modules/spreadsheets";

export type DocumentAuditPreviewDecision =
  | "pending"
  | "accepted"
  | "rejected"
  | "failed";

export type DocumentAuditPreviewRowRecord = {
  rowId: string;
  row: DocumentSpreadsheetImportRow;
  decision: DocumentAuditPreviewDecision;
  decisionAt: string | null;
  decidedBy: string | null;
  materializedDocumentId: string | null;
  failureMessage: string | null;
};

export type DocumentAuditPreviewRowView = {
  rowId: string;
  rowNumber: number;
  sheetName: string;
  displayLabel: string;
  documentRole: DocumentSpreadsheetImportRow["documentRole"];
  documentType: string;
  counterpartyName: string | null;
  counterpartyTaxId: string | null;
  documentDate: string | null;
  documentNumber: string | null;
  currencyCode: string | null;
  subtotalAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  warnings: string[];
  confidence: number;
  sourceRowNumbers: number[];
  decision: DocumentAuditPreviewDecision;
  decisionAt: string | null;
  decidedBy: string | null;
  materializedDocumentId: string | null;
  failureMessage: string | null;
};

export type DocumentAuditPreviewCounts = {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  failed: number;
};

export type DocumentAuditImportedDocument = {
  id: string;
  originalFilename: string;
  documentDate: string | null;
  documentNumber: string | null;
  counterpartyName: string | null;
  currencyCode: string | null;
  totalAmount: number | null;
  createdAt: string;
};

export type DocumentAuditRunListItem = {
  runId: string;
  fileName: string;
  ledgerKind: "purchase" | "sale";
  status: SpreadsheetImportRunRecord["status"];
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  uploadedByDisplay: string | null;
  confirmedByDisplay: string | null;
  warnings: string[];
  latestEventMessage: string | null;
  previewCounts: DocumentAuditPreviewCounts;
  importedCount: number;
  hasStructuredPreview: boolean;
};

export type DocumentAuditRunDetail = DocumentAuditRunListItem & {
  progress: ReturnType<typeof parseDocumentSpreadsheetImportRunProgress>;
  statusEvents: SpreadsheetImportRunRecord["statusEvents"];
  previewRows: DocumentAuditPreviewRowView[];
  importedDocuments: DocumentAuditImportedDocument[];
  extractedMetrics: Record<string, unknown>;
  dateRange: {
    minDate: string | null;
    maxDate: string | null;
  };
  legacyAuditGap: string | null;
};

type ProfileDisplayRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ImportedDocumentRow = {
  id: string;
  original_filename: string;
  document_date: string | null;
  external_reference: string | null;
  document_currency_code: string | null;
  document_total_amount_original: number | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown) {
  return asArray(value).filter((entry): entry is string => typeof entry === "string");
}

function isPreviewDecision(value: unknown): value is DocumentAuditPreviewDecision {
  return value === "pending" || value === "accepted" || value === "rejected" || value === "failed";
}

function isSpreadsheetImportRow(value: unknown): value is DocumentSpreadsheetImportRow {
  const row = asRecord(value);
  return typeof row.rowNumber === "number"
    && typeof row.sheetName === "string"
    && typeof row.documentType === "string"
    && typeof row.displayLabel === "string"
    && typeof row.confidence === "number"
    && typeof row.sourceReference === "string";
}

function getRowId(row: DocumentSpreadsheetImportRow) {
  return row.sourceReference || `${row.sheetName}:fila-${row.rowNumber}`;
}

export function buildDocumentAuditPreviewRows(rows: DocumentSpreadsheetImportRow[]) {
  return rows.map((row) => ({
    rowId: getRowId(row),
    row,
    decision: "pending",
    decisionAt: null,
    decidedBy: null,
    materializedDocumentId: null,
    failureMessage: null,
  } satisfies DocumentAuditPreviewRowRecord));
}

export function parseDocumentAuditPreviewRows(metadata: Record<string, unknown>) {
  const rows = asArray(metadata.audit_preview_rows);

  return rows.flatMap((entry) => {
    const record = asRecord(entry);
    const row = record.row;

    if (!isSpreadsheetImportRow(row)) {
      return [];
    }

    return [{
      rowId: asString(record.rowId) ?? getRowId(row),
      row,
      decision: isPreviewDecision(record.decision) ? record.decision : "pending",
      decisionAt: asString(record.decisionAt),
      decidedBy: asString(record.decidedBy),
      materializedDocumentId: asString(record.materializedDocumentId),
      failureMessage: asString(record.failureMessage),
    } satisfies DocumentAuditPreviewRowRecord];
  });
}

export function countDocumentAuditPreviewRows(rows: DocumentAuditPreviewRowRecord[]): DocumentAuditPreviewCounts {
  return rows.reduce<DocumentAuditPreviewCounts>((summary, row) => {
    summary.total += 1;
    summary[row.decision] += 1;
    return summary;
  }, {
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    failed: 0,
  });
}

export function resolveDocumentAuditPreviewCounterparty(
  row: Pick<DocumentSpreadsheetImportRow, "documentRole" | "facts">,
) {
  if (row.documentRole === "sale") {
    return {
      name: row.facts.receiver_name ?? row.facts.issuer_name ?? null,
      taxId: row.facts.receiver_tax_id ?? row.facts.issuer_tax_id ?? null,
    };
  }

  return {
    name: row.facts.issuer_name ?? row.facts.receiver_name ?? null,
    taxId: row.facts.issuer_tax_id ?? row.facts.receiver_tax_id ?? null,
  };
}

function buildPreviewRowView(
  rowRecord: DocumentAuditPreviewRowRecord,
  profileLookup: Map<string, string>,
) {
  const facts = rowRecord.row.facts;
  const counterparty = resolveDocumentAuditPreviewCounterparty(rowRecord.row);

  return {
    rowId: rowRecord.rowId,
    rowNumber: rowRecord.row.rowNumber,
    sheetName: rowRecord.row.sheetName,
    displayLabel: rowRecord.row.displayLabel,
    documentRole: rowRecord.row.documentRole,
    documentType: rowRecord.row.documentType,
    counterpartyName: counterparty.name,
    counterpartyTaxId: counterparty.taxId,
    documentDate: facts.document_date,
    documentNumber: facts.document_number,
    currencyCode: facts.currency_code,
    subtotalAmount: facts.subtotal,
    taxAmount: facts.tax_amount,
    totalAmount: facts.total_amount,
    warnings: rowRecord.row.warnings,
    confidence: rowRecord.row.confidence,
    sourceRowNumbers: rowRecord.row.sourceRowNumbers,
    decision: rowRecord.decision,
    decisionAt: rowRecord.decisionAt,
    decidedBy: rowRecord.decidedBy ? (profileLookup.get(rowRecord.decidedBy) ?? rowRecord.decidedBy) : null,
    materializedDocumentId: rowRecord.materializedDocumentId,
    failureMessage: rowRecord.failureMessage,
  } satisfies DocumentAuditPreviewRowView;
}

function getUploadedById(run: SpreadsheetImportRunRecord) {
  return asString(run.metadata.uploaded_by);
}

function getImportedDocumentIds(run: SpreadsheetImportRunRecord, previewRows: DocumentAuditPreviewRowRecord[]) {
  const ids = new Set<string>(asStringArray(run.metadata.imported_document_ids));

  for (const row of previewRows) {
    if (row.materializedDocumentId) {
      ids.add(row.materializedDocumentId);
    }
  }

  return [...ids];
}

async function loadProfileDisplayLookup(
  supabase: SupabaseClient,
  userIds: string[],
) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", uniqueUserIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    (((data as ProfileDisplayRow[] | null) ?? [])).map((profile) => [
      profile.id,
      profile.full_name || profile.email || profile.id,
    ]),
  );
}

async function loadImportedDocuments(
  supabase: SupabaseClient,
  organizationId: string,
  documentIds: string[],
) {
  const uniqueDocumentIds = Array.from(new Set(documentIds.filter(Boolean)));

  if (uniqueDocumentIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, original_filename, document_date, external_reference, document_currency_code, document_total_amount_original, created_at, metadata")
    .eq("organization_id", organizationId)
    .in("id", uniqueDocumentIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (((data as ImportedDocumentRow[] | null) ?? [])).map((row) => ({
    id: row.id,
    originalFilename: row.original_filename,
    documentDate: row.document_date,
    documentNumber: row.external_reference,
    counterpartyName: asString(asRecord(row.metadata).counterparty_name)
      ?? asString(asRecord(row.metadata).receiver_name)
      ?? asString(asRecord(row.metadata).issuer_name),
    currencyCode: row.document_currency_code,
    totalAmount: row.document_total_amount_original,
    createdAt: row.created_at,
  } satisfies DocumentAuditImportedDocument));
}

function formatUserDisplay(
  userId: string | null,
  profileLookup: Map<string, string>,
) {
  if (!userId) {
    return null;
  }

  return profileLookup.get(userId) ?? userId;
}

function buildRunListItem(
  run: SpreadsheetImportRunRecord,
  profileLookup: Map<string, string>,
): DocumentAuditRunListItem {
  const previewRows = parseDocumentAuditPreviewRows(run.metadata);
  const previewCounts = countDocumentAuditPreviewRows(previewRows);
  const importedCount = getImportedDocumentIds(run, previewRows).length
    || (asNumber(run.metadata.imported_document_count) ?? previewCounts.accepted);

  return {
    runId: run.id,
    fileName: run.fileName,
    ledgerKind: run.metadata.ledger_kind === "sale" ? "sale" : "purchase",
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    confirmedAt: run.confirmedAt,
    uploadedByDisplay: formatUserDisplay(getUploadedById(run), profileLookup),
    confirmedByDisplay: formatUserDisplay(run.confirmedBy, profileLookup),
    warnings: run.warnings,
    latestEventMessage: run.statusEvents.at(-1)?.message ?? null,
    previewCounts,
    importedCount,
    hasStructuredPreview: previewRows.length > 0,
  };
}

export async function loadDocumentAuditWorkspace(input: {
  supabase: SupabaseClient;
  organizationId: string;
  selectedRunId?: string | null;
  limit?: number;
}) {
  const limit = input.limit ?? 12;
  const [recentRuns, selectedRunCandidate] = await Promise.all([
    listOrganizationSpreadsheetImportRuns(input.supabase, input.organizationId, limit),
    input.selectedRunId
      ? loadSpreadsheetImportRun(input.supabase, input.organizationId, input.selectedRunId)
      : Promise.resolve(null),
  ]);

  const filteredRuns = recentRuns.filter((run) => isDocumentSpreadsheetImportType(run.importType));
  const selectedRun =
    selectedRunCandidate && isDocumentSpreadsheetImportType(selectedRunCandidate.importType)
      ? selectedRunCandidate
      : filteredRuns[0] ?? null;
  const runs = selectedRun
    && !filteredRuns.some((run) => run.id === selectedRun.id)
      ? [selectedRun, ...filteredRuns].slice(0, limit)
      : filteredRuns;

  const actorIds = Array.from(new Set(
    runs.flatMap((run) => [
      getUploadedById(run),
      run.confirmedBy,
      ...parseDocumentAuditPreviewRows(run.metadata).map((row) => row.decidedBy),
    ]).filter((value): value is string => Boolean(value)),
  ));
  const profileLookup = await loadProfileDisplayLookup(input.supabase, actorIds);
  const listItems = runs.map((run) => buildRunListItem(run, profileLookup));

  if (!selectedRun) {
    return {
      runs: listItems,
      selectedRun: null,
    };
  }

  const previewRows = parseDocumentAuditPreviewRows(selectedRun.metadata);
  const previewRowsByDocumentId = new Map(
    previewRows
      .filter((row) => typeof row.materializedDocumentId === "string" && row.materializedDocumentId.length > 0)
      .map((row) => [row.materializedDocumentId, row]),
  );
  const importedDocuments = (await loadImportedDocuments(
    input.supabase,
    input.organizationId,
    getImportedDocumentIds(selectedRun, previewRows),
  )).map((document) => {
    const previewRow = previewRowsByDocumentId.get(document.id);

    return {
      ...document,
      counterpartyName: document.counterpartyName
        ?? (previewRow ? resolveDocumentAuditPreviewCounterparty(previewRow.row).name : null),
    };
  });
  const detail = {
    ...buildRunListItem(selectedRun, profileLookup),
    progress: parseDocumentSpreadsheetImportRunProgress(selectedRun.metadata),
    statusEvents: selectedRun.statusEvents,
    previewRows: previewRows.map((row) => buildPreviewRowView(row, profileLookup)),
    importedDocuments,
    extractedMetrics: asRecord(selectedRun.metadata.extracted_metrics),
    dateRange: {
      minDate: asString(asRecord(selectedRun.metadata.extracted_metrics).minDate)
        ?? asString(selectedRun.metadata.preview_min_date),
      maxDate: asString(asRecord(selectedRun.metadata.extracted_metrics).maxDate)
        ?? asString(selectedRun.metadata.preview_max_date),
    },
    legacyAuditGap:
      previewRows.length === 0 && importedDocuments.length === 0
        ? "Esta corrida es anterior al flujo auditado actual y no trae preview estructurado ni batch persistido."
        : null,
  } satisfies DocumentAuditRunDetail;

  return {
    runs: listItems,
    selectedRun: detail,
  };
}

function buildDecisionMessage(input: {
  acceptedCount: number;
  rejectedCount: number;
  failedCount: number;
  pendingCount: number;
}) {
  const parts = [];

  if (input.acceptedCount > 0) {
    parts.push(`${input.acceptedCount} documento(s) aceptado(s) y materializado(s).`);
  }

  if (input.rejectedCount > 0) {
    parts.push(`${input.rejectedCount} documento(s) marcado(s) como rechazado(s).`);
  }

  if (input.failedCount > 0) {
    parts.push(`${input.failedCount} documento(s) quedaron con error y siguen en preview para resolverlos o rechazarlos.`);
  }

  if (input.pendingCount > 0) {
    parts.push(`${input.pendingCount} documento(s) siguen pendientes en esta auditoria.`);
  }

  if (parts.length === 0) {
    return "No hubo cambios en la seleccion de esta auditoria.";
  }

  return parts.join(" ");
}

export async function applyDocumentAuditPreviewDecisions(input: {
  supabase: SupabaseClient;
  organizationId: string;
  actorId: string | null;
  runId: string;
  acceptRowIds?: string[];
  rejectRowIds?: string[];
}) {
  const run = await loadSpreadsheetImportRun(input.supabase, input.organizationId, input.runId);

  if (!run || !isDocumentSpreadsheetImportType(run.importType)) {
    throw new Error("No encontramos una corrida documental auditable.");
  }

  const acceptRowIds = new Set((input.acceptRowIds ?? []).filter(Boolean));
  const rejectRowIds = new Set((input.rejectRowIds ?? []).filter(Boolean));

  if (acceptRowIds.size === 0 && rejectRowIds.size === 0) {
    throw new Error("Selecciona al menos un documento del preview para aceptar o rechazar.");
  }

  for (const rowId of acceptRowIds) {
    if (rejectRowIds.has(rowId)) {
      throw new Error("No puedes aceptar y rechazar el mismo documento en una sola accion.");
    }
  }

  const previewRows = parseDocumentAuditPreviewRows(run.metadata);

  if (previewRows.length === 0) {
    throw new Error("Esta corrida todavia no tiene un preview estructurado para auditar.");
  }

  const now = new Date().toISOString();
  const uploadedBy = getUploadedById(run);
  let acceptedInAction = 0;
  let rejectedInAction = 0;
  let failedInAction = 0;

  for (const rowRecord of previewRows) {
    if (rejectRowIds.has(rowRecord.rowId) && rowRecord.decision !== "accepted") {
      rowRecord.decision = "rejected";
      rowRecord.decisionAt = now;
      rowRecord.decidedBy = input.actorId;
      rowRecord.failureMessage = null;
      rowRecord.materializedDocumentId = null;
      rejectedInAction += 1;
      continue;
    }

    if (!acceptRowIds.has(rowRecord.rowId) || rowRecord.decision === "accepted") {
      continue;
    }

    try {
      const documentId = await persistDocumentSpreadsheetImportRow({
        supabase: input.supabase,
        organizationId: input.organizationId,
        actorId: input.actorId ?? uploadedBy,
        fileName: run.fileName,
        row: rowRecord.row,
      });
      rowRecord.decision = "accepted";
      rowRecord.decisionAt = now;
      rowRecord.decidedBy = input.actorId;
      rowRecord.materializedDocumentId = documentId;
      rowRecord.failureMessage = null;
      acceptedInAction += 1;
    } catch (error) {
      rowRecord.decision = "failed";
      rowRecord.decisionAt = now;
      rowRecord.decidedBy = input.actorId;
      rowRecord.failureMessage = error instanceof Error
        ? error.message
        : "No se pudo materializar este documento del preview.";
      failedInAction += 1;
    }
  }

  const previewCounts = countDocumentAuditPreviewRows(previewRows);
  const importedDocumentIds = getImportedDocumentIds(run, previewRows);
  const actionMessage = buildDecisionMessage({
    acceptedCount: acceptedInAction,
    rejectedCount: rejectedInAction,
    failedCount: failedInAction,
    pendingCount: previewCounts.pending,
  });

  let nextStatus = run.status;
  let progressStage: DocumentSpreadsheetImportRunStage = "preview_ready";
  let confirmedAt = run.confirmedAt;
  let confirmedBy = run.confirmedBy;
  let finalEventCode = "audit_decision_applied";
  let finalEventMessage = actionMessage;

  if (previewCounts.pending === 0 && previewCounts.failed === 0) {
    if (previewCounts.accepted > 0) {
      nextStatus = "completed";
      progressStage = "completed";
      confirmedAt = confirmedAt ?? now;
      confirmedBy = confirmedBy ?? input.actorId;
      finalEventCode = "audit_completed";
      finalEventMessage = `${actionMessage} La auditoria quedo cerrada y el batch fue materializado.`;
    } else {
      nextStatus = "cancelled";
      progressStage = "cancelled";
      finalEventCode = "audit_discarded";
      finalEventMessage = `${actionMessage} La auditoria quedo descartada sin crear documentos.`;
    }
  }

  const nextMetadata = {
    ...buildDocumentSpreadsheetImportRunMetadata({
      existingMetadata: run.metadata,
      progress: {
        stage: progressStage,
        percent: 100,
        importableRowsDetected: previewCounts.total,
        processedRows: previewCounts.total - previewCounts.pending,
        importedCount: previewCounts.accepted,
        failedCount: previewCounts.failed,
        skippedCount: previewCounts.rejected,
        currentMessage: finalEventMessage,
        latestErrorMessage: failedInAction > 0
          ? previewRows.find((row) => row.decision === "failed")?.failureMessage ?? null
          : null,
        finishedAt: nextStatus === "completed" || nextStatus === "cancelled" ? now : null,
      },
    }),
    audit_preview_rows: previewRows,
    audit_summary: previewCounts,
    imported_document_ids: importedDocumentIds,
  } satisfies Record<string, unknown>;
  const nextEvents = appendSpreadsheetStatusEvent(run.statusEvents, finalEventCode, finalEventMessage);

  const updatedRun = await updateSpreadsheetImportRun(input.supabase, {
    organizationId: input.organizationId,
    runId: run.id,
    status: nextStatus,
    statusEvents: nextEvents,
    confirmedAt,
    confirmedBy,
    metadata: nextMetadata,
  });

  return {
    run: updatedRun,
    previewCounts,
    message: finalEventMessage,
  };
}
