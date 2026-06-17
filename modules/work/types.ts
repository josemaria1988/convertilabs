export const WORK_UNIT_KINDS = [
  "job",
  "project",
  "operation",
  "department",
  "internal_cost_center",
  "service",
  "maintenance",
  "administration",
  "cost_center",
  "area",
] as const;

export type WorkUnitKind = (typeof WORK_UNIT_KINDS)[number];

export const WORK_UNIT_STATUSES = [
  "planned",
  "active",
  "paused",
  "blocked",
  "completed",
  "cancelled",
  "archived",
] as const;

export type WorkUnitStatus = (typeof WORK_UNIT_STATUSES)[number];

export type WorkUnitCreatePayload = {
  organization_id: string;
  code: string | null;
  name: string;
  normalized_name: string;
  kind: WorkUnitKind;
  status: WorkUnitStatus;
  customer_party_id: string | null;
  owner_member_id: string | null;
  start_date: string | null;
  end_date: string | null;
  estimated_revenue: number | null;
  estimated_cost: number | null;
  actual_revenue: number;
  actual_cost: number;
  margin_status: string | null;
  currency_code: string;
  description: string | null;
  source: string;
  legacy_cost_center_id: string | null;
  metadata_json: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
};

export type WorkUnitFinancialSummary = {
  estimatedMargin: number | null;
  actualMargin: number;
  actualMarginRatio: number | null;
  marginStatus: "no_revenue" | "negative" | "at_risk" | "healthy";
};
