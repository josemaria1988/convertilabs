import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  getOperationCategoryValue,
  loadDocumentAccountingContext,
  parseAmountBreakdown,
  parseDraftFacts,
  parseLineItems,
  roundCurrency,
  type PaymentTerms,
  type SettlementMethod,
} from "@/modules/accounting";
import { buildZetaConnection } from "@/modules/integrations/zeta/client/auth";
import { ZetaIntegrationError } from "@/modules/integrations/zeta/client/errors";
import {
  callZetaEndpoint,
  createZetaRestClient,
  type ZetaFetch,
  type ZetaRestClient,
} from "@/modules/integrations/zeta/client/rest-client";
import {
  fingerprintIntegrationPayload,
  integrationTables,
  recordIntegrationAuditEvent,
  upsertIntegrationRawRecord,
} from "@/modules/integrations/repository";
import { normalizeZetaPurchaseExpenseConfig, resolveZetaPurchaseExpenseInvoicePayload } from "@/modules/integrations/zeta/export/purchase-expense-resolver";
import { preflightZetaPurchaseInvoiceDuplicate } from "@/modules/integrations/zeta/export/duplicate-preflight";
import type {
  ZetaPurchaseExpenseCatalogs,
  ZetaPurchaseExpenseDocumentInput,
  ZetaPurchaseExportBlocker,
  ZetaPurchaseInvoiceExportResolution,
  ZetaPurchaseInvoiceExportResult,
} from "@/modules/integrations/zeta/export/types";

type JsonRecord = Record<string, unknown>;

type DocumentRow = {
  id: string;
  organization_id: string;
  document_date: string | null;
  current_draft_id: string | null;
  metadata: JsonRecord | null;
};

type DraftRow = {
  id: string;
  document_id: string;
  document_role: "purchase" | "sale" | "other";
  document_type: string | null;
  status: string;
  operation_context_json: JsonRecord | null;
  intake_context_json: JsonRecord | null;
  fields_json: JsonRecord | null;
  journal_suggestion_json: JsonRecord | null;
};

type ZetaConnectionRow = {
  id: string;
  status: string;
  test_mode: boolean;
  config_json: JsonRecord | null;
};

type ExportDependencies = {
  supabase?: SupabaseClient;
  client?: ZetaRestClient;
  fetchImpl?: ZetaFetch;
  now?: () => Date;
};

const exportEntityType = "purchase_expense_export_attempt";
const exportStream = "zeta.outbound.purchase_expense_invoices";

function nowIso(deps?: ExportDependencies) {
  return (deps?.now?.() ?? new Date()).toISOString();
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePaymentTerms(value: unknown): PaymentTerms | null {
  switch (value) {
    case "cash":
    case "credit":
    case "unknown":
      return value;
    default:
      return null;
  }
}

function normalizeSettlementMethod(value: unknown): SettlementMethod | null {
  switch (value) {
    case "cash":
    case "bank_transfer":
    case "card":
    case "check":
    case "paid_by_partner":
    case "mixed":
    case "unknown":
      return value;
    default:
      return null;
  }
}

async function loadConnection(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from(integrationTables.connections)
    .select("id, status, test_mode, config_json")
    .eq("organization_id", organizationId)
    .eq("provider", "zetasoftware")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as ZetaConnectionRow | null;

  if (!row) {
    throw new Error("Guarda la conexion Zetasoftware antes de exportar compras de gasto.");
  }

  if (row.status === "paused") {
    throw new Error("La conexion Zetasoftware esta pausada.");
  }

  return row;
}

async function buildClient(input: {
  supabase: SupabaseClient;
  organizationId: string;
  deps?: ExportDependencies;
}) {
  if (input.deps?.client) {
    return input.deps.client;
  }

  const runtime = await buildZetaConnection({
    supabase: input.supabase,
    organizationId: input.organizationId,
  });

  return createZetaRestClient({
    baseUrl: runtime.baseUrl,
    credentials: runtime.credentials,
    fetchImpl: input.deps?.fetchImpl,
  });
}

async function loadRawCatalogRows(input: {
  supabase: SupabaseClient;
  organizationId: string;
  entityType: string;
}) {
  const { data, error } = await input.supabase
    .from(integrationTables.rawRecords)
    .select("payload_json")
    .eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware")
    .eq("entity_type", input.entityType)
    .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as Array<{ payload_json?: unknown }> | null) ?? [])
    .map((entry) => asRecord(asRecord(entry.payload_json).row))
    .filter((row) => Object.keys(row).length > 0);
}

async function loadCatalogs(input: {
  supabase: SupabaseClient;
  organizationId: string;
  connection: ZetaConnectionRow;
}): Promise<ZetaPurchaseExpenseCatalogs> {
  const [
    suppliers,
    supplierCommercialData,
    documentTypes,
    concepts,
    vatRates,
    paymentTerms,
    paymentMethods,
    currencies,
    businessLocations,
    cashboxes,
  ] = await Promise.all([
    loadRawCatalogRows({ ...input, entityType: "contact" }),
    loadRawCatalogRows({ ...input, entityType: "supplier_commercial_data" }),
    loadRawCatalogRows({ ...input, entityType: "document_type" }),
    loadRawCatalogRows({ ...input, entityType: "concept" }),
    loadRawCatalogRows({ ...input, entityType: "vat_rate" }),
    loadRawCatalogRows({ ...input, entityType: "payment_term" }),
    loadRawCatalogRows({ ...input, entityType: "payment_method" }),
    loadRawCatalogRows({ ...input, entityType: "currency" }),
    loadRawCatalogRows({ ...input, entityType: "business_location" }),
    loadRawCatalogRows({ ...input, entityType: "cashbox" }),
  ]);
  const config = asRecord(input.connection.config_json);

  return {
    suppliers,
    supplierCommercialData,
    documentTypes,
    concepts,
    vatRates,
    paymentTerms,
    paymentMethods,
    currencies,
    businessLocations,
    cashboxes,
    config: normalizeZetaPurchaseExpenseConfig(
      config.purchase_expense_export ?? config.zeta_purchase_expense_export,
    ),
  };
}

async function loadDocumentRow(input: {
  supabase: SupabaseClient;
  organizationId: string;
  documentId: string;
}) {
  const { data, error } = await input.supabase
    .from("documents")
    .select("id, organization_id, document_date, current_draft_id, metadata")
    .eq("organization_id", input.organizationId)
    .eq("id", input.documentId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Documento no encontrado.");
  }

  return data as DocumentRow;
}

async function loadDraftRow(input: {
  supabase: SupabaseClient;
  document: DocumentRow;
}) {
  const baseQuery = input.supabase
    .from("document_drafts")
    .select("id, document_id, document_role, document_type, status, operation_context_json, intake_context_json, fields_json, journal_suggestion_json")
    .eq("document_id", input.document.id)
    .order("revision_number", { ascending: false })
    .limit(1);
  const query = input.document.current_draft_id
    ? baseQuery.eq("id", input.document.current_draft_id)
    : baseQuery;
  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "El documento aun no tiene draft persistido.");
  }

  return data as DraftRow;
}

async function isFiscalIdentityTrusted(input: {
  supabase: SupabaseClient;
  documentId: string;
  draftId: string;
}) {
  const [sourceRefs, steps] = await Promise.all([
    input.supabase
      .from(integrationTables.documentSourceRefs)
      .select("source_kind")
      .eq("document_id", input.documentId)
      .eq("provider", "zetasoftware"),
    input.supabase
      .from("document_draft_steps")
      .select("step_code, status")
      .eq("draft_id", input.draftId),
  ]);

  if (sourceRefs.error) {
    throw new Error(sourceRefs.error.message);
  }

  if (steps.error) {
    throw new Error(steps.error.message);
  }

  const hasCfeSource = ((sourceRefs.data as Array<{ source_kind?: string }> | null) ?? [])
    .some((row) => row.source_kind === "zeta_received_cfe");
  const identityConfirmed = ((steps.data as Array<{ step_code?: string; status?: string }> | null) ?? [])
    .some((row) => (row.step_code === "identity" || row.step_code === "fields") && row.status === "confirmed");

  return hasCfeSource || identityConfirmed;
}

async function buildDocumentInput(input: {
  supabase: SupabaseClient;
  organizationId: string;
  documentId: string;
}): Promise<ZetaPurchaseExpenseDocumentInput> {
  const document = await loadDocumentRow(input);
  const draft = await loadDraftRow({
    supabase: input.supabase,
    document,
  });
  const facts = parseDraftFacts(draft.fields_json);
  const lineItems = parseLineItems(draft.fields_json);
  const amountBreakdown = parseAmountBreakdown(draft.fields_json);
  const operationCategory = getOperationCategoryValue(draft, facts);
  const accountingContext = await loadDocumentAccountingContext(input.supabase, draft.id);
  const structuredContext = asRecord(accountingContext?.structured_context_json);
  const journalSuggestion = asRecord(draft.journal_suggestion_json);
  const paymentTerms =
    normalizePaymentTerms(structuredContext.payment_terms)
    ?? "unknown";
  const settlementMethod =
    normalizeSettlementMethod(structuredContext.settlement_method)
    ?? "unknown";
  const fiscalIdentityTrusted = await isFiscalIdentityTrusted({
    supabase: input.supabase,
    documentId: document.id,
    draftId: draft.id,
  });
  const lines = lineItems.length > 0
    ? lineItems.map((line) => ({
      lineNumber: line.line_number,
      conceptCode: line.concept_code,
      conceptDescription: line.concept_description,
      netAmount: line.net_amount,
      taxRate: line.tax_rate,
      taxAmount: line.tax_amount,
      totalAmount: line.total_amount,
    }))
    : amountBreakdown.map((line, index) => ({
      lineNumber: index + 1,
      conceptDescription: line.label,
      netAmount: line.amount,
      taxRate: line.tax_rate,
      taxAmount: line.tax_rate && line.amount
        ? roundCurrency((line.amount * line.tax_rate) / 100)
        : null,
      totalAmount: line.amount && line.tax_rate
        ? roundCurrency(line.amount + (line.amount * line.tax_rate) / 100)
        : line.amount,
    }));

  return {
    organizationId: input.organizationId,
    documentId: input.documentId,
    documentRole: draft.document_role,
    documentType: draft.document_type,
    postingTemplateCode: asString(journalSuggestion.templateCode),
    operationCategory,
    paymentTerms,
    settlementMethod,
    supplierRut: facts.issuer_tax_id,
    supplierName: facts.issuer_name,
    series: facts.series,
    number: facts.document_number,
    fiscalIdentityTrusted,
    issueDate: facts.document_date ?? document.document_date,
    currencyCode: facts.currency_code,
    exchangeRate: typeof journalSuggestion.fxRate === "number" ? journalSuggestion.fxRate : null,
    netAmount: facts.subtotal,
    taxAmount: facts.tax_amount,
    totalAmount: facts.total_amount,
    sourceReference: `Convertilabs document ${input.documentId}`,
    cfeTypeCode: asString(asRecord(draft.intake_context_json).cfe_type_code),
    lines,
  };
}

async function loadPreviousExportRecord(input: {
  supabase: SupabaseClient;
  organizationId: string;
  documentId: string;
}) {
  const { data, error } = await input.supabase
    .from(integrationTables.rawRecords)
    .select("id, payload_json, metadata_json")
    .eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware")
    .eq("entity_type", exportEntityType)
    .eq("external_key", `purchase_expense_invoice:${input.documentId}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as (JsonRecord & { id: string }) | null;
}

async function persistExportAttempt(input: {
  supabase: SupabaseClient;
  organizationId: string;
  connectionId: string;
  documentId: string;
  testMode: boolean;
  result: ZetaPurchaseInvoiceExportResult;
  actorProfileId: string;
  status: string;
  response?: unknown;
  deps?: ExportDependencies;
}) {
  const payload = {
    document_id: input.documentId,
    status: input.status,
    dry_run: input.result.dryRun,
    fiscal_fingerprint: input.result.fiscalFingerprint,
    request: input.result.payload,
    response: input.response ?? input.result.zetaResponse ?? null,
    blockers: input.result.blockers,
    warnings: input.result.warnings,
    preview: input.result.preview,
    recorded_at: nowIso(input.deps),
  };

  return upsertIntegrationRawRecord(input.supabase, {
    organizationId: input.organizationId,
    connectionId: input.connectionId,
    provider: "zetasoftware",
    stream: exportStream,
    entityType: exportEntityType,
    externalKey: `purchase_expense_invoice:${input.documentId}`,
    externalVersionKey: input.result.fiscalFingerprint,
    payload,
    payloadHash: fingerprintIntegrationPayload(payload),
    testMode: input.testMode,
    documentDate: input.result.preview.fecha,
    currencyCode: null,
    sourceTotalAmount: input.result.preview.lines.reduce((sum, line) => sum + line.totalAmount, 0),
    sourceNetAmount: input.result.preview.lines.reduce((sum, line) => sum + line.netAmount, 0),
    sourceTaxAmount: input.result.preview.lines.reduce((sum, line) => sum + line.ivaAmount, 0),
    sourceMonetary: {
      lines: input.result.preview.lines,
    },
    metadata: {
      status: input.status,
      actor_profile_id: input.actorProfileId,
      fiscal_fingerprint: input.result.fiscalFingerprint,
    },
  });
}

function withResult(
  resolution: ZetaPurchaseInvoiceExportResolution,
  patch: Partial<ZetaPurchaseInvoiceExportResult>,
): ZetaPurchaseInvoiceExportResult {
  return {
    ...resolution,
    dryRun: false,
    ...patch,
  };
}

function blocker(code: string, message: string): ZetaPurchaseExportBlocker {
  return {
    code,
    message,
  };
}

export async function exportPurchaseExpenseInvoiceToZeta(params: {
  organizationId: string;
  documentId: string;
  actorProfileId: string;
  dryRun?: boolean;
  forceResend?: boolean;
}, deps: ExportDependencies = {}): Promise<ZetaPurchaseInvoiceExportResult> {
  const supabase = deps.supabase ?? getSupabaseServiceRoleClient();
  const connection = await loadConnection(supabase, params.organizationId);
  const [document, catalogs] = await Promise.all([
    buildDocumentInput({
      supabase,
      organizationId: params.organizationId,
      documentId: params.documentId,
    }),
    loadCatalogs({
      supabase,
      organizationId: params.organizationId,
      connection,
    }),
  ]);
  const resolution = resolveZetaPurchaseExpenseInvoicePayload({
    document,
    catalogs,
  });

  if (params.dryRun) {
    return {
      ...resolution,
      dryRun: true,
      duplicate: null,
      attemptRawRecordId: null,
    };
  }

  const previous = await loadPreviousExportRecord({
    supabase,
    organizationId: params.organizationId,
    documentId: params.documentId,
  });
  const previousStatus = asString(asRecord(previous?.metadata_json).status);

  if (
    previousStatus
    && ["success_pending_reconciliation", "found_in_zeta", "already_exists_in_zeta"].includes(previousStatus)
    && !params.forceResend
  ) {
    return withResult(resolution, {
      status: "already_exists_in_zeta",
      exportable: false,
      mode: "blocked",
      blockers: [
        ...resolution.blockers,
        blocker("zeta_export_already_successful", "Este documento ya tiene un envio exitoso o una coincidencia fuerte en Zeta."),
      ],
      dryRun: false,
      attemptRawRecordId: previous?.id ?? null,
    });
  }

  if (previousStatus === "timeout_unknown" && !params.forceResend) {
    return withResult(resolution, {
      status: "timeout_unknown",
      exportable: false,
      mode: "blocked",
      blockers: [
        ...resolution.blockers,
        blocker("zeta_timeout_requires_reconciliation", "El ultimo intento quedo en timeout_unknown. Reconciliacion manual requerida antes de reintentar."),
      ],
      dryRun: false,
      attemptRawRecordId: previous?.id ?? null,
    });
  }

  if (!resolution.payload || resolution.blockers.length > 0) {
    const result = withResult(resolution, {
      status: "blocked",
      exportable: false,
      mode: "blocked",
    });
    const raw = await persistExportAttempt({
      supabase,
      organizationId: params.organizationId,
      connectionId: connection.id,
      documentId: params.documentId,
      testMode: connection.test_mode,
      result,
      actorProfileId: params.actorProfileId,
      status: "blocked",
      deps,
    });

    return {
      ...result,
      attemptRawRecordId: String(raw.id),
    };
  }

  const client = await buildClient({
    supabase,
    organizationId: params.organizationId,
    deps,
  });
  const movimiento = resolution.payload.Data.Movimiento[0];
  const expectedTotal = document.totalAmount;
  const duplicate = await preflightZetaPurchaseInvoiceDuplicate({
    client,
    movimiento,
    expectedTotal,
  });

  if (duplicate.found) {
    const result = withResult(resolution, {
      status: "already_exists_in_zeta",
      exportable: false,
      mode: "blocked",
      duplicate: {
        found: true,
        registroId: duplicate.registroId,
        raw: duplicate.raw,
      },
    });
    const raw = await persistExportAttempt({
      supabase,
      organizationId: params.organizationId,
      connectionId: connection.id,
      documentId: params.documentId,
      testMode: connection.test_mode,
      result,
      actorProfileId: params.actorProfileId,
      status: "already_exists_in_zeta",
      response: duplicate.raw,
      deps,
    });

    await recordIntegrationAuditEvent(supabase, {
      organizationId: params.organizationId,
      actorUserId: params.actorProfileId,
      entityType: "document",
      entityId: params.documentId,
      action: "zeta_purchase_expense_already_exists",
      afterJson: {
        registro_id: duplicate.registroId,
      },
    });

    return {
      ...result,
      attemptRawRecordId: String(raw.id),
    };
  }

  await recordIntegrationAuditEvent(supabase, {
    organizationId: params.organizationId,
    actorUserId: params.actorProfileId,
    entityType: "document",
    entityId: params.documentId,
    action: "zeta_purchase_expense_export_started",
    metadata: {
      fiscal_fingerprint: resolution.fiscalFingerprint,
      force_resend: params.forceResend === true,
    },
  });

  try {
    const response = await callZetaEndpoint(
      client,
      "facturaProveedorAgregar",
      resolution.payload as unknown as Record<string, never>,
    );
    const result = withResult(resolution, {
      status: "success_pending_reconciliation",
      zetaResponse: response,
      duplicate: {
        found: false,
        registroId: null,
        raw: duplicate.raw,
      },
    });
    const raw = await persistExportAttempt({
      supabase,
      organizationId: params.organizationId,
      connectionId: connection.id,
      documentId: params.documentId,
      testMode: connection.test_mode,
      result,
      actorProfileId: params.actorProfileId,
      status: "success_pending_reconciliation",
      response,
      deps,
    });

    await recordIntegrationAuditEvent(supabase, {
      organizationId: params.organizationId,
      actorUserId: params.actorProfileId,
      entityType: "document",
      entityId: params.documentId,
      action: "zeta_purchase_expense_export_completed",
      afterJson: {
        status: "success_pending_reconciliation",
        fiscal_fingerprint: resolution.fiscalFingerprint,
      },
    });

    return {
      ...result,
      attemptRawRecordId: String(raw.id),
    };
  } catch (error) {
    const status = error instanceof ZetaIntegrationError && error.code === "zeta_timeout"
      ? "timeout_unknown"
      : "zeta_error";
    const result = withResult(resolution, {
      status,
      exportable: false,
      zetaResponse: error instanceof Error
        ? {
          name: error.name,
          message: error.message,
          code: error instanceof ZetaIntegrationError ? error.code : "zeta_unexpected_error",
        }
        : {
          message: "Error inesperado al exportar a Zeta.",
        },
    });
    const raw = await persistExportAttempt({
      supabase,
      organizationId: params.organizationId,
      connectionId: connection.id,
      documentId: params.documentId,
      testMode: connection.test_mode,
      result,
      actorProfileId: params.actorProfileId,
      status,
      response: result.zetaResponse,
      deps,
    });

    await recordIntegrationAuditEvent(supabase, {
      organizationId: params.organizationId,
      actorUserId: params.actorProfileId,
      entityType: "document",
      entityId: params.documentId,
      action: status === "timeout_unknown"
        ? "zeta_purchase_expense_export_timeout_unknown"
        : "zeta_purchase_expense_export_failed",
      afterJson: asRecord(result.zetaResponse),
    });

    return {
      ...result,
      attemptRawRecordId: String(raw.id),
    };
  }
}

export async function resolveZetaPurchaseExpenseInvoiceForDocument(params: {
  organizationId: string;
  documentId: string;
  actorProfileId: string;
}, deps: ExportDependencies = {}) {
  return exportPurchaseExpenseInvoiceToZeta({
    ...params,
    dryRun: true,
  }, deps);
}

export function resolveZetaPurchaseExpenseInvoiceFromInputs(input: {
  document: ZetaPurchaseExpenseDocumentInput;
  catalogs: ZetaPurchaseExpenseCatalogs;
}) {
  return resolveZetaPurchaseExpenseInvoicePayload(input);
}
