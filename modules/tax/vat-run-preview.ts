import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { DocumentPostingStatus } from "@/modules/accounting";

type JsonRecord = Record<string, unknown>;

type DraftPreviewRow = {
  id: string;
  document_id: string;
  document_role: "purchase" | "sale" | "other";
  fields_json: JsonRecord | null;
  tax_treatment_json: JsonRecord | null;
};

type OfficialVatRunRow = {
  id: string;
  status: string;
  output_vat: number;
  input_vat_creditable: number;
  input_vat_non_deductible: number;
  import_vat?: number | null;
  import_vat_advance?: number | null;
  net_vat_payable: number;
};

export type VatRunPreviewSnapshot = {
  documentId: string;
  draftId: string;
  role: "purchase" | "sale" | "other";
  documentDate: string;
  vatBucket: string | null;
  taxableAmount: number;
  taxAmount: number;
  reviewFlags: string[];
};

export type VatRunPreview = {
  period: string;
  includeStatuses: DocumentPostingStatus[];
  totals: {
    outputVat: number;
    inputVatCreditable: number;
    inputVatNonDeductible: number;
    netVatPayable: number;
  };
  includedDocuments: VatRunPreviewSnapshot[];
  excludedDocuments: Array<{
    documentId: string;
    reason: string;
  }>;
  warnings: string[];
  officialRunComparison: {
    runId: string | null;
    status: string | null;
    deltaOutputVat: number;
    deltaInputVatCreditable: number;
    deltaNetVatPayable: number;
  };
  generatedAt: string;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getDraftFacts(fieldsJson: JsonRecord | null) {
  return asRecord(asRecord(fieldsJson).facts);
}

function buildPreviewSnapshot(draft: DraftPreviewRow): VatRunPreviewSnapshot | null {
  const facts = getDraftFacts(draft.fields_json);
  const documentDate = asString(facts.document_date);

  if (!documentDate) {
    return null;
  }

  const taxJson = asRecord(draft.tax_treatment_json);

  return {
    documentId: draft.document_id,
    draftId: draft.id,
    role: draft.document_role,
    documentDate,
    vatBucket:
      asString(taxJson.vat_bucket)
      ?? asString(taxJson.vatBucket)
      ?? asString(asRecord(taxJson.determination).vat_bucket),
    taxableAmount:
      asNumber(taxJson.taxable_amount_uyu)
      ?? asNumber(taxJson.taxableAmountUyu)
      ?? asNumber(facts.subtotal)
      ?? 0,
    taxAmount:
      asNumber(taxJson.tax_amount_uyu)
      ?? asNumber(taxJson.taxAmountUyu)
      ?? asNumber(facts.tax_amount)
      ?? 0,
    reviewFlags: [
      ...asStringArray(taxJson.warnings),
      ...asStringArray(taxJson.blockingReasons),
    ],
  };
}

async function loadDraftsForStatuses(
  supabase: SupabaseClient,
  organizationId: string,
  includeStatuses: DocumentPostingStatus[],
) {
  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, current_draft_id, posting_status, document_date")
    .eq("organization_id", organizationId)
    .in("posting_status", includeStatuses);

  if (documentsError) {
    throw new Error(documentsError.message);
  }

  const draftIds = (((documents as Array<{
    current_draft_id: string | null;
  }> | null) ?? []))
    .map((row) => row.current_draft_id)
    .filter((value): value is string => Boolean(value));

  if (draftIds.length === 0) {
    return [];
  }

  const { data: drafts, error: draftsError } = await supabase
    .from("document_drafts")
    .select("id, document_id, document_role, fields_json, tax_treatment_json")
    .in("id", draftIds);

  if (draftsError) {
    throw new Error(draftsError.message);
  }

  return (drafts as DraftPreviewRow[] | null) ?? [];
}

async function loadExcludedDocuments(
  supabase: SupabaseClient,
  organizationId: string,
  period: string,
  includeStatuses: DocumentPostingStatus[],
) {
  const periodStart = `${period}-01`;
  const periodEnd = `${period}-31`;
  const { data, error } = await supabase
    .from("documents")
    .select("id, posting_status, current_draft_id, document_date")
    .eq("organization_id", organizationId)
    .gte("document_date", periodStart)
    .lte("document_date", periodEnd);

  if (error) {
    throw new Error(error.message);
  }

  return (((data as Array<{
    id: string;
    posting_status: DocumentPostingStatus | null;
    current_draft_id: string | null;
    document_date: string | null;
  }> | null) ?? [])).flatMap((row) => {
    if (!row.document_date?.startsWith(period)) {
      return [];
    }

    if (!row.current_draft_id) {
      return [{
        documentId: row.id,
        reason: "No tiene draft actual listo para entrar en la simulacion.",
      }];
    }

    if (!row.posting_status || !includeStatuses.includes(row.posting_status)) {
      return [{
        documentId: row.id,
        reason: `Estado de posteo fuera del preview: ${row.posting_status ?? "sin_posting_status"}.`,
      }];
    }

    return [];
  });
}

async function loadLatestOfficialVatRun(
  supabase: SupabaseClient,
  organizationId: string,
  period: string,
) {
  const [year, month] = period.split("-").map((value) => Number.parseInt(value, 10));
  const { data: periodRow, error: periodError } = await supabase
    .from("tax_periods")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("tax_type", "VAT")
    .eq("period_year", year)
    .eq("period_month", month)
    .limit(1)
    .maybeSingle();

  if (periodError || !periodRow?.id) {
    return null;
  }

  const { data, error } = await supabase
    .from("vat_runs")
    .select("id, status, output_vat, input_vat_creditable, input_vat_non_deductible, import_vat, import_vat_advance, net_vat_payable")
    .eq("organization_id", organizationId)
    .eq("period_id", periodRow.id)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as OfficialVatRunRow | null) ?? null;
}

export async function buildVatRunPreview(input: {
  organizationId: string;
  year: number;
  month: number;
  includeStatuses?: DocumentPostingStatus[];
}) {
  const supabase = getSupabaseServiceRoleClient();
  const includeStatuses = input.includeStatuses ?? ["posted_provisional", "posted_final"];
  const period = `${input.year}-${String(input.month).padStart(2, "0")}`;
  const drafts = await loadDraftsForStatuses(supabase, input.organizationId, includeStatuses);
  const includedDocuments = drafts
    .map((draft) => buildPreviewSnapshot(draft))
    .filter((snapshot): snapshot is VatRunPreviewSnapshot => snapshot !== null)
    .filter((snapshot) => snapshot.documentDate.startsWith(period));
  const excludedDocuments = await loadExcludedDocuments(
    supabase,
    input.organizationId,
    period,
    includeStatuses,
  );
  const totals = includedDocuments.reduce(
    (accumulator, document) => {
      if (document.role === "sale") {
        accumulator.outputVat += document.taxAmount;
      }

      if (document.role === "purchase") {
        if (document.vatBucket === "input_non_deductible") {
          accumulator.inputVatNonDeductible += document.taxAmount;
        } else if (document.vatBucket === "input_creditable") {
          accumulator.inputVatCreditable += document.taxAmount;
        }
      }

      return accumulator;
    },
    {
      outputVat: 0,
      inputVatCreditable: 0,
      inputVatNonDeductible: 0,
    },
  );
  const officialRun = await loadLatestOfficialVatRun(supabase, input.organizationId, period);
  const netVatPayable = roundCurrency(
    totals.outputVat - totals.inputVatCreditable + totals.inputVatNonDeductible,
  );
  const warnings = [
    ...includedDocuments.flatMap((document) => document.reviewFlags),
    ...excludedDocuments.map((document) => document.reason),
  ];

  return {
    period,
    includeStatuses,
    totals: {
      outputVat: roundCurrency(totals.outputVat),
      inputVatCreditable: roundCurrency(totals.inputVatCreditable),
      inputVatNonDeductible: roundCurrency(totals.inputVatNonDeductible),
      netVatPayable,
    },
    includedDocuments,
    excludedDocuments,
    warnings: Array.from(new Set(warnings)),
    officialRunComparison: {
      runId: officialRun?.id ?? null,
      status: officialRun?.status ?? null,
      deltaOutputVat: roundCurrency((totals.outputVat ?? 0) - (officialRun?.output_vat ?? 0)),
      deltaInputVatCreditable: roundCurrency(
        (totals.inputVatCreditable ?? 0) - (officialRun?.input_vat_creditable ?? 0),
      ),
      deltaNetVatPayable: roundCurrency(netVatPayable - (officialRun?.net_vat_payable ?? 0)),
    },
    generatedAt: new Date().toISOString(),
  } satisfies VatRunPreview;
}
