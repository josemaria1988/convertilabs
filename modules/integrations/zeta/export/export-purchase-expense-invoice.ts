import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  getOperationCategoryValue,
  loadDocumentAccountingContext,
  parseAmountBreakdown,
  parseDraftFacts,
  parseLineItems,
  parseSourceTaxBreakdown,
  roundCurrency,
  type PaymentTerms,
  type SettlementMethod,
} from "@/modules/accounting";
import { buildZetaConnection } from "@/modules/integrations/zeta/client/auth";
import { createHumanExportZetaRequestPolicy } from "@/modules/integrations/zeta/client/read-policy";
import { reconcilePurchaseInvoiceAgainstCache } from "@/modules/integrations/zeta/export/purchase-cache-reconciliation";
import {
  normalizeZetaException,
  ZetaIntegrationError,
} from "@/modules/integrations/zeta/client/errors";
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
import { buildPurchaseExpenseFiscalIdentity, normalizeZetaPurchaseExpenseConfig, resolveZetaPurchaseExpenseInvoicePayload } from "@/modules/integrations/zeta/export/purchase-expense-resolver";
import { preflightZetaPurchaseInvoiceDuplicate } from "@/modules/integrations/zeta/export/duplicate-preflight";
import { reconcilePurchaseExpenseInvoiceExport } from "@/modules/integrations/zeta/reconcile/reconcile-purchase-expense-invoice";
import type {
  ZetaFacturaProveedorAgregarResponse,
  ZetaFacturaProveedorMovimiento,
} from "@/modules/integrations/zeta/contracts/factura-proveedor";
import type {
  ZetaPurchaseExpenseCatalogs,
  ZetaPurchaseExpenseDocumentInput,
  ZetaPurchaseExportBlocker,
  ZetaPurchaseExportWarning,
  ZetaPurchaseInvoiceExportPreview,
  ZetaPurchaseInvoiceExportResolution,
  ZetaPurchaseInvoiceExportResult,
  ZetaPurchaseFiscalIdentity,
} from "@/modules/integrations/zeta/export/types";

type JsonRecord = Record<string, unknown>;

type DocumentRow = {
  id: string;
  organization_id: string;
  created_at: string;
  document_date: string | null;
  current_draft_id: string | null;
  work_unit_id: string | null;
  metadata: JsonRecord | null;
};

type WorkUnitRow = {
  id: string;
  code: string | null;
  name: string | null;
  metadata_json: JsonRecord | null;
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
  mode: string;
  test_mode: boolean;
  config_json: JsonRecord | null;
};

type ExportDependencies = {
  supabase?: SupabaseClient;
  client?: ZetaRestClient;
  fetchImpl?: ZetaFetch;
  now?: () => Date;
};

type PreviousExportRecord = {
  id: string;
  payload_json: JsonRecord | null;
  metadata_json: JsonRecord | null;
  source_total_amount: number | string | null;
};

const exportEntityType = "purchase_expense_export_attempt";
const exportClaimEntityType = "purchase_expense_export_claim";
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

function buildPreferredExpenseLines(input: {
  facts: ReturnType<typeof parseDraftFacts>;
  sourceTaxBreakdown: ReturnType<typeof parseSourceTaxBreakdown>;
  lineItems: ReturnType<typeof parseLineItems>;
  amountBreakdown: ReturnType<typeof parseAmountBreakdown>;
}): ZetaPurchaseExpenseDocumentInput["lines"] {
  const sourceLines: ZetaPurchaseExpenseDocumentInput["lines"] =
    input.sourceTaxBreakdown.length > 0
      ? input.sourceTaxBreakdown.map((line, index) => ({
        lineNumber: index + 1,
        conceptDescription: line.label,
        netAmount: line.netAmount,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        totalAmount: line.totalAmount,
      }))
      : input.lineItems.length > 0
        ? input.lineItems.map((line) => ({
          lineNumber: line.line_number,
          conceptCode: line.concept_code,
          conceptDescription: line.concept_description,
          netAmount: line.net_amount,
          taxRate: line.tax_rate,
          taxAmount: line.tax_amount,
          totalAmount: line.total_amount,
        }))
        : input.amountBreakdown.map((line, index) => {
          const hasNet = typeof line.amount === "number";
          const hasRate = typeof line.tax_rate === "number";
          const taxAmount = hasNet && hasRate
            ? roundCurrency((line.amount as number) * (line.tax_rate as number) / 100)
            : null;

          return {
            lineNumber: index + 1,
            conceptDescription: line.label,
            netAmount: line.amount,
            taxRate: line.tax_rate,
            taxAmount,
            totalAmount: hasNet && taxAmount !== null
              ? roundCurrency((line.amount as number) + taxAmount)
              : line.amount,
          };
        });
  const distinctRates = Array.from(new Set(
    sourceLines
      .map((line) => line.taxRate)
      .filter((rate): rate is number => typeof rate === "number" && Number.isFinite(rate)),
  ));
  const hasConfirmedAggregates = [
    input.facts.subtotal,
    input.facts.tax_amount,
    input.facts.total_amount,
  ].every((value) => typeof value === "number" && Number.isFinite(value));

  if (sourceLines.length > 0 && distinctRates.length <= 1 && hasConfirmedAggregates) {
    const first = sourceLines[0];
    const aggregateRate = input.facts.subtotal !== 0
      ? roundCurrency(
        (input.facts.tax_amount as number) / (input.facts.subtotal as number) * 100,
      )
      : distinctRates[0] ?? 0;

    return [{
      lineNumber: 1,
      isAggregate: sourceLines.length > 1 || input.lineItems.length > 1,
      conceptCode: first.conceptCode,
      conceptDescription: first.conceptDescription ?? "Gasto",
      netAmount: input.facts.subtotal,
      taxRate: aggregateRate,
      taxAmount: input.facts.tax_amount,
      totalAmount: input.facts.total_amount,
    }];
  }

  return sourceLines;
}

async function loadConnection(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from(integrationTables.connections)
    .select("id, status, mode, test_mode, config_json")
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
    organizationId: input.organizationId,
    requestPolicy: createHumanExportZetaRequestPolicy(input.organizationId),
    baseUrl: runtime.baseUrl,
    credentials: runtime.credentials,
    fetchImpl: input.deps?.fetchImpl,
  });
}

async function loadRawCatalogRows(input: {
  supabase: SupabaseClient;
  organizationId: string;
  entityType: string;
  testMode: boolean;
}) {
  const pageSize = 1_000;
  const entries: Array<{ payload_json?: unknown }> = [];

  for (let offset = 0; offset < 10_000; offset += pageSize) {
    const { data, error } = await input.supabase
      .from(integrationTables.rawRecords)
      .select("payload_json")
      .eq("organization_id", input.organizationId)
      .eq("provider", "zetasoftware")
      .eq("entity_type", input.entityType)
      .eq("test_mode", input.testMode)
      .order("external_key", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const page = (data as Array<{ payload_json?: unknown }> | null) ?? [];
    entries.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return entries
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
    users,
    cashboxes,
  ] = await Promise.all([
    loadRawCatalogRows({ ...input, entityType: "contact", testMode: input.connection.test_mode }),
    loadRawCatalogRows({ ...input, entityType: "supplier_commercial_data", testMode: input.connection.test_mode }),
    loadRawCatalogRows({ ...input, entityType: "document_type", testMode: input.connection.test_mode }),
    loadRawCatalogRows({ ...input, entityType: "concept", testMode: input.connection.test_mode }),
    loadRawCatalogRows({ ...input, entityType: "vat_rate", testMode: input.connection.test_mode }),
    loadRawCatalogRows({ ...input, entityType: "payment_term", testMode: input.connection.test_mode }),
    loadRawCatalogRows({ ...input, entityType: "payment_method", testMode: input.connection.test_mode }),
    loadRawCatalogRows({ ...input, entityType: "currency", testMode: input.connection.test_mode }),
    loadRawCatalogRows({ ...input, entityType: "business_location", testMode: input.connection.test_mode }),
    loadRawCatalogRows({ ...input, entityType: "user_role", testMode: input.connection.test_mode }),
    loadRawCatalogRows({ ...input, entityType: "cashbox", testMode: input.connection.test_mode }),
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
    users,
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
    .select("id, organization_id, created_at, document_date, current_draft_id, work_unit_id, metadata")
    .eq("organization_id", input.organizationId)
    .eq("id", input.documentId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Documento no encontrado.");
  }

  return data as DocumentRow;
}

async function loadWorkUnitForDocument(input: {
  supabase: SupabaseClient;
  organizationId: string;
  workUnitId: string | null;
}) {
  if (!input.workUnitId) {
    return null;
  }

  const { data, error } = await input.supabase
    .from("work_units")
    .select("id, code, name, metadata_json")
    .eq("organization_id", input.organizationId)
    .eq("id", input.workUnitId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as WorkUnitRow | null;
}

function getZetaCostCenterCode(workUnit: WorkUnitRow | null) {
  const metadata = asRecord(workUnit?.metadata_json);

  return asString(metadata.zeta_cost_center_code)
    ?? asString(metadata.zeta_centro_costo_codigo)
    ?? asString(metadata.cost_center_external_code)
    ?? null;
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
  const workUnit = await loadWorkUnitForDocument({
    supabase: input.supabase,
    organizationId: input.organizationId,
    workUnitId: document.work_unit_id,
  });
  const draft = await loadDraftRow({
    supabase: input.supabase,
    document,
  });
  const facts = parseDraftFacts(draft.fields_json);
  const lineItems = parseLineItems(draft.fields_json);
  const amountBreakdown = parseAmountBreakdown(draft.fields_json);
  const sourceTaxBreakdown = parseSourceTaxBreakdown(draft.fields_json);
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
  const zetaConceptCodeOverride = asString(
    structuredContext.zeta_purchase_expense_concept_code,
  );
  const zetaPaymentTermCodeOverride = asString(
    structuredContext.zeta_purchase_expense_payment_term_code,
  );
  const fiscalIdentityTrusted = await isFiscalIdentityTrusted({
    supabase: input.supabase,
    documentId: document.id,
    draftId: draft.id,
  });
  const lines = buildPreferredExpenseLines({
    facts,
    sourceTaxBreakdown,
    lineItems,
    amountBreakdown,
  });

  return {
    organizationId: input.organizationId,
    documentId: input.documentId,
    createdAt: document.created_at,
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
    zetaConceptCodeOverride,
    zetaPaymentTermCodeOverride,
    workUnitId: workUnit?.id ?? null,
    workUnitCode: workUnit?.code ?? null,
    workUnitName: workUnit?.name ?? null,
    workUnitExternalCode: getZetaCostCenterCode(workUnit),
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
    .select("id, payload_json, metadata_json, source_total_amount")
    .eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware")
    .eq("entity_type", exportEntityType)
    .eq("external_key", `purchase_expense_invoice:${input.documentId}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as PreviousExportRecord | null;
}

function exportClaimExternalKey(identityKey: string) {
  return `purchase_expense_invoice:${identityKey}`;
}

function isUniqueConstraintViolation(error: unknown) {
  const row = asRecord(error);
  const code = asString(row.code);
  const message = asString(row.message)?.toLowerCase() ?? "";

  return code === "23505"
    || message.includes("duplicate key")
    || message.includes("unique constraint");
}

async function loadExportClaimId(input: {
  supabase: SupabaseClient;
  organizationId: string;
  fiscalIdentity: ZetaPurchaseFiscalIdentity;
}) {
  const { data, error } = await input.supabase
    .from(integrationTables.rawRecords)
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware")
    .eq("entity_type", exportClaimEntityType)
    .eq("external_key", exportClaimExternalKey(input.fiscalIdentity.key))
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ? String(data.id) : null;
}

async function loadDocumentExportClaimId(input: {
  supabase: SupabaseClient;
  organizationId: string;
  documentId: string;
}) {
  // A persisted claim survives even if saving the attempt failed. Correcting
  // the fiscal series/number of that source must never make it retryable.
  for (const field of ["payload_json->>document_id", "metadata_json->>document_id"]) {
    const { data, error } = await input.supabase.from(integrationTables.rawRecords)
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("provider", "zetasoftware")
      .eq("entity_type", exportClaimEntityType)
      .eq(field, input.documentId)
      .limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return String(data.id);
  }
  return null;
}

async function acquireExportClaim(input: {
  supabase: SupabaseClient;
  organizationId: string;
  connectionId: string;
  documentId: string;
  fiscalFingerprint: string;
  fiscalIdentity: ZetaPurchaseFiscalIdentity;
  actorProfileId: string;
  testMode: boolean;
  deps?: ExportDependencies;
}) {
  const claimedAt = nowIso(input.deps);
  const payload = {
    document_id: input.documentId,
    fiscal_fingerprint: input.fiscalFingerprint,
    fiscal_identity: input.fiscalIdentity,
    status: "reserved_before_add",
    claimed_at: claimedAt,
    actor_profile_id: input.actorProfileId,
  };
  const { error } = await input.supabase
    .from(integrationTables.rawRecords)
    .insert({
      organization_id: input.organizationId,
      connection_id: input.connectionId,
      provider: "zetasoftware",
      stream: exportStream,
      entity_type: exportClaimEntityType,
      external_key: exportClaimExternalKey(input.fiscalIdentity.key),
      external_version_key: input.fiscalFingerprint,
      payload_json: payload,
      payload_hash: fingerprintIntegrationPayload(payload),
      last_seen_at: claimedAt,
      test_mode: input.testMode,
      metadata_json: {
        status: "reserved_before_add",
        document_id: input.documentId,
        actor_profile_id: input.actorProfileId,
        fiscal_fingerprint: input.fiscalFingerprint,
        fiscal_identity: input.fiscalIdentity,
      },
      updated_at: claimedAt,
    });

  if (!error) {
    return {
      acquired: true,
      claimRawRecordId: null,
    } as const;
  }

  if (!isUniqueConstraintViolation(error)) {
    throw new Error(error.message ?? "No se pudo reservar el envio unico a Zetasoftware.");
  }

  return {
    acquired: false,
    claimRawRecordId: await loadExportClaimId(input),
  } as const;
}

async function findLegacyExportClaimBlocker(input: {
  supabase: SupabaseClient;
  organizationId: string;
  documentId: string;
  fiscalFingerprint: string;
  fiscalIdentity: ZetaPurchaseFiscalIdentity;
  catalogs: ZetaPurchaseExpenseCatalogs;
}) {
  const unresolved = (id: string | null) => ({ id, blocker: blocker(
    "zeta_export_legacy_claim_unresolved",
    "Hay una reserva de envio anterior cuya identidad no se pudo verificar. Revisa ese intento antes de enviar; no se libera ni se ignora automaticamente.",
  ) });
  const duplicate = (id: string) => ({ id, blocker: blocker(
    "zeta_export_claim_already_exists",
    "Este comprobante tiene una reserva de envio anterior. Primero hay que conciliar o revisar ese intento; cambiar fecha, moneda o importe no habilita reenviarlo.",
  ) });
  // Legacy claims contain only a content fingerprint and document id. Their
  // identity must be recovered from a matching stored attempt or an unchanged
  // source document. Never release claims or trust a changed draft on its own.
  // Drain old-version exporters before deploying: their keys cannot serialize
  // concurrent writes with the new immutable-identity keys.
  const pageSize = 500;
  for (let page = 0; page < 100; page += 1) {
    const { data, error } = await input.supabase.from(integrationTables.rawRecords)
      .select("id, external_key, payload_json, metadata_json")
      .eq("organization_id", input.organizationId)
      .eq("provider", "zetasoftware")
      .eq("entity_type", exportClaimEntityType)
      .like("external_key", "purchase_expense_invoice:sha256:%")
      .order("id", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) return unresolved(null);
    for (const row of data) {
      const id = String(row.id);
      const payload = asRecord(row.payload_json), metadata = asRecord(row.metadata_json);
      const fingerprint = asString(payload.fiscal_fingerprint) ?? asString(metadata.fiscal_fingerprint);
      const documentId = asString(payload.document_id) ?? asString(metadata.document_id);
      if (!fingerprint || row.external_key !== exportClaimExternalKey(fingerprint) || !documentId) return unresolved(id);
      if (fingerprint === input.fiscalFingerprint || documentId === input.documentId) return duplicate(id);
      const previous = await loadPreviousExportRecord({ ...input, documentId });
      const previousPayload = asRecord(previous?.payload_json);
      const previousFingerprint = asString(previousPayload.fiscal_fingerprint)
        ?? asString(asRecord(previous?.metadata_json).fiscal_fingerprint);
      let identity: ZetaPurchaseFiscalIdentity | null = null;
      if (previousFingerprint === fingerprint) {
        const movement = parseStoredRequest(previousPayload.request)?.Data.Movimiento[0];
        if (movement) identity = buildPurchaseExpenseFiscalIdentity({
          supplierCode: movement.CodigoProveedor, series: movement.Serie, number: movement.Numero,
        });
      }
      if (!identity) {
        try {
          const document = await buildDocumentInput({ ...input, documentId });
          const resolved = resolveZetaPurchaseExpenseInvoicePayload({ document, catalogs: input.catalogs });
          if (resolved.fiscalFingerprint === fingerprint) identity = resolved.fiscalIdentity;
        } catch {
          // Missing/deleted source or read error cannot establish non-duplication.
          return unresolved(id);
        }
      }
      if (!identity) return unresolved(id);
      if (identity.key === input.fiscalIdentity.key) return duplicate(id);
    }
    if (data.length < pageSize) return null;
  }
  return unresolved(null);
}

function parseStoredMessages<T extends ZetaPurchaseExportBlocker | ZetaPurchaseExportWarning>(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [] as T[];
  }

  return value.flatMap((entry) => {
    const row = asRecord(entry);
    const code = asString(row.code);
    const message = asString(row.message);

    if (!code || !message) {
      return [];
    }

    return [{
      code,
      message,
      ...(asString(row.field) ? { field: asString(row.field) as string } : {}),
    } as T];
  });
}

function parseStoredRequest(value: unknown): ZetaPurchaseInvoiceExportResolution["payload"] {
  const request = asRecord(value);
  const data = asRecord(request.Data);
  const movimientos = Array.isArray(data.Movimiento) ? data.Movimiento : [];
  const movimiento = asRecord(movimientos[0]);

  if (
    typeof movimiento.CodigoProveedor !== "string"
    || !movimiento.CodigoProveedor.trim()
    || typeof movimiento.Fecha !== "string"
    || !movimiento.Fecha.trim()
    || typeof movimiento.CodigoComprobante !== "number"
    || typeof movimiento.CodigoMoneda !== "number"
    || !Array.isArray(movimiento.Lineas)
  ) {
    return null;
  }

  return request as ZetaPurchaseInvoiceExportResolution["payload"];
}

function buildFallbackStoredPreview(
  movimiento: ZetaFacturaProveedorMovimiento | null,
): ZetaPurchaseInvoiceExportPreview {
  return {
    supplierName: null,
    supplierRut: null,
    zetaSupplierCode: movimiento?.CodigoProveedor ?? null,
    comprobanteCode: movimiento?.CodigoComprobante ?? null,
    comprobanteName: null,
    fecha: movimiento?.Fecha ?? null,
    serie: movimiento?.Serie ?? null,
    numero: movimiento?.Numero ?? null,
    monedaCode: movimiento?.CodigoMoneda ?? null,
    cotizacion: movimiento?.Cotizacion ?? null,
    conditionCode: movimiento?.CodigoCondicionPago ?? null,
    paymentMethodCode: movimiento?.FormasPago?.[0]?.CodigoFormaPago ?? null,
    purchaseKind: "expense",
    lines: [],
  };
}

function parseStoredPreview(
  value: unknown,
  movimiento: ZetaFacturaProveedorMovimiento | null,
) {
  const preview = asRecord(value);

  return Object.keys(preview).length > 0
    ? preview as ZetaPurchaseInvoiceExportPreview
    : buildFallbackStoredPreview(movimiento);
}

function parseStoredTotal(previous: PreviousExportRecord, preview: ZetaPurchaseInvoiceExportPreview) {
  const storedTotal = typeof previous.source_total_amount === "number"
    ? previous.source_total_amount
    : typeof previous.source_total_amount === "string"
      ? Number.parseFloat(previous.source_total_amount)
      : Number.NaN;

  if (Number.isFinite(storedTotal)) {
    return storedTotal;
  }

  const lineTotal = preview.lines.reduce((sum, line) => sum + line.totalAmount, 0);

  return Number.isFinite(lineTotal) && preview.lines.length > 0 ? lineTotal : null;
}

function buildPreviousExportResult(input: {
  previous: PreviousExportRecord;
  documentId: string;
  status: ZetaPurchaseInvoiceExportResult["status"];
  dryRun: boolean;
}) {
  const payload = asRecord(input.previous.payload_json);
  const request = parseStoredRequest(payload.request);
  const movimiento = request?.Data.Movimiento[0] ?? null;
  const preview = parseStoredPreview(payload.preview, movimiento);

  return {
    documentId: input.documentId,
    exportable: false,
    mode: "blocked",
    status: input.status,
    blockers: parseStoredMessages<ZetaPurchaseExportBlocker>(payload.blockers),
    warnings: parseStoredMessages<ZetaPurchaseExportWarning>(payload.warnings),
    payload: request,
    preview,
    fiscalFingerprint:
      asString(payload.fiscal_fingerprint)
      ?? asString(asRecord(input.previous.metadata_json).fiscal_fingerprint),
    fiscalIdentity: movimiento ? buildPurchaseExpenseFiscalIdentity({
      supplierCode: movimiento.CodigoProveedor, series: movimiento.Serie, number: movimiento.Numero,
    }) : null,
    dryRun: input.dryRun,
    zetaResponse: payload.response ?? null,
    duplicate: null,
    attemptRawRecordId: input.previous.id,
  } satisfies ZetaPurchaseInvoiceExportResult;
}

function storedAgregarResponse(previousPayload: JsonRecord) {
  const response = previousPayload.response;
  const responseRecord = asRecord(response);

  return Object.prototype.hasOwnProperty.call(responseRecord, "agregar")
    ? responseRecord.agregar
    : response ?? null;
}

async function persistPreviousReconciliation(input: {
  supabase: SupabaseClient;
  previous: PreviousExportRecord;
  actorProfileId: string;
  result: ZetaPurchaseInvoiceExportResult;
  deps?: ExportDependencies;
}) {
  const reconciledAt = nowIso(input.deps);
  const previousPayload = asRecord(input.previous.payload_json);
  const previousMetadata = asRecord(input.previous.metadata_json);
  const { error } = await input.supabase
    .from(integrationTables.rawRecords)
    .update({
      payload_json: {
        ...previousPayload,
        status: input.result.status,
        response: input.result.zetaResponse ?? previousPayload.response ?? null,
        blockers: input.result.blockers,
        warnings: input.result.warnings,
        recorded_at: reconciledAt,
      },
      metadata_json: {
        ...previousMetadata,
        status: input.result.status,
        actor_profile_id: input.actorProfileId,
        reconciliation_status: input.result.status,
        reconciliation_registro_id: input.result.duplicate?.registroId ?? null,
        reconciled_at: reconciledAt,
      },
      updated_at: reconciledAt,
    })
    .eq("id", input.previous.id);

  if (error) {
    throw new Error(error.message);
  }
}

async function reconcilePreviousPendingExport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  documentId: string;
  actorProfileId: string;
  dryRun: boolean;
  previous: PreviousExportRecord;
  deps: ExportDependencies;
}) {
  const previousPayload = asRecord(input.previous.payload_json);
  const baseResult = buildPreviousExportResult({
    previous: input.previous,
    documentId: input.documentId,
    status: "success_pending_reconciliation",
    dryRun: input.dryRun,
  });
  const movimiento = baseResult.payload?.Data.Movimiento[0] ?? null;
  const baseWarnings = baseResult.warnings.filter(
    (entry) => !entry.code.startsWith("zeta_purchase_reconciliation_"),
  );
  const baseBlockers = baseResult.blockers.filter(
    (entry) => entry.code !== "zeta_purchase_reconciliation_pending_no_resend",
  );
  let reconciliation: Awaited<ReturnType<typeof reconcilePurchaseExpenseInvoiceExport>> | null = null;
  let reconciliationError: ReturnType<typeof normalizeZetaException> | null = null;

  if (!movimiento) {
    reconciliationError = normalizeZetaException(new Error(
      "El intento pendiente no conserva el payload original necesario para consultar QueryCompras.",
    ));
  } else {
    try {
      const client = await buildClient({
        supabase: input.supabase,
        organizationId: input.organizationId,
        deps: input.deps,
      });
      reconciliation = await reconcilePurchaseExpenseInvoiceExport({
        client,
        movimiento,
        expectedTotal: parseStoredTotal(input.previous, baseResult.preview),
      });
    } catch (error) {
      reconciliationError = normalizeZetaException(error);
    }
  }

  const foundInZeta = reconciliation?.status === "found_in_zeta";
  const status = foundInZeta
    ? "found_in_zeta"
    : "success_pending_reconciliation";
  const reconciliationWarnings: ZetaPurchaseExportWarning[] = reconciliationError
    ? [{
      code: "zeta_purchase_reconciliation_failed",
      message: `No se pudo completar QueryCompras; el envio sigue pendiente y no se reenvio: ${reconciliationError.message}`,
    }]
    : reconciliation?.warnings.map((message) => ({
      code: foundInZeta
        ? "zeta_purchase_reconciliation_found"
        : "zeta_purchase_reconciliation_pending",
      message,
    })) ?? [];
  const zetaResponse = {
    agregar: storedAgregarResponse(previousPayload),
    reconciliation: reconciliation
      ? {
        status: reconciliation.status,
        registroId: reconciliation.registroId,
        queryCompras: reconciliation.queryComprasRaw,
        asientoLista: reconciliation.asientoListaRaw ?? null,
      }
      : {
        status: "query_failed",
        error: reconciliationError,
      },
  };
  const result = {
    ...baseResult,
    status,
    exportable: false,
    mode: "blocked",
    blockers: foundInZeta
      ? baseBlockers
      : [
        ...baseBlockers,
        blocker(
          "zeta_purchase_reconciliation_pending_no_resend",
          "La factura ya fue aceptada para envio. Solo se consulta QueryCompras; no se vuelve a enviar.",
        ),
      ],
    warnings: [
      ...baseWarnings,
      ...reconciliationWarnings,
    ],
    zetaResponse,
    duplicate: {
      found: foundInZeta,
      registroId: reconciliation?.registroId ?? null,
      raw: reconciliation?.queryComprasRaw ?? null,
    },
  } satisfies ZetaPurchaseInvoiceExportResult;

  await persistPreviousReconciliation({
    supabase: input.supabase,
    previous: input.previous,
    actorProfileId: input.actorProfileId,
    result,
    deps: input.deps,
  });

  if (foundInZeta) {
    await recordIntegrationAuditEvent(input.supabase, {
      organizationId: input.organizationId,
      actorUserId: input.actorProfileId,
      entityType: "document",
      entityId: input.documentId,
      action: "zeta_purchase_expense_reconciliation_found",
      afterJson: {
        status,
        registro_id: reconciliation?.registroId ?? null,
        fiscal_fingerprint: result.fiscalFingerprint,
      },
    });
  }

  return result;
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
    fiscal_identity: input.result.fiscalIdentity,
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
      fiscal_identity: input.result.fiscalIdentity,
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

function isTrueLike(value: unknown) {
  return value === true
    || (typeof value === "string" && value.trim().toLowerCase() === "true");
}

function isFalseLike(value: unknown) {
  return value === false
    || (typeof value === "string" && value.trim().toLowerCase() === "false");
}

function assertFacturaProveedorAccepted(output: {
  Response?: ZetaFacturaProveedorAgregarResponse;
}) {
  const response = output.Response;

  if (response && isTrueLike(response.Succeed)) {
    return response;
  }

  const message = asString(response?.Mensaje);

  if (response && isFalseLike(response.Succeed)) {
    throw new ZetaIntegrationError({
      code: "zeta_factura_proveedor_rejected",
      endpointName: "RESTFacturaProveedorV1Agregar",
      message: message ?? "Zetasoftware rechazo la factura proveedor sin informar el motivo.",
    });
  }

  throw new ZetaIntegrationError({
    code: "zeta_factura_proveedor_response_invalid",
    endpointName: "RESTFacturaProveedorV1Agregar",
    message: message
      ?? "Zetasoftware no confirmo Response.Succeed=true para la factura proveedor.",
  });
}

function hasUnknownWriteOutcome(error: unknown) {
  if (!(error instanceof ZetaIntegrationError)) {
    return false;
  }

  return [
    "zeta_timeout",
    "zeta_network_error",
    "zeta_http_error",
    "zeta_invalid_json",
    "zeta_output_wrapper_missing",
    "zeta_factura_proveedor_response_invalid",
  ].includes(error.code);
}

export async function exportPurchaseExpenseInvoiceToZeta(params: {
  organizationId: string;
  documentId: string;
  actorProfileId: string;
  dryRun?: boolean;
  humanConfirmed?: boolean;
  forceResend?: boolean;
}, deps: ExportDependencies = {}): Promise<ZetaPurchaseInvoiceExportResult> {
  const supabase = deps.supabase ?? getSupabaseServiceRoleClient();
  const connection = await loadConnection(supabase, params.organizationId);
  const previous = await loadPreviousExportRecord({
    supabase,
    organizationId: params.organizationId,
    documentId: params.documentId,
  });
  const previousStatus = asString(asRecord(previous?.metadata_json).status);

  if (previous && (previousStatus === "success_pending_reconciliation" || previousStatus === "sent")) {
    if (params.dryRun || params.humanConfirmed !== true) {
      let stored = buildPreviousExportResult({
        previous, documentId: params.documentId,
        status: "success_pending_reconciliation", dryRun: params.dryRun === true,
      });
      const movimiento = stored.payload?.Data.Movimiento[0];
      if (movimiento) {
        const document = await loadDocumentRow({ supabase, organizationId: params.organizationId, documentId: params.documentId });
        const cacheReconciliation = await reconcilePurchaseInvoiceAgainstCache({
          supabase, organizationId: params.organizationId, documentCreatedAt: document.created_at,
          movimiento, expectedTotal: parseStoredTotal(previous, stored.preview), now: deps.now?.() ?? new Date(),
        });
        stored = { ...stored, preview: { ...stored.preview, cacheReconciliation } };
        if (cacheReconciliation.status === "already_in_erp") {
          return {
            ...stored, status: "found_in_zeta",
            blockers: stored.blockers.filter((entry) => entry.code !== "zeta_purchase_reconciliation_pending_no_resend"),
            duplicate: { found: true, registroId: cacheReconciliation.matches[0]?.registroId ?? null, raw: null },
          };
        }
      }
      return {
        ...stored,
        blockers: [...stored.blockers.filter((entry) => entry.code !== "zeta_purchase_reconciliation_pending_no_resend"), blocker(
          "zeta_purchase_reconciliation_pending_no_resend",
          "Esta factura ya fue aceptada para envio. La validacion no consulta Zeta ni permite reenviarla; queda pendiente de reconciliacion.",
        )],
      };
    }
    return reconcilePreviousPendingExport({
      supabase,
      organizationId: params.organizationId,
      documentId: params.documentId,
      actorProfileId: params.actorProfileId,
      dryRun: false,
      previous,
      deps,
    });
  }

  if (previous && previousStatus === "timeout_unknown") {
    const stored = buildPreviousExportResult({ previous, documentId: params.documentId,
      status: "timeout_unknown", dryRun: params.dryRun === true });
    return { ...stored, blockers: [...stored.blockers, blocker(
      "zeta_timeout_requires_reconciliation",
      "El ultimo envio no tiene un resultado confirmado. La ausencia en la copia mensual no autoriza reenviarlo; requiere reconciliacion.",
    )] };
  }

  if (previous && (previousStatus === "found_in_zeta" || previousStatus === "already_exists_in_zeta")) {
    const previousResult = buildPreviousExportResult({
      previous,
      documentId: params.documentId,
      status: previousStatus,
      dryRun: params.dryRun === true,
    });

    return {
      ...previousResult,
      exportable: false,
      mode: "blocked",
      blockers: [
        ...previousResult.blockers,
        blocker(
          "zeta_export_already_successful",
          "Este documento ya tiene una coincidencia fuerte confirmada en Zeta.",
        ),
      ],
    };
  }

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
  let resolution = resolveZetaPurchaseExpenseInvoicePayload({
    document,
    catalogs,
  });

  const candidate = resolution.payload?.Data.Movimiento[0];
  if (candidate) {
    const cacheReconciliation = await reconcilePurchaseInvoiceAgainstCache({
      supabase, organizationId: params.organizationId,
      documentCreatedAt: document.createdAt ?? "",
      movimiento: candidate, expectedTotal: document.totalAmount ?? null,
      now: deps.now?.() ?? new Date(),
    });
    resolution = { ...resolution, preview: { ...resolution.preview, cacheReconciliation } };
    if (!cacheReconciliation.eligibleForHumanExport) {
      resolution = {
        ...resolution, exportable: false, mode: "blocked",
        status: cacheReconciliation.status === "waiting_for_sync" ? "waiting_for_sync"
          : cacheReconciliation.status === "already_in_erp" ? "already_exists_in_zeta" : "blocked",
        blockers: [...resolution.blockers, blocker(`zeta_purchase_cache_${cacheReconciliation.status}`, cacheReconciliation.message)],
      };
    }
  }

  if (params.dryRun) {
    return {
      ...resolution,
      dryRun: true,
      duplicate: null,
      attemptRawRecordId: null,
    };
  }

  if (resolution.preview.cacheReconciliation && !resolution.preview.cacheReconciliation.eligibleForHumanExport) {
    return withResult(resolution, { attemptRawRecordId: previous?.id ?? null });
  }

  if (params.humanConfirmed !== true) {
    return withResult(resolution, {
      status: "blocked",
      exportable: false,
      mode: "blocked",
      blockers: [
        ...resolution.blockers,
        blocker("zeta_human_confirmation_required", "Confirma el proveedor, comprobante e importe revisados antes de enviarlos a Zeta."),
      ],
      attemptRawRecordId: previous?.id ?? null,
    });
  }

  if (!document.zetaConceptCodeOverride) {
    const result = withResult(resolution, {
      status: "blocked",
      exportable: false,
      mode: "blocked",
      blockers: [
        ...resolution.blockers,
        blocker(
          "zeta_document_concept_confirmation_missing",
          "Selecciona y confirma el concepto Zeta de esta factura antes del envio real.",
        ),
      ],
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

  if (!document.zetaPaymentTermCodeOverride) {
    const result = withResult(resolution, {
      status: "blocked",
      exportable: false,
      mode: "blocked",
      blockers: [
        ...resolution.blockers,
        blocker(
          "zeta_document_payment_term_confirmation_missing",
          "Selecciona y confirma la condicion de pago Zeta de esta factura antes del envio real.",
        ),
      ],
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

  const connectionBlockers: ZetaPurchaseExportBlocker[] = [];

  if (connection.status !== "connected") {
    connectionBlockers.push(blocker(
      "zeta_connection_not_connected",
      "La conexion Zetasoftware no esta validada como conectada. Proba la conexion antes de escribir.",
    ));
  }

  if (connection.test_mode) {
    connectionBlockers.push(blocker(
      "zeta_test_mode_write_blocked",
      "La conexion Zetasoftware esta en modo de prueba; no se permiten escrituras reales.",
    ));
  }

  if (connection.mode !== "read_write") {
    connectionBlockers.push(blocker(
      "zeta_connection_write_not_enabled",
      "La conexion Zetasoftware no tiene la escritura habilitada explicitamente.",
    ));
  }

  if (connectionBlockers.length > 0) {
    const result = withResult(resolution, {
      status: "blocked",
      exportable: false,
      mode: "blocked",
      blockers: [
        ...resolution.blockers,
        ...connectionBlockers,
      ],
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

  const fiscalFingerprint = resolution.fiscalFingerprint;
  const fiscalIdentity = resolution.fiscalIdentity;

  if (!fiscalFingerprint || !fiscalIdentity) {
    const result = withResult(resolution, {
      status: "blocked",
      exportable: false,
      mode: "blocked",
      blockers: [
        ...resolution.blockers,
        blocker(
          "zeta_export_fingerprint_missing",
          "No se pudo construir la huella fiscal necesaria para reservar un envio unico.",
        ),
      ],
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

  const documentClaimId = await loadDocumentExportClaimId({
    supabase, organizationId: params.organizationId, documentId: params.documentId,
  });
  if (documentClaimId) return withResult(resolution, {
    status: "blocked", exportable: false, mode: "blocked",
    blockers: [...resolution.blockers, blocker("zeta_export_claim_already_exists",
      "Este documento ya fue reservado para envio. Una correccion de su identidad no habilita reenviarlo; primero hay que conciliar o revisar el intento existente.")],
    attemptRawRecordId: documentClaimId,
  });

  const legacyClaim = await findLegacyExportClaimBlocker({
    supabase, organizationId: params.organizationId, documentId: params.documentId,
    fiscalFingerprint, fiscalIdentity, catalogs,
  });
  if (legacyClaim) return withResult(resolution, {
    status: "blocked", exportable: false, mode: "blocked",
    blockers: [...resolution.blockers, legacyClaim.blocker], attemptRawRecordId: legacyClaim.id,
  });

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

  if (duplicate.found || duplicate.fiscalConflict) {
    const duplicateStatus = duplicate.found ? "already_exists_in_zeta" : "blocked";
    const result = withResult(resolution, {
      status: duplicateStatus,
      exportable: false,
      mode: "blocked",
      blockers: duplicate.fiscalConflict ? [...resolution.blockers, blocker(
        "zeta_preflight_fiscal_conflict",
        "La comprobacion final encontro el mismo proveedor, serie y numero con datos diferentes. No se envia; revisa el comprobante existente en Zeta.",
      )] : resolution.blockers,
      duplicate: {
        found: duplicate.found,
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
      status: duplicateStatus,
      response: duplicate.raw,
      deps,
    });

    await recordIntegrationAuditEvent(supabase, {
      organizationId: params.organizationId,
      actorUserId: params.actorProfileId,
      entityType: "document",
      entityId: params.documentId,
      action: duplicate.found ? "zeta_purchase_expense_already_exists" : "zeta_purchase_expense_fiscal_conflict",
      afterJson: {
        registro_id: duplicate.registroId,
      },
    });

    return {
      ...result,
      attemptRawRecordId: String(raw.id),
    };
  }

  // This insert is the durable, organization-wide point of no return. The
  // existing unique constraint elects one caller for the immutable identity
  // before any external write. We intentionally never delete the claim here:
  // even a later local failure or a definitive Zeta rejection remains blocked
  // until an audited manual-release workflow exists.
  const claim = await acquireExportClaim({
    supabase,
    organizationId: params.organizationId,
    connectionId: connection.id,
    documentId: params.documentId,
    fiscalFingerprint,
    fiscalIdentity,
    actorProfileId: params.actorProfileId,
    testMode: connection.test_mode,
    deps,
  });

  if (!claim.acquired) {
    return withResult(resolution, {
      status: "blocked",
      exportable: false,
      mode: "blocked",
      blockers: [
        ...resolution.blockers,
        blocker(
          "zeta_export_claim_already_exists",
          "Esta factura ya fue reservada para envio. No se vuelve a llamar Agregar; primero hay que reconciliar o revisar el intento existente.",
        ),
      ],
      duplicate: {
        found: false,
        registroId: null,
        raw: duplicate.raw,
      },
      attemptRawRecordId: claim.claimRawRecordId,
    });
  }

  await recordIntegrationAuditEvent(supabase, {
    organizationId: params.organizationId,
    actorUserId: params.actorProfileId,
    entityType: "document",
    entityId: params.documentId,
    action: "zeta_purchase_expense_export_started",
    metadata: {
      fiscal_fingerprint: resolution.fiscalFingerprint,
      fiscal_identity: resolution.fiscalIdentity,
      force_resend: params.forceResend === true,
    },
  });

  let response;

  try {
    response = await callZetaEndpoint<ZetaFacturaProveedorAgregarResponse>(
      client,
      "facturaProveedorAgregar",
      resolution.payload as unknown as Record<string, never>,
    );
    assertFacturaProveedorAccepted(response);
  } catch (error) {
    const status = hasUnknownWriteOutcome(error)
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

  let reconciliation: Awaited<ReturnType<typeof reconcilePurchaseExpenseInvoiceExport>> | null = null;
  let reconciliationError: ReturnType<typeof normalizeZetaException> | null = null;

  try {
    reconciliation = await reconcilePurchaseExpenseInvoiceExport({
      client,
      movimiento,
      expectedTotal,
    });
  } catch (error) {
    reconciliationError = normalizeZetaException(error);
  }

  const foundInZeta = reconciliation?.status === "found_in_zeta";
  const status = foundInZeta
    ? "found_in_zeta"
    : "success_pending_reconciliation";
  const reconciliationWarnings = reconciliation?.warnings.map((message) => ({
    code: "zeta_purchase_reconciliation_pending",
    message,
  })) ?? (reconciliationError
    ? [{
      code: "zeta_purchase_reconciliation_failed",
      message: `Zeta acepto la factura, pero la verificacion QueryCompras quedo pendiente: ${reconciliationError.message}`,
    }]
    : []);
  const zetaResponse = {
    agregar: response,
    reconciliation: reconciliation
      ? {
        status: reconciliation.status,
        registroId: reconciliation.registroId,
        queryCompras: reconciliation.queryComprasRaw,
        asientoLista: reconciliation.asientoListaRaw ?? null,
      }
      : {
        status: "query_failed",
        error: reconciliationError,
      },
  };
  const result = withResult(resolution, {
    status,
    warnings: [
      ...resolution.warnings,
      ...reconciliationWarnings,
    ],
    zetaResponse,
    duplicate: {
      found: foundInZeta,
      registroId: reconciliation?.registroId ?? null,
      raw: reconciliation?.queryComprasRaw ?? duplicate.raw,
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
    response: zetaResponse,
    deps,
  });

  await recordIntegrationAuditEvent(supabase, {
    organizationId: params.organizationId,
    actorUserId: params.actorProfileId,
    entityType: "document",
    entityId: params.documentId,
    action: "zeta_purchase_expense_export_completed",
    afterJson: {
      status,
      registro_id: reconciliation?.registroId ?? null,
      fiscal_fingerprint: resolution.fiscalFingerprint,
    },
  });

  return {
    ...result,
    attemptRawRecordId: String(raw.id),
  };
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
