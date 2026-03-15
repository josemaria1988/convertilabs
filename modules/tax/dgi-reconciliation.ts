import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMissingDocumentStep5ColumnError,
} from "@/modules/accounting/step5-schema-compat";
import { loadVatRunExportDataset } from "@/modules/exports/repository";
import type { VatRunExportDataset } from "@/modules/exports/types";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import {
  buildDgiReconciliationBucketComparisons,
  buildEmptyDgiBucketMap,
  dgiBucketDefinitions,
  summarizeDgiReconciliationDifferences,
  type DgiBucketComparison,
  type DgiReconciliationBucketCode,
} from "@/modules/tax/dgi-summary-normalizer";

type JsonRecord = Record<string, unknown>;

type DgiReconciliationRunRow = {
  id: string;
  period_year: number;
  period_month: number;
  source_kind: "manual_summary" | "imported_file" | "future_connector";
  status: "draft" | "computed" | "reviewed" | "closed";
  baseline_payload: JsonRecord | null;
  differences_payload: JsonRecord | null;
  metadata_json: JsonRecord | null;
  reviewed_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

type DgiReconciliationBucketRow = {
  id: string;
  run_id: string;
  bucket_code: DgiReconciliationBucketCode;
  dgi_net_amount_uyu: number;
  system_net_amount_uyu: number;
  dgi_tax_amount_uyu: number;
  system_tax_amount_uyu: number;
  delta_net_amount_uyu: number;
  delta_tax_amount_uyu: number;
  difference_status:
    | "matched"
    | "missing_in_system"
    | "extra_in_system"
    | "amount_mismatch"
    | "tax_treatment_mismatch"
    | "pending_manual_adjustment";
  notes: string | null;
  metadata_json: JsonRecord | null;
  created_at: string;
  updated_at: string;
};

export type DgiReconciliationRunSummary = {
  id: string;
  periodYear: number;
  periodMonth: number;
  periodLabel: string;
  sourceKind: DgiReconciliationRunRow["source_kind"];
  status: DgiReconciliationRunRow["status"];
  createdAt: string;
  reviewedAt: string | null;
  closedAt: string | null;
  summary: Record<string, number>;
  vatRunId: string | null;
};

export type DgiReconciliationRunDetail = DgiReconciliationRunSummary & {
  baseline: Record<DgiReconciliationBucketCode, { netAmountUyu: number; taxAmountUyu: number }>;
  buckets: Array<{
    id: string;
    bucketCode: DgiReconciliationBucketCode;
    label: string;
    dgiNetAmountUyu: number;
    systemNetAmountUyu: number;
    dgiTaxAmountUyu: number;
    systemTaxAmountUyu: number;
    deltaNetAmountUyu: number;
    deltaTaxAmountUyu: number;
    differenceStatus: DgiReconciliationBucketRow["difference_status"];
    notes: string | null;
    metadata: JsonRecord;
  }>;
  periodDocuments: Array<{
    id: string;
    originalFilename: string;
    documentDate: string | null;
    postingStatus: string | null;
  }>;
};

export type CreateDgiReconciliationRunInput = {
  organizationId: string;
  actorId: string | null;
  periodYear: number;
  periodMonth: number;
  sourceKind: "manual_summary" | "imported_file";
  baseline: Partial<Record<DgiReconciliationBucketCode, { netAmountUyu: number; taxAmountUyu: number }>>;
  metadata?: JsonRecord;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatPeriodLabel(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildEmptyBaseline() {
  const empty = buildEmptyDgiBucketMap();

  return Object.fromEntries(
    Object.entries(empty).map(([code, bucket]) => [
      code,
      {
        netAmountUyu: bucket.netAmountUyu,
        taxAmountUyu: bucket.taxAmountUyu,
      },
    ]),
  ) as Record<DgiReconciliationBucketCode, { netAmountUyu: number; taxAmountUyu: number }>;
}

function parseRatePercent(value: string | null | undefined) {
  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.replace("%", "").replace(",", ".").trim();
  const numeric = Number(normalized);

  return Number.isFinite(numeric) ? numeric : 0;
}

function inferPurchaseRatePercent(row: VatRunExportDataset["purchases"][number]) {
  if (row.taxableBase > 0 && row.vat > 0) {
    return Math.round((row.vat / row.taxableBase) * 100);
  }

  return 0;
}

export function buildSystemDgiBucketMapFromVatDataset(dataset: VatRunExportDataset) {
  const buckets = buildEmptyDgiBucketMap();

  for (const row of dataset.sales) {
    const rate = parseRatePercent(row.rate);

    if (rate >= 18) {
      buckets.sales_basic.netAmountUyu += row.taxableBase;
      buckets.sales_basic.taxAmountUyu += row.vat;
      buckets.sales_basic.treatmentKey = "sale_basic";
      continue;
    }

    if (rate > 0) {
      buckets.sales_minimum.netAmountUyu += row.taxableBase;
      buckets.sales_minimum.taxAmountUyu += row.vat;
      buckets.sales_minimum.treatmentKey = "sale_minimum";
      continue;
    }

    buckets.exempt_or_non_taxed.netAmountUyu += row.taxableBase;
    buckets.exempt_or_non_taxed.taxAmountUyu += row.vat;
    buckets.exempt_or_non_taxed.treatmentKey = "sale_exempt";
  }

  for (const row of dataset.purchases) {
    const rate = inferPurchaseRatePercent(row);

    if (rate >= 18) {
      buckets.purchase_basic.netAmountUyu += row.taxableBase;
      buckets.purchase_basic.taxAmountUyu += row.vat;
      buckets.purchase_basic.treatmentKey = row.deductibilityStatus;
      continue;
    }

    if (rate > 0) {
      buckets.purchase_minimum.netAmountUyu += row.taxableBase;
      buckets.purchase_minimum.taxAmountUyu += row.vat;
      buckets.purchase_minimum.treatmentKey = row.deductibilityStatus;
      continue;
    }

    buckets.exempt_or_non_taxed.netAmountUyu += row.taxableBase;
    buckets.exempt_or_non_taxed.taxAmountUyu += row.vat;
    buckets.exempt_or_non_taxed.treatmentKey = row.deductibilityStatus;
  }

  buckets.import_vat.taxAmountUyu += dataset.totals.importVat ?? 0;
  buckets.import_vat.treatmentKey = "import_vat";
  buckets.import_vat_advance.taxAmountUyu += dataset.totals.importVatAdvance ?? 0;
  buckets.import_vat_advance.treatmentKey = "import_vat_advance";

  return buckets;
}

async function loadVatRunIdForPeriod(
  supabase: SupabaseClient,
  organizationId: string,
  periodYear: number,
  periodMonth: number,
) {
  const { data: periodRow, error: periodError } = await supabase
    .from("tax_periods")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("tax_type", "vat")
    .eq("period_year", periodYear)
    .eq("period_month", periodMonth)
    .limit(1)
    .maybeSingle();

  if (periodError) {
    throw new Error(periodError.message);
  }

  if (!periodRow?.id) {
    return null;
  }

  const { data: runRow, error: runError } = await supabase
    .from("vat_runs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("period_id", periodRow.id as string)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError) {
    throw new Error(runError.message);
  }

  return typeof runRow?.id === "string" ? runRow.id : null;
}

async function loadPeriodDocuments(
  supabase: SupabaseClient,
  organizationId: string,
  periodYear: number,
  periodMonth: number,
) {
  const startDate = `${periodYear}-${String(periodMonth).padStart(2, "0")}-01`;
  const nextMonth = periodMonth === 12
    ? `${periodYear + 1}-01-01`
    : `${periodYear}-${String(periodMonth + 1).padStart(2, "0")}-01`;
  const primary = await supabase
    .from("documents")
    .select("id, original_filename, document_date, posting_status")
    .eq("organization_id", organizationId)
    .gte("document_date", startDate)
    .lt("document_date", nextMonth)
    .in("posting_status", ["posted_provisional", "posted_final"])
    .order("document_date", { ascending: false })
    .limit(12);
  let data = primary.data as unknown;
  let error = primary.error;

  if (error && isMissingDocumentStep5ColumnError(error)) {
    const legacy = await supabase
      .from("documents")
      .select("id, original_filename, document_date")
      .eq("organization_id", organizationId)
      .gte("document_date", startDate)
      .lt("document_date", nextMonth)
      .order("document_date", { ascending: false })
      .limit(12);
    data = legacy.data as unknown;
    error = legacy.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return (((data as Array<{
    id: string;
    original_filename: string;
    document_date: string | null;
    posting_status?: string | null;
  }> | null) ?? [])).map((row) => ({
    id: row.id,
    originalFilename: row.original_filename,
    documentDate: row.document_date,
    postingStatus: typeof row.posting_status === "string" ? row.posting_status : null,
  }));
}

export async function listOrganizationDgiReconciliationRuns(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 8,
) {
  const { data, error } = await supabase
    .from("dgi_reconciliation_runs")
    .select(
      "id, period_year, period_month, source_kind, status, baseline_payload, differences_payload, metadata_json, reviewed_at, closed_at, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingSupabaseRelationError(error, "dgi_reconciliation_runs")) {
      return [] satisfies DgiReconciliationRunSummary[];
    }

    throw new Error(error.message);
  }

  return (((data as DgiReconciliationRunRow[] | null) ?? [])).map((row) => {
    const differencesPayload = asRecord(row.differences_payload);
    const metadata = asRecord(row.metadata_json);

    return {
      id: row.id,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      periodLabel: formatPeriodLabel(row.period_year, row.period_month),
      sourceKind: row.source_kind,
      status: row.status,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      closedAt: row.closed_at,
      summary: asRecord(differencesPayload.summary) as Record<string, number>,
      vatRunId: asString(metadata.vat_run_id),
    } satisfies DgiReconciliationRunSummary;
  });
}

export async function loadDgiReconciliationRunDetail(
  supabase: SupabaseClient,
  organizationId: string,
  runId: string,
) {
  const runResult = await supabase
    .from("dgi_reconciliation_runs")
    .select(
      "id, period_year, period_month, source_kind, status, baseline_payload, differences_payload, metadata_json, reviewed_at, closed_at, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", runId)
    .limit(1)
    .maybeSingle();

  if (runResult.error) {
    if (isMissingSupabaseRelationError(runResult.error, "dgi_reconciliation_runs")) {
      return null;
    }

    throw new Error(runResult.error.message);
  }

  if (!runResult.data?.id) {
    return null;
  }

  const bucketResult = await supabase
    .from("dgi_reconciliation_buckets")
    .select(
      "id, run_id, bucket_code, dgi_net_amount_uyu, system_net_amount_uyu, dgi_tax_amount_uyu, system_tax_amount_uyu, delta_net_amount_uyu, delta_tax_amount_uyu, difference_status, notes, metadata_json, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("run_id", runId)
    .order("bucket_code", { ascending: true });

  if (bucketResult.error) {
    if (isMissingSupabaseRelationError(bucketResult.error, "dgi_reconciliation_buckets")) {
      return null;
    }

    throw new Error(bucketResult.error.message);
  }

  const run = runResult.data as DgiReconciliationRunRow;
  const bucketRows = ((bucketResult.data as DgiReconciliationBucketRow[] | null) ?? []);
  const baselinePayload = asRecord(run.baseline_payload);
  const baseline = buildEmptyBaseline();

  for (const definition of dgiBucketDefinitions) {
    const row = asRecord(baselinePayload[definition.code]);
    baseline[definition.code] = {
      netAmountUyu: asNumber(row.netAmountUyu),
      taxAmountUyu: asNumber(row.taxAmountUyu),
    };
  }

  return {
    id: run.id,
    periodYear: run.period_year,
    periodMonth: run.period_month,
    periodLabel: formatPeriodLabel(run.period_year, run.period_month),
    sourceKind: run.source_kind,
    status: run.status,
    createdAt: run.created_at,
    reviewedAt: run.reviewed_at,
    closedAt: run.closed_at,
    summary: asRecord(asRecord(run.differences_payload).summary) as Record<string, number>,
    vatRunId: asString(asRecord(run.metadata_json).vat_run_id),
    baseline,
    buckets: bucketRows.map((bucket) => ({
      id: bucket.id,
      bucketCode: bucket.bucket_code,
      label:
        dgiBucketDefinitions.find((entry) => entry.code === bucket.bucket_code)?.label
        ?? bucket.bucket_code,
      dgiNetAmountUyu: bucket.dgi_net_amount_uyu,
      systemNetAmountUyu: bucket.system_net_amount_uyu,
      dgiTaxAmountUyu: bucket.dgi_tax_amount_uyu,
      systemTaxAmountUyu: bucket.system_tax_amount_uyu,
      deltaNetAmountUyu: bucket.delta_net_amount_uyu,
      deltaTaxAmountUyu: bucket.delta_tax_amount_uyu,
      differenceStatus: bucket.difference_status,
      notes: bucket.notes,
      metadata: asRecord(bucket.metadata_json),
    })),
    periodDocuments: await loadPeriodDocuments(
      supabase,
      organizationId,
      run.period_year,
      run.period_month,
    ),
  } satisfies DgiReconciliationRunDetail;
}

export async function createDgiReconciliationRun(
  supabase: SupabaseClient,
  input: CreateDgiReconciliationRunInput,
) {
  const vatRunId = await loadVatRunIdForPeriod(
    supabase,
    input.organizationId,
    input.periodYear,
    input.periodMonth,
  );
  const dataset = vatRunId
    ? await loadVatRunExportDataset(supabase, input.organizationId, vatRunId)
    : null;
  const systemBuckets = dataset
    ? buildSystemDgiBucketMapFromVatDataset(dataset)
    : buildEmptyDgiBucketMap();
  const comparisons = buildDgiReconciliationBucketComparisons({
    baseline: input.baseline,
    system: systemBuckets,
  });
  const summary = summarizeDgiReconciliationDifferences(comparisons);
  const { data: runRow, error: runError } = await supabase
    .from("dgi_reconciliation_runs")
    .insert({
      organization_id: input.organizationId,
      period_year: input.periodYear,
      period_month: input.periodMonth,
      source_kind: input.sourceKind,
      status: "computed",
      baseline_payload: input.baseline,
      differences_payload: {
        summary,
      },
      metadata_json: {
        vat_run_id: vatRunId,
        source_type: input.sourceKind,
        system_document_count: dataset?.totals.documentCount ?? 0,
        warnings: dataset?.canonicalTaxPayload.warnings ?? [],
        ...(input.metadata ?? {}),
      },
      created_by: input.actorId,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .limit(1)
    .single();

  if (runError || !runRow?.id) {
    if (runError && isMissingSupabaseRelationError(runError, "dgi_reconciliation_runs")) {
      throw new Error("Falta la migracion Step 5 para conciliacion DGI.");
    }

    throw new Error(runError?.message ?? "No se pudo crear la corrida DGI.");
  }

  const { error: bucketError } = await supabase
    .from("dgi_reconciliation_buckets")
    .insert(comparisons.map((bucket) => ({
      organization_id: input.organizationId,
      run_id: runRow.id as string,
      bucket_code: bucket.bucketCode,
      dgi_net_amount_uyu: bucket.dgiNetAmountUyu,
      system_net_amount_uyu: bucket.systemNetAmountUyu,
      dgi_tax_amount_uyu: bucket.dgiTaxAmountUyu,
      system_tax_amount_uyu: bucket.systemTaxAmountUyu,
      delta_net_amount_uyu: bucket.deltaNetAmountUyu,
      delta_tax_amount_uyu: bucket.deltaTaxAmountUyu,
      difference_status: bucket.differenceStatus,
      metadata_json: bucket.metadata,
    })));

  if (bucketError) {
    if (isMissingSupabaseRelationError(bucketError, "dgi_reconciliation_buckets")) {
      throw new Error("Falta la migracion Step 5 para buckets de conciliacion DGI.");
    }

    throw new Error(bucketError.message);
  }

  return {
    runId: runRow.id as string,
    vatRunId,
    summary,
  };
}

export async function updateDgiReconciliationBucket(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    runId: string;
    bucketId: string;
    note: string | null;
    action: "justify" | "mark_external_adjustment";
  },
) {
  const { data: bucketRow, error: bucketError } = await supabase
    .from("dgi_reconciliation_buckets")
    .select("id, difference_status, notes, metadata_json")
    .eq("organization_id", input.organizationId)
    .eq("run_id", input.runId)
    .eq("id", input.bucketId)
    .limit(1)
    .maybeSingle();

  if (bucketError || !bucketRow?.id) {
    throw new Error(bucketError?.message ?? "Bucket DGI no encontrado.");
  }

  const nextStatus = input.action === "mark_external_adjustment"
    ? "pending_manual_adjustment"
    : bucketRow.difference_status;
  const nextMetadata = {
    ...asRecord(bucketRow.metadata_json),
    reviewed_manually: true,
    last_review_action: input.action,
  };
  const { error: updateError } = await supabase
    .from("dgi_reconciliation_buckets")
    .update({
      difference_status: nextStatus,
      notes: input.note,
      metadata_json: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bucketId)
    .eq("organization_id", input.organizationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await supabase
    .from("dgi_reconciliation_runs")
    .update({
      status: "reviewed",
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.runId)
    .eq("organization_id", input.organizationId);

  return {
    ok: true,
    nextStatus,
  };
}

export async function closeDgiReconciliationRun(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    runId: string;
  },
) {
  const { error } = await supabase
    .from("dgi_reconciliation_runs")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.runId);

  if (error) {
    throw new Error(error.message);
  }
}
