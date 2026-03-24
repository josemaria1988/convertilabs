import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  isMissingSupabaseColumnError,
  isMissingSupabaseRelationError,
} from "@/lib/supabase/schema-compat";
import type {
  AccountingRuleLifecycleStatus,
  AccountingRuleScope,
} from "@/modules/accounting/types";

type AccountingRuleAdminRow = {
  id: string;
  organization_id: string;
  stable_family_code?: string | null;
  version_number?: number | null;
  name?: string | null;
  description?: string | null;
  scope: string;
  document_id: string | null;
  source_document_id: string | null;
  vendor_id: string | null;
  concept_id: string | null;
  document_role: string;
  account_id: string;
  status?: string | null;
  lifecycle_status?: string | null;
  vat_profile_json?: Record<string, unknown> | null;
  tax_profile_code?: string | null;
  operation_category?: string | null;
  linked_operation_type?: string | null;
  template_code?: string | null;
  times_reused?: number | null;
  times_corrected?: number | null;
  times_matched?: number | null;
  times_applied?: number | null;
  priority?: number | null;
  source?: string | null;
  created_from?: string | null;
  is_active?: boolean | null;
  explainability_json?: Record<string, unknown> | null;
  supersedes_rule_id?: string | null;
  superseded_by_rule_id?: string | null;
  pause_reason?: string | null;
  supersession_reason?: string | null;
  created_by?: string | null;
  approved_by?: string | null;
  activated_at?: string | null;
  paused_at?: string | null;
  retired_at?: string | null;
  last_matched_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type VendorLookupRow = {
  id: string;
  name: string;
};

type ConceptLookupRow = {
  id: string;
  canonical_name: string;
};

type AccountLookupRow = {
  id: string;
  code: string;
  name: string;
};

type DocumentLookupRow = {
  id: string;
  original_filename: string;
  document_date: string | null;
  direction: string | null;
  status: string | null;
  posting_status: string | null;
};

type ProfileLookupRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type RuleLookupMaps = {
  vendorsById: Map<string, VendorLookupRow>;
  conceptsById: Map<string, ConceptLookupRow>;
  accountsById: Map<string, AccountLookupRow>;
  documentsById: Map<string, DocumentLookupRow>;
};

export type AccountingRulesAdminStatusFilter =
  | "all"
  | "active"
  | "paused"
  | "superseded"
  | "draft";

export type AccountingRulesAdminFilters = {
  search: string;
  status: AccountingRulesAdminStatusFilter;
  scope: AccountingRuleScope | "all";
  source: "all" | "manual" | "learning" | "imported" | "migrated";
};

export type AccountingRuleTimelineItem = {
  id: string;
  source: "rule_event" | "audit_log";
  label: string;
  reason: string | null;
  actorDisplay: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type AccountingRuleAffectedDocument = {
  documentId: string;
  originalFilename: string;
  documentDate: string | null;
  direction: string | null;
  status: string | null;
  postingStatus: string | null;
  appliedAt: string;
  confidence: number | null;
  source: "assignment_run" | "ai_decision_log";
  note: string | null;
};

export type AccountingRulesAdminListItem = {
  id: string;
  stableFamilyCode: string | null;
  versionNumber: number;
  lifecycleStatus: AccountingRuleLifecycleStatus;
  approvalStatus: string | null;
  name: string;
  description: string | null;
  scope: AccountingRuleScope;
  documentRole: string;
  priority: number;
  source: string | null;
  createdFrom: string | null;
  vendorName: string | null;
  conceptName: string | null;
  accountLabel: string | null;
  conditionSummary: string[];
  resultSummary: string[];
  documentsAppliedCount: number;
  matchesCount: number;
  lastMatchedAt: string | null;
  lastEditedAt: string | null;
  pauseReason: string | null;
  sourceDocumentId: string | null;
  sourceDocumentLabel: string | null;
  supersedesRuleId: string | null;
  supersededByRuleId: string | null;
  searchableText: string;
};

export type AccountingRuleDetail = AccountingRulesAdminListItem & {
  ruleId: string;
  metadata: Record<string, unknown>;
  explainability: Record<string, unknown>;
  createdAt: string | null;
  activatedAt: string | null;
  pausedAt: string | null;
  retiredAt: string | null;
  createdByDisplay: string | null;
  approvedByDisplay: string | null;
  supersedesRuleLabel: string | null;
  supersededByRuleLabel: string | null;
  canPause: boolean;
  canReactivate: boolean;
  reactivationBlockedReason: string | null;
  affectedDocuments: AccountingRuleAffectedDocument[];
  timeline: AccountingRuleTimelineItem[];
};

export type AccountingRulesAdminPageData = {
  filters: AccountingRulesAdminFilters;
  metrics: {
    total: number;
    active: number;
    paused: number;
    superseded: number;
    draft: number;
    createdFromLearning: number;
  };
  rules: AccountingRulesAdminListItem[];
  selectedRuleId: string | null;
  selectedRule: AccountingRuleDetail | null;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeSearch(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeStatusFilter(value: string | null | undefined): AccountingRulesAdminStatusFilter {
  switch (value) {
    case "active":
    case "paused":
    case "superseded":
    case "draft":
      return value;
    default:
      return "all";
  }
}

function normalizeScopeFilter(value: string | null | undefined): AccountingRuleScope | "all" {
  switch (value) {
    case "document_override":
    case "vendor_concept_operation_category":
    case "vendor_concept":
    case "concept_global":
    case "vendor_default":
      return value;
    default:
      return "all";
  }
}

function normalizeSourceFilter(
  value: string | null | undefined,
): AccountingRulesAdminFilters["source"] {
  switch (value) {
    case "manual":
    case "learning":
    case "imported":
    case "migrated":
      return value;
    default:
      return "all";
  }
}

export function normalizeAccountingRulesAdminFilters(input: {
  search?: string | null;
  status?: string | null;
  scope?: string | null;
  source?: string | null;
}) {
  return {
    search: normalizeSearch(input.search),
    status: normalizeStatusFilter(input.status),
    scope: normalizeScopeFilter(input.scope),
    source: normalizeSourceFilter(input.source),
  } satisfies AccountingRulesAdminFilters;
}

export function deriveAccountingRuleLifecycleStatus(input: {
  lifecycleStatus?: string | null;
  approvalStatus?: string | null;
  isActive?: boolean | null;
  supersededByRuleId?: string | null;
}) {
  switch (input.lifecycleStatus) {
    case "draft":
    case "active":
    case "paused":
    case "superseded":
    case "deleted_if_unused":
      return input.lifecycleStatus;
    default:
      break;
  }

  if (input.supersededByRuleId) {
    return "superseded" satisfies AccountingRuleLifecycleStatus;
  }

  if (input.isActive === true) {
    return "active" satisfies AccountingRuleLifecycleStatus;
  }

  if (input.approvalStatus === "candidate") {
    return "draft" satisfies AccountingRuleLifecycleStatus;
  }

  return "paused" satisfies AccountingRuleLifecycleStatus;
}

function resolveRuleOrigin(row: AccountingRuleAdminRow) {
  return asString(row.created_from) ?? asString(row.source);
}

function resolveRuleStatusOrder(value: AccountingRuleLifecycleStatus) {
  switch (value) {
    case "active":
      return 0;
    case "paused":
      return 1;
    case "superseded":
      return 2;
    case "draft":
      return 3;
    case "deleted_if_unused":
      return 4;
    default:
      return 9;
  }
}

function resolveRuleScopeOrder(value: AccountingRuleScope) {
  switch (value) {
    case "document_override":
      return 0;
    case "vendor_concept_operation_category":
      return 1;
    case "vendor_concept":
      return 2;
    case "concept_global":
      return 3;
    case "vendor_default":
      return 4;
    default:
      return 9;
  }
}

function buildSourceDocumentLabel(document: DocumentLookupRow | null | undefined) {
  if (!document) {
    return null;
  }

  return document.document_date
    ? `${document.original_filename} · ${document.document_date}`
    : document.original_filename;
}

function buildAccountLabel(account: AccountLookupRow | null | undefined) {
  if (!account) {
    return null;
  }

  return `${account.code} - ${account.name}`;
}

function buildFallbackRuleName(input: {
  row: AccountingRuleAdminRow;
  vendorName: string | null;
  conceptName: string | null;
  accountLabel: string | null;
}) {
  const operationCategory = asString(input.row.operation_category);

  switch (input.row.scope as AccountingRuleScope) {
    case "document_override":
      return `Override puntual${input.accountLabel ? ` · ${input.accountLabel}` : ""}`;
    case "vendor_concept_operation_category":
      return [
        input.vendorName ?? "Proveedor",
        input.conceptName ?? "Concepto",
        operationCategory ?? "Categoria",
      ].join(" / ");
    case "vendor_concept":
      return [
        input.vendorName ?? "Proveedor",
        input.conceptName ?? "Concepto",
      ].join(" / ");
    case "concept_global":
      return input.conceptName ?? "Concepto global";
    case "vendor_default":
      return input.vendorName ? `Default de ${input.vendorName}` : "Default del proveedor";
    default:
      return input.accountLabel ?? "Regla contable";
  }
}

function pushIfText(target: string[], value: string | null) {
  if (value) {
    target.push(value);
  }
}

function buildConditionSummary(input: {
  row: AccountingRuleAdminRow;
  vendorName: string | null;
  conceptName: string | null;
}) {
  const items: string[] = [];
  const metadata = asRecord(input.row.metadata);

  if (input.row.document_id) {
    items.push("Documento puntual");
  }

  pushIfText(items, input.vendorName ? `Proveedor: ${input.vendorName}` : null);
  pushIfText(items, input.conceptName ? `Concepto: ${input.conceptName}` : null);
  pushIfText(
    items,
    asString(input.row.operation_category)
      ? `Categoria: ${asString(input.row.operation_category)}`
      : null,
  );
  pushIfText(
    items,
    asString(metadata.operation_kind) ? `Operacion: ${asString(metadata.operation_kind)}` : null,
  );
  pushIfText(
    items,
    asString(metadata.payment_terms) ? `Condicion: ${asString(metadata.payment_terms)}` : null,
  );
  pushIfText(
    items,
    asString(metadata.settlement_method) ? `Medio: ${asString(metadata.settlement_method)}` : null,
  );

  return items.length > 0 ? items : ["Sin resumen de condiciones"];
}

function buildResultSummary(input: {
  row: AccountingRuleAdminRow;
  accountLabel: string | null;
}) {
  const items: string[] = [];

  pushIfText(items, input.accountLabel ? `Cuenta: ${input.accountLabel}` : null);
  pushIfText(
    items,
    asString(input.row.template_code) ? `Template: ${asString(input.row.template_code)}` : null,
  );
  pushIfText(
    items,
    asString(input.row.tax_profile_code)
      ? `Tax profile: ${asString(input.row.tax_profile_code)}`
      : null,
  );
  pushIfText(
    items,
    asString(input.row.linked_operation_type)
      ? `Operacion ligada: ${asString(input.row.linked_operation_type)}`
      : null,
  );

  return items.length > 0 ? items : ["Sin resultado materializado"];
}

function buildRuleDescription(row: AccountingRuleAdminRow) {
  const explainability = asRecord(row.explainability_json);
  const metadata = asRecord(row.metadata);

  return (
    asString(row.description)
    ?? asString(explainability.summary)
    ?? asString(explainability.purpose)
    ?? asString(metadata.rationale)
    ?? null
  );
}

function buildSearchableText(input: {
  name: string;
  description: string | null;
  vendorName: string | null;
  conceptName: string | null;
  accountLabel: string | null;
  row: AccountingRuleAdminRow;
  sourceDocumentLabel: string | null;
}) {
  return [
    input.name,
    input.description,
    input.vendorName,
    input.conceptName,
    input.accountLabel,
    asString(input.row.scope),
    asString(input.row.source),
    asString(input.row.created_from),
    asString(input.row.operation_category),
    input.sourceDocumentLabel,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function mapRowToListItem(
  row: AccountingRuleAdminRow,
  lookups: RuleLookupMaps,
) {
  const vendorName = row.vendor_id ? lookups.vendorsById.get(row.vendor_id)?.name ?? null : null;
  const conceptName = row.concept_id
    ? lookups.conceptsById.get(row.concept_id)?.canonical_name ?? null
    : null;
  const accountLabel = buildAccountLabel(
    row.account_id ? lookups.accountsById.get(row.account_id) ?? null : null,
  );
  const sourceDocument = row.source_document_id
    ? lookups.documentsById.get(row.source_document_id) ?? null
    : null;
  const sourceDocumentLabel = buildSourceDocumentLabel(sourceDocument);
  const lifecycleStatus = deriveAccountingRuleLifecycleStatus({
    lifecycleStatus: asString(row.lifecycle_status),
    approvalStatus: asString(row.status),
    isActive: asBoolean(row.is_active),
    supersededByRuleId: asString(row.superseded_by_rule_id),
  });
  const name =
    asString(row.name)
    ?? buildFallbackRuleName({
      row,
      vendorName,
      conceptName,
      accountLabel,
    });
  const description = buildRuleDescription(row);

  return {
    id: row.id,
    stableFamilyCode: asString(row.stable_family_code),
    versionNumber: asNumber(row.version_number) ?? 1,
    lifecycleStatus,
    approvalStatus: asString(row.status),
    name,
    description,
    scope: row.scope as AccountingRuleScope,
    documentRole: row.document_role,
    priority: asNumber(row.priority) ?? 0,
    source: asString(row.source),
    createdFrom: resolveRuleOrigin(row),
    vendorName,
    conceptName,
    accountLabel,
    conditionSummary: buildConditionSummary({
      row,
      vendorName,
      conceptName,
    }),
    resultSummary: buildResultSummary({
      row,
      accountLabel,
    }),
    documentsAppliedCount: asNumber(row.times_applied) ?? asNumber(row.times_reused) ?? 0,
    matchesCount: asNumber(row.times_matched) ?? asNumber(row.times_reused) ?? 0,
    lastMatchedAt: asString(row.last_matched_at),
    lastEditedAt:
      asString(row.updated_at)
      ?? asString(row.paused_at)
      ?? asString(row.activated_at)
      ?? asString(row.created_at),
    pauseReason: asString(row.pause_reason),
    sourceDocumentId: row.source_document_id,
    sourceDocumentLabel,
    supersedesRuleId: asString(row.supersedes_rule_id),
    supersededByRuleId: asString(row.superseded_by_rule_id),
    searchableText: buildSearchableText({
      name,
      description,
      vendorName,
      conceptName,
      accountLabel,
      row,
      sourceDocumentLabel,
    }),
  } satisfies AccountingRulesAdminListItem;
}

export function sortAccountingRuleListItems(items: AccountingRulesAdminListItem[]) {
  return [...items].sort((left, right) => {
    const statusOrder = resolveRuleStatusOrder(left.lifecycleStatus)
      - resolveRuleStatusOrder(right.lifecycleStatus);

    if (statusOrder !== 0) {
      return statusOrder;
    }

    const scopeOrder = resolveRuleScopeOrder(left.scope) - resolveRuleScopeOrder(right.scope);

    if (scopeOrder !== 0) {
      return scopeOrder;
    }

    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    const leftDate = Date.parse(left.lastEditedAt ?? left.lastMatchedAt ?? "") || 0;
    const rightDate = Date.parse(right.lastEditedAt ?? right.lastMatchedAt ?? "") || 0;

    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }

    return left.name.localeCompare(right.name, "es");
  });
}

export function matchesAccountingRuleSourceFilter(
  item: Pick<AccountingRulesAdminListItem, "createdFrom" | "source">,
  filter: AccountingRulesAdminFilters["source"],
) {
  if (filter === "all") {
    return true;
  }

  const value = (item.createdFrom ?? item.source ?? "").toLowerCase();

  switch (filter) {
    case "manual":
      return value === "manual";
    case "learning":
      return value === "learned_from_approval" || value === "learning_approval";
    case "imported":
      return value === "import" || value === "imported";
    case "migrated":
      return value === "migration" || value === "migrated";
    default:
      return true;
  }
}

function filterAccountingRuleListItems(
  items: AccountingRulesAdminListItem[],
  filters: AccountingRulesAdminFilters,
) {
  const normalizedSearch = filters.search.toLowerCase();

  return items.filter((item) => {
    if (filters.status !== "all" && item.lifecycleStatus !== filters.status) {
      return false;
    }

    if (filters.scope !== "all" && item.scope !== filters.scope) {
      return false;
    }

    if (!matchesAccountingRuleSourceFilter(item, filters.source)) {
      return false;
    }

    if (normalizedSearch && !item.searchableText.includes(normalizedSearch)) {
      return false;
    }

    return true;
  });
}

async function loadAccountingRulesAdminRows(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const primarySelect = [
    "id",
    "organization_id",
    "stable_family_code",
    "version_number",
    "name",
    "description",
    "scope",
    "document_id",
    "source_document_id",
    "vendor_id",
    "concept_id",
    "document_role",
    "account_id",
    "status",
    "lifecycle_status",
    "vat_profile_json",
    "tax_profile_code",
    "operation_category",
    "linked_operation_type",
    "template_code",
    "times_reused",
    "times_corrected",
    "times_matched",
    "times_applied",
    "priority",
    "source",
    "created_from",
    "is_active",
    "explainability_json",
    "supersedes_rule_id",
    "superseded_by_rule_id",
    "pause_reason",
    "supersession_reason",
    "created_by",
    "approved_by",
    "activated_at",
    "paused_at",
    "retired_at",
    "last_matched_at",
    "metadata",
    "created_at",
    "updated_at",
  ].join(", ");
  const legacySelect = [
    "id",
    "organization_id",
    "scope",
    "document_id",
    "source_document_id",
    "vendor_id",
    "concept_id",
    "document_role",
    "account_id",
    "status",
    "vat_profile_json",
    "tax_profile_code",
    "operation_category",
    "linked_operation_type",
    "template_code",
    "times_reused",
    "times_corrected",
    "priority",
    "source",
    "is_active",
    "metadata",
    "created_at",
    "updated_at",
    "created_by",
    "approved_by",
  ].join(", ");

  let result = await supabase
    .from("accounting_rules")
    .select(primarySelect)
    .eq("organization_id", organizationId)
    .limit(250);

  if (result.error && isMissingSupabaseColumnError(result.error, "accounting_rules")) {
    result = await supabase
      .from("accounting_rules")
      .select(legacySelect)
      .eq("organization_id", organizationId)
      .limit(250);
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data as unknown as AccountingRuleAdminRow[] | null) ?? [];
}

async function loadRuleLookupMaps(
  supabase: SupabaseClient,
  rows: AccountingRuleAdminRow[],
) {
  const vendorIds = [...new Set(rows.map((row) => row.vendor_id).filter((value): value is string => Boolean(value)))];
  const conceptIds = [...new Set(rows.map((row) => row.concept_id).filter((value): value is string => Boolean(value)))];
  const accountIds = [...new Set(rows.map((row) => row.account_id).filter((value): value is string => Boolean(value)))];
  const documentIds = [...new Set(rows
    .map((row) => row.source_document_id)
    .filter((value): value is string => Boolean(value)))];

  const [vendorsResult, conceptsResult, accountsResult, documentsResult] = await Promise.all([
    vendorIds.length > 0
      ? supabase.from("vendors").select("id, name").in("id", vendorIds)
      : Promise.resolve({ data: [], error: null }),
    conceptIds.length > 0
      ? supabase
        .from("organization_concepts")
        .select("id, canonical_name")
        .in("id", conceptIds)
      : Promise.resolve({ data: [], error: null }),
    accountIds.length > 0
      ? supabase.from("chart_of_accounts").select("id, code, name").in("id", accountIds)
      : Promise.resolve({ data: [], error: null }),
    documentIds.length > 0
      ? supabase
        .from("documents")
        .select("id, original_filename, document_date, direction, status, posting_status")
        .in("id", documentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (vendorsResult.error) {
    throw new Error(vendorsResult.error.message);
  }

  if (conceptsResult.error) {
    throw new Error(conceptsResult.error.message);
  }

  if (accountsResult.error) {
    throw new Error(accountsResult.error.message);
  }

  if (documentsResult.error) {
    throw new Error(documentsResult.error.message);
  }

  return {
    vendorsById: new Map(
      (((vendorsResult.data as VendorLookupRow[] | null) ?? [])).map((row) => [row.id, row]),
    ),
    conceptsById: new Map(
      (((conceptsResult.data as ConceptLookupRow[] | null) ?? [])).map((row) => [row.id, row]),
    ),
    accountsById: new Map(
      (((accountsResult.data as AccountLookupRow[] | null) ?? [])).map((row) => [row.id, row]),
    ),
    documentsById: new Map(
      (((documentsResult.data as DocumentLookupRow[] | null) ?? [])).map((row) => [row.id, row]),
    ),
  } satisfies RuleLookupMaps;
}

type AccountingRuleEventRow = {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  reason: string | null;
  payload_json: Record<string, unknown> | null;
  created_at: string;
};

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AssignmentRunRow = {
  document_id: string;
  confidence: number | null;
  created_at: string;
  response_json: Record<string, unknown> | null;
};

type AIDecisionLogRow = {
  document_id: string;
  confidence_score: number | null;
  certainty_level: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

function formatRuleEventLabel(value: string) {
  switch (value) {
    case "created":
      return "Regla creada";
    case "activated":
      return "Regla activada";
    case "paused":
      return "Regla pausada";
    case "reactivated":
      return "Regla reactivada";
    case "superseded":
      return "Regla reemplazada";
    case "migrated":
      return "Regla incorporada al admin";
    default:
      return value.replace(/[_:]/g, " ");
  }
}

function formatAuditActionLabel(value: string) {
  if (value.startsWith("learned_rule:")) {
    return "Regla aprendida desde documento";
  }

  if (value === "created_from_rules_admin") {
    return "Regla creada desde admin";
  }

  return value.replace(/[_:]/g, " ");
}

async function loadProfileDisplayMap(
  supabase: SupabaseClient,
  ids: string[],
) {
  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    (((data as ProfileLookupRow[] | null) ?? [])).map((profile) => [
      profile.id,
      profile.full_name || profile.email || profile.id,
    ]),
  );
}

async function loadAccountingRuleTimeline(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    ruleId: string;
  },
) {
  const [eventsResult, auditResult] = await Promise.all([
    supabase
      .from("accounting_rule_events")
      .select("id, event_type, actor_user_id, reason, payload_json, created_at")
      .eq("organization_id", input.organizationId)
      .eq("rule_id", input.ruleId)
      .order("created_at", { ascending: false })
      .limit(24),
    supabase
      .from("audit_log")
      .select("id, actor_user_id, action, before_json, after_json, metadata, created_at")
      .eq("organization_id", input.organizationId)
      .eq("entity_type", "accounting_rule")
      .eq("entity_id", input.ruleId)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const eventRows = eventsResult.error && isMissingSupabaseRelationError(
    eventsResult.error,
    "accounting_rule_events",
  )
    ? []
    : ((eventsResult.data as AccountingRuleEventRow[] | null) ?? []);

  if (
    eventsResult.error
    && eventRows.length === 0
    && !isMissingSupabaseRelationError(eventsResult.error, "accounting_rule_events")
  ) {
    throw new Error(eventsResult.error.message);
  }

  if (auditResult.error) {
    throw new Error(auditResult.error.message);
  }

  const auditRows = ((auditResult.data as AuditLogRow[] | null) ?? []);
  const actorIds = [
    ...new Set([
      ...eventRows.map((row) => row.actor_user_id).filter((value): value is string => Boolean(value)),
      ...auditRows.map((row) => row.actor_user_id).filter((value): value is string => Boolean(value)),
    ]),
  ];
  const actorDisplayById = await loadProfileDisplayMap(supabase, actorIds);
  const auditActionsToHide = eventRows.length > 0
    ? new Set(["accounting_rule:paused", "accounting_rule:reactivated"])
    : new Set<string>();

  return [
    ...eventRows.map((event) => ({
      id: `event:${event.id}`,
      source: "rule_event" as const,
      label: formatRuleEventLabel(event.event_type),
      reason: asString(event.reason),
      actorDisplay:
        event.actor_user_id ? actorDisplayById.get(event.actor_user_id) ?? event.actor_user_id : null,
      createdAt: event.created_at,
      payload: asRecord(event.payload_json),
    })),
    ...auditRows
      .filter((event) => !auditActionsToHide.has(event.action))
      .map((event) => ({
        id: `audit:${event.id}`,
        source: "audit_log" as const,
        label: formatAuditActionLabel(event.action),
        reason:
          asString(asRecord(event.metadata).reason)
          ?? asString(asRecord(event.after_json).pause_reason)
          ?? null,
        actorDisplay:
          event.actor_user_id ? actorDisplayById.get(event.actor_user_id) ?? event.actor_user_id : null,
        createdAt: event.created_at,
        payload: {
          before: asRecord(event.before_json),
          after: asRecord(event.after_json),
          metadata: asRecord(event.metadata),
        },
      })),
  ]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 24) satisfies AccountingRuleTimelineItem[];
}

async function loadAccountingRuleAffectedDocuments(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    ruleId: string;
  },
) {
  const [assignmentResult, logResult] = await Promise.all([
    supabase
      .from("document_assignment_runs")
      .select("document_id, confidence, created_at, response_json")
      .eq("organization_id", input.organizationId)
      .eq("status", "completed")
      .contains("response_json", { applied_rule: { rule_id: input.ruleId } })
      .order("created_at", { ascending: false })
      .limit(16),
    supabase
      .from("ai_decision_logs")
      .select("document_id, confidence_score, certainty_level, metadata_json, created_at")
      .eq("organization_id", input.organizationId)
      .eq("run_type", "accounting_resolution")
      .contains("metadata_json", { rule_id: input.ruleId })
      .order("created_at", { ascending: false })
      .limit(16),
  ]);

  const assignmentRows = assignmentResult.error && isMissingSupabaseRelationError(
    assignmentResult.error,
    "document_assignment_runs",
  )
    ? []
    : ((assignmentResult.data as AssignmentRunRow[] | null) ?? []);
  const logRows = logResult.error && isMissingSupabaseRelationError(logResult.error, "ai_decision_logs")
    ? []
    : ((logResult.data as AIDecisionLogRow[] | null) ?? []);

  if (
    assignmentResult.error
    && assignmentRows.length === 0
    && !isMissingSupabaseRelationError(assignmentResult.error, "document_assignment_runs")
  ) {
    throw new Error(assignmentResult.error.message);
  }

  if (
    logResult.error
    && logRows.length === 0
    && !isMissingSupabaseRelationError(logResult.error, "ai_decision_logs")
  ) {
    throw new Error(logResult.error.message);
  }

  const byDocumentId = new Map<string, AccountingRuleAffectedDocument>();

  for (const row of assignmentRows) {
    const appliedRule = asRecord(asRecord(row.response_json).applied_rule);
    byDocumentId.set(row.document_id, {
      documentId: row.document_id,
      originalFilename: row.document_id,
      documentDate: null,
      direction: null,
      status: null,
      postingStatus: null,
      appliedAt: row.created_at,
      confidence: row.confidence,
      source: "assignment_run",
      note: asString(appliedRule.scope_label),
    });
  }

  for (const row of logRows) {
    if (byDocumentId.has(row.document_id)) {
      continue;
    }

    byDocumentId.set(row.document_id, {
      documentId: row.document_id,
      originalFilename: row.document_id,
      documentDate: null,
      direction: null,
      status: null,
      postingStatus: null,
      appliedAt: row.created_at,
      confidence: row.confidence_score,
      source: "ai_decision_log",
      note: asString(row.certainty_level),
    });
  }

  const documentIds = [...byDocumentId.keys()];

  if (documentIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, original_filename, document_date, direction, status, posting_status")
    .in("id", documentIds);

  if (error) {
    throw new Error(error.message);
  }

  const documentsById = new Map(
    (((data as DocumentLookupRow[] | null) ?? [])).map((document) => [document.id, document]),
  );

  return [...byDocumentId.values()]
    .map((entry) => {
      const document = documentsById.get(entry.documentId);

      return {
        ...entry,
        originalFilename: document?.original_filename ?? entry.originalFilename,
        documentDate: document?.document_date ?? null,
        direction: document?.direction ?? null,
        status: document?.status ?? null,
        postingStatus: document?.posting_status ?? null,
      } satisfies AccountingRuleAffectedDocument;
    })
    .sort((left, right) => Date.parse(right.appliedAt) - Date.parse(left.appliedAt))
    .slice(0, 12);
}

function buildMetrics(items: AccountingRulesAdminListItem[]) {
  return {
    total: items.length,
    active: items.filter((item) => item.lifecycleStatus === "active").length,
    paused: items.filter((item) => item.lifecycleStatus === "paused").length,
    superseded: items.filter((item) => item.lifecycleStatus === "superseded").length,
    draft: items.filter((item) => item.lifecycleStatus === "draft").length,
    createdFromLearning: items.filter((item) => matchesAccountingRuleSourceFilter(item, "learning")).length,
  };
}

function canReactivateRule(row: AccountingRuleAdminRow, lifecycleStatus: AccountingRuleLifecycleStatus) {
  if (lifecycleStatus !== "paused") {
    return {
      allowed: false,
      reason: "Solo puedes reactivar reglas pausadas.",
    };
  }

  if (asString(row.superseded_by_rule_id)) {
    return {
      allowed: false,
      reason: "No puedes reactivar una regla que ya fue sustituida por una sucesora.",
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}

export async function loadAccountingRulesAdminPageData(input: {
  organizationId: string;
  selectedRuleId?: string | null;
  filters?: Partial<AccountingRulesAdminFilters>;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const rows = await loadAccountingRulesAdminRows(supabase, input.organizationId);
  const lookups = await loadRuleLookupMaps(supabase, rows);
  const allItems = sortAccountingRuleListItems(rows.map((row) => mapRowToListItem(row, lookups)));
  const filters = normalizeAccountingRulesAdminFilters({
    search: input.filters?.search,
    status: input.filters?.status,
    scope: input.filters?.scope,
    source: input.filters?.source,
  });
  const filteredItems = filterAccountingRuleListItems(allItems, filters);
  const selectedRuleId =
    filteredItems.find((item) => item.id === input.selectedRuleId)?.id
    ?? filteredItems[0]?.id
    ?? null;
  const selectedRow = selectedRuleId
    ? rows.find((row) => row.id === selectedRuleId) ?? null
    : null;
  const itemsById = new Map(allItems.map((item) => [item.id, item]));
  let selectedRule: AccountingRuleDetail | null = null;

  if (selectedRuleId && selectedRow) {
    const baseItem = itemsById.get(selectedRuleId);

    if (baseItem) {
      const lifecycleStatus = deriveAccountingRuleLifecycleStatus({
        lifecycleStatus: asString(selectedRow.lifecycle_status),
        approvalStatus: asString(selectedRow.status),
        isActive: asBoolean(selectedRow.is_active),
        supersededByRuleId: asString(selectedRow.superseded_by_rule_id),
      });
      const [timeline, affectedDocuments, actorDisplayById] = await Promise.all([
        loadAccountingRuleTimeline(supabase, {
          organizationId: input.organizationId,
          ruleId: selectedRuleId,
        }),
        loadAccountingRuleAffectedDocuments(supabase, {
          organizationId: input.organizationId,
          ruleId: selectedRuleId,
        }),
        loadProfileDisplayMap(
          supabase,
          [
            asString(selectedRow.created_by),
            asString(selectedRow.approved_by),
          ].filter((value): value is string => Boolean(value)),
        ),
      ]);
      const reactivation = canReactivateRule(selectedRow, lifecycleStatus);

      selectedRule = {
        ...baseItem,
        ruleId: selectedRuleId,
        metadata: asRecord(selectedRow.metadata),
        explainability: asRecord(selectedRow.explainability_json),
        createdAt: asString(selectedRow.created_at),
        activatedAt: asString(selectedRow.activated_at),
        pausedAt: asString(selectedRow.paused_at),
        retiredAt: asString(selectedRow.retired_at),
        createdByDisplay:
          asString(selectedRow.created_by)
            ? actorDisplayById.get(asString(selectedRow.created_by) as string) ?? asString(selectedRow.created_by)
            : null,
        approvedByDisplay:
          asString(selectedRow.approved_by)
            ? actorDisplayById.get(asString(selectedRow.approved_by) as string) ?? asString(selectedRow.approved_by)
            : null,
        supersedesRuleLabel: baseItem.supersedesRuleId
          ? itemsById.get(baseItem.supersedesRuleId)?.name ?? baseItem.supersedesRuleId
          : null,
        supersededByRuleLabel: baseItem.supersededByRuleId
          ? itemsById.get(baseItem.supersededByRuleId)?.name ?? baseItem.supersededByRuleId
          : null,
        canPause: lifecycleStatus === "active",
        canReactivate: reactivation.allowed,
        reactivationBlockedReason: reactivation.reason,
        affectedDocuments,
        timeline,
      };
    }
  }

  return {
    filters,
    metrics: buildMetrics(allItems),
    rules: filteredItems,
    selectedRuleId,
    selectedRule,
  } satisfies AccountingRulesAdminPageData;
}

async function recordAccountingRuleEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    ruleId: string;
    actorUserId: string | null;
    eventType: string;
    reason: string;
    payload?: Record<string, unknown>;
  },
) {
  const { error } = await supabase
    .from("accounting_rule_events")
    .insert({
      organization_id: input.organizationId,
      rule_id: input.ruleId,
      actor_user_id: input.actorUserId,
      event_type: input.eventType,
      reason: input.reason,
      payload_json: input.payload ?? {},
    });

  if (error && isMissingSupabaseRelationError(error, "accounting_rule_events")) {
    return;
  }

  if (error) {
    throw new Error(error.message);
  }
}

async function recordAuditLogEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorUserId: string | null;
    ruleId: string;
    action: string;
    beforeJson: Record<string, unknown>;
    afterJson: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await supabase
    .from("audit_log")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId,
      entity_type: "accounting_rule",
      entity_id: input.ruleId,
      action: input.action,
      before_json: input.beforeJson,
      after_json: input.afterJson,
      metadata: input.metadata ?? {},
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function loadRuleForLifecycleMutation(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    ruleId: string;
  },
) {
  const { data, error } = await supabase
    .from("accounting_rules")
    .select(
      "id, organization_id, status, lifecycle_status, is_active, pause_reason, superseded_by_rule_id, updated_at, created_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("id", input.ruleId)
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No encontramos la regla contable solicitada.");
  }

  return data as AccountingRuleAdminRow;
}

export async function pauseAccountingRule(input: {
  organizationId: string;
  ruleId: string;
  actorUserId: string | null;
  reason: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const reason = input.reason.trim();

  if (!reason) {
    throw new Error("La pausa exige un motivo.");
  }

  const current = await loadRuleForLifecycleMutation(supabase, input);
  const lifecycleStatus = deriveAccountingRuleLifecycleStatus({
    lifecycleStatus: asString(current.lifecycle_status),
    approvalStatus: asString(current.status),
    isActive: asBoolean(current.is_active),
    supersededByRuleId: asString(current.superseded_by_rule_id),
  });

  if (lifecycleStatus !== "active") {
    throw new Error("Solo puedes pausar reglas activas.");
  }

  const now = new Date().toISOString();
  const patch = {
    lifecycle_status: "paused",
    is_active: false,
    pause_reason: reason,
    paused_at: now,
    updated_at: now,
  };
  const { error } = await supabase
    .from("accounting_rules")
    .update(patch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.ruleId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAccountingRuleEvent(supabase, {
    organizationId: input.organizationId,
    ruleId: input.ruleId,
    actorUserId: input.actorUserId,
    eventType: "paused",
    reason,
    payload: {
      previous_lifecycle_status: lifecycleStatus,
      next_lifecycle_status: "paused",
    },
  });
  await recordAuditLogEvent(supabase, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    ruleId: input.ruleId,
    action: "accounting_rule:paused",
    beforeJson: {
      lifecycle_status: lifecycleStatus,
      is_active: current.is_active,
      pause_reason: current.pause_reason,
    },
    afterJson: patch,
    metadata: {
      reason,
    },
  });
}

export async function reactivateAccountingRule(input: {
  organizationId: string;
  ruleId: string;
  actorUserId: string | null;
  reason: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const reason = input.reason.trim();

  if (!reason) {
    throw new Error("La reactivacion exige un motivo.");
  }

  const current = await loadRuleForLifecycleMutation(supabase, input);
  const lifecycleStatus = deriveAccountingRuleLifecycleStatus({
    lifecycleStatus: asString(current.lifecycle_status),
    approvalStatus: asString(current.status),
    isActive: asBoolean(current.is_active),
    supersededByRuleId: asString(current.superseded_by_rule_id),
  });
  const reactivation = canReactivateRule(current, lifecycleStatus);

  if (!reactivation.allowed) {
    throw new Error(reactivation.reason ?? "No puedes reactivar esta regla.");
  }

  const now = new Date().toISOString();
  const patch = {
    lifecycle_status: "active",
    is_active: true,
    activated_at: now,
    updated_at: now,
  };
  const { error } = await supabase
    .from("accounting_rules")
    .update(patch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.ruleId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAccountingRuleEvent(supabase, {
    organizationId: input.organizationId,
    ruleId: input.ruleId,
    actorUserId: input.actorUserId,
    eventType: "reactivated",
    reason,
    payload: {
      previous_lifecycle_status: lifecycleStatus,
      next_lifecycle_status: "active",
    },
  });
  await recordAuditLogEvent(supabase, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    ruleId: input.ruleId,
    action: "accounting_rule:reactivated",
    beforeJson: {
      lifecycle_status: lifecycleStatus,
      is_active: current.is_active,
      pause_reason: current.pause_reason,
    },
    afterJson: patch,
    metadata: {
      reason,
    },
  });
}
