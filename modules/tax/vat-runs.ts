import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

type ConfirmationRow = {
  document_id: string;
  draft_id: string;
  confirmed_at: string;
};

type ConfirmedDraftRow = {
  id: string;
  document_id: string;
  document_role: "purchase" | "sale" | "other";
  fields_json: JsonRecord | null;
  tax_treatment_json: JsonRecord | null;
};

type TaxPeriodRow = {
  id: string;
};

type VatRunRow = {
  id: string;
  version_no: number;
};

type VatDocumentSnapshot = {
  documentId: string;
  draftId: string;
  role: "purchase" | "sale" | "other";
  documentDate: string;
  vatBucket: string | null;
  taxableAmount: number;
  taxAmount: number;
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getDraftFacts(fieldsJson: JsonRecord | null) {
  const fields = asRecord(fieldsJson);
  return asRecord(fields.facts);
}

function getDraftDate(draft: ConfirmedDraftRow) {
  const facts = getDraftFacts(draft.fields_json);
  return asString(facts.document_date);
}

function getTaxSnapshot(draft: ConfirmedDraftRow) {
  const taxJson = asRecord(draft.tax_treatment_json);

  return {
    vatBucket:
      asString(taxJson.vat_bucket)
      ?? asString(taxJson.vatBucket)
      ?? asString(taxJson.result_bucket)
      ?? asString(asRecord(taxJson.determination).vat_bucket),
    taxableAmount:
      asNumber(taxJson.taxable_amount)
      ?? asNumber(taxJson.taxableAmount)
      ?? asNumber(asRecord(taxJson.determination).taxable_amount)
      ?? asNumber(getDraftFacts(draft.fields_json).subtotal)
      ?? 0,
    taxAmount:
      asNumber(taxJson.tax_amount)
      ?? asNumber(taxJson.taxAmount)
      ?? asNumber(asRecord(taxJson.determination).tax_amount)
      ?? asNumber(getDraftFacts(draft.fields_json).tax_amount)
      ?? 0,
  };
}

function toPeriodMonthKey(documentDate: string) {
  return documentDate.slice(0, 7);
}

function buildVatDocumentSnapshot(draft: ConfirmedDraftRow): VatDocumentSnapshot | null {
  const documentDate = getDraftDate(draft);

  if (!documentDate) {
    return null;
  }

  const taxSnapshot = getTaxSnapshot(draft);

  return {
    documentId: draft.document_id,
    draftId: draft.id,
    role: draft.document_role,
    documentDate,
    vatBucket: taxSnapshot.vatBucket,
    taxableAmount: roundCurrency(taxSnapshot.taxableAmount),
    taxAmount: roundCurrency(taxSnapshot.taxAmount),
  };
}

async function ensureVatPeriod(
  supabase: SupabaseClient,
  organizationId: string,
  year: number,
  month: number,
) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("tax_periods")
    .upsert(
      {
        organization_id: organizationId,
        tax_type: "VAT",
        period_year: year,
        period_month: month,
        start_date: startDate,
        end_date: endDate,
        status: "open",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_id,tax_type,period_year,period_month",
      },
    )
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo asegurar el periodo IVA.");
  }

  return data as TaxPeriodRow;
}

async function loadLatestConfirmedDrafts(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data: confirmations, error: confirmationsError } = await supabase
    .from("document_confirmations")
    .select("document_id, draft_id, confirmed_at")
    .eq("organization_id", organizationId)
    .order("confirmed_at", { ascending: false });

  if (confirmationsError) {
    throw new Error(confirmationsError.message);
  }

  const latestConfirmationByDocument = new Map<string, ConfirmationRow>();

  for (const row of ((confirmations as ConfirmationRow[] | null) ?? [])) {
    if (!latestConfirmationByDocument.has(row.document_id)) {
      latestConfirmationByDocument.set(row.document_id, row);
    }
  }

  const draftIds = Array.from(latestConfirmationByDocument.values()).map((row) => row.draft_id);

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

  return (drafts as ConfirmedDraftRow[] | null) ?? [];
}

async function loadLatestVatRun(
  supabase: SupabaseClient,
  organizationId: string,
  periodId: string,
) {
  const { data, error } = await supabase
    .from("vat_runs")
    .select("id, version_no")
    .eq("organization_id", organizationId)
    .eq("period_id", periodId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as VatRunRow | null) ?? null;
}

export async function rebuildMonthlyVatRunFromConfirmations(
  supabase: SupabaseClient,
  organizationId: string,
  periodDate: string,
  requestedBy: string | null,
) {
  const year = Number.parseInt(periodDate.slice(0, 4), 10);
  const month = Number.parseInt(periodDate.slice(5, 7), 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error("La fecha del documento no es valida para reconstruir IVA mensual.");
  }

  const period = await ensureVatPeriod(supabase, organizationId, year, month);
  const drafts = await loadLatestConfirmedDrafts(supabase, organizationId);
  const relevantSnapshots = drafts
    .map((draft) => buildVatDocumentSnapshot(draft))
    .filter((snapshot): snapshot is VatDocumentSnapshot => snapshot !== null)
    .filter((snapshot) => toPeriodMonthKey(snapshot.documentDate) === periodDate.slice(0, 7));

  const totals = relevantSnapshots.reduce(
    (accumulator, snapshot) => {
      if (snapshot.role === "sale") {
        accumulator.outputVat += snapshot.taxAmount;
      }

      if (snapshot.role === "purchase") {
        if (snapshot.vatBucket === "input_non_deductible") {
          accumulator.inputVatNonDeductible += snapshot.taxAmount;
        } else if (snapshot.vatBucket === "input_creditable") {
          accumulator.inputVatCreditable += snapshot.taxAmount;
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

  const outputVat = roundCurrency(totals.outputVat);
  const inputVatCreditable = roundCurrency(totals.inputVatCreditable);
  const inputVatNonDeductible = roundCurrency(totals.inputVatNonDeductible);
  const netVatPayable = roundCurrency(
    outputVat - inputVatCreditable + inputVatNonDeductible,
  );
  const existingRun = await loadLatestVatRun(supabase, organizationId, period.id);
  const payload = {
    organization_id: organizationId,
    period_id: period.id,
    status: "draft",
    input_snapshot_json: {
      documents: relevantSnapshots,
      generated_at: new Date().toISOString(),
    },
    result_json: {
      formula: "output_vat - input_vat_creditable + input_vat_non_deductible",
      period: `${year}-${String(month).padStart(2, "0")}`,
      totals: {
        output_vat: outputVat,
        input_vat_creditable: inputVatCreditable,
        input_vat_non_deductible: inputVatNonDeductible,
        net_vat_payable: netVatPayable,
      },
    },
    output_vat: outputVat,
    input_vat_creditable: inputVatCreditable,
    input_vat_non_deductible: inputVatNonDeductible,
    adjustments: 0,
    net_vat_payable: netVatPayable,
    created_by: requestedBy,
  };

  if (existingRun) {
    const { error } = await supabase
      .from("vat_runs")
      .update(payload)
      .eq("id", existingRun.id);

    if (error) {
      throw new Error(error.message);
    }

    return existingRun.id;
  }

  const { data, error } = await supabase
    .from("vat_runs")
    .insert({
      ...payload,
      version_no: 1,
    })
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo crear el VAT run mensual.");
  }

  return data.id as string;
}

type VatRunListRow = {
  id: string;
  status: string;
  output_vat: number;
  input_vat_creditable: number;
  input_vat_non_deductible: number;
  net_vat_payable: number;
  result_json: JsonRecord | null;
  input_snapshot_json: JsonRecord | null;
  created_at: string;
  period: {
    period_year: number;
    period_month: number | null;
    start_date: string;
    end_date: string;
  } | {
    period_year: number;
    period_month: number | null;
    start_date: string;
    end_date: string;
  }[] | null;
};

export type OrganizationVatRun = {
  id: string;
  periodLabel: string;
  status: string;
  outputVat: number;
  inputVatCreditable: number;
  inputVatNonDeductible: number;
  netVatPayable: number;
  createdAt: string;
  tracedDocuments: VatDocumentSnapshot[];
};

export async function loadOrganizationVatRuns(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("vat_runs")
    .select(
      "id, status, output_vat, input_vat_creditable, input_vat_non_deductible, net_vat_payable, result_json, input_snapshot_json, created_at, period:tax_periods!vat_runs_period_id_fkey(period_year, period_month, start_date, end_date)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(error.message);
  }

  return (((data as VatRunListRow[] | null) ?? [])).map((row) => {
    const period = Array.isArray(row.period) ? row.period[0] : row.period;
    const snapshot = asRecord(row.input_snapshot_json);
    const tracedDocuments = Array.isArray(snapshot.documents)
      ? snapshot.documents.filter((item): item is VatDocumentSnapshot => {
          const candidate = asRecord(item);
          return typeof candidate.documentId === "string" && typeof candidate.draftId === "string";
        })
      : [];

    return {
      id: row.id,
      periodLabel: period
        ? `${period.period_year}-${String(period.period_month ?? 0).padStart(2, "0")}`
        : "Sin periodo",
      status: row.status,
      outputVat: row.output_vat,
      inputVatCreditable: row.input_vat_creditable,
      inputVatNonDeductible: row.input_vat_non_deductible,
      netVatPayable: row.net_vat_payable,
      createdAt: row.created_at,
      tracedDocuments,
    } satisfies OrganizationVatRun;
  });
}
