import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { DocumentPostingStatus } from "@/modules/accounting";
import {
  loadVatPeriodUniverse,
  selectVatUniverseDocumentsForPreview,
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
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
  const includedDocuments = previewSelection.includedDocuments
    .filter((document) =>
      document.postingStatus !== null
      && includeStatuses.includes(document.postingStatus),
    )
    .map((document) => ({
      documentId: document.documentId,
      draftId: document.draftId ?? `missing-draft-${document.documentId}`,
      role: document.role,
      documentDate: document.documentDate ?? period,
      vatBucket: document.vatBucket,
      taxableAmount: document.taxableAmountUyu,
      taxAmount: document.taxAmountUyu,
      reviewFlags: document.reviewFlags,
    } satisfies VatRunPreviewSnapshot));
  const excludedDocuments = previewSelection.excludedDocuments.map((document) => ({
    documentId: document.documentId,
    reason: document.reason,
  }));
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
