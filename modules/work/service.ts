import type {
  WorkUnitCreatePayload,
  WorkUnitFinancialSummary,
  WorkUnitKind,
  WorkUnitStatus,
} from "@/modules/work/types";

function compactText(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeCurrencyCode(value: string | null | undefined) {
  return compactText(value)?.toUpperCase() ?? "UYU";
}

function normalizeAmount(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value)) {
    throw new Error("Work unit amounts must be finite numbers.");
  }

  return Math.round(value * 100) / 100;
}

function assertDateRange(startDate: string | null, endDate: string | null) {
  if (startDate && endDate && endDate < startDate) {
    throw new Error("Work unit end_date cannot be before start_date.");
  }
}

export function buildWorkUnitCreatePayload(input: {
  organizationId: string;
  name: string;
  code?: string | null;
  kind?: WorkUnitKind;
  status?: WorkUnitStatus;
  customerPartyId?: string | null;
  ownerMemberId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  estimatedRevenue?: number | null;
  estimatedCost?: number | null;
  actualRevenue?: number | null;
  actualCost?: number | null;
  currencyCode?: string | null;
  description?: string | null;
  source?: string | null;
  legacyCostCenterId?: string | null;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
}): WorkUnitCreatePayload {
  const name = compactText(input.name);

  if (!name) {
    throw new Error("Work unit name is required.");
  }

  const startDate = compactText(input.startDate);
  const endDate = compactText(input.endDate);
  assertDateRange(startDate, endDate);

  const actualRevenue = normalizeAmount(input.actualRevenue) ?? 0;
  const actualCost = normalizeAmount(input.actualCost) ?? 0;
  const financialSummary = summarizeWorkUnitFinancials({
    estimatedRevenue: input.estimatedRevenue,
    estimatedCost: input.estimatedCost,
    actualRevenue,
    actualCost,
  });

  return {
    organization_id: input.organizationId,
    code: compactText(input.code),
    name,
    normalized_name: normalizeName(name),
    kind: input.kind ?? "job",
    status: input.status ?? "planned",
    customer_party_id: input.customerPartyId ?? null,
    owner_member_id: input.ownerMemberId ?? null,
    start_date: startDate,
    end_date: endDate,
    estimated_revenue: normalizeAmount(input.estimatedRevenue),
    estimated_cost: normalizeAmount(input.estimatedCost),
    actual_revenue: actualRevenue,
    actual_cost: actualCost,
    margin_status: financialSummary.marginStatus,
    currency_code: normalizeCurrencyCode(input.currencyCode),
    description: compactText(input.description),
    source: compactText(input.source) ?? "manual",
    legacy_cost_center_id: input.legacyCostCenterId ?? null,
    metadata_json: input.metadata ?? {},
    created_by: input.actorId ?? null,
    updated_by: input.actorId ?? null,
  };
}

export function summarizeWorkUnitFinancials(input: {
  estimatedRevenue?: number | null;
  estimatedCost?: number | null;
  actualRevenue?: number | null;
  actualCost?: number | null;
}): WorkUnitFinancialSummary {
  const estimatedRevenue = normalizeAmount(input.estimatedRevenue);
  const estimatedCost = normalizeAmount(input.estimatedCost);
  const actualRevenue = normalizeAmount(input.actualRevenue) ?? 0;
  const actualCost = normalizeAmount(input.actualCost) ?? 0;
  const estimatedMargin =
    estimatedRevenue === null && estimatedCost === null
      ? null
      : (estimatedRevenue ?? 0) - (estimatedCost ?? 0);
  const actualMargin = actualRevenue - actualCost;
  const actualMarginRatio = actualRevenue > 0
    ? Math.round((actualMargin / actualRevenue) * 10000) / 10000
    : null;

  let marginStatus: WorkUnitFinancialSummary["marginStatus"] = "healthy";

  if (actualRevenue <= 0) {
    marginStatus = "no_revenue";
  } else if (actualMargin < 0) {
    marginStatus = "negative";
  } else if (actualMarginRatio !== null && actualMarginRatio < 0.1) {
    marginStatus = "at_risk";
  }

  return {
    estimatedMargin,
    actualMargin,
    actualMarginRatio,
    marginStatus,
  };
}

export function canMutateWorkUnit(role: string) {
  return ["owner", "admin", "admin_processing", "accountant", "reviewer", "operator"].includes(role);
}

export function canArchiveWorkUnit(role: string) {
  return ["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role);
}
