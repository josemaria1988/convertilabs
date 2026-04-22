import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import type { DocumentPostingStatus } from "@/modules/accounting";
import {
  loadVatPeriodUniverse,
  selectVatUniverseDocumentsForPreview,
  type VatPeriodUniverseDocument,
} from "@/modules/tax/vat-period-universe";

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
  display: {
    counterpartyName: string | null;
    issuerName: string | null;
    receiverName: string | null;
    documentNumber: string | null;
    documentType: string | null;
    currencyCode: string | null;
    totalAmount: number;
  };
  journalEntryId: string | null;
  journalEntryNumber: number | null;
  vatBucket: string | null;
  taxableAmount: number;
  taxAmount: number;
  reviewFlags: string[];
};

export type VatRunDrilldownItem = {
  documentId: string;
  draftId: string | null;
  role: "purchase" | "sale" | "other";
  documentDate: string | null;
  display: VatRunPreviewSnapshot["display"];
  journalEntryId: string | null;
  journalEntryNumber: number | null;
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
    draftId: string | null;
    role: "purchase" | "sale" | "other";
    documentDate: string | null;
    display: VatRunPreviewSnapshot["display"];
    journalEntryId: string | null;
    journalEntryNumber: number | null;
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

async function loadLatestJournalEntriesByDocument(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentIds: string[];
  },
) {
  if (input.documentIds.length === 0) {
    return new Map<string, { journalEntryId: string; entryNumber: number | null }>();
  }

  const { data, error } = await supabase
    .from("v_journal_entries_read")
    .select("source_document_id, journal_entry_id, entry_number, entry_date, status, is_active_leaf")
    .eq("organization_id", input.organizationId)
    .in("source_document_id", input.documentIds)
    .in("status", ["posted", "exported"])
    .order("is_active_leaf", { ascending: false })
    .order("entry_date", { ascending: false })
    .order("entry_number", { ascending: false })
    .limit(1000);

  if (error) {
    if (isMissingSupabaseRelationError(error, "v_journal_entries_read")) {
      return new Map<string, { journalEntryId: string; entryNumber: number | null }>();
    }

    throw new Error(error.message);
  }

  const rows = (data as Array<{
    source_document_id: string | null;
    journal_entry_id: string;
    entry_number: number | null;
  }> | null) ?? [];
  const result = new Map<string, { journalEntryId: string; entryNumber: number | null }>();

  for (const row of rows) {
    if (!row.source_document_id || result.has(row.source_document_id)) {
      continue;
    }

    result.set(row.source_document_id, {
      journalEntryId: row.journal_entry_id,
      entryNumber: row.entry_number,
    });
  }

  return result;
}

function buildDrilldownBase(
  document: VatPeriodUniverseDocument,
  journalEntryByDocumentId: Map<string, { journalEntryId: string; entryNumber: number | null }>,
): VatRunDrilldownItem {
  const journalEntry = journalEntryByDocumentId.get(document.documentId);

  return {
    documentId: document.documentId,
    draftId: document.draftId,
    role: document.role,
    documentDate: document.documentDate,
    display: document.display,
    journalEntryId: journalEntry?.journalEntryId ?? null,
    journalEntryNumber: journalEntry?.entryNumber ?? null,
  };
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
  const includeStatuses = input.includeStatuses ?? ["vat_ready", "posted_provisional", "posted_final"];
  const period = `${input.year}-${String(input.month).padStart(2, "0")}`;
  const universe = await loadVatPeriodUniverse(supabase, {
    organizationId: input.organizationId,
    period,
  });
  const previewSelection = selectVatUniverseDocumentsForPreview(universe);
  const universeDocumentById = new Map(
    universe.documents.map((document) => [document.documentId, document]),
  );
  const selectedDocumentIds = Array.from(new Set([
    ...previewSelection.includedDocuments.map((document) => document.documentId),
    ...previewSelection.excludedDocuments.map((document) => document.documentId),
  ]));
  const journalEntryByDocumentId = await loadLatestJournalEntriesByDocument(supabase, {
    organizationId: input.organizationId,
    documentIds: selectedDocumentIds,
  });
  const includedDocuments = previewSelection.includedDocuments
    .filter((document) =>
      document.postingStatus !== null
      && includeStatuses.includes(document.postingStatus),
    )
    .map((document) => {
      const drilldown = buildDrilldownBase(document, journalEntryByDocumentId);

      return {
        ...drilldown,
        draftId: drilldown.draftId ?? `missing-draft-${document.documentId}`,
        documentDate: drilldown.documentDate ?? period,
        vatBucket: document.vatBucket,
        taxableAmount: document.taxableAmountUyu,
        taxAmount: document.taxAmountUyu,
        reviewFlags: document.reviewFlags,
      } satisfies VatRunPreviewSnapshot;
    });
  const excludedDocuments = previewSelection.excludedDocuments.map((document) => {
    const universeDocument = universeDocumentById.get(document.documentId);

    return {
      ...(universeDocument
        ? buildDrilldownBase(universeDocument, journalEntryByDocumentId)
        : {
            documentId: document.documentId,
            draftId: null,
            role: "other" as const,
            documentDate: null,
            display: {
              counterpartyName: null,
              issuerName: null,
              receiverName: null,
              documentNumber: null,
              documentType: null,
              currencyCode: null,
              totalAmount: 0,
            },
            journalEntryId: null,
            journalEntryNumber: null,
          }),
      reason: document.reason,
    };
  });
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
