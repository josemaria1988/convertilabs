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
  journal_suggestion_json: JsonRecord | null;
};

type TaxPeriodRow = {
  id: string;
  period_year: number;
  period_month: number | null;
  start_date: string;
  end_date: string;
  status: string;
};

type VatRunRow = {
  id: string;
  period_id: string;
  version_no: number;
  status: string;
  import_vat?: number | null;
  import_vat_advance?: number | null;
  result_json: JsonRecord | null;
};

export type VatRunStatus =
  | "draft"
  | "needs_review"
  | "reviewed"
  | "finalized"
  | "locked";

export type VatDocumentSnapshot = {
  documentId: string;
  draftId: string;
  role: "purchase" | "sale" | "other";
  documentDate: string;
  vatBucket: string | null;
  taxableAmount: number;
  taxAmount: number;
  reviewFlags: string[];
};

export type OrganizationVatRun = {
  id: string;
  periodId: string;
  periodLabel: string;
  status: VatRunStatus;
  outputVat: number;
  inputVatCreditable: number;
  inputVatNonDeductible: number;
  importVat: number;
  importVatAdvance: number;
  netVatPayable: number;
  createdAt: string;
  reviewFlagsCount: number;
  tracedDocuments: VatDocumentSnapshot[];
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
    warnings: asStringArray(taxJson.warnings),
    blockingReasons: asStringArray(taxJson.blockingReasons),
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
    reviewFlags: [...taxSnapshot.warnings, ...taxSnapshot.blockingReasons],
  };
}

function mapVatRunStatusToTaxPeriodStatus(status: VatRunStatus) {
  switch (status) {
    case "draft":
      return "open";
    case "needs_review":
    case "reviewed":
      return "review";
    case "finalized":
      return "closed";
    case "locked":
      return "locked";
  }
}

async function recordAuditEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    entityId: string;
    action: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await supabase
    .from("audit_log")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorId,
      entity_type: "vat_run",
      entity_id: input.entityId,
      action: input.action,
      metadata: input.metadata ?? {},
    });

  if (error) {
    throw new Error(error.message);
  }
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
    .select("id, period_year, period_month, start_date, end_date, status")
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
    .select("id, document_id, document_role, fields_json, tax_treatment_json, journal_suggestion_json")
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
    .select("id, period_id, version_no, status, result_json")
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

async function loadApprovedImportOperationTaxSummary(
  supabase: SupabaseClient,
  organizationId: string,
  periodDate: string,
) {
  const periodKey = periodDate.slice(0, 7);
  const { data: operations, error: operationsError } = await supabase
    .from("organization_import_operations")
    .select("id, operation_date, payment_date, status")
    .eq("organization_id", organizationId)
    .eq("status", "approved");

  if (operationsError) {
    throw new Error(operationsError.message);
  }

  const relevantOperationIds = (((operations as Array<{
    id: string;
    operation_date: string | null;
    payment_date: string | null;
    status: string;
  }> | null) ?? []))
    .filter((row) =>
      row.operation_date?.startsWith(periodKey)
      || row.payment_date?.startsWith(periodKey))
    .map((row) => row.id);

  if (relevantOperationIds.length === 0) {
    return {
      importVat: 0,
      importVatAdvance: 0,
      otherTaxesCount: 0,
      operationIds: [],
    };
  }

  const { data: taxes, error: taxesError } = await supabase
    .from("organization_import_operation_taxes")
    .select("import_operation_id, amount, is_creditable_vat, is_vat_advance, is_other_tax")
    .eq("organization_id", organizationId)
    .in("import_operation_id", relevantOperationIds);

  if (taxesError) {
    throw new Error(taxesError.message);
  }

  return (((taxes as Array<{
    import_operation_id: string;
    amount: number;
    is_creditable_vat: boolean;
    is_vat_advance: boolean;
    is_other_tax: boolean;
  }> | null) ?? [])).reduce(
    (accumulator, tax) => {
      if (tax.is_creditable_vat) {
        accumulator.importVat += tax.amount;
      }

      if (tax.is_vat_advance) {
        accumulator.importVatAdvance += tax.amount;
      }

      if (tax.is_other_tax) {
        accumulator.otherTaxesCount += 1;
      }

      if (!accumulator.operationIds.includes(tax.import_operation_id)) {
        accumulator.operationIds.push(tax.import_operation_id);
      }

      return accumulator;
    },
    {
      importVat: 0,
      importVatAdvance: 0,
      otherTaxesCount: 0,
      operationIds: [] as string[],
    },
  );
}

async function updateTaxPeriodStatus(
  supabase: SupabaseClient,
  periodId: string,
  status: VatRunStatus,
) {
  const { error } = await supabase
    .from("tax_periods")
    .update({
      status: mapVatRunStatusToTaxPeriodStatus(status),
      updated_at: new Date().toISOString(),
    })
    .eq("id", periodId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function assertVatPeriodMutableForDocument(
  supabase: SupabaseClient,
  organizationId: string,
  documentDate: string,
) {
  const year = Number.parseInt(documentDate.slice(0, 4), 10);
  const month = Number.parseInt(documentDate.slice(5, 7), 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return;
  }

  const period = await ensureVatPeriod(supabase, organizationId, year, month);
  const existingRun = await loadLatestVatRun(supabase, organizationId, period.id);

  if (existingRun?.status === "finalized" || existingRun?.status === "locked") {
    throw new Error(
      `El periodo IVA ${year}-${String(month).padStart(2, "0")} esta ${existingRun.status} y debe reabrirse antes de mutar documentos.`,
    );
  }
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
  const existingRun = await loadLatestVatRun(supabase, organizationId, period.id);

  if (existingRun?.status === "finalized" || existingRun?.status === "locked") {
    throw new Error("No se puede recalcular un periodo IVA finalizado o locked sin reapertura.");
  }

  const drafts = await loadLatestConfirmedDrafts(supabase, organizationId);
  const importSummary = await loadApprovedImportOperationTaxSummary(
    supabase,
    organizationId,
    periodDate,
  );
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

      accumulator.reviewFlagsCount += snapshot.reviewFlags.length;
      return accumulator;
    },
    {
      outputVat: 0,
      inputVatCreditable: 0,
      inputVatNonDeductible: 0,
      reviewFlagsCount: 0,
    },
  );

  const outputVat = roundCurrency(totals.outputVat);
  const inputVatCreditable = roundCurrency(totals.inputVatCreditable);
  const inputVatNonDeductible = roundCurrency(totals.inputVatNonDeductible);
  const importVat = roundCurrency(importSummary.importVat);
  const importVatAdvance = roundCurrency(importSummary.importVatAdvance);
  const netVatPayable = roundCurrency(
    outputVat
    - inputVatCreditable
    - importVat
    - importVatAdvance
    + inputVatNonDeductible,
  );
  const nextStatus: VatRunStatus =
    totals.reviewFlagsCount > 0
      ? "needs_review"
      : existingRun?.status === "reviewed"
        ? "reviewed"
        : "draft";
  const payload = {
    organization_id: organizationId,
    period_id: period.id,
    status: nextStatus,
      input_snapshot_json: {
        documents: relevantSnapshots,
        import_operations: importSummary.operationIds,
        generated_at: new Date().toISOString(),
      },
      result_json: {
        formula: "output_vat - input_vat_creditable - import_vat - import_vat_advance + input_vat_non_deductible",
        period: `${year}-${String(month).padStart(2, "0")}`,
        totals: {
          output_vat: outputVat,
          input_vat_creditable: inputVatCreditable,
          input_vat_non_deductible: inputVatNonDeductible,
          import_vat: importVat,
          import_vat_advance: importVatAdvance,
          net_vat_payable: netVatPayable,
        },
        documents_included_count: relevantSnapshots.length,
        import_operations_included_count: importSummary.operationIds.length,
        import_other_taxes_count: importSummary.otherTaxesCount,
        review_flags_count: totals.reviewFlagsCount,
      },
      output_vat: outputVat,
      input_vat_creditable: inputVatCreditable,
      input_vat_non_deductible: inputVatNonDeductible,
      import_vat: importVat,
      import_vat_advance: importVatAdvance,
      adjustments: 0,
      net_vat_payable: netVatPayable,
    created_by: requestedBy,
    updated_at: new Date().toISOString(),
  };

  let runId: string;

  if (existingRun) {
    const { error } = await supabase
      .from("vat_runs")
      .update(payload)
      .eq("id", existingRun.id);

    if (error) {
      throw new Error(error.message);
    }

    runId = existingRun.id;
  } else {
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

    runId = data.id as string;
  }

  await updateTaxPeriodStatus(supabase, period.id, nextStatus);
  return runId;
}

export async function updateVatRunLifecycle(input: {
  supabase: SupabaseClient;
  organizationId: string;
  runId: string;
  actorId: string | null;
  action: "review" | "finalize" | "lock" | "reopen";
  reason?: string | null;
}) {
  const { data, error } = await input.supabase
    .from("vat_runs")
    .select("id, period_id, status, result_json")
    .eq("organization_id", input.organizationId)
    .eq("id", input.runId)
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "VAT run no encontrado.");
  }

  const current = data as VatRunRow;
  let nextStatus: VatRunStatus;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  switch (input.action) {
    case "review":
      nextStatus = "reviewed";
      patch.reviewed_by = input.actorId;
      patch.reviewed_at = new Date().toISOString();
      break;
    case "finalize":
      nextStatus = "finalized";
      patch.finalized_by = input.actorId;
      patch.finalized_at = new Date().toISOString();
      break;
    case "lock":
      nextStatus = "locked";
      patch.locked_by = input.actorId;
      patch.locked_at = new Date().toISOString();
      break;
    case "reopen":
      if (!input.reason?.trim()) {
        throw new Error("Reabrir un periodo IVA requiere motivo.");
      }

      nextStatus = "draft";
      patch.reopened_by = input.actorId;
      patch.reopened_at = new Date().toISOString();
      break;
  }

  const { error: updateError } = await input.supabase
    .from("vat_runs")
    .update({
      ...patch,
      status: nextStatus,
    })
    .eq("id", input.runId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await updateTaxPeriodStatus(input.supabase, current.period_id, nextStatus);
  await recordAuditEvent(input.supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    entityId: input.runId,
    action: `vat_run:${input.action}`,
    metadata: input.reason?.trim()
      ? {
          reason: input.reason.trim(),
        }
      : {},
  });

  return nextStatus;
}

type VatRunListRow = {
  id: string;
  period_id: string;
  status: VatRunStatus;
  output_vat: number;
  input_vat_creditable: number;
  input_vat_non_deductible: number;
  import_vat?: number | null;
  import_vat_advance?: number | null;
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

export async function loadOrganizationVatRuns(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("vat_runs")
    .select(
      "id, period_id, status, output_vat, input_vat_creditable, input_vat_non_deductible, import_vat, import_vat_advance, net_vat_payable, result_json, input_snapshot_json, created_at, period:tax_periods!vat_runs_period_id_fkey(period_year, period_month, start_date, end_date)",
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
    const resultJson = asRecord(row.result_json);
    const tracedDocuments = Array.isArray(snapshot.documents)
      ? snapshot.documents.filter((item): item is VatDocumentSnapshot => {
          const candidate = asRecord(item);
          return typeof candidate.documentId === "string" && typeof candidate.draftId === "string";
        })
      : [];

    return {
      id: row.id,
      periodId: row.period_id,
      periodLabel: period
        ? `${period.period_year}-${String(period.period_month ?? 0).padStart(2, "0")}`
        : "Sin periodo",
      status: row.status,
      outputVat: row.output_vat,
      inputVatCreditable: row.input_vat_creditable,
      inputVatNonDeductible: row.input_vat_non_deductible,
      importVat:
        typeof row.import_vat === "number"
          ? row.import_vat
          : typeof asRecord(row.result_json).totals === "object"
            ? asNumber(asRecord(asRecord(row.result_json).totals).import_vat) ?? 0
            : 0,
      importVatAdvance:
        typeof row.import_vat_advance === "number"
          ? row.import_vat_advance
          : typeof asRecord(row.result_json).totals === "object"
            ? asNumber(asRecord(asRecord(row.result_json).totals).import_vat_advance) ?? 0
            : 0,
      netVatPayable: row.net_vat_payable,
      createdAt: row.created_at,
      reviewFlagsCount:
        typeof resultJson.review_flags_count === "number"
          ? resultJson.review_flags_count
          : tracedDocuments.reduce((sum, document) => sum + document.reviewFlags.length, 0),
      tracedDocuments,
    } satisfies OrganizationVatRun;
  });
}
