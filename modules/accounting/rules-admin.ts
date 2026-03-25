import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAIModelConfig } from "@/lib/env";
import { createStructuredOpenAIResponse } from "@/lib/llm/openai-responses";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  isMissingSupabaseColumnError,
  isMissingSupabaseRelationError,
} from "@/lib/supabase/schema-compat";
import { loadActiveAccountingRules } from "@/modules/accounting/repository";
import { deriveDocumentAccountingState } from "@/modules/accounting/runtime";
import type {
  AccountingRuleRecord,
  AccountingRuleLifecycleStatus,
  AccountingRuleScope,
} from "@/modules/accounting/types";
import { loadReviewDocumentContext } from "@/modules/documents/review-context";
import {
  formatDocumentRoleLabel,
  formatRuleScopeLabel,
} from "@/modules/presentation/labels";

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

export type AccountingRulesAdminEditorOptions = {
  vendors: AccountingRuleEditorOption[];
  concepts: AccountingRuleEditorOption[];
  accounts: AccountingRuleEditorOption[];
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
  vendorId: string | "all";
  accountId: string | "all";
  operationCategory: string | "all";
  onlyWithConflicts: boolean;
  onlyUnused: boolean;
};

export type AccountingRulesAdminFilterOptions = {
  vendors: AccountingRuleEditorOption[];
  accounts: AccountingRuleEditorOption[];
  operationCategories: string[];
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

export type AccountingRuleConflict = {
  otherRuleId: string;
  otherRuleName: string;
  otherRuleScope: AccountingRuleScope;
  otherRulePriority: number;
  conflictType: "same_segment_same_scope" | "broader_scope_overlap" | "narrower_scope_overlap";
  severity: "info" | "warning";
  summary: string;
};

export type AccountingRuleSimulationExample = {
  documentId: string;
  originalFilename: string;
  documentDate: string | null;
  previousRuleId: string | null;
  previousRuleName: string | null;
  previousScope: string | null;
  nextRuleId: string | null;
  nextRuleName: string | null;
  nextScope: string | null;
  changed: boolean;
};

export type AccountingRuleSimulationSummary = {
  id: string;
  simulationType: string;
  sampleSize: number;
  affectedDocumentsCount: number;
  affectedRecentDocumentsCount: number;
  createdAt: string;
  createdByDisplay: string | null;
  summary: Record<string, unknown>;
  examples: AccountingRuleSimulationExample[];
};

export type AccountingRuleAiThreadSummary = {
  id: string;
  title: string;
  contextScope: string;
  contextRuleId: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export type AccountingRuleAiMessageView = {
  id: string;
  role: "user" | "assistant" | "system_context";
  messageText: string;
  structuredPayload: Record<string, unknown>;
  referencedRuleIds: string[];
  referencedDocumentIds: string[];
  provider: string | null;
  model: string | null;
  createdAt: string;
};

export type AccountingRuleAiThreadDetail = {
  id: string;
  title: string;
  contextScope: string;
  contextRuleId: string | null;
  messages: AccountingRuleAiMessageView[];
};

export type AccountingRulePriorityDirection = "up" | "down";

export type AccountingRuleAiAnalysis = {
  assistant_reply: string;
  user_intent_summary: string;
  current_rules_relevant: Array<{
    rule_id: string | null;
    rule_name: string;
    scope: string;
    priority: number | null;
    why_it_matters: string;
  }>;
  current_winning_logic: string;
  coverage_gaps: string[];
  conflicts: string[];
  recommended_manual_actions: Array<{
    action: string;
    target_rule_id: string | null;
    reasoning: string;
    risk: string;
  }>;
  warnings: string[];
  example_explanations: string[];
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
  vendorId: string | null;
  conceptId: string | null;
  accountId: string | null;
  operationCategory: string | null;
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
  hasConflicts: boolean;
  conflictCount: number;
  conflictSummary: string | null;
  segmentKey: string;
  searchableText: string;
};

export type AccountingRuleDetail = AccountingRulesAdminListItem & {
  ruleId: string;
  documentId: string | null;
  vendorId: string | null;
  conceptId: string | null;
  accountId: string | null;
  taxProfileCode: string | null;
  operationCategory: string | null;
  linkedOperationType: string | null;
  templateCode: string | null;
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
  canDeleteUnused: boolean;
  deleteUnusedBlockedReason: string | null;
  conflicts: AccountingRuleConflict[];
  canMovePriorityUp: boolean;
  canMovePriorityDown: boolean;
  priorityUpLabel: string | null;
  priorityDownLabel: string | null;
  recentSimulations: AccountingRuleSimulationSummary[];
  selectedSimulation: AccountingRuleSimulationSummary | null;
  aiThreads: AccountingRuleAiThreadSummary[];
  selectedAiThreadId: string | null;
  selectedAiThread: AccountingRuleAiThreadDetail | null;
  affectedDocuments: AccountingRuleAffectedDocument[];
  timeline: AccountingRuleTimelineItem[];
};

export type AccountingRuleEditorOption = {
  id: string;
  label: string;
  note?: string | null;
};

export type AccountingRulesAdminPageData = {
  filters: AccountingRulesAdminFilters;
  filterOptions: AccountingRulesAdminFilterOptions;
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
  selectedSimulationId: string | null;
  selectedThreadId: string | null;
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

function normalizeEntityFilter(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value.trim() : "all";
}

function normalizeBooleanFilter(value: string | null | undefined) {
  return value === "1" || value === "true" || value === "on";
}

export function normalizeAccountingRulesAdminFilters(input: {
  search?: string | null;
  status?: string | null;
  scope?: string | null;
  source?: string | null;
  vendorId?: string | null;
  accountId?: string | null;
  operationCategory?: string | null;
  onlyWithConflicts?: string | null;
  onlyUnused?: string | null;
}) {
  return {
    search: normalizeSearch(input.search),
    status: normalizeStatusFilter(input.status),
    scope: normalizeScopeFilter(input.scope),
    source: normalizeSourceFilter(input.source),
    vendorId: normalizeEntityFilter(input.vendorId),
    accountId: normalizeEntityFilter(input.accountId),
    operationCategory: normalizeEntityFilter(input.operationCategory),
    onlyWithConflicts: normalizeBooleanFilter(input.onlyWithConflicts),
    onlyUnused: normalizeBooleanFilter(input.onlyUnused),
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

function buildRuleSegmentKey(input: {
  scope: AccountingRuleScope;
  documentRole: string;
  documentId: string | null;
  vendorId: string | null;
  conceptId: string | null;
  operationCategory: string | null;
}) {
  switch (input.scope) {
    case "document_override":
      return [input.scope, input.documentRole, input.documentId ?? "none"].join(":");
    case "vendor_concept_operation_category":
      return [
        input.scope,
        input.documentRole,
        input.vendorId ?? "none",
        input.conceptId ?? "none",
        input.operationCategory ?? "none",
      ].join(":");
    case "vendor_concept":
      return [
        input.scope,
        input.documentRole,
        input.vendorId ?? "none",
        input.conceptId ?? "none",
      ].join(":");
    case "concept_global":
      return [input.scope, input.documentRole, input.conceptId ?? "none"].join(":");
    case "vendor_default":
      return [input.scope, input.documentRole, input.vendorId ?? "none"].join(":");
    default:
      return [input.scope, input.documentRole].join(":");
  }
}

function ruleCouldOverlap(left: AccountingRulesAdminListItem, right: AccountingRulesAdminListItem) {
  if (left.id === right.id || left.documentRole !== right.documentRole) {
    return false;
  }

  if (
    left.scope === right.scope
    && left.segmentKey === right.segmentKey
  ) {
    return true;
  }

  const vendorOverlap =
    !left.vendorId
    || !right.vendorId
    || left.vendorId === right.vendorId;
  const conceptOverlap =
    !left.conceptId
    || !right.conceptId
    || left.conceptId === right.conceptId;
  const operationOverlap =
    !left.operationCategory
    || !right.operationCategory
    || left.operationCategory === right.operationCategory;

  return vendorOverlap && conceptOverlap && operationOverlap;
}

function buildConflictType(left: AccountingRulesAdminListItem, right: AccountingRulesAdminListItem) {
  if (left.scope === right.scope && left.segmentKey === right.segmentKey) {
    return "same_segment_same_scope" as const;
  }

  const leftScopeOrder = resolveRuleScopeOrder(left.scope);
  const rightScopeOrder = resolveRuleScopeOrder(right.scope);

  return leftScopeOrder < rightScopeOrder
    ? "broader_scope_overlap"
    : "narrower_scope_overlap";
}

function buildConflictSummary(left: AccountingRulesAdminListItem, right: AccountingRulesAdminListItem) {
  if (left.scope === right.scope && left.segmentKey === right.segmentKey) {
    return `Comparte scope y segmento con ${right.name}; la prioridad decide quien gana.`;
  }

  return `Puede competir con ${right.name} por vendor/concepto/operacion superpuestos.`;
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
    vendorId: asString(row.vendor_id),
    conceptId: asString(row.concept_id),
    accountId: asString(row.account_id),
    operationCategory: asString(row.operation_category),
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
    hasConflicts: false,
    conflictCount: 0,
    conflictSummary: null,
    segmentKey: buildRuleSegmentKey({
      scope: row.scope as AccountingRuleScope,
      documentRole: row.document_role,
      documentId: asString(row.document_id),
      vendorId: asString(row.vendor_id),
      conceptId: asString(row.concept_id),
      operationCategory: asString(row.operation_category),
    }),
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

export function enrichRuleItemsWithConflicts(items: AccountingRulesAdminListItem[]) {
  const conflictsByRuleId = new Map<string, AccountingRuleConflict[]>();

  for (const item of items) {
    conflictsByRuleId.set(item.id, []);
  }

  for (let index = 0; index < items.length; index += 1) {
    const left = items[index];

    for (let innerIndex = index + 1; innerIndex < items.length; innerIndex += 1) {
      const right = items[innerIndex];

      if (
        left.lifecycleStatus !== "active"
        || right.lifecycleStatus !== "active"
        || !ruleCouldOverlap(left, right)
      ) {
        continue;
      }

      const leftType = buildConflictType(left, right);
      const rightType = buildConflictType(right, left);

      conflictsByRuleId.get(left.id)?.push({
        otherRuleId: right.id,
        otherRuleName: right.name,
        otherRuleScope: right.scope,
        otherRulePriority: right.priority,
        conflictType: leftType,
        severity: leftType === "same_segment_same_scope" ? "warning" : "info",
        summary: buildConflictSummary(left, right),
      });
      conflictsByRuleId.get(right.id)?.push({
        otherRuleId: left.id,
        otherRuleName: left.name,
        otherRuleScope: left.scope,
        otherRulePriority: left.priority,
        conflictType: rightType,
        severity: rightType === "same_segment_same_scope" ? "warning" : "info",
        summary: buildConflictSummary(right, left),
      });
    }
  }

  return items.map((item) => {
    const conflicts = conflictsByRuleId.get(item.id) ?? [];

    return {
      ...item,
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
      conflictSummary: conflicts[0]?.summary ?? null,
    } satisfies AccountingRulesAdminListItem;
  });
}

function buildAccountingRulesAdminFilterOptions(items: AccountingRulesAdminListItem[]) {
  return {
    vendors: items
      .filter((item) => item.vendorId && item.vendorName)
      .map((item) => ({
        id: item.vendorId as string,
        label: item.vendorName as string,
      }))
      .filter((option, index, array) => array.findIndex((entry) => entry.id === option.id) === index)
      .sort((left, right) => left.label.localeCompare(right.label, "es")),
    accounts: items
      .filter((item) => item.accountId && item.accountLabel)
      .map((item) => ({
        id: item.accountId as string,
        label: item.accountLabel as string,
      }))
      .filter((option, index, array) => array.findIndex((entry) => entry.id === option.id) === index)
      .sort((left, right) => left.label.localeCompare(right.label, "es")),
    operationCategories: items
      .map((item) => item.operationCategory)
      .filter((value): value is string => Boolean(value))
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort((left, right) => left.localeCompare(right, "es")),
  } satisfies AccountingRulesAdminFilterOptions;
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

    if (filters.vendorId !== "all" && item.vendorId !== filters.vendorId) {
      return false;
    }

    if (filters.accountId !== "all" && item.accountId !== filters.accountId) {
      return false;
    }

    if (
      filters.operationCategory !== "all"
      && item.operationCategory !== filters.operationCategory
    ) {
      return false;
    }

    if (filters.onlyWithConflicts && !item.hasConflicts) {
      return false;
    }

    if (
      filters.onlyUnused
      && (
        item.documentsAppliedCount > 0
        || item.matchesCount > 0
        || Boolean(item.supersededByRuleId)
      )
    ) {
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

export async function loadAccountingRulesAdminEditorOptions(organizationId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const [vendorsResult, conceptsResult, accountsResult] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true })
      .limit(300),
    supabase
      .from("organization_concepts")
      .select("id, canonical_name, document_role, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("canonical_name", { ascending: true })
      .limit(300),
    supabase
      .from("chart_of_accounts")
      .select("id, code, name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("is_postable", true)
      .order("code", { ascending: true })
      .limit(500),
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

  return {
    vendors: (((vendorsResult.data as VendorLookupRow[] | null) ?? [])).map((row) => ({
      id: row.id,
      label: row.name,
    })),
    concepts: ((((conceptsResult.data as Array<ConceptLookupRow & {
      document_role?: string | null;
    }> | null) ?? []))).map((row) => ({
      id: row.id,
      label: row.canonical_name,
      note: asString(row.document_role),
    })),
    accounts: (((accountsResult.data as AccountLookupRow[] | null) ?? [])).map((row) => ({
      id: row.id,
      label: `${row.code} - ${row.name}`,
      note: row.code,
    })),
  } satisfies AccountingRulesAdminEditorOptions;
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

type AccountingRuleSimulationRow = {
  id: string;
  simulation_type: string;
  sample_size: number | null;
  affected_documents_count: number | null;
  affected_recent_documents_count: number | null;
  summary_json: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
};

type AccountingRuleAiThreadRow = {
  id: string;
  title: string;
  context_scope: string;
  context_rule_id: string | null;
  archived_at: string | null;
  created_at: string;
};

type AccountingRuleAiMessageRow = {
  id: string;
  thread_id: string;
  role: string;
  message_text: string;
  structured_payload_json: Record<string, unknown> | null;
  referenced_rule_ids: string[] | null;
  referenced_document_ids: string[] | null;
  provider: string | null;
  model: string | null;
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
    case "deleted_unused":
      return "Regla eliminada sin uso";
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

  if (value === "accounting_rule:superseded") {
    return "Regla reemplazada";
  }

  if (value === "accounting_rule:deleted_unused") {
    return "Regla eliminada sin uso";
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
    ? new Set([
      "accounting_rule:paused",
      "accounting_rule:reactivated",
      "accounting_rule:superseded",
      "accounting_rule:deleted_unused",
      "created_from_rules_admin",
    ])
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

export function resolveSupersedingRuleScopeFields(input: {
  scope: AccountingRuleScope;
  currentDocumentId: string | null;
  vendorId: string | null;
  conceptId: string | null;
  operationCategory: string | null;
}) {
  const errors: string[] = [];

  if (input.scope === "document_override" && !input.currentDocumentId) {
    errors.push("No puedes convertir esta regla en document override porque no tiene documento ancla.");
  }

  if (
    (input.scope === "vendor_concept" || input.scope === "vendor_concept_operation_category" || input.scope === "vendor_default")
    && !input.vendorId
  ) {
    errors.push("El scope elegido requiere proveedor.");
  }

  if (
    (input.scope === "vendor_concept" || input.scope === "vendor_concept_operation_category" || input.scope === "concept_global")
    && !input.conceptId
  ) {
    errors.push("El scope elegido requiere concepto.");
  }

  if (input.scope === "vendor_concept_operation_category" && !input.operationCategory) {
    errors.push("El scope elegido requiere categoria operativa.");
  }

  return {
    documentId: input.scope === "document_override" ? input.currentDocumentId : null,
    vendorId:
      input.scope === "vendor_concept"
      || input.scope === "vendor_concept_operation_category"
      || input.scope === "vendor_default"
        ? input.vendorId
        : null,
    conceptId:
      input.scope === "vendor_concept"
      || input.scope === "vendor_concept_operation_category"
      || input.scope === "concept_global"
        ? input.conceptId
        : null,
    operationCategory:
      input.scope === "vendor_concept_operation_category" ? input.operationCategory : null,
    errors,
  };
}

export function evaluateDeleteUnusedGuard(input: {
  documentsAppliedCount: number;
  matchesCount: number;
  hasAssignmentUsage: boolean;
  hasDecisionLogUsage: boolean;
  hasActiveDescendant: boolean;
}) {
  if (input.documentsAppliedCount > 0 || input.matchesCount > 0) {
    return {
      allowed: false,
      reason: "No se puede eliminar porque ya tiene trazabilidad. Debes pausarla.",
    };
  }

  if (input.hasAssignmentUsage || input.hasDecisionLogUsage) {
    return {
      allowed: false,
      reason: "No se puede eliminar porque ya aparece en corridas o logs historicos.",
    };
  }

  if (input.hasActiveDescendant) {
    return {
      allowed: false,
      reason: "No se puede eliminar porque ya tiene una sucesora activa en la misma familia.",
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}

async function loadRuleUsageSignals(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    ruleId: string;
    stableFamilyCode: string | null;
    versionNumber: number;
  },
) {
  const [assignmentResult, logResult, descendantResult] = await Promise.all([
    supabase
      .from("document_assignment_runs")
      .select("document_id")
      .eq("organization_id", input.organizationId)
      .eq("status", "completed")
      .contains("response_json", { applied_rule: { rule_id: input.ruleId } })
      .limit(1),
    supabase
      .from("ai_decision_logs")
      .select("document_id")
      .eq("organization_id", input.organizationId)
      .eq("run_type", "accounting_resolution")
      .contains("metadata_json", { rule_id: input.ruleId })
      .limit(1),
    input.stableFamilyCode
      ? supabase
        .from("accounting_rules")
        .select("id, version_number, lifecycle_status, status, is_active, superseded_by_rule_id")
        .eq("organization_id", input.organizationId)
        .eq("stable_family_code", input.stableFamilyCode)
        .neq("id", input.ruleId)
        .order("version_number", { ascending: false })
        .limit(24)
      : supabase
        .from("accounting_rules")
        .select("id, version_number, lifecycle_status, status, is_active, superseded_by_rule_id")
        .eq("organization_id", input.organizationId)
        .eq("supersedes_rule_id", input.ruleId)
        .limit(24),
  ]);

  const assignmentRows = assignmentResult.error && isMissingSupabaseRelationError(
    assignmentResult.error,
    "document_assignment_runs",
  )
    ? []
    : ((assignmentResult.data as Array<{ document_id: string }> | null) ?? []);
  const logRows = logResult.error && isMissingSupabaseRelationError(logResult.error, "ai_decision_logs")
    ? []
    : ((logResult.data as Array<{ document_id: string }> | null) ?? []);

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

  if (descendantResult.error) {
    throw new Error(descendantResult.error.message);
  }

  const descendantRows = ((descendantResult.data as AccountingRuleAdminRow[] | null) ?? []);
  const hasActiveDescendant = descendantRows.some((row) => {
    if (
      input.stableFamilyCode
      && (asNumber(row.version_number) ?? 0) <= input.versionNumber
    ) {
      return false;
    }

    return deriveAccountingRuleLifecycleStatus({
      lifecycleStatus: asString(row.lifecycle_status),
      approvalStatus: asString(row.status),
      isActive: asBoolean(row.is_active),
      supersededByRuleId: asString(row.superseded_by_rule_id),
    }) === "active";
  });

  return {
    hasAssignmentUsage: assignmentRows.length > 0,
    hasDecisionLogUsage: logRows.length > 0,
    hasActiveDescendant,
  };
}

function loadRuleConflicts(
  item: AccountingRulesAdminListItem,
  items: AccountingRulesAdminListItem[],
) {
  return items
    .filter((candidate) => candidate.id !== item.id && ruleCouldOverlap(item, candidate))
    .filter((candidate) => candidate.lifecycleStatus === "active")
    .map((candidate) => {
      const conflictType = buildConflictType(item, candidate);

      return {
        otherRuleId: candidate.id,
        otherRuleName: candidate.name,
        otherRuleScope: candidate.scope,
        otherRulePriority: candidate.priority,
        conflictType,
        severity: conflictType === "same_segment_same_scope" ? "warning" : "info",
        summary: buildConflictSummary(item, candidate),
      } satisfies AccountingRuleConflict;
    })
    .sort((left, right) => right.otherRulePriority - left.otherRulePriority)
    .slice(0, 8);
}

function resolvePriorityNeighbors(
  item: AccountingRulesAdminListItem,
  items: AccountingRulesAdminListItem[],
) {
  const segmentItems = items
    .filter((candidate) => (
      candidate.lifecycleStatus === "active"
      && candidate.scope === item.scope
      && candidate.segmentKey === item.segmentKey
    ))
    .sort((left, right) => right.priority - left.priority);
  const index = segmentItems.findIndex((candidate) => candidate.id === item.id);
  const higher = index > 0 ? segmentItems[index - 1] : null;
  const lower = index >= 0 && index < segmentItems.length - 1 ? segmentItems[index + 1] : null;

  return {
    canMoveUp: Boolean(higher),
    canMoveDown: Boolean(lower),
    upLabel: higher ? `${higher.name} (prio ${higher.priority})` : null,
    downLabel: lower ? `${lower.name} (prio ${lower.priority})` : null,
  };
}

async function loadAccountingRuleSimulations(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    ruleId: string;
    selectedSimulationId?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("accounting_rule_simulations")
    .select(
      "id, simulation_type, sample_size, affected_documents_count, affected_recent_documents_count, summary_json, created_by, created_at",
    )
    .eq("organization_id", input.organizationId)
    .or(`base_rule_id.eq.${input.ruleId},candidate_rule_id.eq.${input.ruleId}`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error && isMissingSupabaseRelationError(error, "accounting_rule_simulations")) {
    return {
      selectedSimulationId: null,
      simulations: [] as AccountingRuleSimulationSummary[],
      selectedSimulation: null as AccountingRuleSimulationSummary | null,
    };
  }

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data as AccountingRuleSimulationRow[] | null) ?? []);
  const actorDisplayById = await loadProfileDisplayMap(
    supabase,
    rows.map((row) => row.created_by).filter((value): value is string => Boolean(value)),
  );
  const simulations = rows.map((row) => ({
    id: row.id,
    simulationType: row.simulation_type,
    sampleSize: asNumber(row.sample_size) ?? 0,
    affectedDocumentsCount: asNumber(row.affected_documents_count) ?? 0,
    affectedRecentDocumentsCount: asNumber(row.affected_recent_documents_count) ?? 0,
    createdAt: row.created_at,
    createdByDisplay: row.created_by
      ? actorDisplayById.get(row.created_by) ?? row.created_by
      : null,
    summary: asRecord(row.summary_json),
    examples: Array.isArray(asRecord(row.summary_json).examples)
      ? (asRecord(row.summary_json).examples as AccountingRuleSimulationExample[])
      : [],
  })) satisfies AccountingRuleSimulationSummary[];
  const selectedSimulationId =
    simulations.find((simulation) => simulation.id === input.selectedSimulationId)?.id
    ?? simulations[0]?.id
    ?? null;

  return {
    selectedSimulationId,
    simulations,
    selectedSimulation: simulations.find((simulation) => simulation.id === selectedSimulationId) ?? null,
  };
}

async function loadAccountingRuleAiThreads(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    ruleId: string;
    selectedThreadId?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("accounting_rule_ai_threads")
    .select("id, title, context_scope, context_rule_id, archived_at, created_at")
    .eq("organization_id", input.organizationId)
    .or(`context_rule_id.eq.${input.ruleId},context_scope.eq.global`)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error && isMissingSupabaseRelationError(error, "accounting_rule_ai_threads")) {
    return {
      selectedThreadId: null,
      threads: [] as AccountingRuleAiThreadSummary[],
      selectedThread: null as AccountingRuleAiThreadDetail | null,
    };
  }

  if (error) {
    throw new Error(error.message);
  }

  const threads = (((data as AccountingRuleAiThreadRow[] | null) ?? [])).map((row) => ({
    id: row.id,
    title: row.title,
    contextScope: row.context_scope,
    contextRuleId: row.context_rule_id,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  })) satisfies AccountingRuleAiThreadSummary[];
  const selectedThreadId =
    threads.find((thread) => thread.id === input.selectedThreadId)?.id
    ?? threads[0]?.id
    ?? null;

  if (!selectedThreadId) {
    return {
      selectedThreadId: null,
      threads,
      selectedThread: null,
    };
  }

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const messagesResult = await supabase
    .from("accounting_rule_ai_messages")
    .select("id, thread_id, role, message_text, structured_payload_json, referenced_rule_ids, referenced_document_ids, provider, model, created_at")
    .eq("thread_id", selectedThreadId)
    .order("created_at", { ascending: true })
    .limit(40);

  if (messagesResult.error && isMissingSupabaseRelationError(messagesResult.error, "accounting_rule_ai_messages")) {
    return {
      selectedThreadId,
      threads,
      selectedThread: selectedThread
        ? {
          id: selectedThread.id,
          title: selectedThread.title,
          contextScope: selectedThread.contextScope,
          contextRuleId: selectedThread.contextRuleId,
          messages: [],
        }
        : null,
    };
  }

  if (messagesResult.error) {
    throw new Error(messagesResult.error.message);
  }

  return {
    selectedThreadId,
    threads,
    selectedThread: selectedThread
      ? {
        id: selectedThread.id,
        title: selectedThread.title,
        contextScope: selectedThread.contextScope,
        contextRuleId: selectedThread.contextRuleId,
        messages: (((messagesResult.data as AccountingRuleAiMessageRow[] | null) ?? [])).map((row) => ({
          id: row.id,
          role:
            row.role === "assistant" || row.role === "system_context"
              ? row.role
              : "user",
          messageText: row.message_text,
          structuredPayload: asRecord(row.structured_payload_json),
          referencedRuleIds: Array.isArray(row.referenced_rule_ids) ? row.referenced_rule_ids : [],
          referencedDocumentIds: Array.isArray(row.referenced_document_ids) ? row.referenced_document_ids : [],
          provider: asString(row.provider),
          model: asString(row.model),
          createdAt: row.created_at,
        })) satisfies AccountingRuleAiMessageView[],
      }
      : null,
  };
}

export async function loadAccountingRulesAdminPageData(input: {
  organizationId: string;
  selectedRuleId?: string | null;
  selectedSimulationId?: string | null;
  selectedThreadId?: string | null;
  filters?: Partial<AccountingRulesAdminFilters>;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const rows = await loadAccountingRulesAdminRows(supabase, input.organizationId);
  const lookups = await loadRuleLookupMaps(supabase, rows);
  const allItems = sortAccountingRuleListItems(
    enrichRuleItemsWithConflicts(rows.map((row) => mapRowToListItem(row, lookups))),
  );
  const filters = normalizeAccountingRulesAdminFilters({
    search: input.filters?.search,
    status: input.filters?.status,
    scope: input.filters?.scope,
    source: input.filters?.source,
    vendorId: input.filters?.vendorId,
    accountId: input.filters?.accountId,
    operationCategory: input.filters?.operationCategory,
    onlyWithConflicts: input.filters?.onlyWithConflicts ? "1" : "0",
    onlyUnused: input.filters?.onlyUnused ? "1" : "0",
  });
  const filterOptions = buildAccountingRulesAdminFilterOptions(allItems);
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
      const [timeline, affectedDocuments, actorDisplayById, usageSignals] = await Promise.all([
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
        loadRuleUsageSignals(supabase, {
          organizationId: input.organizationId,
          ruleId: selectedRuleId,
          stableFamilyCode: asString(selectedRow.stable_family_code),
          versionNumber: asNumber(selectedRow.version_number) ?? 1,
        }),
      ]);
      const reactivation = canReactivateRule(selectedRow, lifecycleStatus);
      const conflicts = loadRuleConflicts(baseItem, allItems);
      const priorityNeighbors = resolvePriorityNeighbors(baseItem, allItems);
      const [simulationState, aiState] = await Promise.all([
        loadAccountingRuleSimulations(supabase, {
          organizationId: input.organizationId,
          ruleId: selectedRuleId,
          selectedSimulationId: input.selectedSimulationId,
        }),
        loadAccountingRuleAiThreads(supabase, {
          organizationId: input.organizationId,
          ruleId: selectedRuleId,
          selectedThreadId: input.selectedThreadId,
        }),
      ]);
      const deleteGuard = lifecycleStatus === "superseded"
        ? {
          allowed: false,
          reason: "No se puede eliminar porque esta regla ya fue reemplazada por una sucesora.",
        }
        : lifecycleStatus === "deleted_if_unused"
          ? {
            allowed: false,
            reason: "Esta regla ya fue eliminada sin uso y queda solo para auditoria.",
          }
          : evaluateDeleteUnusedGuard({
            documentsAppliedCount: baseItem.documentsAppliedCount,
            matchesCount: baseItem.matchesCount,
            hasAssignmentUsage: usageSignals.hasAssignmentUsage,
            hasDecisionLogUsage: usageSignals.hasDecisionLogUsage,
            hasActiveDescendant: usageSignals.hasActiveDescendant,
          });

      selectedRule = {
        ...baseItem,
        ruleId: selectedRuleId,
        documentId: asString(selectedRow.document_id),
        vendorId: asString(selectedRow.vendor_id),
        conceptId: asString(selectedRow.concept_id),
        accountId: asString(selectedRow.account_id),
        taxProfileCode: asString(selectedRow.tax_profile_code),
        operationCategory: asString(selectedRow.operation_category),
        linkedOperationType: asString(selectedRow.linked_operation_type),
        templateCode: asString(selectedRow.template_code),
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
        canDeleteUnused: deleteGuard.allowed,
        deleteUnusedBlockedReason: deleteGuard.reason,
        conflicts,
        canMovePriorityUp: priorityNeighbors.canMoveUp,
        canMovePriorityDown: priorityNeighbors.canMoveDown,
        priorityUpLabel: priorityNeighbors.upLabel,
        priorityDownLabel: priorityNeighbors.downLabel,
        recentSimulations: simulationState.simulations,
        selectedSimulation: simulationState.selectedSimulation,
        aiThreads: aiState.threads,
        selectedAiThreadId: aiState.selectedThreadId,
        selectedAiThread: aiState.selectedThread,
        affectedDocuments,
        timeline,
      };
    }
  }

  return {
    filters,
    filterOptions,
    metrics: buildMetrics(allItems),
    rules: filteredItems,
    selectedRuleId,
    selectedSimulationId: selectedRule?.selectedSimulation?.id ?? null,
    selectedThreadId: selectedRule?.selectedAiThreadId ?? null,
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

async function loadRuleForVersionedMutation(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    ruleId: string;
  },
) {
  const { data, error } = await supabase
    .from("accounting_rules")
    .select(
      [
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
        "metadata",
        "created_at",
        "updated_at",
      ].join(", "),
    )
    .eq("organization_id", input.organizationId)
    .eq("id", input.ruleId)
    .limit(1)
    .maybeSingle();
  const row = data as unknown as AccountingRuleAdminRow | null;

  if (error || !row?.id) {
    throw new Error(error?.message ?? "No encontramos la regla contable solicitada.");
  }

  return row;
}

function parseAccountingRuleScope(value: string): AccountingRuleScope {
  switch (value) {
    case "document_override":
    case "vendor_concept_operation_category":
    case "vendor_concept":
    case "concept_global":
    case "vendor_default":
      return value;
    default:
      throw new Error("El scope de la nueva version no es valido.");
  }
}

function parseAccountingDocumentRole(value: string) {
  switch (value) {
    case "purchase":
    case "sale":
    case "other":
      return value;
    default:
      throw new Error("El rol documental de la nueva version no es valido.");
  }
}

async function ensureRuleReferenceIntegrity(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    vendorId: string | null;
    conceptId: string | null;
    accountId: string;
  },
) {
  const [vendorResult, conceptResult, accountResult] = await Promise.all([
    input.vendorId
      ? supabase
        .from("vendors")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("id", input.vendorId)
        .limit(1)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    input.conceptId
      ? supabase
        .from("organization_concepts")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("id", input.conceptId)
        .limit(1)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("chart_of_accounts")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("id", input.accountId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (vendorResult.error) {
    throw new Error(vendorResult.error.message);
  }

  if (conceptResult.error) {
    throw new Error(conceptResult.error.message);
  }

  if (accountResult.error) {
    throw new Error(accountResult.error.message);
  }

  if (input.vendorId && !vendorResult.data?.id) {
    throw new Error("El proveedor elegido no pertenece a la organizacion.");
  }

  if (input.conceptId && !conceptResult.data?.id) {
    throw new Error("El concepto elegido no pertenece a la organizacion.");
  }

  if (!accountResult.data?.id) {
    throw new Error("La cuenta elegida no pertenece a la organizacion.");
  }
}

async function loadNextRuleVersionNumber(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    stableFamilyCode: string;
    currentVersionNumber: number;
  },
) {
  const { data, error } = await supabase
    .from("accounting_rules")
    .select("version_number")
    .eq("organization_id", input.organizationId)
    .eq("stable_family_code", input.stableFamilyCode)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Math.max(asNumber(data?.version_number) ?? 0, input.currentVersionNumber) + 1;
}

function mapAdminRowToAccountingRuleRecord(row: AccountingRuleAdminRow): AccountingRuleRecord {
  return {
    id: row.id,
    organization_id: row.organization_id,
    stable_family_code: asString(row.stable_family_code),
    version_number: asNumber(row.version_number) ?? 1,
    name: asString(row.name) ?? undefined,
    description: asString(row.description) ?? undefined,
    scope: row.scope as AccountingRuleScope,
    document_id: asString(row.document_id),
    source_document_id: asString(row.source_document_id) ?? asString(row.document_id),
    vendor_id: asString(row.vendor_id),
    concept_id: asString(row.concept_id),
    document_role: parseAccountingDocumentRole(row.document_role),
    account_id: row.account_id,
    status: (asString(row.status) as AccountingRuleRecord["status"] | null) ?? "approved",
    lifecycle_status: deriveAccountingRuleLifecycleStatus({
      lifecycleStatus: asString(row.lifecycle_status),
      approvalStatus: asString(row.status),
      isActive: asBoolean(row.is_active),
      supersededByRuleId: asString(row.superseded_by_rule_id),
    }),
    vat_profile_json: asRecord(row.vat_profile_json),
    tax_profile_code: asString(row.tax_profile_code),
    operation_category: asString(row.operation_category),
    linked_operation_type: asString(row.linked_operation_type),
    template_code: asString(row.template_code),
    times_reused: asNumber(row.times_reused) ?? 0,
    times_corrected: asNumber(row.times_corrected) ?? 0,
    times_matched: asNumber(row.times_matched) ?? 0,
    times_applied: asNumber(row.times_applied) ?? 0,
    priority: asNumber(row.priority) ?? 0,
    source: asString(row.source) ?? "manual",
    created_from: resolveRuleOrigin(row),
    is_active: asBoolean(row.is_active) ?? false,
    explainability_json: asRecord(row.explainability_json),
    supersedes_rule_id: asString(row.supersedes_rule_id),
    superseded_by_rule_id: asString(row.superseded_by_rule_id),
    pause_reason: asString(row.pause_reason),
    supersession_reason: asString(row.supersession_reason),
    activated_at: asString(row.activated_at),
    paused_at: asString(row.paused_at),
    retired_at: asString(row.retired_at),
    last_matched_at: asString(row.last_matched_at),
    metadata: asRecord(row.metadata),
    created_at: asString(row.created_at) ?? new Date().toISOString(),
    updated_at: asString(row.updated_at) ?? undefined,
  } satisfies AccountingRuleRecord;
}

function sortRuleRecordsByPriority(records: AccountingRuleRecord[]) {
  return [...records].sort((left, right) => right.priority - left.priority);
}

async function loadSimulationSampleDocuments(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentRole: "purchase" | "sale" | "other";
    limit?: number;
  },
) {
  const { data, error } = await supabase
    .from("document_drafts")
    .select("document_id, updated_at")
    .eq("organization_id", input.organizationId)
    .eq("document_role", input.documentRole)
    .order("updated_at", { ascending: false })
    .limit(input.limit ?? 10);

  if (error) {
    throw new Error(error.message);
  }

  const orderedDocumentIds = (((data as Array<{
    document_id: string;
    updated_at: string;
  }> | null) ?? []))
    .map((row) => row.document_id)
    .filter((value, index, array) => array.indexOf(value) === index);

  return orderedDocumentIds;
}

async function persistAccountingRuleSimulation(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorUserId: string | null;
    baseRuleId: string | null;
    candidateRuleId?: string | null;
    simulationType: string;
    sampleSize: number;
    affectedDocumentsCount: number;
    affectedRecentDocumentsCount: number;
    summary: Record<string, unknown>;
  },
) {
  const { data, error } = await supabase
    .from("accounting_rule_simulations")
    .insert({
      organization_id: input.organizationId,
      base_rule_id: input.baseRuleId,
      candidate_rule_id: input.candidateRuleId ?? null,
      simulation_type: input.simulationType,
      sample_size: input.sampleSize,
      affected_documents_count: input.affectedDocumentsCount,
      affected_recent_documents_count: input.affectedRecentDocumentsCount,
      summary_json: input.summary,
      created_by: input.actorUserId,
    })
    .select("id")
    .limit(1)
    .maybeSingle();

  if (error && isMissingSupabaseRelationError(error, "accounting_rule_simulations")) {
    return null;
  }

  if (error) {
    throw new Error(error.message);
  }

  return asString((data as Record<string, unknown> | null)?.id);
}

async function runAccountingRuleSimulation(input: {
  organizationId: string;
  actorUserId: string | null;
  baseRule: AccountingRuleAdminRow | null;
  documentRole?: "purchase" | "sale" | "other";
  simulationType: string;
  summaryTitle: string;
  baseRules: AccountingRuleRecord[];
  candidateRules: AccountingRuleRecord[];
  candidateRuleId?: string | null;
  extraSummary?: Record<string, unknown>;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const documentRole = input.baseRule
    ? parseAccountingDocumentRole(input.baseRule.document_role)
    : parseAccountingDocumentRole(input.documentRole ?? "");
  const documentIds = await loadSimulationSampleDocuments(supabase, {
    organizationId: input.organizationId,
    documentRole,
    limit: 10,
  });
  const ruleLabelById = new Map<string, string>();

  for (const row of input.baseRules) {
    ruleLabelById.set(row.id, row.name ?? row.id);
  }

  for (const row of input.candidateRules) {
    ruleLabelById.set(row.id, row.name ?? ruleLabelById.get(row.id) ?? row.id);
  }

  const examples: AccountingRuleSimulationExample[] = [];

  for (const documentId of documentIds) {
    const context = await loadReviewDocumentContext({
      supabase,
      organizationId: input.organizationId,
      documentId,
      actorId: input.actorUserId,
    });
    const sharedContext = {
      supabase,
      organizationId: input.organizationId,
      documentId: context.document.id,
      draftId: context.draft.id,
      actorId: input.actorUserId,
      documentRole: context.draft.document_role,
      documentType: context.draft.document_type,
      intakeContext: context.draft.intake_context_json,
      facts: context.facts,
      amountBreakdown: context.amountBreakdown,
      lineItems: context.lineItems,
      operationCategory: context.operationCategory,
      profile: context.profile,
      ruleSnapshot: context.ruleSnapshot,
      invoiceIdentity: context.invoiceIdentity,
      runAssistant: false,
    } as const;
    const [baseline, candidate] = await Promise.all([
      deriveDocumentAccountingState({
        ...sharedContext,
        activeRulesOverride: sortRuleRecordsByPriority(input.baseRules),
      }),
      deriveDocumentAccountingState({
        ...sharedContext,
        activeRulesOverride: sortRuleRecordsByPriority(input.candidateRules),
      }),
    ]);
    const previousRuleId = baseline.derived.appliedRule.ruleId;
    const nextRuleId = candidate.derived.appliedRule.ruleId;

    examples.push({
      documentId: context.document.id,
      originalFilename: context.document.original_filename,
      documentDate: context.document.document_date,
      previousRuleId,
      previousRuleName: previousRuleId ? ruleLabelById.get(previousRuleId) ?? previousRuleId : null,
      previousScope: baseline.derived.appliedRule.scope,
      nextRuleId,
      nextRuleName: nextRuleId ? ruleLabelById.get(nextRuleId) ?? nextRuleId : null,
      nextScope: candidate.derived.appliedRule.scope,
      changed:
        previousRuleId !== nextRuleId
        || baseline.derived.appliedRule.scope !== candidate.derived.appliedRule.scope,
    });
  }

  const changedExamples = examples.filter((example) => example.changed);
  const summary = {
    title: input.summaryTitle,
    sample_size: examples.length,
    changed_documents_count: changedExamples.length,
    unchanged_documents_count: examples.length - changedExamples.length,
    examples: examples.slice(0, 8),
    warnings: examples.length === 0
      ? ["No encontramos documentos recientes suficientes para simular el impacto."]
      : [],
    ...input.extraSummary,
  } satisfies Record<string, unknown>;
  const simulationId = await persistAccountingRuleSimulation(supabase, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    baseRuleId: input.baseRule?.id ?? null,
    candidateRuleId: input.candidateRuleId ?? null,
    simulationType: input.simulationType,
    sampleSize: examples.length,
    affectedDocumentsCount: changedExamples.length,
    affectedRecentDocumentsCount: changedExamples.length,
    summary,
  });

  if (input.baseRule?.id) {
    await recordAccountingRuleEvent(supabase, {
      organizationId: input.organizationId,
      ruleId: input.baseRule.id,
      actorUserId: input.actorUserId,
      eventType: "simulation_run",
      reason: input.summaryTitle,
      payload: {
        simulation_id: simulationId,
        simulation_type: input.simulationType,
        changed_documents_count: changedExamples.length,
      },
    });
  }

  return {
    simulationId,
    sampleSize: examples.length,
    changedDocumentsCount: changedExamples.length,
    examples: examples.slice(0, 8),
    summary,
  };
}

function buildSameSegmentRuleMatcher(baseRule: AccountingRuleAdminRow) {
  const baseScope = baseRule.scope as AccountingRuleScope;
  const baseDocumentRole = baseRule.document_role;
  const baseSegmentKey = buildRuleSegmentKey({
    scope: baseScope,
    documentRole: baseDocumentRole,
    documentId: asString(baseRule.document_id),
    vendorId: asString(baseRule.vendor_id),
    conceptId: asString(baseRule.concept_id),
    operationCategory: asString(baseRule.operation_category),
  });

  return (rule: AccountingRuleRecord) => (
    rule.scope === baseScope
    && rule.document_role === baseDocumentRole
    && buildRuleSegmentKey({
      scope: rule.scope,
      documentRole: rule.document_role,
      documentId: rule.document_id,
      vendorId: rule.vendor_id,
      conceptId: rule.concept_id,
      operationCategory: rule.operation_category,
    }) === baseSegmentKey
  );
}

function swapPriorityInRuleSet(input: {
  rules: AccountingRuleRecord[];
  currentRuleId: string;
  otherRuleId: string;
}) {
  const current = input.rules.find((rule) => rule.id === input.currentRuleId) ?? null;
  const other = input.rules.find((rule) => rule.id === input.otherRuleId) ?? null;

  if (!current || !other) {
    throw new Error("No pudimos resolver la prioridad objetivo para esta regla.");
  }

  return input.rules.map((rule) => {
    if (rule.id === current.id) {
      return {
        ...rule,
        priority: other.priority,
      } satisfies AccountingRuleRecord;
    }

    if (rule.id === other.id) {
      return {
        ...rule,
        priority: current.priority,
      } satisfies AccountingRuleRecord;
    }

    return rule;
  });
}

export function resolvePrioritySwapTarget(input: {
  rules: AccountingRuleRecord[];
  baseRule: AccountingRuleAdminRow;
  currentRuleId: string;
  direction: AccountingRulePriorityDirection;
}) {
  const matcher = buildSameSegmentRuleMatcher(input.baseRule);
  const orderedRules = sortRuleRecordsByPriority(input.rules.filter(matcher));
  const currentIndex = orderedRules.findIndex((rule) => rule.id === input.currentRuleId);

  if (currentIndex < 0) {
    throw new Error("No encontramos la regla seleccionada dentro de su segmento activo.");
  }

  const targetIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const otherRule = orderedRules[targetIndex] ?? null;

  if (!otherRule) {
    throw new Error(
      input.direction === "up"
        ? "La regla ya esta en la mayor prioridad disponible para este segmento."
        : "La regla ya esta en la menor prioridad disponible para este segmento.",
    );
  }

  return {
    orderedRules,
    currentRule: orderedRules[currentIndex],
    otherRule,
  };
}

function buildPreviewRuleRecord(input: {
  current: AccountingRuleAdminRow;
  scope: AccountingRuleScope;
  documentRole: "purchase" | "sale" | "other";
  accountId: string;
  name: string | null;
  description: string | null;
  taxProfileCode: string | null;
  operationCategory: string | null;
  linkedOperationType: string | null;
  templateCode: string | null;
  documentId: string | null;
  vendorId: string | null;
  conceptId: string | null;
}) {
  const now = new Date().toISOString();
  const currentRecord = mapAdminRowToAccountingRuleRecord(input.current);

  return {
    ...currentRecord,
    id: `${input.current.id}:preview:${Date.now()}`,
    name: input.name ?? currentRecord.name ?? undefined,
    description: input.description ?? currentRecord.description ?? undefined,
    scope: input.scope,
    document_id: input.documentId,
    source_document_id:
      asString(input.current.source_document_id)
      ?? asString(input.current.document_id)
      ?? currentRecord.source_document_id
      ?? null,
    vendor_id: input.vendorId,
    concept_id: input.conceptId,
    document_role: input.documentRole,
    account_id: input.accountId,
    tax_profile_code: input.taxProfileCode,
    operation_category: input.operationCategory,
    linked_operation_type: input.linkedOperationType,
    template_code: input.templateCode,
    priority: asNumber(input.current.priority) ?? currentRecord.priority,
    lifecycle_status: "active",
    supersedes_rule_id: input.current.id,
    superseded_by_rule_id: null,
    pause_reason: null,
    supersession_reason: null,
    is_active: true,
    activated_at: now,
    paused_at: null,
    retired_at: null,
    last_matched_at: currentRecord.last_matched_at,
    created_at: now,
    updated_at: now,
  } satisfies AccountingRuleRecord;
}

function resolveDefaultAccountingRulePriority(scope: AccountingRuleScope) {
  switch (scope) {
    case "document_override":
      return 1000;
    case "vendor_concept_operation_category":
      return 950;
    case "vendor_concept":
      return 900;
    case "concept_global":
      return 800;
    case "vendor_default":
      return 700;
    default:
      return 700;
  }
}

function parseAccountingRulePriority(value: string | number | null | undefined, scope: AccountingRuleScope) {
  const rawValue =
    typeof value === "number"
      ? String(value)
      : asString(value);

  if (!rawValue) {
    return resolveDefaultAccountingRulePriority(scope);
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("La prioridad debe ser un entero positivo o cero.");
  }

  return Math.trunc(parsed);
}

function buildManualCandidateRuleRecord(input: {
  organizationId: string;
  scope: AccountingRuleScope;
  documentRole: "purchase" | "sale" | "other";
  accountId: string;
  name: string;
  description: string | null;
  taxProfileCode: string | null;
  operationCategory: string | null;
  linkedOperationType: string | null;
  templateCode: string | null;
  documentId: string | null;
  vendorId: string | null;
  conceptId: string | null;
  priority: number;
}) {
  const now = new Date().toISOString();

  return {
    id: `preview:${crypto.randomUUID()}`,
    organization_id: input.organizationId,
    stable_family_code: null,
    version_number: 1,
    name: input.name,
    description: input.description ?? undefined,
    scope: input.scope,
    document_id: input.documentId,
    source_document_id: null,
    vendor_id: input.vendorId,
    concept_id: input.conceptId,
    document_role: input.documentRole,
    account_id: input.accountId,
    status: "approved",
    lifecycle_status: "active",
    vat_profile_json: {},
    tax_profile_code: input.taxProfileCode,
    operation_category: input.operationCategory,
    linked_operation_type: input.linkedOperationType,
    template_code: input.templateCode,
    times_reused: 0,
    times_corrected: 0,
    times_matched: 0,
    times_applied: 0,
    priority: input.priority,
    source: "manual",
    created_from: "manual",
    is_active: true,
    explainability_json: {},
    supersedes_rule_id: null,
    superseded_by_rule_id: null,
    pause_reason: null,
    supersession_reason: null,
    activated_at: now,
    paused_at: null,
    retired_at: null,
    last_matched_at: null,
    metadata: {},
    created_at: now,
    updated_at: now,
  } satisfies AccountingRuleRecord;
}

const accountingRuleAiAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "assistant_reply",
    "user_intent_summary",
    "current_rules_relevant",
    "current_winning_logic",
    "coverage_gaps",
    "conflicts",
    "recommended_manual_actions",
    "warnings",
    "example_explanations",
  ],
  properties: {
    assistant_reply: { type: "string" },
    user_intent_summary: { type: "string" },
    current_rules_relevant: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rule_id", "rule_name", "scope", "priority", "why_it_matters"],
        properties: {
          rule_id: { type: ["string", "null"] },
          rule_name: { type: "string" },
          scope: { type: "string" },
          priority: { type: ["number", "null"] },
          why_it_matters: { type: "string" },
        },
      },
    },
    current_winning_logic: { type: "string" },
    coverage_gaps: { type: "array", items: { type: "string" } },
    conflicts: { type: "array", items: { type: "string" } },
    recommended_manual_actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "target_rule_id", "reasoning", "risk"],
        properties: {
          action: { type: "string" },
          target_rule_id: { type: ["string", "null"] },
          reasoning: { type: "string" },
          risk: { type: "string" },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
    example_explanations: { type: "array", items: { type: "string" } },
  },
} as const;

export function buildDeterministicRuleAiAnalysis(input: {
  prompt: string;
  rule: AccountingRuleDetail;
}) {
  const normalizedPrompt = input.prompt.trim().toLowerCase();
  const topConflict = input.rule.conflicts[0] ?? null;
  const shouldRecommendSimulation =
    input.rule.conflicts.length > 0 || input.rule.affectedDocuments.length === 0;
  const assistantReply =
    normalizedPrompt.includes("que regla")
    || normalizedPrompt.includes("recomend")
      ? topConflict
        ? `Te recomiendo no crear una regla nueva todavia. Primero compara "${input.rule.name}" con "${topConflict.otherRuleName}" y corre una simulacion de prioridad para ver cual deberia ganar sin sobrecapturar documentos.`
        : input.rule.affectedDocuments.length === 0
          ? `Te recomiendo tomar "${input.rule.name}" como base, pero validarla con una simulacion antes de tocarla. Hoy no vemos documentos recientes trazados y falta evidencia para recomendar un cambio mas agresivo.`
          : `Te recomiendo empezar por "${input.rule.name}". Hoy ya es la regla mas clara para este caso; si quieres afinar cobertura, el siguiente paso sano es versionarla, no crear otra desde cero.`
      : shouldRecommendSimulation
        ? `Mi sugerencia principal es simular antes de cambiar nada. Esta regla tiene competencia o poca evidencia reciente, y eso hace riesgoso mover prioridad o ampliar cobertura a ciegas.`
        : `Mi sugerencia principal es mantener esta regla como base y versionarla solo si quieres ajustar su alcance. No veo señales fuertes de que necesites otra regla nueva para este caso.`;

  return {
    assistant_reply: assistantReply,
    user_intent_summary: input.prompt.trim() || "Analisis general de la regla seleccionada.",
    current_rules_relevant: [
      {
        rule_id: input.rule.id,
        rule_name: input.rule.name,
        scope: formatRuleScopeLabel(input.rule.scope),
        priority: input.rule.priority,
        why_it_matters: "Es la regla actualmente seleccionada y concentra el contexto principal.",
      },
      ...input.rule.conflicts.slice(0, 3).map((conflict) => ({
        rule_id: conflict.otherRuleId,
        rule_name: conflict.otherRuleName,
        scope: formatRuleScopeLabel(conflict.otherRuleScope),
        priority: conflict.otherRulePriority,
        why_it_matters: conflict.summary,
      })),
    ],
    current_winning_logic:
      `Hoy gana por scope ${formatRuleScopeLabel(input.rule.scope).toLowerCase()} y prioridad ${input.rule.priority}.`,
    coverage_gaps:
      input.rule.affectedDocuments.length === 0
        ? ["No vemos documentos recientes trazados a esta regla; puede haber un hueco de cobertura o falta de uso."]
        : [],
    conflicts: input.rule.conflicts.map((conflict) => conflict.summary).slice(0, 4),
    recommended_manual_actions: [
      {
        action: input.rule.conflicts.length > 0 ? "change_priority" : "modify_existing_rule",
        target_rule_id: input.rule.id,
        reasoning:
          input.rule.conflicts.length > 0
            ? "Hay reglas competidoras activas y conviene simular prioridad antes de aplicar cambios."
            : "La regla puede ajustarse versionando si quieres afinar cobertura.",
        risk:
          input.rule.conflicts.length > 0
            ? "Subir prioridad sin simulacion puede sobrecapturar documentos vecinos."
            : "Versionar sin revisar ejemplos recientes puede mover documentos fuera de su carril esperado.",
      },
    ],
    warnings: [
      "La IA aqui es consultiva: no crea ni activa reglas por su cuenta.",
      "Si la evidencia reciente es escasa, conviene validar con simulacion antes de confirmar cambios.",
    ],
    example_explanations: input.rule.affectedDocuments.slice(0, 3).map((document) => (
      `${document.originalFilename}: la regla aparece trazada en ${formatDocumentRoleLabel((document.direction as "purchase" | "sale" | "other") ?? "other")}.`
    )),
  } satisfies AccountingRuleAiAnalysis;
}

function formatAccountingRuleAiActionLabel(action: string) {
  switch (action) {
    case "modify_existing_rule":
      return "Versionar la regla actual";
    case "create_new_rule":
      return "Crear una regla nueva";
    case "change_priority":
      return "Simular o cambiar prioridad";
    case "pause_rule":
      return "Pausar la regla";
    case "need_more_context":
      return "Reunir mas contexto";
    case "no_change_needed":
      return "No cambiar nada por ahora";
    default:
      return "Accion manual sugerida";
  }
}

function buildAccountingRuleAiResponseText(analysis: AccountingRuleAiAnalysis) {
  const lines = [analysis.assistant_reply];

  if (analysis.recommended_manual_actions.length > 0) {
    const topActions = analysis.recommended_manual_actions.slice(0, 2);
    lines.push(
      "",
      "Siguiente paso recomendado:",
      ...topActions.map((item) => `- ${formatAccountingRuleAiActionLabel(item.action)}. ${item.reasoning}`),
    );
  }

  if (analysis.warnings.length > 0) {
    lines.push("", `Ten en cuenta: ${analysis.warnings.join(" ")}`);
  }

  return lines.join("\n");
}

function extractAiAnalysisReferencedRuleIds(analysis: AccountingRuleAiAnalysis) {
  return analysis.current_rules_relevant
    .map((item) => item.rule_id)
    .filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);
}

function extractAiAnalysisReferencedDocumentIds(
  rule: AccountingRuleDetail,
  analysis: AccountingRuleAiAnalysis,
) {
  const desiredCount = Math.max(1, analysis.example_explanations.length);

  return rule.affectedDocuments
    .slice(0, desiredCount)
    .map((document) => document.documentId)
    .filter((value, index, array) => array.indexOf(value) === index);
}

async function insertAccountingRuleAiMessage(
  supabase: SupabaseClient,
  input: {
    threadId: string;
    organizationId: string;
    role: AccountingRuleAiMessageView["role"];
    messageText: string;
    structuredPayload?: Record<string, unknown>;
    referencedRuleIds?: string[];
    referencedDocumentIds?: string[];
    provider?: string | null;
    model?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    estimatedCost?: number | null;
  },
) {
  const { error } = await supabase
    .from("accounting_rule_ai_messages")
    .insert({
      thread_id: input.threadId,
      organization_id: input.organizationId,
      role: input.role,
      message_text: input.messageText,
      structured_payload_json: input.structuredPayload ?? {},
      referenced_rule_ids: input.referencedRuleIds ?? [],
      referenced_document_ids: input.referencedDocumentIds ?? [],
      provider: input.provider ?? null,
      model: input.model ?? null,
      tokens_input: input.inputTokens ?? null,
      tokens_output: input.outputTokens ?? null,
      estimated_cost: input.estimatedCost ?? null,
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function loadAccountingRuleAiThreadForMutation(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    threadId: string;
  },
) {
  const { data, error } = await supabase
    .from("accounting_rule_ai_threads")
    .select("id, organization_id, title, context_scope, context_rule_id, archived_at, created_at")
    .eq("organization_id", input.organizationId)
    .eq("id", input.threadId)
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No encontramos el hilo consultivo solicitado.");
  }

  return data as AccountingRuleAiThreadRow;
}

function buildAccountingRuleAiSystemPrompt() {
  return [
    "Eres un analista consultivo de reglas contables dentro de Convertilabs.",
    "Solo puedes analizar reglas, precedencia, cobertura, conflictos y sugerir acciones manuales.",
    "assistant_reply es el texto final que vera el usuario.",
    "Responde en espanol rioplatense, de forma directa y util.",
    "No repitas el pedido del usuario ni expliques que entendiste su intencion.",
    "Empieza por la recomendacion o respuesta principal, no por un resumen.",
    "No afirmes que creaste, activaste, pausaste, editaste o reordenaste reglas.",
    "No propongas SQL ni cambios automaticos sobre historicos.",
    "Si falta evidencia, dilo de forma explicita.",
    "Devuelve solo JSON valido que cumpla el schema.",
  ].join("\n");
}

function buildAccountingRuleAiUserPrompt(input: {
  prompt: string;
  rule: AccountingRuleDetail;
}) {
  const relevantDocuments = input.rule.affectedDocuments
    .slice(0, 5)
    .map((document) => (
      `- ${document.originalFilename} | ${document.documentDate ?? "sin fecha"} | ${document.note ?? "sin nota"}`
    ))
    .join("\n");
  const conflicts = input.rule.conflicts
    .slice(0, 5)
    .map((conflict) => (
      `- ${conflict.otherRuleName} | ${formatRuleScopeLabel(conflict.otherRuleScope)} | prio ${conflict.otherRulePriority} | ${conflict.summary}`
    ))
    .join("\n");

  return [
    `Consulta del usuario: ${input.prompt.trim() || "Analisis general de la regla seleccionada."}`,
    `Regla seleccionada: ${input.rule.name} (${input.rule.id})`,
    `Scope: ${formatRuleScopeLabel(input.rule.scope)}`,
    `Prioridad: ${input.rule.priority}`,
    `Condiciones: ${input.rule.conditionSummary.join(" | ") || "sin condiciones visibles"}`,
    `Resultado: ${input.rule.resultSummary.join(" | ") || "sin resultado visible"}`,
    `Conflictos detectados:\n${conflicts || "- sin conflictos visibles"}`,
    `Documentos recientes trazados:\n${relevantDocuments || "- sin documentos visibles"}`,
    "Recuerda: assistant_reply debe hablarle al usuario de forma directa, sin resumir la consulta ni exponer razonamiento interno.",
  ].join("\n\n");
}

async function resolveAccountingRuleAiAnalysis(input: {
  prompt: string;
  rule: AccountingRuleDetail;
}) {
  const fallbackAnalysis = buildDeterministicRuleAiAnalysis(input);

  if (!process.env.OPENAI_API_KEY) {
    return {
      analysis: fallbackAnalysis,
      provider: null,
      model: null,
      usage: null,
    };
  }

  try {
    const { openAiRulesModel } = getOpenAIModelConfig();
    const response = await createStructuredOpenAIResponse<AccountingRuleAiAnalysis>({
      model: openAiRulesModel,
      schemaName: "accounting_rule_ai_analysis",
      schema: accountingRuleAiAnalysisSchema,
      systemPrompt: buildAccountingRuleAiSystemPrompt(),
      userPrompt: buildAccountingRuleAiUserPrompt(input),
      metadata: {
        feature: "accounting_rules_admin",
        rule_id: input.rule.id,
      },
    });

    return {
      analysis: response.output,
      provider: "openai",
      model: openAiRulesModel,
      usage: response.usage,
    };
  } catch {
    return {
      analysis: {
        ...fallbackAnalysis,
        warnings: [
          ...fallbackAnalysis.warnings,
          "El modelo no estuvo disponible y se uso un analisis deterministico basado en reglas y evidencia local.",
        ],
      } satisfies AccountingRuleAiAnalysis,
      provider: null,
      model: null,
      usage: null,
    };
  }
}

export async function simulateManualAccountingRule(input: {
  organizationId: string;
  actorUserId: string | null;
  name: string | null;
  description: string | null;
  scope: string;
  documentRole: string;
  vendorId: string | null;
  conceptId: string | null;
  accountId: string | null;
  taxProfileCode: string | null;
  operationCategory: string | null;
  linkedOperationType: string | null;
  templateCode: string | null;
  priority: string | number | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const name = asString(input.name);
  const accountId = asString(input.accountId);

  if (!name) {
    throw new Error("La regla nueva requiere un nombre visible.");
  }

  if (!accountId) {
    throw new Error("La simulacion requiere cuenta destino.");
  }

  const scope = parseAccountingRuleScope(input.scope);

  if (scope === "document_override") {
    throw new Error("Las reglas nuevas desde administracion no admiten document override.");
  }

  const documentRole = parseAccountingDocumentRole(input.documentRole);
  const priority = parseAccountingRulePriority(input.priority, scope);
  const scopedValues = resolveSupersedingRuleScopeFields({
    scope,
    currentDocumentId: null,
    vendorId: asString(input.vendorId),
    conceptId: asString(input.conceptId),
    operationCategory: asString(input.operationCategory),
  });

  if (scopedValues.errors.length > 0) {
    throw new Error(scopedValues.errors.join(" "));
  }

  await ensureRuleReferenceIntegrity(supabase, {
    organizationId: input.organizationId,
    vendorId: scopedValues.vendorId,
    conceptId: scopedValues.conceptId,
    accountId,
  });

  const activeRules = await loadActiveAccountingRules(supabase, input.organizationId, documentRole);
  const candidateRule = buildManualCandidateRuleRecord({
    organizationId: input.organizationId,
    scope,
    documentRole,
    accountId,
    name,
    description: asString(input.description),
    taxProfileCode: asString(input.taxProfileCode),
    operationCategory: scopedValues.operationCategory,
    linkedOperationType: asString(input.linkedOperationType),
    templateCode: asString(input.templateCode),
    documentId: scopedValues.documentId,
    vendorId: scopedValues.vendorId,
    conceptId: scopedValues.conceptId,
    priority,
  });

  return runAccountingRuleSimulation({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    baseRule: null,
    documentRole,
    simulationType: "new_rule",
    summaryTitle: `Simulacion de regla nueva para ${name}`,
    baseRules: sortRuleRecordsByPriority(activeRules),
    candidateRules: sortRuleRecordsByPriority([...activeRules, candidateRule]),
    candidateRuleId: null,
    extraSummary: {
      candidate_scope: scope,
      candidate_account_id: accountId,
      candidate_priority: priority,
      candidate_operation_category: scopedValues.operationCategory,
      candidate_rule_name: name,
    },
  });
}

export async function simulateSupersedingAccountingRule(input: {
  organizationId: string;
  ruleId: string;
  actorUserId: string | null;
  name: string | null;
  description: string | null;
  scope: string;
  documentRole: string;
  vendorId: string | null;
  conceptId: string | null;
  accountId: string | null;
  taxProfileCode: string | null;
  operationCategory: string | null;
  linkedOperationType: string | null;
  templateCode: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const accountId = asString(input.accountId);

  if (!accountId) {
    throw new Error("La simulacion requiere cuenta destino.");
  }

  const scope = parseAccountingRuleScope(input.scope);
  const documentRole = parseAccountingDocumentRole(input.documentRole);
  const current = await loadRuleForVersionedMutation(supabase, input);
  const lifecycleStatus = deriveAccountingRuleLifecycleStatus({
    lifecycleStatus: asString(current.lifecycle_status),
    approvalStatus: asString(current.status),
    isActive: asBoolean(current.is_active),
    supersededByRuleId: asString(current.superseded_by_rule_id),
  });

  if (lifecycleStatus === "superseded") {
    throw new Error("No puedes simular una nueva version sobre una regla ya reemplazada.");
  }

  if (lifecycleStatus === "deleted_if_unused") {
    throw new Error("No puedes simular una nueva version sobre una regla eliminada sin uso.");
  }

  const scopedValues = resolveSupersedingRuleScopeFields({
    scope,
    currentDocumentId: asString(current.document_id),
    vendorId: asString(input.vendorId),
    conceptId: asString(input.conceptId),
    operationCategory: asString(input.operationCategory),
  });

  if (scopedValues.errors.length > 0) {
    throw new Error(scopedValues.errors.join(" "));
  }

  await ensureRuleReferenceIntegrity(supabase, {
    organizationId: input.organizationId,
    vendorId: scopedValues.vendorId,
    conceptId: scopedValues.conceptId,
    accountId,
  });

  const activeRules = await loadActiveAccountingRules(supabase, input.organizationId, documentRole);
  const candidateRule = buildPreviewRuleRecord({
    current,
    scope,
    documentRole,
    accountId,
    name: asString(input.name),
    description: asString(input.description),
    taxProfileCode: asString(input.taxProfileCode),
    operationCategory: scopedValues.operationCategory,
    linkedOperationType: asString(input.linkedOperationType),
    templateCode: asString(input.templateCode),
    documentId: scopedValues.documentId,
    vendorId: scopedValues.vendorId,
    conceptId: scopedValues.conceptId,
  });
  const baseRules = sortRuleRecordsByPriority(activeRules);
  const candidateRules =
    lifecycleStatus === "active"
      ? sortRuleRecordsByPriority([
        ...activeRules.filter((rule) => rule.id !== current.id),
        candidateRule,
      ])
      : sortRuleRecordsByPriority([...activeRules, candidateRule]);

  return runAccountingRuleSimulation({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    baseRule: current,
    simulationType: "edit_version",
    summaryTitle: `Simulacion de version nueva para ${asString(current.name) ?? current.id}`,
    baseRules,
    candidateRules,
    candidateRuleId: null,
    extraSummary: {
      candidate_scope: scope,
      candidate_account_id: accountId,
      candidate_operation_category: scopedValues.operationCategory,
    },
  });
}

export async function createManualAccountingRule(input: {
  organizationId: string;
  actorUserId: string | null;
  reason: string;
  name: string | null;
  description: string | null;
  scope: string;
  documentRole: string;
  vendorId: string | null;
  conceptId: string | null;
  accountId: string | null;
  taxProfileCode: string | null;
  operationCategory: string | null;
  linkedOperationType: string | null;
  templateCode: string | null;
  priority: string | number | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const reason = input.reason.trim();
  const name = asString(input.name);
  const accountId = asString(input.accountId);

  if (!reason) {
    throw new Error("La regla nueva exige una justificacion.");
  }

  if (!name) {
    throw new Error("La regla nueva requiere un nombre visible.");
  }

  if (!accountId) {
    throw new Error("La regla nueva requiere cuenta destino.");
  }

  const scope = parseAccountingRuleScope(input.scope);

  if (scope === "document_override") {
    throw new Error("Las reglas nuevas desde administracion no admiten document override.");
  }

  const documentRole = parseAccountingDocumentRole(input.documentRole);
  const priority = parseAccountingRulePriority(input.priority, scope);
  const scopedValues = resolveSupersedingRuleScopeFields({
    scope,
    currentDocumentId: null,
    vendorId: asString(input.vendorId),
    conceptId: asString(input.conceptId),
    operationCategory: asString(input.operationCategory),
  });

  if (scopedValues.errors.length > 0) {
    throw new Error(scopedValues.errors.join(" "));
  }

  await ensureRuleReferenceIntegrity(supabase, {
    organizationId: input.organizationId,
    vendorId: scopedValues.vendorId,
    conceptId: scopedValues.conceptId,
    accountId,
  });

  const stableFamilyCode = `rule_family_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const insertPayload = {
    organization_id: input.organizationId,
    stable_family_code: stableFamilyCode,
    version_number: 1,
    name,
    description: asString(input.description),
    scope,
    document_id: scopedValues.documentId,
    source_document_id: null,
    vendor_id: scopedValues.vendorId,
    concept_id: scopedValues.conceptId,
    document_role: documentRole,
    account_id: accountId,
    status: "approved",
    lifecycle_status: "active",
    vat_profile_json: {},
    tax_profile_code: asString(input.taxProfileCode),
    operation_category: scopedValues.operationCategory,
    linked_operation_type: asString(input.linkedOperationType),
    template_code: asString(input.templateCode),
    times_reused: 0,
    times_corrected: 0,
    times_matched: 0,
    times_applied: 0,
    priority,
    source: "manual",
    created_from: "manual",
    explainability_json: {},
    created_by: input.actorUserId,
    approved_by: input.actorUserId,
    is_active: true,
    activated_at: now,
    metadata: {
      rationale: reason,
      created_via: "rules_admin_manual",
    },
    updated_at: now,
  };
  const { data, error } = await supabase
    .from("accounting_rules")
    .insert(insertPayload)
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo crear la regla contable.");
  }

  const ruleId = String(data.id);
  await Promise.all([
    recordAccountingRuleEvent(supabase, {
      organizationId: input.organizationId,
      ruleId,
      actorUserId: input.actorUserId,
      eventType: "created",
      reason,
      payload: {
        created_from: "rules_admin_manual",
        stable_family_code: stableFamilyCode,
        version_number: 1,
      },
    }),
    recordAuditLogEvent(supabase, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      ruleId,
      action: "created_from_rules_admin",
      beforeJson: {},
      afterJson: insertPayload,
      metadata: {
        reason,
      },
    }),
  ]);

  return ruleId;
}

export async function simulateAccountingRulePriorityChange(input: {
  organizationId: string;
  ruleId: string;
  actorUserId: string | null;
  direction: AccountingRulePriorityDirection;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const current = await loadRuleForVersionedMutation(supabase, input);
  const lifecycleStatus = deriveAccountingRuleLifecycleStatus({
    lifecycleStatus: asString(current.lifecycle_status),
    approvalStatus: asString(current.status),
    isActive: asBoolean(current.is_active),
    supersededByRuleId: asString(current.superseded_by_rule_id),
  });

  if (lifecycleStatus !== "active") {
    throw new Error("Solo puedes simular prioridad sobre reglas activas.");
  }

  const activeRules = await loadActiveAccountingRules(
    supabase,
    input.organizationId,
    parseAccountingDocumentRole(current.document_role),
  );
  const swapTarget = resolvePrioritySwapTarget({
    rules: activeRules,
    baseRule: current,
    currentRuleId: current.id,
    direction: input.direction,
  });
  const candidateRules = sortRuleRecordsByPriority(swapPriorityInRuleSet({
    rules: activeRules,
    currentRuleId: current.id,
    otherRuleId: swapTarget.otherRule.id,
  }));

  return runAccountingRuleSimulation({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    baseRule: current,
    simulationType: "priority_change",
    summaryTitle: `Simulacion de prioridad ${input.direction === "up" ? "hacia arriba" : "hacia abajo"} para ${asString(current.name) ?? current.id}`,
    baseRules: sortRuleRecordsByPriority(activeRules),
    candidateRules,
    candidateRuleId: null,
    extraSummary: {
      direction: input.direction,
      swapped_with_rule_id: swapTarget.otherRule.id,
    },
  });
}

export async function changeAccountingRulePriority(input: {
  organizationId: string;
  ruleId: string;
  actorUserId: string | null;
  direction: AccountingRulePriorityDirection;
  reason: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const reason = input.reason.trim();

  if (!reason) {
    throw new Error("El cambio de prioridad exige un motivo.");
  }

  const current = await loadRuleForVersionedMutation(supabase, input);
  const lifecycleStatus = deriveAccountingRuleLifecycleStatus({
    lifecycleStatus: asString(current.lifecycle_status),
    approvalStatus: asString(current.status),
    isActive: asBoolean(current.is_active),
    supersededByRuleId: asString(current.superseded_by_rule_id),
  });

  if (lifecycleStatus !== "active") {
    throw new Error("Solo puedes cambiar prioridad sobre reglas activas.");
  }

  const activeRules = await loadActiveAccountingRules(
    supabase,
    input.organizationId,
    parseAccountingDocumentRole(current.document_role),
  );
  const swapTarget = resolvePrioritySwapTarget({
    rules: activeRules,
    baseRule: current,
    currentRuleId: current.id,
    direction: input.direction,
  });
  const now = new Date().toISOString();

  const [currentUpdate, otherUpdate] = await Promise.all([
    supabase
      .from("accounting_rules")
      .update({
        priority: swapTarget.otherRule.priority,
        updated_at: now,
      })
      .eq("organization_id", input.organizationId)
      .eq("id", current.id),
    supabase
      .from("accounting_rules")
      .update({
        priority: swapTarget.currentRule.priority,
        updated_at: now,
      })
      .eq("organization_id", input.organizationId)
      .eq("id", swapTarget.otherRule.id),
  ]);

  if (currentUpdate.error) {
    throw new Error(currentUpdate.error.message);
  }

  if (otherUpdate.error) {
    throw new Error(otherUpdate.error.message);
  }

  await Promise.all([
    recordAccountingRuleEvent(supabase, {
      organizationId: input.organizationId,
      ruleId: current.id,
      actorUserId: input.actorUserId,
      eventType: "priority_changed",
      reason,
      payload: {
        direction: input.direction,
        previous_priority: swapTarget.currentRule.priority,
        next_priority: swapTarget.otherRule.priority,
        swapped_with_rule_id: swapTarget.otherRule.id,
      },
    }),
    recordAccountingRuleEvent(supabase, {
      organizationId: input.organizationId,
      ruleId: swapTarget.otherRule.id,
      actorUserId: input.actorUserId,
      eventType: "priority_changed",
      reason,
      payload: {
        direction: input.direction === "up" ? "down" : "up",
        previous_priority: swapTarget.otherRule.priority,
        next_priority: swapTarget.currentRule.priority,
        swapped_with_rule_id: current.id,
      },
    }),
    recordAuditLogEvent(supabase, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      ruleId: current.id,
      action: "accounting_rule:priority_changed",
      beforeJson: {
        priority: swapTarget.currentRule.priority,
      },
      afterJson: {
        priority: swapTarget.otherRule.priority,
      },
      metadata: {
        reason,
        direction: input.direction,
        swapped_with_rule_id: swapTarget.otherRule.id,
      },
    }),
    recordAuditLogEvent(supabase, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      ruleId: swapTarget.otherRule.id,
      action: "accounting_rule:priority_changed",
      beforeJson: {
        priority: swapTarget.otherRule.priority,
      },
      afterJson: {
        priority: swapTarget.currentRule.priority,
      },
      metadata: {
        reason,
        direction: input.direction === "up" ? "down" : "up",
        swapped_with_rule_id: current.id,
      },
    }),
  ]);

  return {
    ruleId: current.id,
    otherRuleId: swapTarget.otherRule.id,
  };
}

export async function createAccountingRuleAiThread(input: {
  organizationId: string;
  actorUserId: string | null;
  ruleId: string;
  title: string | null;
  initialPrompt: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const pageData = await loadAccountingRulesAdminPageData({
    organizationId: input.organizationId,
    selectedRuleId: input.ruleId,
  });
  const rule = pageData.selectedRule;

  if (!rule) {
    throw new Error("Selecciona una regla valida antes de abrir un hilo consultivo.");
  }

  const threadTitle =
    asString(input.title)
    ?? `Analisis consultivo - ${rule.name}`;
  const { data, error } = await supabase
    .from("accounting_rule_ai_threads")
    .insert({
      organization_id: input.organizationId,
      title: threadTitle,
      context_scope: "rule",
      context_rule_id: rule.id,
      created_by: input.actorUserId,
    })
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No pudimos crear el hilo consultivo.");
  }

  const threadId = String(data.id);
  await insertAccountingRuleAiMessage(supabase, {
    threadId,
    organizationId: input.organizationId,
    role: "system_context",
    messageText: `Contexto fijo del hilo sobre ${rule.name}.`,
    structuredPayload: {
      rule_id: rule.id,
      rule_name: rule.name,
      scope: rule.scope,
      priority: rule.priority,
      conflict_count: rule.conflicts.length,
      affected_documents: rule.affectedDocuments.slice(0, 5).map((document) => ({
        id: document.documentId,
        filename: document.originalFilename,
      })),
    },
    referencedRuleIds: [rule.id, ...rule.conflicts.map((conflict) => conflict.otherRuleId)]
      .filter((value, index, array) => array.indexOf(value) === index),
    referencedDocumentIds: rule.affectedDocuments
      .slice(0, 5)
      .map((document) => document.documentId),
  });

  if (asString(input.initialPrompt)) {
    await sendAccountingRuleAiMessage({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      threadId,
      message: asString(input.initialPrompt) ?? "",
    });
  }

  return threadId;
}

export async function sendAccountingRuleAiMessage(input: {
  organizationId: string;
  actorUserId: string | null;
  threadId: string;
  message: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const message = input.message.trim();

  if (!message) {
    throw new Error("Escribe una consulta antes de enviar al chat consultivo.");
  }

  const thread = await loadAccountingRuleAiThreadForMutation(supabase, {
    organizationId: input.organizationId,
    threadId: input.threadId,
  });

  if (thread.archived_at) {
    throw new Error("Este hilo ya fue archivado y no admite mensajes nuevos.");
  }

  if (!thread.context_rule_id) {
    throw new Error("Por ahora el chat consultivo requiere una regla seleccionada.");
  }

  const pageData = await loadAccountingRulesAdminPageData({
    organizationId: input.organizationId,
    selectedRuleId: thread.context_rule_id,
    selectedThreadId: thread.id,
  });
  const rule = pageData.selectedRule;

  if (!rule) {
    throw new Error("No pudimos reconstruir el contexto de la regla para este hilo.");
  }

  await insertAccountingRuleAiMessage(supabase, {
    threadId: thread.id,
    organizationId: input.organizationId,
    role: "user",
    messageText: message,
    structuredPayload: {
      prompt: message,
    },
    referencedRuleIds: [rule.id],
    referencedDocumentIds: rule.affectedDocuments
      .slice(0, 3)
      .map((document) => document.documentId),
  });

  await recordAccountingRuleEvent(supabase, {
    organizationId: input.organizationId,
    ruleId: rule.id,
    actorUserId: input.actorUserId,
    eventType: "ai_analysis_requested",
    reason: message,
    payload: {
      thread_id: thread.id,
    },
  });

  const analysisResult = await resolveAccountingRuleAiAnalysis({
    prompt: message,
    rule,
  });
  const referencedRuleIds = extractAiAnalysisReferencedRuleIds(analysisResult.analysis);
  const referencedDocumentIds = extractAiAnalysisReferencedDocumentIds(rule, analysisResult.analysis);

  await insertAccountingRuleAiMessage(supabase, {
    threadId: thread.id,
    organizationId: input.organizationId,
    role: "assistant",
    messageText: buildAccountingRuleAiResponseText(analysisResult.analysis),
    structuredPayload: analysisResult.analysis,
    referencedRuleIds,
    referencedDocumentIds,
    provider: analysisResult.provider,
    model: analysisResult.model,
    inputTokens: analysisResult.usage?.inputTokens ?? null,
    outputTokens: analysisResult.usage?.outputTokens ?? null,
    estimatedCost: analysisResult.usage?.estimatedCostUsd ?? null,
  });

  await recordAccountingRuleEvent(supabase, {
    organizationId: input.organizationId,
    ruleId: rule.id,
    actorUserId: input.actorUserId,
    eventType: "ai_analysis_answered",
    reason: message,
    payload: {
      thread_id: thread.id,
      referenced_rule_ids: referencedRuleIds,
      referenced_document_ids: referencedDocumentIds,
    },
  });

  return {
    threadId: thread.id,
    ruleId: rule.id,
  };
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

export async function createSupersedingAccountingRule(input: {
  organizationId: string;
  ruleId: string;
  actorUserId: string | null;
  reason: string;
  name: string | null;
  description: string | null;
  scope: string;
  documentRole: string;
  vendorId: string | null;
  conceptId: string | null;
  accountId: string | null;
  taxProfileCode: string | null;
  operationCategory: string | null;
  linkedOperationType: string | null;
  templateCode: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const reason = input.reason.trim();

  if (!reason) {
    throw new Error("La nueva version exige una justificacion.");
  }

  const accountId = asString(input.accountId);

  if (!accountId) {
    throw new Error("La nueva version requiere cuenta destino.");
  }

  const scope = parseAccountingRuleScope(input.scope);
  const documentRole = parseAccountingDocumentRole(input.documentRole);
  const current = await loadRuleForVersionedMutation(supabase, input);
  const currentLifecycleStatus = deriveAccountingRuleLifecycleStatus({
    lifecycleStatus: asString(current.lifecycle_status),
    approvalStatus: asString(current.status),
    isActive: asBoolean(current.is_active),
    supersededByRuleId: asString(current.superseded_by_rule_id),
  });

  if (currentLifecycleStatus === "superseded") {
    throw new Error("No puedes editar versionando una regla que ya fue reemplazada.");
  }

  if (currentLifecycleStatus === "deleted_if_unused") {
    throw new Error("No puedes versionar una regla eliminada sin uso.");
  }

  const scopedValues = resolveSupersedingRuleScopeFields({
    scope,
    currentDocumentId: asString(current.document_id),
    vendorId: asString(input.vendorId),
    conceptId: asString(input.conceptId),
    operationCategory: asString(input.operationCategory),
  });

  if (scopedValues.errors.length > 0) {
    throw new Error(scopedValues.errors.join(" "));
  }

  await ensureRuleReferenceIntegrity(supabase, {
    organizationId: input.organizationId,
    vendorId: scopedValues.vendorId,
    conceptId: scopedValues.conceptId,
    accountId,
  });

  const stableFamilyCode = asString(current.stable_family_code) ?? `rule_family_${current.id}`;
  const nextVersionNumber = await loadNextRuleVersionNumber(supabase, {
    organizationId: input.organizationId,
    stableFamilyCode,
    currentVersionNumber: asNumber(current.version_number) ?? 1,
  });
  const now = new Date().toISOString();
  const sourceDocumentId = asString(current.source_document_id) ?? asString(current.document_id);
  const successorInsert = {
    organization_id: input.organizationId,
    stable_family_code: stableFamilyCode,
    version_number: nextVersionNumber,
    name: asString(input.name),
    description: asString(input.description),
    scope,
    document_id: scopedValues.documentId,
    source_document_id: sourceDocumentId,
    vendor_id: scopedValues.vendorId,
    concept_id: scopedValues.conceptId,
    document_role: documentRole,
    account_id: accountId,
    status: "approved",
    lifecycle_status: "active",
    vat_profile_json: asRecord(current.vat_profile_json),
    tax_profile_code: asString(input.taxProfileCode),
    operation_category: scopedValues.operationCategory,
    linked_operation_type: asString(input.linkedOperationType),
    template_code: asString(input.templateCode),
    times_reused: 0,
    times_corrected: 0,
    times_matched: 0,
    times_applied: 0,
    priority: asNumber(current.priority) ?? 0,
    source: asString(current.source) ?? "manual",
    created_from: resolveRuleOrigin(current) ?? "manual",
    explainability_json: asRecord(current.explainability_json),
    supersedes_rule_id: current.id,
    created_by: input.actorUserId,
    approved_by: input.actorUserId ?? asString(current.approved_by) ?? asString(current.created_by),
    is_active: true,
    activated_at: now,
    metadata: asRecord(current.metadata),
    updated_at: now,
  };
  const { data, error } = await supabase
    .from("accounting_rules")
    .insert(successorInsert)
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo crear la nueva version de la regla.");
  }

  const successorRuleId = String(data.id);
  const supersededPatch = {
    lifecycle_status: "superseded",
    is_active: false,
    superseded_by_rule_id: successorRuleId,
    supersession_reason: reason,
    retired_at: now,
    updated_at: now,
  };
  const { error: updateError } = await supabase
    .from("accounting_rules")
    .update(supersededPatch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.ruleId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await Promise.all([
    recordAccountingRuleEvent(supabase, {
      organizationId: input.organizationId,
      ruleId: successorRuleId,
      actorUserId: input.actorUserId,
      eventType: "created",
      reason,
      payload: {
        created_from: "rules_admin_versioning",
        supersedes_rule_id: current.id,
        stable_family_code: stableFamilyCode,
        version_number: nextVersionNumber,
      },
    }),
    recordAccountingRuleEvent(supabase, {
      organizationId: input.organizationId,
      ruleId: input.ruleId,
      actorUserId: input.actorUserId,
      eventType: "superseded",
      reason,
      payload: {
        successor_rule_id: successorRuleId,
        previous_lifecycle_status: currentLifecycleStatus,
        next_lifecycle_status: "superseded",
      },
    }),
  ]);

  await Promise.all([
    recordAuditLogEvent(supabase, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      ruleId: successorRuleId,
      action: "created_from_rules_admin",
      beforeJson: {},
      afterJson: {
        stable_family_code: stableFamilyCode,
        version_number: nextVersionNumber,
        supersedes_rule_id: current.id,
        scope,
        document_role: documentRole,
        account_id: accountId,
      },
      metadata: {
        reason,
        source_rule_id: current.id,
      },
    }),
    recordAuditLogEvent(supabase, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      ruleId: input.ruleId,
      action: "accounting_rule:superseded",
      beforeJson: {
        lifecycle_status: currentLifecycleStatus,
        is_active: current.is_active,
        superseded_by_rule_id: current.superseded_by_rule_id,
        supersession_reason: current.supersession_reason,
      },
      afterJson: supersededPatch,
      metadata: {
        reason,
        successor_rule_id: successorRuleId,
      },
    }),
  ]);

  return successorRuleId;
}

export async function deleteUnusedAccountingRule(input: {
  organizationId: string;
  ruleId: string;
  actorUserId: string | null;
  reason: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const reason = input.reason.trim();

  if (!reason) {
    throw new Error("La eliminacion segura exige un motivo.");
  }

  const current = await loadRuleForVersionedMutation(supabase, input);
  const lifecycleStatus = deriveAccountingRuleLifecycleStatus({
    lifecycleStatus: asString(current.lifecycle_status),
    approvalStatus: asString(current.status),
    isActive: asBoolean(current.is_active),
    supersededByRuleId: asString(current.superseded_by_rule_id),
  });

  if (lifecycleStatus === "superseded") {
    throw new Error("No puedes eliminar una regla que ya fue reemplazada.");
  }

  if (lifecycleStatus === "deleted_if_unused") {
    throw new Error("Esta regla ya fue eliminada sin uso.");
  }

  const usageSignals = await loadRuleUsageSignals(supabase, {
    organizationId: input.organizationId,
    ruleId: input.ruleId,
    stableFamilyCode: asString(current.stable_family_code),
    versionNumber: asNumber(current.version_number) ?? 1,
  });
  const guard = evaluateDeleteUnusedGuard({
    documentsAppliedCount: asNumber(current.times_applied) ?? asNumber(current.times_reused) ?? 0,
    matchesCount: asNumber(current.times_matched) ?? asNumber(current.times_reused) ?? 0,
    hasAssignmentUsage: usageSignals.hasAssignmentUsage,
    hasDecisionLogUsage: usageSignals.hasDecisionLogUsage,
    hasActiveDescendant: usageSignals.hasActiveDescendant,
  });

  if (!guard.allowed) {
    throw new Error(guard.reason ?? "La regla no se puede eliminar.");
  }

  const now = new Date().toISOString();
  const patch = {
    lifecycle_status: "deleted_if_unused",
    is_active: false,
    retired_at: now,
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
    eventType: "deleted_unused",
    reason,
    payload: {
      previous_lifecycle_status: lifecycleStatus,
      next_lifecycle_status: "deleted_if_unused",
    },
  });
  await recordAuditLogEvent(supabase, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    ruleId: input.ruleId,
    action: "accounting_rule:deleted_unused",
    beforeJson: {
      lifecycle_status: lifecycleStatus,
      is_active: current.is_active,
    },
    afterJson: patch,
    metadata: {
      reason,
    },
  });
}
