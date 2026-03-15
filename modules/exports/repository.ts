import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMissingSupabaseColumnError,
  isMissingSupabaseRelationError,
} from "@/lib/supabase/schema-compat";
import type {
  AccountingExportDataset,
  AccountingExportScope,
} from "@/modules/exports/accounting-adapters";
import {
  buildCanonicalTaxPayload,
  buildDgiFormSummary,
  buildFallbackDgiMappings,
  type CanonicalTaxMetric,
  type DGIFormMappingRecord,
} from "@/modules/exports/canonical";
import type { VatRunExportDataset } from "@/modules/exports/types";
import {
  isMissingDocumentStep5ColumnError,
  isMissingJournalEntryLineStep5ColumnError,
  isMissingJournalEntryStep5ColumnError,
} from "@/modules/accounting/step5-schema-compat";
import { isMissingVatRunImportColumnError } from "@/modules/tax/vat-run-schema-compat";

type JsonRecord = Record<string, unknown>;

type VatRunRow = {
  id: string;
  organization_id: string;
  status: string;
  output_vat: number;
  input_vat_creditable: number;
  input_vat_non_deductible: number;
  import_vat?: number | null;
  import_vat_advance?: number | null;
  net_vat_payable: number;
  result_json: JsonRecord | null;
  input_snapshot_json: JsonRecord | null;
  period: {
    period_year: number;
    period_month: number | null;
  } | {
    period_year: number;
    period_month: number | null;
  }[] | null;
};

const VAT_RUN_EXPORT_SELECT = [
  "id",
  "organization_id",
  "status",
  "output_vat",
  "input_vat_creditable",
  "input_vat_non_deductible",
  "import_vat",
  "import_vat_advance",
  "net_vat_payable",
  "result_json",
  "input_snapshot_json",
  "period:tax_periods!vat_runs_period_id_fkey(period_year, period_month)",
].join(", ");

const VAT_RUN_EXPORT_SELECT_LEGACY = [
  "id",
  "organization_id",
  "status",
  "output_vat",
  "input_vat_creditable",
  "input_vat_non_deductible",
  "net_vat_payable",
  "result_json",
  "input_snapshot_json",
  "period:tax_periods!vat_runs_period_id_fkey(period_year, period_month)",
].join(", ");

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function getVatRunPeriod(
  period: VatRunRow["period"],
): { period_year: number; period_month: number | null } | null {
  if (Array.isArray(period)) {
    return period[0] ?? null;
  }

  return period ?? null;
}

async function loadActiveDgiMappings(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organization_dgi_form_mappings")
    .select("form_code, line_code, metric_key, label, calculation_mode, version")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("version", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const mappings = ((data as Array<{
    form_code: string;
    line_code: string;
    metric_key: DGIFormMappingRecord["metricKey"];
    label: string;
    calculation_mode: "direct_metric";
    version: number;
  }> | null) ?? []).map((row) => ({
    formCode: row.form_code,
    lineCode: row.line_code,
    metricKey: row.metric_key,
    label: row.label,
    calculationMode: row.calculation_mode,
    version: row.version,
  }));

  return mappings.length > 0 ? mappings : buildFallbackDgiMappings();
}

export async function loadVatRunExportDataset(
  supabase: SupabaseClient,
  organizationId: string,
  vatRunId: string,
) {
  const runVatRunQuery = (selectClause: string) =>
    supabase
      .from("vat_runs")
      .select(selectClause)
      .eq("organization_id", organizationId)
      .eq("id", vatRunId)
      .limit(1)
      .maybeSingle();

  let { data: vatRun, error: vatRunError } = await runVatRunQuery(VAT_RUN_EXPORT_SELECT);

  if (vatRunError && isMissingVatRunImportColumnError(vatRunError)) {
    ({ data: vatRun, error: vatRunError } = await runVatRunQuery(VAT_RUN_EXPORT_SELECT_LEGACY));
  }

  if (vatRunError || !vatRun) {
    throw new Error(vatRunError?.message ?? "VAT run no encontrado para export.");
  }

  const vatRunRow = vatRun as unknown as VatRunRow;

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .limit(1)
    .maybeSingle();

  if (organizationError || !organization?.id) {
    throw new Error(organizationError?.message ?? "Organizacion no encontrada para export.");
  }

  const snapshot = asRecord(vatRunRow.input_snapshot_json);
  const tracedDocuments = Array.isArray(snapshot.documents)
    ? snapshot.documents.map((entry) => asRecord(entry))
    : [];
  const documentIds = tracedDocuments
    .map((entry) => asString(entry.documentId))
    .filter((value): value is string => Boolean(value));
  const draftIds = tracedDocuments
    .map((entry) => asString(entry.draftId))
    .filter((value): value is string => Boolean(value));

  const [
    documentsResult,
    draftsResult,
    invoiceIdentityResult,
    lineItemsResult,
    confirmationsResult,
    suggestionsResult,
    journalEntriesResult,
    importOperationsResult,
    importTaxesResult,
    dgiMappings,
    historicalRunsResult,
  ] = await Promise.all([
    documentIds.length > 0
      ? supabase
        .from("documents")
        .select("id, original_filename")
        .in("id", documentIds)
      : Promise.resolve({ data: [], error: null }),
    draftIds.length > 0
      ? supabase
        .from("document_drafts")
        .select("id, document_id, fields_json, source_confidence, confirmed_at")
        .in("id", draftIds)
      : Promise.resolve({ data: [], error: null }),
    documentIds.length > 0
      ? supabase
        .from("document_invoice_identities")
        .select("document_id, issuer_tax_id_normalized, duplicate_status")
        .in("document_id", documentIds)
      : Promise.resolve({ data: [], error: null }),
    draftIds.length > 0
      ? supabase
        .from("document_line_items")
        .select("draft_id, match_strategy, raw_concept_description, metadata")
        .in("draft_id", draftIds)
      : Promise.resolve({ data: [], error: null }),
    documentIds.length > 0
      ? supabase
        .from("document_confirmations")
        .select("document_id, confirmed_at, confirmed_by")
        .in("document_id", documentIds)
        .order("confirmed_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    documentIds.length > 0
      ? supabase
        .from("accounting_suggestions")
        .select("document_id, explanation, rule_trace_json")
        .in("document_id", documentIds)
        .order("approved_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    documentIds.length > 0
      ? supabase
        .from("journal_entries")
        .select(
          "id, source_document_id, entry_date, reference, journal_entry_lines(line_no, debit, credit, description, metadata, chart_of_accounts(code, name))",
        )
        .in("source_document_id", documentIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("organization_import_operations")
      .select("id, reference_code, dua_number, supplier_name, operation_date, payment_date, status")
      .eq("organization_id", organizationId)
      .eq("status", "approved"),
    supabase
      .from("organization_import_operation_taxes")
      .select("import_operation_id, tax_label, amount, is_creditable_vat, is_vat_advance, is_other_tax, metadata_json")
      .eq("organization_id", organizationId),
    loadActiveDgiMappings(supabase, organizationId),
    supabase
      .from("organization_spreadsheet_import_runs")
      .select("result_json")
      .eq("organization_id", organizationId)
      .eq("import_type", "historical_vat_liquidation")
      .not("confirmed_at", "is", null),
  ]);

  if (
    documentsResult.error
    || draftsResult.error
    || invoiceIdentityResult.error
    || lineItemsResult.error
    || confirmationsResult.error
    || suggestionsResult.error
    || journalEntriesResult.error
    || importOperationsResult.error
    || importTaxesResult.error
    || (
      historicalRunsResult.error
      && !isMissingSupabaseRelationError(
        historicalRunsResult.error,
        "organization_spreadsheet_import_runs",
      )
    )
  ) {
    throw new Error(
      documentsResult.error?.message
      ?? draftsResult.error?.message
      ?? invoiceIdentityResult.error?.message
      ?? lineItemsResult.error?.message
      ?? confirmationsResult.error?.message
      ?? suggestionsResult.error?.message
      ?? journalEntriesResult.error?.message
      ?? importOperationsResult.error?.message
      ?? importTaxesResult.error?.message
      ?? (
        historicalRunsResult.error
        && !isMissingSupabaseRelationError(
          historicalRunsResult.error,
          "organization_spreadsheet_import_runs",
        )
          ? historicalRunsResult.error.message
          : null
      )
      ?? "No se pudo cargar el dataset de export.",
    );
  }

  const documentsById = new Map(
    ((documentsResult.data as Array<{ id: string; original_filename: string }> | null) ?? [])
      .map((row) => [row.id, row]),
  );
  const draftsById = new Map(
    ((draftsResult.data as Array<{
      id: string;
      document_id: string;
      fields_json: JsonRecord | null;
      source_confidence: number | null;
      confirmed_at: string | null;
    }> | null) ?? []).map((row) => [row.id, row]),
  );
  const invoiceByDocumentId = new Map(
    ((invoiceIdentityResult.data as Array<{
      document_id: string;
      issuer_tax_id_normalized: string | null;
      duplicate_status: string;
    }> | null) ?? []).map((row) => [row.document_id, row]),
  );
  const lineItemsByDraftId = new Map<string, Array<{
    match_strategy: string;
    raw_concept_description: string | null;
  }>>();

  for (const row of ((lineItemsResult.data as Array<{
    draft_id: string;
    match_strategy: string;
    raw_concept_description: string | null;
  }> | null) ?? [])) {
    const current = lineItemsByDraftId.get(row.draft_id) ?? [];
    current.push(row);
    lineItemsByDraftId.set(row.draft_id, current);
  }

  const latestConfirmationByDocument = new Map<string, {
    confirmed_at: string;
    confirmed_by: string | null;
  }>();

  for (const row of ((confirmationsResult.data as Array<{
    document_id: string;
    confirmed_at: string;
    confirmed_by: string | null;
  }> | null) ?? [])) {
    if (!latestConfirmationByDocument.has(row.document_id)) {
      latestConfirmationByDocument.set(row.document_id, row);
    }
  }

  const latestSuggestionByDocument = new Map(
    ((suggestionsResult.data as Array<{
      document_id: string;
      explanation: string | null;
      rule_trace_json: unknown;
    }> | null) ?? []).map((row) => [row.document_id, row]),
  );

  const purchaseRows: VatRunExportDataset["purchases"] = [];
  const saleRows: VatRunExportDataset["sales"] = [];
  const importRows: VatRunExportDataset["imports"] = [];
  const traceabilityRows: VatRunExportDataset["traceability"] = [];
  const journalRows: VatRunExportDataset["journalEntries"] = [];

  for (const snapshotDocument of tracedDocuments) {
    const documentId = asString(snapshotDocument.documentId);
    const draftId = asString(snapshotDocument.draftId);

    if (!documentId || !draftId) {
      continue;
    }

    const draft = draftsById.get(draftId);
    const document = documentsById.get(documentId);

    if (!draft || !document) {
      throw new Error("El export encontro documentos o drafts faltantes.");
    }

    const facts = asRecord(asRecord(draft.fields_json).facts);
    const subtotal = asNumber(snapshotDocument.taxableAmount) ?? asNumber(facts.subtotal) ?? 0;
    const taxAmount = asNumber(snapshotDocument.taxAmount) ?? asNumber(facts.tax_amount) ?? 0;
    const totalAmount = asNumber(facts.total_amount) ?? subtotal + taxAmount;
    const role = asString(snapshotDocument.role) ?? "other";
    const vatBucket = asString(snapshotDocument.vatBucket);
    const flags = asStringArray(snapshotDocument.reviewFlags);
    const concepts = lineItemsByDraftId.get(draftId) ?? [];
    const primaryConcept = concepts[0]?.raw_concept_description ?? "Sin concepto";
    const invoiceIdentity = invoiceByDocumentId.get(documentId);
    const confirmation = latestConfirmationByDocument.get(documentId);
    const suggestion = latestSuggestionByDocument.get(documentId);
    const documentNumber = asString(facts.document_number);
    const documentDate = asString(snapshotDocument.documentDate) ?? asString(facts.document_date) ?? "";

    if (role === "purchase") {
      purchaseRows.push({
        date: documentDate,
        vendor: asString(facts.issuer_name) ?? "Proveedor sin resolver",
        vendorTaxId: invoiceIdentity?.issuer_tax_id_normalized ?? asString(facts.issuer_tax_id),
        documentNumber,
        primaryConcept,
        taxableBase: subtotal,
        vat: taxAmount,
        total: totalAmount,
        deductibilityStatus:
          vatBucket === "input_non_deductible"
            ? "No deducible"
            : vatBucket === "input_creditable"
              ? "Credito fiscal"
              : "Manual / exento",
        notes: flags.join(" "),
      });
    } else if (role === "sale") {
      saleRows.push({
        date: documentDate,
        customer: asString(facts.receiver_name) ?? "Cliente",
        documentNumber,
        taxableBase: subtotal,
        vat: taxAmount,
        total: totalAmount,
        rate: taxAmount > 0 && subtotal > 0 ? `${Math.round((taxAmount / subtotal) * 100)}%` : "0%",
        notes: flags.join(" "),
      });
    }

    traceabilityRows.push({
      document: document.original_filename,
      vendorResolved: asString(facts.issuer_name) ?? "Sin proveedor",
      duplicateDetected: invoiceIdentity?.duplicate_status === "clear" ? "No" : "Si",
      conceptMatchStrategy: concepts[0]?.match_strategy ?? "sin_match",
      confidence:
        typeof draft.source_confidence === "number"
          ? `${Math.round(draft.source_confidence * 100)}%`
          : "Sin score",
      reviewer: confirmation?.confirmed_by ?? "Usuario del tenant",
      approvalDate: confirmation?.confirmed_at ?? draft.confirmed_at ?? "",
      appliedRule: Array.isArray(suggestion?.rule_trace_json)
        ? asString(asRecord((suggestion.rule_trace_json as unknown[])[0]).scope) ?? "sin_regla"
        : "sin_regla",
      flags: flags.join(" "),
    });
  }

  for (const entry of ((journalEntriesResult.data as Array<{
    id: string;
    source_document_id: string | null;
    entry_date: string;
    reference: string | null;
    journal_entry_lines: Array<{
      line_no: number;
      debit: number;
      credit: number;
      description: string | null;
      metadata: JsonRecord | null;
      chart_of_accounts:
        | {
            code: string;
            name: string;
          }
        | {
            code: string;
            name: string;
          }[]
        | null;
    }> | null;
  }> | null) ?? [])) {
    for (const line of entry.journal_entry_lines ?? []) {
      const account = Array.isArray(line.chart_of_accounts)
        ? line.chart_of_accounts[0]
        : line.chart_of_accounts;

      journalRows.push({
        date: entry.entry_date,
        reference: entry.reference ?? entry.source_document_id ?? entry.id,
        account: account?.code ?? "sin_cuenta",
        accountName: account?.name ?? line.description ?? "Sin nombre",
        debit: line.debit,
        credit: line.credit,
        provenance:
          asString(asRecord(line.metadata).provenance)
          ?? "journal_entry_line",
      });
    }
  }

  const period = getVatRunPeriod(vatRunRow.period);
  const periodLabel = period
    ? `${period.period_year}-${String(period.period_month ?? 0).padStart(2, "0")}`
    : "Sin periodo";
  const importOperationIdsForPeriod = (((importOperationsResult.data as Array<{
    id: string;
    reference_code: string | null;
    dua_number: string | null;
    supplier_name: string | null;
    operation_date: string | null;
    payment_date: string | null;
    status: string;
  }> | null) ?? []))
    .filter((operation) =>
      operation.operation_date?.startsWith(periodLabel)
      || operation.payment_date?.startsWith(periodLabel));
  const importOperationById = new Map(importOperationIdsForPeriod.map((operation) => [operation.id, operation]));

  for (const tax of ((importTaxesResult.data as Array<{
    import_operation_id: string;
    tax_label: string;
    amount: number;
    is_creditable_vat: boolean;
    is_vat_advance: boolean;
    is_other_tax: boolean;
    metadata_json: JsonRecord | null;
  }> | null) ?? [])) {
    const operation = importOperationById.get(tax.import_operation_id);

    if (!operation) {
      continue;
    }

    importRows.push({
      referenceCode: operation.reference_code ?? tax.import_operation_id,
      duaNumber: operation.dua_number,
      supplierName: operation.supplier_name,
      taxLabel: tax.tax_label,
      amount: tax.amount,
      sourceType: "imported_from_document",
      notes: asStringArray(asRecord(tax.metadata_json).warnings).join(" "),
    });
  }

  const historicalRuns = ((historicalRunsResult.data as Array<{
    result_json: JsonRecord | null;
  }> | null) ?? []);
  const historicalWarnings = historicalRuns.some((run) => {
    const canonical = asRecord(asRecord(run.result_json).canonical);
    const periods = Array.isArray(canonical.periods) ? canonical.periods : [];

    return periods.some((periodEntry) =>
      asString(asRecord(periodEntry).periodLabel) === periodLabel);
  })
    ? ["Existe historico IVA importado para este periodo; revisar diferencias antes de exportar."]
    : [];
  const canonicalMetrics = [
    {
      metricKey: "purchaseTaxableBase",
      value: purchaseRows.reduce((sum, row) => sum + row.taxableBase, 0),
      sourceType: "system_generated",
      warnings: [],
    },
    {
      metricKey: "saleTaxableBase",
      value: saleRows.reduce((sum, row) => sum + row.taxableBase, 0),
      sourceType: "system_generated",
      warnings: [],
    },
    {
      metricKey: "outputVat",
      value: vatRunRow.output_vat,
      sourceType: "system_generated",
      warnings: historicalWarnings,
    },
    {
      metricKey: "inputVatCreditable",
      value: vatRunRow.input_vat_creditable,
      sourceType: "system_generated",
      warnings: historicalWarnings,
    },
    {
      metricKey: "inputVatNonDeductible",
      value: vatRunRow.input_vat_non_deductible,
      sourceType: "system_generated",
      warnings: [],
    },
    {
      metricKey: "importVat",
      value: asNumber(vatRunRow.import_vat) ?? asNumber(asRecord(asRecord(vatRunRow.result_json).totals).import_vat) ?? 0,
      sourceType: importRows.length > 0
        ? "imported_from_document"
        : "system_generated",
      warnings: [],
    },
    {
      metricKey: "importVatAdvance",
      value: asNumber(vatRunRow.import_vat_advance) ?? asNumber(asRecord(asRecord(vatRunRow.result_json).totals).import_vat_advance) ?? 0,
      sourceType: importRows.length > 0
        ? "imported_from_document"
        : "system_generated",
      warnings: [],
    },
    {
      metricKey: "netVatPayable",
      value: vatRunRow.net_vat_payable,
      sourceType: "system_generated",
      warnings: historicalWarnings,
    },
  ] satisfies CanonicalTaxMetric[];
  const canonicalTaxPayload = buildCanonicalTaxPayload({
    organizationId,
    vatRunId,
    periodLabel,
    metrics: canonicalMetrics,
    warnings: historicalWarnings,
  });
  const dgiFormSummary = buildDgiFormSummary({
    organizationId,
    vatRunId,
    formCode: dgiMappings[0]?.formCode ?? "2176",
    metrics: canonicalMetrics,
    mappings: dgiMappings,
    warnings: historicalWarnings,
  });
  const canonicalAccountingPayload = {
    organizationId,
    payloadType: "journal_entries",
    sourceType: "system_generated",
    entries: journalRows.map((row) => ({
      reference: row.reference,
      accountCode: row.account,
      accountName: row.accountName,
      debit: row.debit,
      credit: row.credit,
    })),
    templates: [],
    chart: [],
    warnings: [],
  } satisfies VatRunExportDataset["canonicalAccountingPayload"];

  return {
    organizationId,
    organizationName: organization.name as string,
    vatRunId,
    periodLabel,
    totals: {
      documentCount: tracedDocuments.length,
      purchaseTaxableBase: purchaseRows.reduce((sum, row) => sum + row.taxableBase, 0),
      saleTaxableBase: saleRows.reduce((sum, row) => sum + row.taxableBase, 0),
      outputVat: vatRunRow.output_vat,
      inputVatCreditable: vatRunRow.input_vat_creditable,
      inputVatNonDeductible: vatRunRow.input_vat_non_deductible,
      importVat: canonicalMetrics.find((metric) => metric.metricKey === "importVat")?.value ?? 0,
      importVatAdvance: canonicalMetrics.find((metric) => metric.metricKey === "importVatAdvance")?.value ?? 0,
      netVatPayable: vatRunRow.net_vat_payable,
      warningsCount: traceabilityRows.reduce(
        (sum, row) => sum + (row.flags ? 1 : 0),
        0,
      ),
    },
    purchases: purchaseRows,
    sales: saleRows,
    journalEntries: journalRows,
    imports: importRows,
    traceability: traceabilityRows,
    dgiFormSummary,
    canonicalTaxPayload,
    canonicalAccountingPayload,
  } satisfies VatRunExportDataset;
}

function buildPeriodRange(periodYear: number, periodMonth: number) {
  const start = `${periodYear}-${String(periodMonth).padStart(2, "0")}-01`;
  const end = periodMonth === 12
    ? `${periodYear + 1}-01-01`
    : `${periodYear}-${String(periodMonth + 1).padStart(2, "0")}-01`;

  return {
    start,
    end,
    label: `${periodYear}-${String(periodMonth).padStart(2, "0")}`,
  };
}

export async function loadAccountingExportDataset(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    periodYear: number;
    periodMonth: number;
    scope: AccountingExportScope;
  },
) {
  const period = buildPeriodRange(input.periodYear, input.periodMonth);
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .limit(1)
    .maybeSingle();

  if (organizationError || !organization?.id) {
    throw new Error(organizationError?.message ?? "Organizacion no encontrada para exportacion.");
  }

  const loadJournalEntries = async () => {
    const primary = await supabase
      .from("journal_entries")
      .select(
        "id, source_document_id, entry_date, reference, description, posting_mode, currency_code, functional_currency, fx_rate_bcu_value, fx_rate_bcu_date_used",
      )
      .eq("organization_id", organizationId)
      .gte("entry_date", period.start)
      .lt("entry_date", period.end)
      .order("entry_date", { ascending: true });
    let data = primary.data as unknown;
    let error = primary.error;

    if (error && isMissingJournalEntryStep5ColumnError(error)) {
      const legacy = await supabase
        .from("journal_entries")
        .select("id, source_document_id, entry_date, reference, description, currency_code")
        .eq("organization_id", organizationId)
        .gte("entry_date", period.start)
        .lt("entry_date", period.end)
        .order("entry_date", { ascending: true });
      data = legacy.data as unknown;
      error = legacy.error;
    }

    if (error) {
      throw new Error(error.message);
    }

    return ((data as Array<{
      id: string;
      source_document_id: string | null;
      entry_date: string;
      reference: string | null;
      description: string | null;
      posting_mode?: string | null;
      currency_code?: string | null;
      functional_currency?: string | null;
      fx_rate_bcu_value?: number | null;
      fx_rate_bcu_date_used?: string | null;
    }> | null) ?? []);
  };

  const journalEntries = await loadJournalEntries();
  const journalIds = journalEntries.map((row) => row.id);
  const documentIds = journalEntries
    .map((row) => row.source_document_id)
    .filter((value): value is string => Boolean(value));

  const loadJournalLines = async () => {
    if (journalIds.length === 0) {
      return [];
    }

    const primary = await supabase
      .from("journal_entry_lines")
      .select(
        "journal_entry_id, line_no, debit, credit, original_currency_code, original_amount, functional_amount_uyu, fx_rate_applied, description, metadata, chart_of_accounts(code, name, metadata, external_code, is_provisional, tax_profile_hint)",
      )
      .in("journal_entry_id", journalIds)
      .order("line_no", { ascending: true });
    let data = primary.data as unknown;
    let error = primary.error;

    if (
      error
      && (
        isMissingJournalEntryLineStep5ColumnError(error)
        || isMissingSupabaseColumnError(error, "chart_of_accounts")
      )
    ) {
      const legacy = await supabase
        .from("journal_entry_lines")
        .select(
          "journal_entry_id, line_no, debit, credit, description, metadata, chart_of_accounts(code, name, metadata)",
        )
        .in("journal_entry_id", journalIds)
        .order("line_no", { ascending: true });
      data = legacy.data as unknown;
      error = legacy.error;
    }

    if (error) {
      throw new Error(error.message);
    }

    return ((data as Array<{
      journal_entry_id: string;
      line_no: number;
      debit: number;
      credit: number;
      original_currency_code?: string | null;
      original_amount?: number | null;
      functional_amount_uyu?: number | null;
      fx_rate_applied?: number | null;
      description: string | null;
      metadata: JsonRecord | null;
      chart_of_accounts:
        | {
            code: string;
            name: string;
            metadata?: JsonRecord | null;
            external_code?: string | null;
            is_provisional?: boolean | null;
            tax_profile_hint?: string | null;
          }
        | Array<{
            code: string;
            name: string;
            metadata?: JsonRecord | null;
            external_code?: string | null;
            is_provisional?: boolean | null;
            tax_profile_hint?: string | null;
          }>
        | null;
    }> | null) ?? []);
  };

  const loadDocuments = async () => {
    if (documentIds.length === 0) {
      return [];
    }

    const primary = await supabase
      .from("documents")
      .select("id, original_filename, document_date, posting_status")
      .in("id", documentIds);
    let data = primary.data as unknown;
    let error = primary.error;

    if (error && isMissingDocumentStep5ColumnError(error)) {
      const legacy = await supabase
        .from("documents")
        .select("id, original_filename, document_date")
        .in("id", documentIds);
      data = legacy.data as unknown;
      error = legacy.error;
    }

    if (error) {
      throw new Error(error.message);
    }

    return ((data as Array<{
      id: string;
      original_filename: string;
      document_date: string | null;
      posting_status?: string | null;
    }> | null) ?? []);
  };

  const loadLatestReconciliation = async () => {
    const runResult = await supabase
      .from("dgi_reconciliation_runs")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("period_year", input.periodYear)
      .eq("period_month", input.periodMonth)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runResult.error) {
      if (isMissingSupabaseRelationError(runResult.error, "dgi_reconciliation_runs")) {
        return [];
      }

      throw new Error(runResult.error.message);
    }

    if (!runResult.data?.id) {
      return [];
    }

    const bucketResult = await supabase
      .from("dgi_reconciliation_buckets")
      .select("bucket_code, difference_status, delta_net_amount_uyu, delta_tax_amount_uyu, notes")
      .eq("organization_id", organizationId)
      .eq("run_id", runResult.data.id as string)
      .order("bucket_code", { ascending: true });

    if (bucketResult.error) {
      if (isMissingSupabaseRelationError(bucketResult.error, "dgi_reconciliation_buckets")) {
        return [];
      }

      throw new Error(bucketResult.error.message);
    }

    return ((bucketResult.data as Array<{
      bucket_code: string;
      difference_status: string;
      delta_net_amount_uyu: number;
      delta_tax_amount_uyu: number;
      notes: string | null;
    }> | null) ?? []);
  };

  const [journalLines, documents, dgiDifferences] = await Promise.all([
    loadJournalLines(),
    loadDocuments(),
    loadLatestReconciliation(),
  ]);
  const documentById = new Map(documents.map((row) => [row.id, row]));
  const linesByJournalId = new Map<string, typeof journalLines>();

  for (const line of journalLines) {
    const group = linesByJournalId.get(line.journal_entry_id) ?? [];
    group.push(line);
    linesByJournalId.set(line.journal_entry_id, group);
  }

  const exportRows = journalEntries.flatMap((entry) => {
    const document = entry.source_document_id
      ? documentById.get(entry.source_document_id)
      : null;
    const postingStatus = typeof document?.posting_status === "string"
      ? document.posting_status
      : null;
    const scopeMatches =
      input.scope === "all_posted"
        ? !postingStatus || ["posted_provisional", "posted_final"].includes(postingStatus)
        : postingStatus === input.scope;

    if (!scopeMatches) {
      return [];
    }

    return (linesByJournalId.get(entry.id) ?? []).map((line) => {
      const account = Array.isArray(line.chart_of_accounts)
        ? line.chart_of_accounts[0]
        : line.chart_of_accounts;
      const metadata = asRecord(account?.metadata);

      return {
        entryDate: entry.entry_date,
        reference: entry.reference ?? entry.id,
        description: entry.description ?? line.description,
        documentFilename: document?.original_filename ?? null,
        documentPostingStatus: postingStatus,
        postingMode:
          typeof entry.posting_mode === "string" && entry.posting_mode
            ? entry.posting_mode
            : "final",
        accountCode: account?.code ?? "sin_cuenta",
        externalAccountCode:
          typeof account?.external_code === "string" && account.external_code
            ? account.external_code
            : (
              typeof metadata.external_code === "string" && metadata.external_code
                ? metadata.external_code
                : null
            ),
        accountName: account?.name ?? line.description ?? "Sin nombre",
        debit: line.debit,
        credit: line.credit,
        originalCurrencyCode:
          typeof line.original_currency_code === "string" && line.original_currency_code
            ? line.original_currency_code
            : (typeof entry.currency_code === "string" ? entry.currency_code : null),
        originalAmount:
          typeof line.original_amount === "number"
            ? line.original_amount
            : (
              line.debit !== 0
                ? line.debit
                : line.credit
            ),
        functionalCurrencyCode:
          typeof entry.functional_currency === "string" && entry.functional_currency
            ? entry.functional_currency
            : "UYU",
        functionalAmountUyu:
          typeof line.functional_amount_uyu === "number"
            ? line.functional_amount_uyu
            : (line.debit !== 0 ? line.debit : line.credit),
        fxRateApplied:
          typeof line.fx_rate_applied === "number"
            ? line.fx_rate_applied
            : (typeof entry.fx_rate_bcu_value === "number" ? entry.fx_rate_bcu_value : null),
        taxProfileHint:
          typeof account?.tax_profile_hint === "string" && account.tax_profile_hint
            ? account.tax_profile_hint
            : (
              typeof metadata.tax_profile_hint === "string" && metadata.tax_profile_hint
                ? metadata.tax_profile_hint
                : null
            ),
        accountIsProvisional:
          typeof account?.is_provisional === "boolean"
            ? account.is_provisional
            : metadata.is_provisional === true,
      };
    });
  });

  const recategorizationQueue = documents
    .filter((document) => document.posting_status === "posted_provisional")
    .map((document) => ({
      documentId: document.id,
      documentFilename: document.original_filename,
      documentDate: document.document_date,
      postingStatus: typeof document.posting_status === "string" ? document.posting_status : null,
    }));

  return {
    organizationId,
    organizationName: organization.name as string,
    periodLabel: period.label,
    scope: input.scope,
    rows: exportRows,
    recategorizationQueue,
    dgiDifferences: dgiDifferences.map((bucket) => ({
      bucketCode: bucket.bucket_code,
      label: bucket.bucket_code.replace(/_/g, " "),
      differenceStatus: bucket.difference_status,
      deltaNetAmountUyu: bucket.delta_net_amount_uyu,
      deltaTaxAmountUyu: bucket.delta_tax_amount_uyu,
      notes: bucket.notes,
    })),
    warnings: [
      exportRows.length === 0
        ? "No hay lineas de asiento para el periodo y scope seleccionados."
        : "",
      recategorizationQueue.length > 0
        ? `${recategorizationQueue.length} documento(s) siguen en posteo provisional.`
        : "",
    ].filter(Boolean),
  } satisfies AccountingExportDataset;
}
