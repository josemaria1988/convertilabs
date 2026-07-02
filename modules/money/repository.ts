import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMissingSupabaseColumnError,
  isMissingSupabaseRelationError,
} from "@/lib/supabase/schema-compat";
import type {
  MoneyDashboardData,
  MoneyDirection,
  MoneyGroup,
  MoneyItem,
} from "@/modules/money/types";

type MoneyOpenItemRow = {
  open_item_id: string;
  party_id: string | null;
  work_unit_id: string | null;
  work_unit_name: string | null;
  work_unit_code: string | null;
  counterparty_type: string | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
  counterparty_tax_id_normalized: string | null;
  source_document_id: string | null;
  document_role: string | null;
  document_type: string | null;
  issue_date: string | null;
  due_date: string | null;
  days_overdue: number | null;
  currency_code: string | null;
  outstanding_amount: number | null;
  status: string | null;
  settlement_count: number | null;
};

const MONEY_OPEN_ITEMS_SELECT = [
  "open_item_id",
  "party_id",
  "work_unit_id",
  "work_unit_name",
  "work_unit_code",
  "counterparty_type",
  "counterparty_id",
  "counterparty_name",
  "counterparty_tax_id_normalized",
  "source_document_id",
  "document_role",
  "document_type",
  "issue_date",
  "due_date",
  "days_overdue",
  "currency_code",
  "outstanding_amount",
  "status",
  "settlement_count",
].join(", ");

const LEGACY_MONEY_OPEN_ITEMS_SELECT = [
  "open_item_id",
  "party_id",
  "counterparty_type",
  "counterparty_id",
  "counterparty_name",
  "counterparty_tax_id_normalized",
  "source_document_id",
  "document_role",
  "document_type",
  "issue_date",
  "due_date",
  "days_overdue",
  "currency_code",
  "outstanding_amount",
  "status",
  "settlement_count",
].join(", ");

function roundAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function deriveDirection(row: MoneyOpenItemRow): MoneyDirection {
  if (row.document_role === "sale" || row.counterparty_type === "customer") {
    return "receivable";
  }

  return "payable";
}

function includesSearch(row: MoneyOpenItemRow, searchTerm: string | null | undefined) {
  const normalized = searchTerm?.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    row.counterparty_name,
    row.counterparty_tax_id_normalized,
    row.work_unit_name,
    row.work_unit_code,
    row.document_type,
    row.document_role,
    row.status,
  ].filter(Boolean).join(" ").toLowerCase().includes(normalized);
}

function mapMoneyItem(row: MoneyOpenItemRow, today: string): MoneyItem {
  const direction = deriveDirection(row);
  const dueSoonEnd = addDaysIso(today, 7);
  const displayAmount = Math.abs(asNumber(row.outstanding_amount));
  const dueDate = row.due_date;

  return {
    id: row.open_item_id,
    direction,
    partyId: row.party_id ?? row.counterparty_id,
    partyName: row.counterparty_name ?? (direction === "receivable" ? "Cliente sin nombre" : "Proveedor sin nombre"),
    partyTaxId: row.counterparty_tax_id_normalized,
    workUnitId: row.work_unit_id,
    workUnitName: row.work_unit_name,
    workUnitCode: row.work_unit_code,
    sourceDocumentId: row.source_document_id,
    documentRole: row.document_role,
    documentType: row.document_type,
    issueDate: row.issue_date,
    dueDate,
    daysOverdue: asNumber(row.days_overdue),
    isDueSoon: Boolean(dueDate && dueDate >= today && dueDate <= dueSoonEnd),
    currencyCode: row.currency_code?.trim().toUpperCase() || "UYU",
    outstandingAmount: asNumber(row.outstanding_amount),
    displayAmount,
    status: row.status,
    settlementCount: asNumber(row.settlement_count),
  };
}

function emptyMoneyDashboard(today: string, isAvailable: boolean): MoneyDashboardData {
  return {
    isAvailable,
    today,
    items: [],
    receivables: [],
    payables: [],
    overdue: [],
    dueSoon: [],
    byParty: [],
    byWorkUnit: [],
    summary: {
      receivableCount: 0,
      receivableAmount: 0,
      payableCount: 0,
      payableAmount: 0,
      overdueCount: 0,
      overdueAmount: 0,
      dueSoonCount: 0,
      dueSoonAmount: 0,
      netPosition: 0,
      partiesWithBalance: 0,
      workUnitsWithBalance: 0,
    },
  };
}

function addToGroup(
  groups: Map<string, MoneyGroup>,
  key: string,
  base: Omit<MoneyGroup, "count" | "outstandingAmount" | "overdueCount" | "dueSoonCount">,
  item: MoneyItem,
) {
  const current = groups.get(key) ?? {
    ...base,
    count: 0,
    outstandingAmount: 0,
    overdueCount: 0,
    dueSoonCount: 0,
  };

  current.count += 1;
  current.outstandingAmount = roundAmount(current.outstandingAmount + item.displayAmount);
  current.overdueCount += item.daysOverdue > 0 ? 1 : 0;
  current.dueSoonCount += item.isDueSoon ? 1 : 0;
  groups.set(key, current);
}

function sortGroups(groups: Iterable<MoneyGroup>) {
  return Array.from(groups).sort((left, right) =>
    right.outstandingAmount - left.outstandingAmount
    || left.label.localeCompare(right.label));
}

function isMissingMoneyWorkUnitColumn(error: unknown) {
  const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string };

  return isMissingSupabaseColumnError(supabaseError, "v_open_items_outstanding", "work_unit_id")
    || isMissingSupabaseColumnError(supabaseError, "v_open_items_outstanding", "work_unit_name")
    || isMissingSupabaseColumnError(supabaseError, "v_open_items_outstanding", "work_unit_code");
}

function buildPartyGroups(items: MoneyItem[], organizationSlug: string) {
  const groups = new Map<string, MoneyGroup>();

  for (const item of items) {
    const key = `${item.direction}:${item.partyId ?? item.partyName}`;
    addToGroup(groups, key, {
      key,
      label: item.partyName,
      secondaryLabel: item.direction === "receivable" ? "Cliente" : "Proveedor",
      direction: item.direction,
      href: item.partyId ? `/app/o/${organizationSlug}/money?party=${item.partyId}` : null,
    }, item);
  }

  return sortGroups(groups.values());
}

function buildWorkUnitGroups(items: MoneyItem[], organizationSlug: string) {
  const groups = new Map<string, MoneyGroup>();

  for (const item of items) {
    const key = item.workUnitId ?? "unassigned";
    addToGroup(groups, key, {
      key,
      label: item.workUnitName ?? "Sin trabajo asignado",
      secondaryLabel: item.workUnitCode,
      direction: "mixed",
      href: item.workUnitId ? `/app/o/${organizationSlug}/work/${item.workUnitId}` : null,
    }, item);
  }

  return sortGroups(groups.values());
}

export async function loadMoneyDashboard(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    organizationSlug: string;
    searchTerm?: string | null;
    partyId?: string | null;
    workUnitId?: string | null;
    dueFilter?: "overdue" | "week" | null;
    today?: string | null;
  },
): Promise<MoneyDashboardData> {
  const today = input.today ?? todayIso();
  const buildQuery = (selectClause: string, includeWorkUnitFilter: boolean) => {
    let query = supabase
      .from("v_open_items_outstanding")
      .select(selectClause)
      .eq("organization_id", input.organizationId);

    if (input.partyId) {
      query = query.eq("party_id", input.partyId);
    }

    if (input.workUnitId && includeWorkUnitFilter) {
      query = query.eq("work_unit_id", input.workUnitId);
    }

    return query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("issue_date", { ascending: false })
      .limit(500);
  };

  let supportsWorkUnitColumns = true;
  let { data, error } = await buildQuery(MONEY_OPEN_ITEMS_SELECT, true);

  if (error) {
    if (!isMissingMoneyWorkUnitColumn(error)) {
      if (isMissingSupabaseRelationError(error, "v_open_items_outstanding")) {
        return emptyMoneyDashboard(today, false);
      }

      throw new Error(error.message);
    }

    supportsWorkUnitColumns = false;
    const fallbackResult = await buildQuery(LEGACY_MONEY_OPEN_ITEMS_SELECT, false);

    if (fallbackResult.error) {
      if (isMissingSupabaseRelationError(fallbackResult.error, "v_open_items_outstanding")) {
        return emptyMoneyDashboard(today, false);
      }

      throw new Error(fallbackResult.error.message);
    }

    data = fallbackResult.data;
  }

  const rows = ((data as unknown as MoneyOpenItemRow[] | null) ?? [])
    .filter((row) => includesSearch(row, input.searchTerm))
    .map((row) => mapMoneyItem(row, today))
    .filter((item) => {
      if (input.workUnitId && !supportsWorkUnitColumns) {
        return false;
      }

      if (input.dueFilter === "overdue") {
        return item.daysOverdue > 0;
      }

      if (input.dueFilter === "week") {
        return item.isDueSoon;
      }

      return true;
    });
  const receivables = rows.filter((item) => item.direction === "receivable");
  const payables = rows.filter((item) => item.direction === "payable");
  const overdue = rows.filter((item) => item.daysOverdue > 0);
  const dueSoon = rows.filter((item) => item.isDueSoon);
  const receivableAmount = roundAmount(receivables.reduce((sum, item) => sum + item.displayAmount, 0));
  const payableAmount = roundAmount(payables.reduce((sum, item) => sum + item.displayAmount, 0));
  const byParty = buildPartyGroups(rows, input.organizationSlug);
  const byWorkUnit = buildWorkUnitGroups(rows, input.organizationSlug);

  return {
    isAvailable: true,
    today,
    items: rows,
    receivables,
    payables,
    overdue,
    dueSoon,
    byParty,
    byWorkUnit,
    summary: {
      receivableCount: receivables.length,
      receivableAmount,
      payableCount: payables.length,
      payableAmount,
      overdueCount: overdue.length,
      overdueAmount: roundAmount(overdue.reduce((sum, item) => sum + item.displayAmount, 0)),
      dueSoonCount: dueSoon.length,
      dueSoonAmount: roundAmount(dueSoon.reduce((sum, item) => sum + item.displayAmount, 0)),
      netPosition: roundAmount(receivableAmount - payableAmount),
      partiesWithBalance: byParty.length,
      workUnitsWithBalance: byWorkUnit.filter((group) => group.key !== "unassigned").length,
    },
  };
}
