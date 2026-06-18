import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { listAllOrganizationWorkspaceDocuments } from "@/modules/documents/review";
import {
  buildCompanyHomeDashboard,
  type CompanyHomeDashboard,
  type CompanyHomeDocumentSignal,
  type CompanyHomeMoneySignal,
  type CompanyHomeOperationsSignal,
  type CompanyHomePartySignal,
  type CompanyHomeTreasurySignal,
  type CompanyHomeWorkUnitSignal,
} from "@/modules/presentation/company-home";
import { loadOrganizationVatRuns } from "@/modules/tax/vat-runs";
import { loadTreasuryDashboard, treasuryMinorToDisplay } from "@/modules/treasury";

type WorkUnitHomeRow = {
  id: string;
  name: string | null;
  status: string | null;
  kind: string | null;
  actual_revenue: number | null;
  actual_cost: number | null;
  margin_status: string | null;
  updated_at: string | null;
};

type WorkUnitDocumentSummaryRow = {
  work_unit_id: string | null;
  direction: string | null;
  total_amount_uyu: number | null;
  document_total_amount_original: number | null;
};

type PartyHomeRow = {
  id: string;
  display_name: string | null;
  legal_name: string | null;
  status: string | null;
  source: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type OpenItemHomeRow = {
  open_item_id: string;
  counterparty_name: string | null;
  document_role: string | null;
  due_date: string | null;
  days_overdue: number | null;
  outstanding_amount: number | null;
  status: string | null;
  source_document_id: string | null;
};

type TaskHomeRow = {
  status: string | null;
  due_date: string | null;
};

type ProcessHomeRow = {
  criticality: string | null;
  future_owner_label: string | null;
  status: string | null;
};

type CaptureNoteHomeRow = {
  status: string | null;
};

type CloseHomeRow = {
  status: string | null;
  summary_json: Record<string, unknown> | null;
};

function asNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asUnknownNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mapWorkUnitRow(
  row: WorkUnitHomeRow,
  documentAmountsByWorkUnitId: Map<string, { revenue: number; cost: number }> = new Map(),
): CompanyHomeWorkUnitSignal {
  const documentAmounts = documentAmountsByWorkUnitId.get(row.id);
  const actualRevenue = asNumber(row.actual_revenue);
  const actualCost = asNumber(row.actual_cost);

  return {
    id: row.id,
    name: row.name ?? "Trabajo sin nombre",
    status: row.status ?? "planned",
    kind: row.kind ?? "job",
    actualRevenue: documentAmounts && documentAmounts.revenue > 0
      ? documentAmounts.revenue
      : actualRevenue,
    actualCost: documentAmounts && documentAmounts.cost > 0
      ? documentAmounts.cost
      : actualCost,
    marginStatus: row.margin_status,
    updatedAt: row.updated_at,
  };
}

function mapPartyRow(row: PartyHomeRow): CompanyHomePartySignal {
  return {
    id: row.id,
    displayName: row.display_name ?? row.legal_name ?? "Contraparte sin nombre",
    status: row.status,
    source: row.source,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function mapMoneyRow(row: OpenItemHomeRow): CompanyHomeMoneySignal {
  return {
    id: row.open_item_id,
    counterpartyName: row.counterparty_name,
    documentRole: row.document_role,
    dueDate: row.due_date,
    daysOverdue: asNumber(row.days_overdue),
    outstandingAmount: asNumber(row.outstanding_amount),
    status: row.status,
    sourceDocumentId: row.source_document_id,
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function loadWorkUnitSignals(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{
  isAvailable: boolean;
  totalCount: number;
  recent: CompanyHomeWorkUnitSignal[];
}> {
  const { data, count, error } = await supabase
    .from("work_units")
    .select(
      "id, name, status, kind, actual_revenue, actual_cost, margin_status, updated_at",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(8);

  if (error) {
    if (isMissingSupabaseRelationError(error, "work_units")) {
      return {
        isAvailable: false,
        totalCount: 0,
        recent: [],
      };
    }

    throw new Error(error.message);
  }

  const rows = (data as WorkUnitHomeRow[] | null) ?? [];
  const workUnitIds = rows.map((row) => row.id);
  const documentAmountsByWorkUnitId = new Map<string, { revenue: number; cost: number }>();

  if (workUnitIds.length > 0) {
    const { data: documentRows, error: documentError } = await supabase
      .from("documents")
      .select("work_unit_id, direction, total_amount_uyu, document_total_amount_original")
      .eq("organization_id", organizationId)
      .in("work_unit_id", workUnitIds)
      .limit(500);

    if (documentError && !isMissingSupabaseRelationError(documentError, "documents")) {
      throw new Error(documentError.message);
    }

    for (const document of ((documentRows as WorkUnitDocumentSummaryRow[] | null) ?? [])) {
      if (!document.work_unit_id) {
        continue;
      }

      const current = documentAmountsByWorkUnitId.get(document.work_unit_id) ?? {
        revenue: 0,
        cost: 0,
      };
      const amount = asNumber(document.total_amount_uyu)
        || asNumber(document.document_total_amount_original);

      if (document.direction === "sale") {
        current.revenue += amount;
      } else if (document.direction === "purchase") {
        current.cost += amount;
      }

      documentAmountsByWorkUnitId.set(document.work_unit_id, current);
    }
  }

  return {
    isAvailable: true,
    totalCount: count ?? data?.length ?? 0,
    recent: rows.map((row) => mapWorkUnitRow(row, documentAmountsByWorkUnitId)),
  };
}

async function loadPartySignals(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{
  isAvailable: boolean;
  totalCount: number;
  recent: CompanyHomePartySignal[];
}> {
  const { data, count, error } = await supabase
    .from("parties")
    .select("id, display_name, legal_name, status, source, updated_at, created_at", {
      count: "exact",
    })
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(8);

  if (error) {
    if (isMissingSupabaseRelationError(error, "parties")) {
      return {
        isAvailable: false,
        totalCount: 0,
        recent: [],
      };
    }

    throw new Error(error.message);
  }

  return {
    isAvailable: true,
    totalCount: count ?? data?.length ?? 0,
    recent: ((data as PartyHomeRow[] | null) ?? []).map(mapPartyRow),
  };
}

async function loadMoneySignals(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{
  isAvailable: boolean;
  totalCount: number;
  recent: CompanyHomeMoneySignal[];
}> {
  const { data, count, error } = await supabase
    .from("v_open_items_outstanding")
    .select(
      "open_item_id, counterparty_name, document_role, due_date, days_overdue, outstanding_amount, status, source_document_id",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error) {
    if (isMissingSupabaseRelationError(error, "v_open_items_outstanding")) {
      return {
        isAvailable: false,
        totalCount: 0,
        recent: [],
      };
    }

    throw new Error(error.message);
  }

  return {
    isAvailable: true,
    totalCount: count ?? data?.length ?? 0,
    recent: ((data as OpenItemHomeRow[] | null) ?? []).map(mapMoneyRow),
  };
}

async function loadTreasurySignals(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    organizationSlug: string;
  },
): Promise<CompanyHomeTreasurySignal> {
  const empty = {
    isAvailable: false,
    currencyCode: null,
    conservativeAvailableCash: 0,
    alertCount: 0,
    criticalAlertCount: 0,
  };

  try {
    const treasury = await loadTreasuryDashboard(supabase, input);

    if (!treasury.isAvailable || treasury.currencies.length === 0) {
      return empty;
    }

    const severity = {
      CRITICAL: 4,
      RED: 3,
      YELLOW: 2,
      GREEN: 1,
    };
    const primaryCurrency = [...treasury.currencies].sort((left, right) =>
      severity[right.status] - severity[left.status]
      || left.currencyCode.localeCompare(right.currencyCode))[0];

    return {
      isAvailable: true,
      currencyCode: primaryCurrency.currencyCode,
      conservativeAvailableCash: treasuryMinorToDisplay(primaryCurrency.conservativeAvailableCashMinor),
      alertCount: treasury.alerts.length,
      criticalAlertCount: treasury.alerts.filter((alert) =>
        alert.riskLevel === "critical" || alert.riskLevel === "high").length,
    };
  } catch (error) {
    const supabaseError = error as { code?: string; message?: string; details?: string; hint?: string };

    if (
      isMissingSupabaseRelationError(supabaseError, "treasury_bank_accounts")
      || isMissingSupabaseRelationError(supabaseError, "treasury_vales")
      || isMissingSupabaseRelationError(supabaseError, "treasury_manual_receivables")
    ) {
      return empty;
    }

    throw error;
  }
}

async function loadOperationsSignals(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CompanyHomeOperationsSignal> {
  const { data, error } = await supabase
    .from("tasks")
    .select("status, due_date")
    .eq("organization_id", organizationId)
    .limit(500);

  if (error) {
    if (isMissingSupabaseRelationError(error, "tasks")) {
      return {
        isAvailable: false,
        totalTasks: 0,
        blockedTasks: 0,
        dueThisWeek: 0,
        continuityRiskCount: 0,
        rawCaptures: 0,
        latestVatStatus: null,
        vatReviewFlags: 0,
        vatTracedDocuments: 0,
        latestCloseStatus: null,
        closeBlockers: 0,
        closeWarnings: 0,
      };
    }

    throw new Error(error.message);
  }

  const rows = (data as TaskHomeRow[] | null) ?? [];
  const today = todayIso();
  const weekEnd = addDaysIso(today, 7);
  const openTasks = rows.filter((row) => !["done", "cancelled"].includes(row.status ?? ""));
  const blockedTasks = rows.filter((row) => row.status === "blocked").length;
  const dueThisWeek = openTasks.filter((row) =>
    row.due_date && row.due_date >= today && row.due_date <= weekEnd).length;

  const [processesResult, capturesResult, closeResult] = await Promise.all([
    supabase
      .from("processes")
      .select("criticality, future_owner_label, status")
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .limit(500),
    supabase
      .from("capture_notes")
      .select("status")
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .limit(500),
    supabase
      .from("close_check_runs")
      .select("status, summary_json")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (processesResult.error && !isMissingSupabaseRelationError(processesResult.error, "processes")) {
    throw new Error(processesResult.error.message);
  }

  if (capturesResult.error && !isMissingSupabaseRelationError(capturesResult.error, "capture_notes")) {
    throw new Error(capturesResult.error.message);
  }

  if (closeResult.error && !isMissingSupabaseRelationError(closeResult.error, "close_check_runs")) {
    throw new Error(closeResult.error.message);
  }

  const criticalProcessesWithoutFutureOwner = ((processesResult.data as ProcessHomeRow[] | null) ?? [])
    .filter((process) =>
      ["high", "critical"].includes(process.criticality ?? "")
      && !process.future_owner_label
      && process.status !== "archived").length;
  const rawCaptures = ((capturesResult.data as CaptureNoteHomeRow[] | null) ?? [])
    .filter((capture) => capture.status === "captured").length;
  const closeRow = (closeResult.data as CloseHomeRow | null) ?? null;
  const closeSummary = closeRow?.summary_json ?? {};
  let latestVatStatus: string | null = null;
  let vatReviewFlags = 0;
  let vatTracedDocuments = 0;

  try {
    const vatRuns = await loadOrganizationVatRuns(supabase, organizationId);
    const latestVatRun = vatRuns[0] ?? null;

    latestVatStatus = latestVatRun?.status ?? null;
    vatReviewFlags = latestVatRun?.reviewFlagsCount ?? 0;
    vatTracedDocuments = latestVatRun?.tracedDocuments.length ?? 0;
  } catch (error) {
    const supabaseError = error as { code?: string; message?: string; details?: string; hint?: string };

    if (
      !isMissingSupabaseRelationError(supabaseError, "vat_runs")
      && !isMissingSupabaseRelationError(supabaseError, "vat_run_documents")
      && !isMissingSupabaseRelationError(supabaseError, "tax_periods")
    ) {
      throw error;
    }
  }

  return {
    isAvailable: true,
    totalTasks: openTasks.length,
    blockedTasks,
    dueThisWeek,
    continuityRiskCount:
      blockedTasks
      + criticalProcessesWithoutFutureOwner
      + rawCaptures
      + asUnknownNumber(closeSummary.blocker_count),
    rawCaptures,
    latestVatStatus,
    vatReviewFlags,
    vatTracedDocuments,
    latestCloseStatus: closeRow?.status ?? null,
    closeBlockers: asUnknownNumber(closeSummary.blocker_count),
    closeWarnings: asUnknownNumber(closeSummary.warning_count),
  };
}

function mapDocumentSignal(input: {
  organizationSlug: string;
  document: Awaited<ReturnType<typeof listAllOrganizationWorkspaceDocuments>>[number];
}): CompanyHomeDocumentSignal {
  return {
    id: input.document.id,
    label: input.document.counterpartyName ?? input.document.originalFilename,
    href: input.document.processedHref ?? `/app/o/${input.organizationSlug}/documents?documentId=${input.document.id}`,
    createdAt: input.document.createdAt,
    bucket: input.document.operationalBucket,
    blockingReason: input.document.blockingReason,
    nextActionLabel: input.document.nextPrimaryActionLabel,
  };
}

export async function loadCompanyHomeDashboard(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    organizationSlug: string;
  },
): Promise<CompanyHomeDashboard> {
  const [documents, work, directory, money, treasury, operations] = await Promise.all([
    listAllOrganizationWorkspaceDocuments({
      organizationId: input.organizationId,
      organizationSlug: input.organizationSlug,
      sortOrder: "date_desc",
      limit: 40,
    }),
    loadWorkUnitSignals(supabase, input.organizationId),
    loadPartySignals(supabase, input.organizationId),
    loadMoneySignals(supabase, input.organizationId),
    loadTreasurySignals(supabase, input),
    loadOperationsSignals(supabase, input.organizationId),
  ]);

  return buildCompanyHomeDashboard({
    organizationSlug: input.organizationSlug,
    documents: documents.map((document) =>
      mapDocumentSignal({
        organizationSlug: input.organizationSlug,
        document,
      })),
    work,
    directory,
    money,
    treasury,
    operations,
  });
}
