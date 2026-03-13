import type { SupabaseClient } from "@supabase/supabase-js";
import type { VatRunExportDataset } from "@/modules/exports/types";

type JsonRecord = Record<string, unknown>;

type VatRunRow = {
  id: string;
  organization_id: string;
  status: string;
  output_vat: number;
  input_vat_creditable: number;
  input_vat_non_deductible: number;
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

export async function loadVatRunExportDataset(
  supabase: SupabaseClient,
  organizationId: string,
  vatRunId: string,
) {
  const { data: vatRun, error: vatRunError } = await supabase
    .from("vat_runs")
    .select(
      "id, organization_id, status, output_vat, input_vat_creditable, input_vat_non_deductible, net_vat_payable, result_json, input_snapshot_json, period:tax_periods!vat_runs_period_id_fkey(period_year, period_month)",
    )
    .eq("organization_id", organizationId)
    .eq("id", vatRunId)
    .limit(1)
    .maybeSingle();

  if (vatRunError || !vatRun) {
    throw new Error(vatRunError?.message ?? "VAT run no encontrado para export.");
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .limit(1)
    .maybeSingle();

  if (organizationError || !organization?.id) {
    throw new Error(organizationError?.message ?? "Organizacion no encontrada para export.");
  }

  const snapshot = asRecord((vatRun as VatRunRow).input_snapshot_json);
  const tracedDocuments = Array.isArray(snapshot.documents)
    ? snapshot.documents.map((entry) => asRecord(entry))
    : [];
  const documentIds = tracedDocuments
    .map((entry) => asString(entry.documentId))
    .filter((value): value is string => Boolean(value));
  const draftIds = tracedDocuments
    .map((entry) => asString(entry.draftId))
    .filter((value): value is string => Boolean(value));

  if (documentIds.length === 0 || draftIds.length === 0) {
    throw new Error("El VAT run no tiene documentos trazables suficientes para export.");
  }

  const [
    documentsResult,
    draftsResult,
    invoiceIdentityResult,
    lineItemsResult,
    confirmationsResult,
    suggestionsResult,
    journalEntriesResult,
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("id, original_filename")
      .in("id", documentIds),
    supabase
      .from("document_drafts")
      .select("id, document_id, fields_json, source_confidence, confirmed_at")
      .in("id", draftIds),
    supabase
      .from("document_invoice_identities")
      .select("document_id, issuer_tax_id_normalized, duplicate_status")
      .in("document_id", documentIds),
    supabase
      .from("document_line_items")
      .select("draft_id, match_strategy, raw_concept_description, metadata")
      .in("draft_id", draftIds),
    supabase
      .from("document_confirmations")
      .select("document_id, confirmed_at, confirmed_by")
      .in("document_id", documentIds)
      .order("confirmed_at", { ascending: false }),
    supabase
      .from("accounting_suggestions")
      .select("document_id, explanation, rule_trace_json")
      .in("document_id", documentIds)
      .order("approved_at", { ascending: false }),
    supabase
      .from("journal_entries")
      .select(
        "id, source_document_id, entry_date, reference, journal_entry_lines(line_no, debit, credit, description, metadata, chart_of_accounts(code, name))",
      )
      .in("source_document_id", documentIds),
  ]);

  if (
    documentsResult.error
    || draftsResult.error
    || invoiceIdentityResult.error
    || lineItemsResult.error
    || confirmationsResult.error
    || suggestionsResult.error
    || journalEntriesResult.error
  ) {
    throw new Error(
      documentsResult.error?.message
      ?? draftsResult.error?.message
      ?? invoiceIdentityResult.error?.message
      ?? lineItemsResult.error?.message
      ?? confirmationsResult.error?.message
      ?? suggestionsResult.error?.message
      ?? journalEntriesResult.error?.message
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

  const period = getVatRunPeriod((vatRun as VatRunRow).period);
  const periodLabel = period
    ? `${period.period_year}-${String(period.period_month ?? 0).padStart(2, "0")}`
    : "Sin periodo";

  return {
    organizationId,
    organizationName: organization.name as string,
    vatRunId,
    periodLabel,
    totals: {
      documentCount: tracedDocuments.length,
      purchaseTaxableBase: purchaseRows.reduce((sum, row) => sum + row.taxableBase, 0),
      saleTaxableBase: saleRows.reduce((sum, row) => sum + row.taxableBase, 0),
      outputVat: (vatRun as VatRunRow).output_vat,
      inputVatCreditable: (vatRun as VatRunRow).input_vat_creditable,
      inputVatNonDeductible: (vatRun as VatRunRow).input_vat_non_deductible,
      netVatPayable: (vatRun as VatRunRow).net_vat_payable,
      warningsCount: traceabilityRows.reduce(
        (sum, row) => sum + (row.flags ? 1 : 0),
        0,
      ),
    },
    purchases: purchaseRows,
    sales: saleRows,
    journalEntries: journalRows,
    traceability: traceabilityRows,
  } satisfies VatRunExportDataset;
}
