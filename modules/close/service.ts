import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import {
  buildAccountingMonthRange,
  compareAccountingMonthKeysDesc,
} from "@/modules/accounting/periods";
import {
  computeKernelHash,
  stableSerialize,
} from "@/modules/accounting/kernel";
import {
  getFiscalPeriodDocumentMutationErrorMessage,
  isFiscalPeriodLockedForPosting,
  isFiscalPeriodMutableForDocument,
  normalizeFiscalPeriodStatus,
  type CanonicalFiscalPeriodStatus,
  type FiscalPeriodStatus,
} from "@/modules/accounting/fiscal-period-status";
import { listOrganizationDgiReconciliationRuns } from "@/modules/tax/dgi-reconciliation";
import { loadOrganizationVatRuns } from "@/modules/tax/vat-runs";

type JsonRecord = Record<string, unknown>;

type FiscalPeriodRow = {
  id: string;
  organization_id: string;
  code: string;
  label: string;
  starts_on: string;
  ends_on: string;
  status: FiscalPeriodStatus;
  is_current: boolean | null;
  closed_at: string | null;
  locked_at: string | null;
  reopened_at: string | null;
  status_changed_at?: string | null;
  status_changed_by?: string | null;
  metadata: JsonRecord | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CloseCheckRunRow = {
  id: string;
  organization_id: string;
  fiscal_period_id: string;
  run_kind: string;
  status: string;
  triggered_by_profile_id: string | null;
  input_hash: string | null;
  summary_json: JsonRecord | null;
  snapshot_json: JsonRecord | null;
  created_at: string;
};

type CloseCheckResultRow = {
  close_check_run_id: string;
  check_code: string;
  family: string;
  severity: string;
  status: string;
  message: string;
  metric_value: number | null;
  metadata_json: JsonRecord | null;
};

type FiscalPeriodTransitionLogRow = {
  id: string;
  fiscal_period_id: string;
  from_status: string | null;
  to_status: string;
  reason_code: string | null;
  reason_comment: string | null;
  created_at: string;
};

type DocumentSummaryRow = {
  status: string | null;
  posting_status: string | null;
  created_at: string | null;
};

type JournalSummaryRow = {
  status: string | null;
  immutable_at: string | null;
  functional_total_debit: number | null;
  functional_total_credit: number | null;
};

type OpenItemSummaryRow = {
  open_item_id: string;
};

export type CloseCheckStatus =
  | "pass"
  | "warning"
  | "blocker"
  | "waived";

export type CloseCheckResult = {
  code: string;
  label: string;
  family: "documents" | "accounting" | "tax" | "operations";
  severity: "info" | "warning" | "blocker";
  status: CloseCheckStatus;
  message: string;
  metricValue: number | null;
  metadata: JsonRecord;
};

export type CloseValidatorSnapshot = {
  period: {
    id: string;
    code: string;
    label: string;
    startsOn: string;
    endsOn: string;
    status: FiscalPeriodStatus;
    normalizedStatus: CanonicalFiscalPeriodStatus;
  };
  documents: {
    totalCount: number;
    pendingCount: number;
    provisionalCount: number;
    lateCount: number;
  };
  journal: {
    totalCount: number;
    unfinalizedCount: number;
    immutableCount: number;
    functionalDebit: number;
    functionalCredit: number;
    imbalance: number;
  };
  tax: {
    vatStatus: string | null;
    dgiStatus: string | null;
  };
  operations: {
    outstandingOpenItemsCount: number;
  };
};

export type CloseCheckRunSummary = {
  id: string | null;
  status: "pass" | "warning" | "blocker";
  blockerCount: number;
  warningCount: number;
  passCount: number;
  createdAt: string | null;
  snapshotHash: string;
  snapshot: CloseValidatorSnapshot;
  results: CloseCheckResult[];
};

export type CloseWorkspacePeriod = {
  id: string;
  code: string;
  label: string;
  startsOn: string;
  endsOn: string;
  status: FiscalPeriodStatus;
  normalizedStatus: CanonicalFiscalPeriodStatus;
  isCurrent: boolean;
  closedAt: string | null;
  lockedAt: string | null;
  reopenedAt: string | null;
};

export type FiscalPeriodTransitionOption = {
  nextStatus: CanonicalFiscalPeriodStatus;
  enabled: boolean;
  reason: string | null;
};

export type CloseWorkspaceData = {
  isAvailable: boolean;
  periods: CloseWorkspacePeriod[];
  selectedPeriod: CloseWorkspacePeriod | null;
  preview: CloseCheckRunSummary | null;
  latestCheckRun: CloseCheckRunSummary | null;
  transitionOptions: FiscalPeriodTransitionOption[];
  hardCloseReady: boolean;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function roundAmount(value: number | null | undefined) {
  const normalized = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.round(normalized * 100) / 100;
}

function sortResults(results: CloseCheckResult[]) {
  const rank: Record<CloseCheckStatus, number> = {
    blocker: 0,
    warning: 1,
    waived: 2,
    pass: 3,
  };

  return [...results].sort((left, right) =>
    rank[left.status] - rank[right.status]
    || left.family.localeCompare(right.family)
    || left.label.localeCompare(right.label));
}

function getCloseCheckLabel(code: string) {
  switch (code) {
    case "documents_ready_for_close":
      return "Documentos listos para cierre";
    case "documents_posted_provisional":
      return "Postings provisionales resueltos";
    case "journal_entries_finalized":
      return "Asientos finalizados";
    case "trial_balance_balanced":
      return "Trial balance balanceado";
    case "vat_run_closed":
      return "IVA del periodo finalizado";
    case "dgi_reconciliation_closed":
      return "Conciliacion DGI cerrada";
    case "late_documents_review":
      return "Documentos cargados fuera de ventana";
    case "open_items_supported":
      return "Open items del corte entendidos";
    default:
      return code
        .split("_")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
  }
}

function summarizeCloseCheckResults(
  snapshot: CloseValidatorSnapshot,
  results: CloseCheckResult[],
  persistedId: string | null,
  createdAt: string | null,
): CloseCheckRunSummary {
  const sortedResults = sortResults(results);
  const blockerCount = sortedResults.filter((result) => result.status === "blocker").length;
  const warningCount = sortedResults.filter((result) => result.status === "warning").length;
  const passCount = sortedResults.filter((result) => result.status === "pass").length;

  return {
    id: persistedId,
    status:
      blockerCount > 0
        ? "blocker"
        : warningCount > 0
          ? "warning"
          : "pass",
    blockerCount,
    warningCount,
    passCount,
    createdAt,
    snapshotHash: computeKernelHash(snapshot),
    snapshot,
    results: sortedResults,
  };
}

function buildResult(input: {
  code: string;
  label: string;
  family: CloseCheckResult["family"];
  status: CloseCheckStatus;
  message: string;
  metricValue?: number | null;
  metadata?: JsonRecord;
}) {
  return {
    code: input.code,
    label: input.label,
    family: input.family,
    severity:
      input.status === "blocker"
        ? "blocker"
        : input.status === "warning"
          ? "warning"
          : "info",
    status: input.status,
    message: input.message,
    metricValue: input.metricValue ?? null,
    metadata: input.metadata ?? {},
  } satisfies CloseCheckResult;
}

export function buildCloseCheckResults(
  snapshot: CloseValidatorSnapshot,
) {
  const results: CloseCheckResult[] = [];

  results.push(
    snapshot.documents.pendingCount > 0
      ? buildResult({
          code: "documents_ready_for_close",
          label: "Documentos listos para cierre",
          family: "documents",
          status: "blocker",
          message: `${snapshot.documents.pendingCount} documento(s) del periodo siguen sin confirmacion final o fuera del workflow de cierre.`,
          metricValue: snapshot.documents.pendingCount,
          metadata: {
            total_documents: snapshot.documents.totalCount,
          },
        })
      : buildResult({
          code: "documents_ready_for_close",
          label: "Documentos listos para cierre",
          family: "documents",
          status: "pass",
          message: "No hay documentos del periodo pendientes de confirmacion final.",
          metricValue: snapshot.documents.totalCount,
        }),
  );

  results.push(
    snapshot.documents.provisionalCount > 0
      ? buildResult({
          code: "documents_posted_provisional",
          label: "Postings provisionales resueltos",
          family: "documents",
          status: "warning",
          message: `${snapshot.documents.provisionalCount} documento(s) siguen en posted_provisional y requieren confirmacion o reapertura explicita.`,
          metricValue: snapshot.documents.provisionalCount,
        })
      : buildResult({
          code: "documents_posted_provisional",
          label: "Postings provisionales resueltos",
          family: "documents",
          status: "pass",
          message: "No hay postings documentales provisionales pendientes en el periodo.",
        }),
  );

  results.push(
    snapshot.journal.unfinalizedCount > 0
      ? buildResult({
          code: "journal_entries_finalized",
          label: "Asientos finalizados",
          family: "accounting",
          status: "blocker",
          message: `${snapshot.journal.unfinalizedCount} asiento(s) del periodo siguen en draft o sin immutable_at.`,
          metricValue: snapshot.journal.unfinalizedCount,
        })
      : buildResult({
          code: "journal_entries_finalized",
          label: "Asientos finalizados",
          family: "accounting",
          status: "pass",
          message: "Todos los asientos del periodo estan finalizados e inmutables.",
          metricValue: snapshot.journal.immutableCount,
        }),
  );

  results.push(
    Math.abs(snapshot.journal.imbalance) > 0.01
      ? buildResult({
          code: "trial_balance_balanced",
          label: "Trial balance balanceado",
          family: "accounting",
          status: "blocker",
          message: `El set visible del periodo no balancea. Diferencia funcional detectada: ${snapshot.journal.imbalance.toFixed(2)}.`,
          metricValue: snapshot.journal.imbalance,
          metadata: {
            functional_debit: snapshot.journal.functionalDebit,
            functional_credit: snapshot.journal.functionalCredit,
          },
        })
      : buildResult({
          code: "trial_balance_balanced",
          label: "Trial balance balanceado",
          family: "accounting",
          status: "pass",
          message: "Los totales funcionales del periodo balancean.",
          metricValue: snapshot.journal.functionalDebit,
        }),
  );

  const vatClosed = snapshot.tax.vatStatus === "finalized" || snapshot.tax.vatStatus === "locked";
  results.push(
    vatClosed
      ? buildResult({
          code: "vat_run_closed",
          label: "IVA del periodo finalizado",
          family: "tax",
          status: "pass",
          message: `El periodo IVA asociado esta ${snapshot.tax.vatStatus}.`,
        })
      : buildResult({
          code: "vat_run_closed",
          label: "IVA del periodo finalizado",
          family: "tax",
          status: snapshot.documents.totalCount > 0 ? "blocker" : "warning",
          message:
            snapshot.documents.totalCount > 0
              ? "No existe un VAT run finalized/locked para el periodo y hay documentos con impacto fiscal potencial."
              : "No hay VAT run finalized/locked para el periodo. Revisa si el mes requiere liquidacion.",
        }),
  );

  results.push(
    snapshot.tax.dgiStatus === "closed"
      ? buildResult({
          code: "dgi_reconciliation_closed",
          label: "Conciliacion DGI cerrada",
          family: "tax",
          status: "pass",
          message: "Existe una conciliacion DGI cerrada para el periodo.",
        })
      : buildResult({
          code: "dgi_reconciliation_closed",
          label: "Conciliacion DGI cerrada",
          family: "tax",
          status: "warning",
          message: "No hay una conciliacion DGI cerrada para el periodo o sigue en borrador/revision.",
        }),
  );

  results.push(
    snapshot.documents.lateCount > 0
      ? buildResult({
          code: "late_documents_review",
          label: "Documentos cargados fuera de ventana",
          family: "operations",
          status: "warning",
          message: `${snapshot.documents.lateCount} documento(s) del periodo fueron cargados despues del cierre calendario del mes y conviene revisarlos.`,
          metricValue: snapshot.documents.lateCount,
        })
      : buildResult({
          code: "late_documents_review",
          label: "Documentos cargados fuera de ventana",
          family: "operations",
          status: "pass",
          message: "No se detectaron documentos cargados fuera de la ventana calendario del mes.",
        }),
  );

  results.push(
    snapshot.operations.outstandingOpenItemsCount > 0
      ? buildResult({
          code: "open_items_supported",
          label: "Open items del corte entendidos",
          family: "operations",
          status: "warning",
          message: `${snapshot.operations.outstandingOpenItemsCount} open item(s) siguen abiertos al momento del chequeo. Prepara aging o soporte del corte antes de cerrar.`,
          metricValue: snapshot.operations.outstandingOpenItemsCount,
        })
      : buildResult({
          code: "open_items_supported",
          label: "Open items del corte entendidos",
          family: "operations",
          status: "pass",
          message: "No hay open items abiertos visibles para el corte actual.",
        }),
  );

  return sortResults(results);
}

function mapFiscalPeriod(row: FiscalPeriodRow): CloseWorkspacePeriod {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
    normalizedStatus: normalizeFiscalPeriodStatus(row.status),
    isCurrent: row.is_current === true,
    closedAt: row.closed_at,
    lockedAt: row.locked_at,
    reopenedAt: row.reopened_at,
  };
}

async function listOrganizationFiscalPeriods(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("fiscal_periods")
    .select(
      "id, organization_id, code, label, starts_on, ends_on, status, is_current, closed_at, locked_at, reopened_at, status_changed_at, status_changed_by, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("starts_on", { ascending: false })
    .limit(24);

  if (error && isMissingSupabaseRelationError(error, "fiscal_periods")) {
    return [] satisfies CloseWorkspacePeriod[];
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data as FiscalPeriodRow[] | null) ?? []).map(mapFiscalPeriod);
}

async function loadFiscalPeriodById(
  supabase: SupabaseClient,
  organizationId: string,
  fiscalPeriodId: string,
) {
  const { data, error } = await supabase
    .from("fiscal_periods")
    .select(
      "id, organization_id, code, label, starts_on, ends_on, status, is_current, closed_at, locked_at, reopened_at, status_changed_at, status_changed_by, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", fiscalPeriodId)
    .limit(1)
    .maybeSingle();

  if (error && isMissingSupabaseRelationError(error, "fiscal_periods")) {
    return null;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapFiscalPeriod(data as FiscalPeriodRow) : null;
}

async function loadDocumentSnapshot(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    period: CloseWorkspacePeriod;
  },
) {
  const { data, error } = await supabase
    .from("documents")
    .select("status, posting_status, created_at")
    .eq("organization_id", input.organizationId)
    .gte("document_date", input.period.startsOn)
    .lte("document_date", input.period.endsOn)
    .limit(2000);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as DocumentSummaryRow[] | null) ?? [];

  return rows.reduce(
    (summary, row) => {
      const status = asString(row.status);
      const postingStatus = asString(row.posting_status);
      const createdAt = asString(row.created_at);

      summary.totalCount += 1;

      if (
        !["posted_final", "locked"].includes(postingStatus ?? "")
        && !["duplicate", "rejected", "archived"].includes(status ?? "")
      ) {
        summary.pendingCount += 1;
      }

      if (postingStatus === "posted_provisional") {
        summary.provisionalCount += 1;
      }

      if (createdAt && createdAt.slice(0, 10) > input.period.endsOn) {
        summary.lateCount += 1;
      }

      return summary;
    },
    {
      totalCount: 0,
      pendingCount: 0,
      provisionalCount: 0,
      lateCount: 0,
    },
  );
}

async function loadJournalSnapshot(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    period: CloseWorkspacePeriod;
  },
) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("status, immutable_at, functional_total_debit, functional_total_credit")
    .eq("organization_id", input.organizationId)
    .gte("entry_date", input.period.startsOn)
    .lte("entry_date", input.period.endsOn)
    .limit(4000);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as JournalSummaryRow[] | null) ?? [];

  return rows.reduce(
    (summary, row) => {
      summary.totalCount += 1;

      const immutable = Boolean(asString(row.immutable_at));
      const status = asString(row.status);
      const functionalDebit = roundAmount(row.functional_total_debit);
      const functionalCredit = roundAmount(row.functional_total_credit);

      if (immutable && (status === "posted" || status === "exported")) {
        summary.immutableCount += 1;
        summary.functionalDebit = roundAmount(summary.functionalDebit + functionalDebit);
        summary.functionalCredit = roundAmount(summary.functionalCredit + functionalCredit);
      } else {
        summary.unfinalizedCount += 1;
      }

      return summary;
    },
    {
      totalCount: 0,
      unfinalizedCount: 0,
      immutableCount: 0,
      functionalDebit: 0,
      functionalCredit: 0,
      imbalance: 0,
    },
  );
}

async function loadOpenItemsSnapshot(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    period: CloseWorkspacePeriod;
  },
) {
  const { data, error } = await supabase
    .from("v_open_items_outstanding")
    .select("open_item_id")
    .eq("organization_id", input.organizationId)
    .lte("issue_date", input.period.endsOn)
    .limit(1000);

  if (error && isMissingSupabaseRelationError(error, "v_open_items_outstanding")) {
    return {
      outstandingOpenItemsCount: 0,
    };
  }

  if (error) {
    throw new Error(error.message);
  }

  return {
    outstandingOpenItemsCount: ((data as OpenItemSummaryRow[] | null) ?? []).length,
  };
}

async function loadTaxSnapshot(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    period: CloseWorkspacePeriod;
  },
) {
  const [vatRuns, dgiRuns] = await Promise.all([
    loadOrganizationVatRuns(supabase, input.organizationId),
    listOrganizationDgiReconciliationRuns(supabase, input.organizationId, 24),
  ]);

  const vatRun = vatRuns.find((run) => run.periodLabel === input.period.code) ?? null;
  const dgiRun = dgiRuns.find((run) => run.periodLabel === input.period.code) ?? null;

  return {
    vatStatus: vatRun?.status ?? null,
    dgiStatus: dgiRun?.status ?? null,
  };
}

async function loadCloseValidatorSnapshot(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    period: CloseWorkspacePeriod;
  },
) {
  const [documents, journalBase, tax, operations] = await Promise.all([
    loadDocumentSnapshot(supabase, input),
    loadJournalSnapshot(supabase, input),
    loadTaxSnapshot(supabase, input),
    loadOpenItemsSnapshot(supabase, input),
  ]);
  const journal = {
    ...journalBase,
    imbalance: roundAmount(journalBase.functionalDebit - journalBase.functionalCredit),
  };

  return {
    period: {
      id: input.period.id,
      code: input.period.code,
      label: input.period.label,
      startsOn: input.period.startsOn,
      endsOn: input.period.endsOn,
      status: input.period.status,
      normalizedStatus: input.period.normalizedStatus,
    },
    documents,
    journal,
    tax,
    operations,
  } satisfies CloseValidatorSnapshot;
}

async function persistCloseCheckRun(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    fiscalPeriodId: string;
    actorId: string | null;
    snapshot: CloseValidatorSnapshot;
    results: CloseCheckResult[];
    runKind?: string;
  },
) {
  const summary = summarizeCloseCheckResults(input.snapshot, input.results, null, null);
  const createdAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("close_check_runs")
    .insert({
      organization_id: input.organizationId,
      fiscal_period_id: input.fiscalPeriodId,
      run_kind: input.runKind ?? "manual",
      status: summary.status,
      triggered_by_profile_id: input.actorId,
      input_hash: computeKernelHash({
        fiscal_period_id: input.fiscalPeriodId,
        snapshot: input.snapshot,
      }),
      summary_json: {
        blocker_count: summary.blockerCount,
        warning_count: summary.warningCount,
        pass_count: summary.passCount,
        snapshot_hash: summary.snapshotHash,
      },
      snapshot_json: JSON.parse(stableSerialize(input.snapshot)),
      created_at: createdAt,
    })
    .select("id")
    .limit(1)
    .single();

  if (error && isMissingSupabaseRelationError(error, "close_check_runs")) {
    return summary;
  }

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo persistir el close check run.");
  }

  const runId = data.id as string;
  const { error: resultsError } = await supabase
    .from("close_check_results")
    .insert(
      input.results.map((result) => ({
        close_check_run_id: runId,
        check_code: result.code,
        family: result.family,
        severity: result.severity,
        status: result.status,
        message: result.message,
        metric_value: result.metricValue,
        metadata_json: result.metadata,
      })),
    );

  if (resultsError && !isMissingSupabaseRelationError(resultsError, "close_check_results")) {
    throw new Error(resultsError.message);
  }

  return summarizeCloseCheckResults(input.snapshot, input.results, runId, createdAt);
}

async function loadCloseCheckResults(
  supabase: SupabaseClient,
  closeCheckRunId: string,
) {
  const { data, error } = await supabase
    .from("close_check_results")
    .select(
      "close_check_run_id, check_code, family, severity, status, message, metric_value, metadata_json",
    )
    .eq("close_check_run_id", closeCheckRunId);

  if (error && isMissingSupabaseRelationError(error, "close_check_results")) {
    return [] satisfies CloseCheckResult[];
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data as CloseCheckResultRow[] | null) ?? []).map((row) => ({
    code: row.check_code,
    label: getCloseCheckLabel(row.check_code),
    family: row.family as CloseCheckResult["family"],
    severity: row.severity as CloseCheckResult["severity"],
    status: row.status as CloseCheckStatus,
    message: row.message,
    metricValue: typeof row.metric_value === "number" ? row.metric_value : null,
    metadata: asRecord(row.metadata_json),
  }));
}

export async function loadLatestCloseCheckRun(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    fiscalPeriodId: string;
  },
) {
  const { data, error } = await supabase
    .from("close_check_runs")
    .select(
      "id, organization_id, fiscal_period_id, run_kind, status, triggered_by_profile_id, input_hash, summary_json, snapshot_json, created_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("fiscal_period_id", input.fiscalPeriodId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && isMissingSupabaseRelationError(error, "close_check_runs")) {
    return null;
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    return null;
  }

  const row = data as CloseCheckRunRow;
  const snapshot = asRecord(row.snapshot_json) as unknown as CloseValidatorSnapshot;
  const persistedResults = await loadCloseCheckResults(supabase, row.id);
  const summaryJson = asRecord(row.summary_json);

  if (persistedResults.length > 0) {
    return {
      id: row.id,
      status: (asString(row.status) as "pass" | "warning" | "blocker") ?? "warning",
      blockerCount:
        typeof summaryJson.blocker_count === "number"
          ? summaryJson.blocker_count
          : persistedResults.filter((result) => result.status === "blocker").length,
      warningCount:
        typeof summaryJson.warning_count === "number"
          ? summaryJson.warning_count
          : persistedResults.filter((result) => result.status === "warning").length,
      passCount:
        typeof summaryJson.pass_count === "number"
          ? summaryJson.pass_count
          : persistedResults.filter((result) => result.status === "pass").length,
      createdAt: row.created_at,
      snapshotHash:
        asString(summaryJson.snapshot_hash)
        ?? computeKernelHash(snapshot),
      snapshot,
      results: sortResults(persistedResults),
    } satisfies CloseCheckRunSummary;
  }

  const fallbackResults = buildCloseCheckResults(snapshot);
  return summarizeCloseCheckResults(snapshot, fallbackResults, row.id, row.created_at);
}

export async function runCloseValidator(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    fiscalPeriodId: string;
    actorId: string | null;
    runKind?: string;
  },
) {
  const period = await loadFiscalPeriodById(supabase, input.organizationId, input.fiscalPeriodId);

  if (!period) {
    throw new Error("No encontramos el periodo contable solicitado.");
  }

  const snapshot = await loadCloseValidatorSnapshot(supabase, {
    organizationId: input.organizationId,
    period,
  });
  const results = buildCloseCheckResults(snapshot);

  return persistCloseCheckRun(supabase, {
    organizationId: input.organizationId,
    fiscalPeriodId: input.fiscalPeriodId,
    actorId: input.actorId,
    snapshot,
    results,
    runKind: input.runKind,
  });
}

function buildTransitionMatrix(input: {
  supportsHardClose: boolean;
}) {
  return {
    open: ["ready_to_close"],
    ready_to_close: ["open", "soft_closed"],
    soft_closed: ["open", "tax_locked"],
    tax_locked: input.supportsHardClose ? ["open", "hard_closed"] : ["open"],
    hard_closed: input.supportsHardClose ? ["audit_frozen"] : [],
    audit_frozen: [],
  } satisfies Record<CanonicalFiscalPeriodStatus, CanonicalFiscalPeriodStatus[]>;
}

export function canTransitionFiscalPeriodStatus(input: {
  fromStatus: string | null | undefined;
  toStatus: CanonicalFiscalPeriodStatus;
  supportsHardClose: boolean;
}) {
  const fromStatus = normalizeFiscalPeriodStatus(input.fromStatus);

  if (
    !input.supportsHardClose
    && (input.toStatus === "hard_closed" || input.toStatus === "audit_frozen")
  ) {
    return {
      ok: false,
      reason: "Hard close real y audit freeze quedan reservados hasta la fase de close snapshots.",
    };
  }

  if (fromStatus === input.toStatus) {
    return {
      ok: false,
      reason: "El periodo ya se encuentra en ese estado.",
    };
  }

  const allowed = buildTransitionMatrix({
    supportsHardClose: input.supportsHardClose,
  });
  const allowedTargets = allowed[fromStatus] as CanonicalFiscalPeriodStatus[];

  if (!allowedTargets.includes(input.toStatus)) {
    return {
      ok: false,
      reason: `La transicion ${fromStatus} -> ${input.toStatus} no esta habilitada por la politica actual.`,
    };
  }

  return {
    ok: true,
    reason: null,
  };
}

function buildTransitionOptions(
  currentStatus: string | null | undefined,
  supportsHardClose: boolean,
) {
  return [
    "open",
    "ready_to_close",
    "soft_closed",
    "tax_locked",
    "hard_closed",
    "audit_frozen",
  ].map((nextStatus) => {
    const guard = canTransitionFiscalPeriodStatus({
      fromStatus: currentStatus,
      toStatus: nextStatus as CanonicalFiscalPeriodStatus,
      supportsHardClose,
    });

    return {
      nextStatus: nextStatus as CanonicalFiscalPeriodStatus,
      enabled: guard.ok,
      reason: guard.reason,
    } satisfies FiscalPeriodTransitionOption;
  });
}

async function recordAuditEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    entityType: string;
    entityId: string | null;
    action: string;
    beforeJson?: JsonRecord | null;
    afterJson?: JsonRecord | null;
    metadata?: JsonRecord;
  },
) {
  const { error } = await supabase
    .from("audit_log")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      before_json: input.beforeJson ?? null,
      after_json: input.afterJson ?? null,
      metadata: input.metadata ?? {},
    });

  if (error && isMissingSupabaseRelationError(error, "audit_log")) {
    return;
  }

  if (error) {
    throw new Error(error.message);
  }
}

export async function transitionFiscalPeriodStatus(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    fiscalPeriodId: string;
    actorId: string | null;
    nextStatus: CanonicalFiscalPeriodStatus;
    reasonCode?: string | null;
    reasonComment?: string | null;
  },
) {
  const period = await loadFiscalPeriodById(supabase, input.organizationId, input.fiscalPeriodId);

  if (!period) {
    throw new Error("No encontramos el periodo contable solicitado.");
  }

  const supportsHardClose = false;
  const guard = canTransitionFiscalPeriodStatus({
    fromStatus: period.status,
    toStatus: input.nextStatus,
    supportsHardClose,
  });

  if (!guard.ok) {
    throw new Error(guard.reason ?? "La transicion no esta habilitada.");
  }

  let validatorRunId: string | null = null;

  if (input.nextStatus === "soft_closed" || input.nextStatus === "tax_locked") {
    const checkRun = await runCloseValidator(supabase, {
      organizationId: input.organizationId,
      fiscalPeriodId: input.fiscalPeriodId,
      actorId: input.actorId,
      runKind: "transition_gate",
    });
    validatorRunId = checkRun.id;

    if (checkRun.blockerCount > 0) {
      throw new Error("El periodo todavia tiene blockers y no puede avanzar de estado.");
    }

    if (
      input.nextStatus === "tax_locked"
      && checkRun.results.some((result) =>
        result.code === "vat_run_closed" && result.status !== "pass")
    ) {
      throw new Error("No se puede pasar a tax_locked sin un VAT run finalized o locked.");
    }
  }

  const previous = {
    status: period.status,
    normalized_status: period.normalizedStatus,
    closed_at: period.closedAt,
    locked_at: period.lockedAt,
    reopened_at: period.reopenedAt,
  };
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.nextStatus,
    status_changed_at: now,
    status_changed_by: input.actorId,
    updated_at: now,
  };

  if (input.nextStatus === "open") {
    patch.closed_at = null;
    patch.locked_at = null;
    patch.reopened_at = now;
  }

  if (input.nextStatus === "ready_to_close") {
    patch.closed_at = null;
    patch.locked_at = null;
  }

  if (input.nextStatus === "soft_closed") {
    patch.closed_at = now;
    patch.locked_at = null;
  }

  if (input.nextStatus === "tax_locked") {
    patch.closed_at = period.closedAt ?? now;
    patch.locked_at = now;
  }

  const { error } = await supabase
    .from("fiscal_periods")
    .update(patch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.fiscalPeriodId);

  if (error) {
    throw new Error(error.message);
  }

  const { data: transitionData, error: transitionError } = await supabase
    .from("fiscal_period_transition_logs")
    .insert({
      organization_id: input.organizationId,
      fiscal_period_id: input.fiscalPeriodId,
      from_status: period.status,
      to_status: input.nextStatus,
      changed_by_profile_id: input.actorId,
      reason_code: input.reasonCode ?? null,
      reason_comment: input.reasonComment ?? null,
      validator_run_id: validatorRunId,
      metadata_json: {
        previous_normalized_status: period.normalizedStatus,
      },
    })
    .select("id, fiscal_period_id, from_status, to_status, reason_code, reason_comment, created_at")
    .limit(1)
    .maybeSingle();

  if (transitionError && !isMissingSupabaseRelationError(transitionError, "fiscal_period_transition_logs")) {
    throw new Error(transitionError.message);
  }

  await recordAuditEvent(supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    entityType: "fiscal_period",
    entityId: input.fiscalPeriodId,
    action: `transition:${period.normalizedStatus}->${input.nextStatus}`,
    beforeJson: previous,
    afterJson: {
      ...previous,
      status: input.nextStatus,
      normalized_status: input.nextStatus,
      closed_at: patch.closed_at ?? previous.closed_at,
      locked_at: patch.locked_at ?? previous.locked_at,
      reopened_at: patch.reopened_at ?? previous.reopened_at,
    },
    metadata: {
      reason_code: input.reasonCode ?? null,
      reason_comment: input.reasonComment ?? null,
      validator_run_id: validatorRunId,
    },
  });

  return {
    ok: true,
    transition: transitionData as FiscalPeriodTransitionLogRow | null,
  };
}

export async function assertFiscalPeriodAllowsDocumentMutation(
  supabase: SupabaseClient,
  organizationId: string,
  documentDate: string,
) {
  const periodRange = buildAccountingMonthRange(documentDate);

  if (!periodRange) {
    return;
  }

  const { data, error } = await supabase
    .from("fiscal_periods")
    .select("id, code, status, locked_at")
    .eq("organization_id", organizationId)
    .eq("starts_on", periodRange.startDate)
    .eq("ends_on", periodRange.endDate)
    .limit(1)
    .maybeSingle();

  if (error && isMissingSupabaseRelationError(error, "fiscal_periods")) {
    return;
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return;
  }

  const status = asString(data.status);
  const lockedAt = asString(data.locked_at);

  if (
    isFiscalPeriodLockedForPosting({
      status,
      lockedAt,
    })
    || !isFiscalPeriodMutableForDocument(status)
  ) {
    throw new Error(
      getFiscalPeriodDocumentMutationErrorMessage(
        status,
        asString(data.code) ?? periodRange.code,
      ),
    );
  }
}

export async function loadCloseWorkspaceData(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    fiscalPeriodCode?: string | null;
  },
): Promise<CloseWorkspaceData> {
  const periods = (await listOrganizationFiscalPeriods(supabase, input.organizationId))
    .sort((left, right) =>
      right.startsOn.localeCompare(left.startsOn)
      || compareAccountingMonthKeysDesc(left.code, right.code));

  if (periods.length === 0) {
    return {
      isAvailable: false,
      periods: [],
      selectedPeriod: null,
      preview: null,
      latestCheckRun: null,
      transitionOptions: [],
      hardCloseReady: false,
    };
  }

  const selectedPeriod =
    periods.find((period) => period.code === input.fiscalPeriodCode)
    ?? periods[0]
    ?? null;

  if (!selectedPeriod) {
    return {
      isAvailable: false,
      periods,
      selectedPeriod: null,
      preview: null,
      latestCheckRun: null,
      transitionOptions: [],
      hardCloseReady: false,
    };
  }

  const snapshot = await loadCloseValidatorSnapshot(supabase, {
    organizationId: input.organizationId,
    period: selectedPeriod,
  });
  const previewResults = buildCloseCheckResults(snapshot);
  const preview = summarizeCloseCheckResults(snapshot, previewResults, null, null);
  const latestCheckRun = await loadLatestCloseCheckRun(supabase, {
    organizationId: input.organizationId,
    fiscalPeriodId: selectedPeriod.id,
  });
  const transitionOptions = buildTransitionOptions(selectedPeriod.status, false);

  return {
    isAvailable: true,
    periods,
    selectedPeriod,
    preview,
    latestCheckRun,
    transitionOptions,
    hardCloseReady: false,
  };
}
