import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMissingSupabaseColumnError,
  isMissingSupabaseRelationError,
} from "@/lib/supabase/schema-compat";
import {
  buildEconomicEventHash,
  buildJournalEntrySourceHash,
  buildPostingProposalLinePayloads,
  buildPostingProposalPayload,
  buildReversalJournalEntry,
  buildSourceEventFactsPayload,
  buildSourceEventPayload,
  computeKernelHash,
} from "@/modules/accounting/kernel";
import {
  normalizeCurrencyCode,
  normalizeDocumentNumber,
  normalizeTaxId,
  normalizeTextToken,
  roundCurrency,
  slugifyConceptCode,
} from "@/modules/accounting/normalization";
import {
  buildAccountingMonthRange,
  getAccountingMonthKey,
} from "@/modules/accounting/periods";
import { isFiscalPeriodLockedForPosting } from "@/modules/accounting/fiscal-period-status";
import { ensureStarterAccountingSetup } from "@/modules/accounting/starter-accounts";
import {
  isMissingJournalEntryLineStep5ColumnError,
  isMissingJournalEntryStep5ColumnError,
  omitJournalEntryLineStep5Columns,
  omitJournalEntryStep5Columns,
} from "@/modules/accounting/step5-schema-compat";
import { pickSuspiciousInvoiceDuplicateDocumentId } from "@/modules/accounting/invoice-identity";
import type {
  AccountRoleBindingRecord,
  AccountingArtifactsPersistenceInput,
  AccountingArtifactsPersistenceResult,
  AccountingContextResolution,
  AccountingRuleRecord,
  AccountingRuntimeContext,
  AccountingVendorRecord,
  ApprovalLearningInput,
  DocumentAccountingContextRecord,
  DocumentIntakeFactMap,
  DuplicateResolutionResult,
  OrganizationConceptAliasRecord,
  OrganizationConceptRecord,
  PersistedDocumentLineItemRecord,
  PersistedInvoiceIdentityRow,
  PostableAccountRecord,
  PriorApprovalExample,
  ResolveDuplicateInput,
} from "@/modules/accounting/types";

type VendorRow = {
  id: string;
  organization_id: string;
  name: string;
  tax_id: string | null;
  tax_id_normalized: string | null;
  name_normalized: string | null;
  default_account_id: string | null;
  default_payment_account_id: string | null;
  default_tax_profile: Record<string, unknown> | null;
  default_operation_category: string | null;
  metadata: Record<string, unknown> | null;
};

type VendorAliasRow = {
  id: string;
  vendor_id: string;
  alias_display: string | null;
  alias_normalized: string;
  source: string;
};

type ChartAccountRow = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  account_type: string;
  normal_side: "debit" | "credit";
  is_postable: boolean;
  is_provisional?: boolean | null;
  source?: string | null;
  external_code?: string | null;
  statement_section?: string | null;
  nature_tag?: string | null;
  function_tag?: string | null;
  cashflow_tag?: string | null;
  tax_profile_hint?: string | null;
  currency_policy?: string | null;
  chapter_code?: string | null;
  presentation_code?: string | null;
  group_id?: string | null;
  currency_code?: string | null;
  natural_balance?: "debit" | "credit" | null;
  requires_party?: boolean | null;
  reconciliable?: boolean | null;
  tax_account_kind?: string | null;
  include_fx_revaluation?: boolean | null;
  cost_center_policy?: string | null;
  sort_order?: number | null;
  provider_managed?: boolean | null;
  source_provider?: string | null;
  external_parent_code?: string | null;
  account_level?: number | null;
  is_imputable?: boolean | null;
  uses_cost_centers?: boolean | null;
  literal_tributario?: number | null;
  source_channel?: string | null;
  provider_meta_json?: Record<string, unknown> | null;
  jurisdiction_meta_json?: Record<string, unknown> | null;
  last_synced_from_provider_at?: string | null;
  metadata: Record<string, unknown> | null;
};

type AccountRoleBindingRow = {
  id: string;
  organization_id: string;
  binding_key: string;
  role_code: string;
  account_id: string;
  document_role: string | null;
  currency_code: string | null;
  settlement_method: string | null;
  priority: number | null;
  source: string | null;
  is_active: boolean | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

function asArray<T>(value: T[] | null | undefined) {
  return value ?? [];
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function recordAuditEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    entityType: string;
    entityId: string | null;
    action: string;
    beforeJson?: Record<string, unknown> | null;
    afterJson?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
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

  if (error) {
    throw new Error(error.message);
  }
}

async function recordAccountingRuleLifecycleEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    ruleId: string;
    actorId: string | null;
    eventType: string;
    reason?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  const { error } = await supabase
    .from("accounting_rule_events")
    .insert({
      organization_id: input.organizationId,
      rule_id: input.ruleId,
      actor_user_id: input.actorId,
      event_type: input.eventType,
      reason: input.reason ?? null,
      payload_json: input.payload ?? {},
    });

  if (error && isMissingSupabaseRelationError(error, "accounting_rule_events")) {
    return;
  }

  if (error) {
    throw new Error(error.message);
  }
}

export async function loadOrganizationVendors(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const [vendorResult, aliasResult] = await Promise.all([
    supabase
      .from("vendors")
      .select(
        "id, organization_id, name, tax_id, tax_id_normalized, name_normalized, default_account_id, default_payment_account_id, default_tax_profile, default_operation_category, metadata",
      )
      .eq("organization_id", organizationId),
    supabase
      .from("vendor_aliases")
      .select("id, vendor_id, alias_display, alias_normalized, source")
      .eq("organization_id", organizationId),
  ]);

  if (vendorResult.error) {
    throw new Error(vendorResult.error.message);
  }

  if (aliasResult.error) {
    throw new Error(aliasResult.error.message);
  }

  const aliasesByVendorId = new Map<string, VendorAliasRow[]>();

  for (const alias of asArray(aliasResult.data as VendorAliasRow[] | null)) {
    const current = aliasesByVendorId.get(alias.vendor_id) ?? [];
    current.push(alias);
    aliasesByVendorId.set(alias.vendor_id, current);
  }

  return asArray(vendorResult.data as VendorRow[] | null).map((vendor) => ({
    ...vendor,
    tax_id_normalized: vendor.tax_id_normalized ?? normalizeTaxId(vendor.tax_id),
    name_normalized: vendor.name_normalized ?? normalizeTextToken(vendor.name),
    aliases: aliasesByVendorId.get(vendor.id) ?? [],
  })) satisfies AccountingVendorRecord[];
}

export async function loadOrganizationConcepts(
  supabase: SupabaseClient,
  organizationId: string,
  documentRole?: AccountingRuleRecord["document_role"] | null,
) {
  let query = supabase
    .from("organization_concepts")
    .select(
      "id, organization_id, code, canonical_name, description, document_role, default_account_id, default_vat_profile_json, default_operation_category, is_active, metadata",
    )
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (documentRole) {
    query = query.eq("document_role", documentRole);
  }

  const { data, error } = await query.order("canonical_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as OrganizationConceptRecord[] | null);
}

export async function loadOrganizationConceptAliases(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organization_concept_aliases")
    .select(
      "id, organization_id, concept_id, vendor_id, alias_code_normalized, alias_description_normalized, match_scope, source",
    )
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as OrganizationConceptAliasRecord[] | null);
}

export async function loadOrganizationPostableAccounts(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const selectClause = [
    "id",
    "organization_id",
    "code",
    "name",
    "account_type",
    "normal_side",
    "is_postable",
    "is_provisional",
    "source",
    "external_code",
    "statement_section",
    "nature_tag",
    "function_tag",
    "cashflow_tag",
    "tax_profile_hint",
    "currency_policy",
    "chapter_code",
    "presentation_code",
    "group_id",
    "currency_code",
    "natural_balance",
    "requires_party",
    "reconciliable",
    "tax_account_kind",
    "include_fx_revaluation",
    "cost_center_policy",
    "sort_order",
    "provider_managed",
    "source_provider",
    "external_parent_code",
    "account_level",
    "is_imputable",
    "uses_cost_centers",
    "literal_tributario",
    "source_channel",
    "provider_meta_json",
    "jurisdiction_meta_json",
    "last_synced_from_provider_at",
    "metadata",
  ].join(", ");
  const legacySelectClause = [
    "id",
    "organization_id",
    "code",
    "name",
    "account_type",
    "normal_side",
    "is_postable",
    "metadata",
  ].join(", ");
  let { data, error } = await supabase
    .from("chart_of_accounts")
    .select(selectClause)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("is_postable", true)
    .order("code", { ascending: true });

  if (error && isMissingSupabaseColumnError(error, "chart_of_accounts")) {
    ({ data, error } = await supabase
      .from("chart_of_accounts")
      .select(legacySelectClause)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("is_postable", true)
      .order("code", { ascending: true }));
  }

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as ChartAccountRow[] | null).map((row) => {
    const metadata = asRecord(row.metadata);

    return {
      ...row,
      is_provisional: asBoolean(row.is_provisional) ?? asBoolean(metadata.is_provisional) ?? false,
      source: asString(row.source) ?? asString(metadata.source),
      external_code: asString(row.external_code) ?? asString(metadata.external_code),
      statement_section: asString(row.statement_section) ?? asString(metadata.statement_section),
      nature_tag: asString(row.nature_tag) ?? asString(metadata.nature_tag),
      function_tag: asString(row.function_tag) ?? asString(metadata.function_tag),
      cashflow_tag: asString(row.cashflow_tag) ?? asString(metadata.cashflow_tag),
      tax_profile_hint: asString(row.tax_profile_hint) ?? asString(metadata.tax_profile_hint),
      currency_policy: asString(row.currency_policy) ?? asString(metadata.currency_policy) ?? "mono_currency",
      chapter_code: asString(row.chapter_code) ?? asString(metadata.chapter_code),
      presentation_code: asString(row.presentation_code) ?? asString(metadata.presentation_code),
      group_id: asString(row.group_id) ?? asString(metadata.group_id),
      currency_code: asString(row.currency_code) ?? asString(metadata.currency_code),
      natural_balance:
        (asString(row.natural_balance) as "debit" | "credit" | null)
        ?? (asString(metadata.natural_balance) as "debit" | "credit" | null),
      requires_party: asBoolean(row.requires_party) ?? asBoolean(metadata.requires_party),
      reconciliable: asBoolean(row.reconciliable) ?? asBoolean(metadata.reconciliable),
      tax_account_kind: asString(row.tax_account_kind) ?? asString(metadata.tax_account_kind),
      include_fx_revaluation:
        asBoolean(row.include_fx_revaluation) ?? asBoolean(metadata.include_fx_revaluation),
      cost_center_policy:
        asString(row.cost_center_policy) ?? asString(metadata.cost_center_policy) ?? "optional",
      sort_order: asNumber(row.sort_order) ?? asNumber(metadata.sort_order),
      provider_managed: asBoolean(row.provider_managed) ?? asBoolean(metadata.provider_managed),
      source_provider: asString(row.source_provider) ?? asString(metadata.source_provider),
      external_parent_code: asString(row.external_parent_code) ?? asString(metadata.external_parent_code),
      account_level: asNumber(row.account_level) ?? asNumber(metadata.account_level),
      is_imputable: asBoolean(row.is_imputable) ?? asBoolean(metadata.is_imputable),
      uses_cost_centers: asBoolean(row.uses_cost_centers) ?? asBoolean(metadata.uses_cost_centers),
      literal_tributario: asNumber(row.literal_tributario) ?? asNumber(metadata.literal_tributario),
      source_channel: asString(row.source_channel) ?? asString(metadata.source_channel),
      provider_meta_json: asRecord(row.provider_meta_json) ?? asRecord(metadata.provider_meta_json),
      jurisdiction_meta_json:
        asRecord(row.jurisdiction_meta_json) ?? asRecord(metadata.jurisdiction_meta_json),
      last_synced_from_provider_at:
        asString(row.last_synced_from_provider_at) ?? asString(metadata.last_synced_from_provider_at),
      metadata,
    } satisfies PostableAccountRecord;
  });
}

export async function loadOrganizationAccountRoleBindings(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("account_role_bindings")
    .select(
      "id, organization_id, binding_key, role_code, account_id, document_role, currency_code, settlement_method, priority, source, is_active, metadata, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .order("binding_key", { ascending: true });

  if (error && isMissingSupabaseRelationError(error, "account_role_bindings")) {
    return [] satisfies AccountRoleBindingRecord[];
  }

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as AccountRoleBindingRow[] | null).map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    binding_key: row.binding_key,
    role_code: row.role_code as AccountRoleBindingRecord["role_code"],
    account_id: row.account_id,
    document_role: (asString(row.document_role) as AccountRoleBindingRecord["document_role"]) ?? null,
    currency_code: normalizeCurrencyCode(asString(row.currency_code)),
    settlement_method:
      (asString(row.settlement_method) as AccountRoleBindingRecord["settlement_method"]) ?? null,
    priority: asNumber(row.priority) ?? 0,
    source: asString(row.source) ?? "manual",
    is_active: asBoolean(row.is_active) ?? true,
    metadata: asRecord(row.metadata),
    created_at: asString(row.created_at) ?? undefined,
  })) satisfies AccountRoleBindingRecord[];
}

export function buildReviewOverrideAccountPayload(input: {
  organizationId: string;
  actorId: string | null;
  documentId: string;
  draftId: string;
  documentRole: AccountingRuleRecord["document_role"];
  code: string;
  name: string;
}) {
  const code = input.code.trim();
  const name = input.name.trim();

  if (!code) {
    throw new Error("El codigo de cuenta es obligatorio.");
  }

  if (!name) {
    throw new Error("El nombre de cuenta es obligatorio.");
  }

  const accountType =
    input.documentRole === "sale"
      ? "revenue"
      : input.documentRole === "purchase"
        ? "expense"
        : "expense";
  const normalSide = accountType === "revenue" ? "credit" : "debit";

  return {
    organization_id: input.organizationId,
    code,
    name,
    account_type: accountType,
    normal_side: normalSide,
    is_postable: true,
    is_provisional: false,
    source: "manual",
    external_code: null,
    statement_section: null,
    nature_tag: accountType === "revenue" ? "revenue" : "expense",
    function_tag: null,
    cashflow_tag: null,
    tax_profile_hint: null,
    currency_policy: "mono_currency",
    metadata: {
      source: "document_review_inline_create",
      created_by: input.actorId,
      created_from_document_id: input.documentId,
      created_from_draft_id: input.draftId,
      review_document_role: input.documentRole,
      review_account_kind: accountType,
      review_account_slug: slugifyConceptCode(name),
    },
  };
}

export async function createReviewOverrideAccount(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    documentId: string;
    draftId: string;
    documentRole: AccountingRuleRecord["document_role"];
    code: string;
    name: string;
  },
) {
  const payload = buildReviewOverrideAccountPayload(input);
  const selectClause = "id, organization_id, code, name, account_type, normal_side, is_postable, is_provisional, source, external_code, statement_section, nature_tag, function_tag, cashflow_tag, tax_profile_hint, currency_policy, metadata";
  const legacySelectClause =
    "id, organization_id, code, name, account_type, normal_side, is_postable, metadata";
  let existingResult = await supabase
    .from("chart_of_accounts")
    .select(selectClause)
    .eq("organization_id", input.organizationId)
    .eq("code", payload.code)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (existingResult.error && isMissingSupabaseColumnError(existingResult.error, "chart_of_accounts")) {
    existingResult = await supabase
      .from("chart_of_accounts")
      .select(legacySelectClause)
      .eq("organization_id", input.organizationId)
      .eq("code", payload.code)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
  }

  if (existingResult.error) {
    throw new Error(existingResult.error.message);
  }

  if (existingResult.data) {
    throw new Error("Ya existe una cuenta activa con ese codigo en la organizacion.");
  }

  let insertResult = await supabase
    .from("chart_of_accounts")
    .insert(payload)
    .select(selectClause)
    .limit(1)
    .single();

  if (insertResult.error && isMissingSupabaseColumnError(insertResult.error, "chart_of_accounts")) {
    insertResult = await supabase
      .from("chart_of_accounts")
      .insert({
        organization_id: payload.organization_id,
        code: payload.code,
        name: payload.name,
        account_type: payload.account_type,
        normal_side: payload.normal_side,
        is_postable: payload.is_postable,
        metadata: payload.metadata,
      })
      .select(legacySelectClause)
      .limit(1)
      .single();
  }

  if (insertResult.error || !insertResult.data?.id) {
    throw new Error(insertResult.error?.message ?? "No se pudo crear la cuenta contable.");
  }
  const data = insertResult.data as unknown as PostableAccountRecord;

  await recordAuditEvent(supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    entityType: "chart_account",
    entityId: data.id as string,
    action: "created_from_document_review",
    afterJson: {
      code: data.code,
      name: data.name,
      account_type: data.account_type,
      normal_side: data.normal_side,
      is_postable: data.is_postable,
      metadata: data.metadata,
    },
    metadata: {
      document_id: input.documentId,
      draft_id: input.draftId,
      document_role: input.documentRole,
    },
  });

  return data as PostableAccountRecord;
}

export async function loadActiveAccountingRules(
  supabase: SupabaseClient,
  organizationId: string,
  documentRole?: AccountingRuleRecord["document_role"] | null,
) {
  const selectClause =
    "id, organization_id, scope, document_id, source_document_id, vendor_id, concept_id, document_role, account_id, status, vat_profile_json, tax_profile_code, operation_category, linked_operation_type, template_code, times_reused, times_corrected, priority, source, is_active, metadata, created_at";
  const legacySelectClause =
    "id, organization_id, scope, document_id, vendor_id, concept_id, document_role, account_id, vat_profile_json, operation_category, linked_operation_type, priority, source, is_active, metadata, created_at";
  let query = supabase
    .from("accounting_rules")
    .select(selectClause)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (documentRole) {
    query = query.eq("document_role", documentRole);
  }

  const primaryResult = await query;
  let data = primaryResult.data as unknown;
  let error = primaryResult.error;

  if (error && isMissingSupabaseColumnError(error, "accounting_rules")) {
    let legacyQuery = supabase
      .from("accounting_rules")
      .select(legacySelectClause)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (documentRole) {
      legacyQuery = legacyQuery.eq("document_role", documentRole);
    }

    const legacyResult = await legacyQuery;
    data = legacyResult.data as unknown;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as Array<Record<string, unknown>> | null).map((row) => ({
    id: String(row.id),
    organization_id: String(row.organization_id),
    scope: row.scope as AccountingRuleRecord["scope"],
    document_id: asString(row.document_id),
    source_document_id: asString(row.source_document_id) ?? asString(row.document_id),
    vendor_id: asString(row.vendor_id),
    concept_id: asString(row.concept_id),
    document_role: row.document_role as AccountingRuleRecord["document_role"],
    account_id: String(row.account_id),
    status: (asString(row.status) as AccountingRuleRecord["status"] | null) ?? "approved",
    vat_profile_json: (row.vat_profile_json as Record<string, unknown> | null) ?? null,
    tax_profile_code: asString(row.tax_profile_code),
    operation_category: asString(row.operation_category),
    linked_operation_type: asString(row.linked_operation_type),
    template_code: asString(row.template_code),
    times_reused: asNumber(row.times_reused) ?? 0,
    times_corrected: asNumber(row.times_corrected) ?? 0,
    priority: asNumber(row.priority) ?? 0,
    source: asString(row.source) ?? "manual",
    is_active: row.is_active === true,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  }) satisfies AccountingRuleRecord);
}

export async function loadAccountingRuntimeContext(
  supabase: SupabaseClient,
  organizationId: string,
  documentRole?: AccountingRuleRecord["document_role"] | null,
  actorId?: string | null,
) {
  await ensureStarterAccountingSetup(supabase, {
    organizationId,
    actorId: actorId ?? null,
  });

  const [vendors, concepts, conceptAliases, accounts, accountRoleBindings, activeRules] = await Promise.all([
    loadOrganizationVendors(supabase, organizationId),
    loadOrganizationConcepts(supabase, organizationId, documentRole),
    loadOrganizationConceptAliases(supabase, organizationId),
    loadOrganizationPostableAccounts(supabase, organizationId),
    loadOrganizationAccountRoleBindings(supabase, organizationId),
    loadActiveAccountingRules(supabase, organizationId, documentRole),
  ]);

  return {
    vendors,
    concepts,
    conceptAliases,
    accounts,
    accountRoleBindings,
    activeRules,
  } satisfies AccountingRuntimeContext;
}

export async function loadPriorApprovalExamples(
  supabase: SupabaseClient,
  organizationId: string,
  documentRole: AccountingRuleRecord["document_role"],
) {
  const { data, error } = await supabase
    .from("accounting_rules")
    .select(
      "id, scope, vendor_id, concept_id, account_id, source, metadata, chart_of_accounts!accounting_rules_account_id_fkey(code, name)",
    )
    .eq("organization_id", organizationId)
    .eq("document_role", documentRole)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as Array<{
    id: string;
    scope: AccountingRuleRecord["scope"];
    vendor_id: string | null;
    concept_id: string | null;
    account_id: string;
    source: string;
    metadata: Record<string, unknown> | null;
    chart_of_accounts:
      | {
          code: string;
          name: string;
        }
      | {
          code: string;
          name: string;
        }[]
      | null;
  }> | null).map((row) => {
    const account = Array.isArray(row.chart_of_accounts)
      ? row.chart_of_accounts[0]
      : row.chart_of_accounts;

    return {
      ruleId: row.id,
      scope: row.scope,
      vendorId: row.vendor_id,
      conceptId: row.concept_id,
      accountId: row.account_id,
      accountCode: account?.code ?? null,
      accountName: account?.name ?? null,
      rationale:
        typeof row.metadata?.rationale === "string"
          ? row.metadata.rationale
          : typeof row.metadata?.assistant_rationale === "string"
            ? row.metadata.assistant_rationale
            : null,
    } satisfies PriorApprovalExample;
  });
}

export async function loadActiveExtractionId(
  supabase: SupabaseClient,
  documentId: string,
) {
  const { data, error } = await supabase
    .from("document_extractions")
    .select("id")
    .eq("document_id", documentId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.id === "string" ? data.id : null;
}

export async function findDuplicateInvoiceIdentityDocumentId(
  supabase: SupabaseClient,
  organizationId: string,
  currentDocumentId: string,
  invoiceIdentityKey: string | null,
) {
  if (!invoiceIdentityKey) {
    return null;
  }

  const { data, error } = await supabase
    .from("document_invoice_identities")
    .select("document_id")
    .eq("organization_id", organizationId)
    .eq("invoice_identity_key", invoiceIdentityKey)
    .neq("document_id", currentDocumentId)
    .in("duplicate_status", [
      "clear",
      "suspected_duplicate",
      "false_positive",
      "justified_non_duplicate",
    ])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.document_id === "string" ? data.document_id : null;
}

export async function findExactInvoiceDuplicateDocumentId(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    currentDocumentId?: string | null;
    facts: DocumentIntakeFactMap;
  },
) {
  const documentNumberNormalized = normalizeDocumentNumber(
    [input.facts.series, input.facts.document_number].filter(Boolean).join("-"),
  );
  const totalAmount =
    typeof input.facts.total_amount === "number"
      ? roundCurrency(input.facts.total_amount)
      : null;
  const currencyCode = normalizeCurrencyCode(input.facts.currency_code);
  const issuerTaxIdNormalized = normalizeTaxId(input.facts.issuer_tax_id);
  const issuerNameNormalized = normalizeTextToken(input.facts.issuer_name);

  if (!documentNumberNormalized || totalAmount === null || !currencyCode) {
    return null;
  }

  const allowedStatuses = [
    "clear",
    "suspected_duplicate",
    "false_positive",
    "justified_non_duplicate",
  ];

  if (issuerTaxIdNormalized) {
    let query = supabase
      .from("document_invoice_identities")
      .select("document_id")
      .eq("organization_id", input.organizationId)
      .eq("issuer_tax_id_normalized", issuerTaxIdNormalized)
      .eq("document_number_normalized", documentNumberNormalized)
      .eq("total_amount", totalAmount)
      .eq("currency_code", currencyCode)
      .in("duplicate_status", allowedStatuses);

    if (input.currentDocumentId) {
      query = query.neq("document_id", input.currentDocumentId);
    }

    const { data, error } = await query
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    const row = ((data as Array<{ document_id: string }> | null) ?? [])[0] ?? null;

    if (typeof row?.document_id === "string") {
      return row.document_id;
    }
  }

  if (!issuerNameNormalized) {
    return null;
  }

  let query = supabase
    .from("document_invoice_identities")
    .select("document_id")
    .eq("organization_id", input.organizationId)
    .eq("issuer_name_normalized", issuerNameNormalized)
    .eq("document_number_normalized", documentNumberNormalized)
    .eq("total_amount", totalAmount)
    .eq("currency_code", currencyCode)
    .in("duplicate_status", allowedStatuses);

  if (input.currentDocumentId) {
    query = query.neq("document_id", input.currentDocumentId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const row = ((data as Array<{ document_id: string }> | null) ?? [])[0] ?? null;

  return typeof row?.document_id === "string" ? row.document_id : null;
}

export async function findSuspiciousDuplicateInvoiceIdentityDocumentId(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    currentDocumentId: string;
    facts: DocumentIntakeFactMap;
  },
) {
  const documentNumberNormalized = normalizeDocumentNumber(
    [input.facts.series, input.facts.document_number].filter(Boolean).join("-"),
  );

  if (!documentNumberNormalized) {
    return null;
  }

  const { data, error } = await supabase
    .from("document_invoice_identities")
    .select(
      "document_id, issuer_tax_id_normalized, issuer_name_normalized, document_number_normalized, document_date, total_amount, currency_code",
    )
    .eq("organization_id", input.organizationId)
    .neq("document_id", input.currentDocumentId)
    .eq("document_number_normalized", documentNumberNormalized)
    .in("duplicate_status", [
      "clear",
      "suspected_duplicate",
      "false_positive",
      "justified_non_duplicate",
    ])
    .order("created_at", { ascending: true })
    .limit(12);

  if (error) {
    throw new Error(error.message);
  }

  return pickSuspiciousInvoiceDuplicateDocumentId({
    issuerTaxIdNormalized: normalizeTaxId(input.facts.issuer_tax_id),
    issuerNameNormalized: normalizeTextToken(input.facts.issuer_name),
    documentNumberNormalized,
    documentDate: input.facts.document_date ?? null,
    totalAmount:
      typeof input.facts.total_amount === "number"
        ? roundCurrency(input.facts.total_amount)
        : null,
    currencyCode: normalizeCurrencyCode(input.facts.currency_code),
    candidates: ((data as Array<{
      document_id: string;
      issuer_tax_id_normalized: string | null;
      issuer_name_normalized: string | null;
      document_number_normalized: string | null;
      document_date: string | null;
      total_amount: number | null;
      currency_code: string | null;
    }> | null) ?? []).map((row) => ({
      documentId: row.document_id,
      issuerTaxIdNormalized: row.issuer_tax_id_normalized,
      issuerNameNormalized: row.issuer_name_normalized,
      documentNumberNormalized: row.document_number_normalized,
      documentDate: row.document_date,
      totalAmount: row.total_amount,
      currencyCode: row.currency_code,
    })),
  });
}

export async function upsertDocumentInvoiceIdentity(
  supabase: SupabaseClient,
  input: Omit<
    PersistedInvoiceIdentityRow,
    "id" | "created_at" | "updated_at" | "resolved_at" | "resolved_by"
  >,
) {
  const now = new Date().toISOString();
  const payload = {
    organization_id: input.organization_id,
    document_id: input.document_id,
    source_draft_id: input.source_draft_id,
    vendor_id: input.vendor_id,
    issuer_tax_id_normalized: input.issuer_tax_id_normalized,
    issuer_name_normalized: input.issuer_name_normalized,
    document_number_normalized: input.document_number_normalized,
    document_date: input.document_date,
    total_amount: input.total_amount,
    currency_code: input.currency_code,
    identity_strategy: input.identity_strategy,
    invoice_identity_key: input.invoice_identity_key,
    duplicate_status: input.duplicate_status,
    duplicate_of_document_id: input.duplicate_of_document_id,
    duplicate_reason: input.duplicate_reason,
    resolution_notes: input.resolution_notes,
    updated_at: now,
  };
  const { data, error } = await supabase
    .from("document_invoice_identities")
    .upsert(payload, {
      onConflict: "document_id",
    })
    .select(
      "id, organization_id, document_id, source_draft_id, vendor_id, issuer_tax_id_normalized, issuer_name_normalized, document_number_normalized, document_date, total_amount, currency_code, identity_strategy, invoice_identity_key, duplicate_status, duplicate_of_document_id, duplicate_reason, resolution_notes, resolved_by, resolved_at, created_at, updated_at",
    )
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo persistir la identidad de factura.");
  }

  return data as PersistedInvoiceIdentityRow;
}

export async function loadDocumentInvoiceIdentity(
  supabase: SupabaseClient,
  documentId: string,
) {
  const { data, error } = await supabase
    .from("document_invoice_identities")
    .select(
      "id, organization_id, document_id, source_draft_id, vendor_id, issuer_tax_id_normalized, issuer_name_normalized, document_number_normalized, document_date, total_amount, currency_code, identity_strategy, invoice_identity_key, duplicate_status, duplicate_of_document_id, duplicate_reason, resolution_notes, resolved_by, resolved_at, created_at, updated_at",
    )
    .eq("document_id", documentId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PersistedInvoiceIdentityRow | null) ?? null;
}

export async function upsertDocumentLineItems(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
    draftId: string;
    lines: Array<{
      lineNumber: number;
      rawConceptCode: string | null;
      rawConceptDescription: string | null;
      normalizedConceptCode: string | null;
      normalizedConceptDescription: string | null;
      netAmount: number | null;
      taxRate: number | null;
      taxAmount: number | null;
      totalAmount: number | null;
      matchedConceptId: string | null;
      matchStrategy: string;
      matchConfidence: number;
      requiresUserContext: boolean;
      metadata?: Record<string, unknown>;
    }>;
  },
) {
  const { error: deleteError } = await supabase
    .from("document_line_items")
    .delete()
    .eq("draft_id", input.draftId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (input.lines.length === 0) {
    return [] satisfies PersistedDocumentLineItemRecord[];
  }

  const payload = input.lines.map((line) => ({
    organization_id: input.organizationId,
    document_id: input.documentId,
    draft_id: input.draftId,
    line_number: line.lineNumber,
    raw_concept_code: line.rawConceptCode,
    raw_concept_description: line.rawConceptDescription,
    normalized_concept_code: line.normalizedConceptCode,
    normalized_concept_description: line.normalizedConceptDescription,
    net_amount: line.netAmount,
    tax_rate: line.taxRate,
    tax_amount: line.taxAmount,
    total_amount: line.totalAmount,
    matched_concept_id: line.matchedConceptId,
    match_strategy: line.matchStrategy,
    match_confidence: line.matchConfidence,
    requires_user_context: line.requiresUserContext,
    metadata: line.metadata ?? {},
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase
    .from("document_line_items")
    .insert(payload)
    .select(
      "id, organization_id, document_id, draft_id, line_number, raw_concept_code, raw_concept_description, normalized_concept_code, normalized_concept_description, net_amount, tax_rate, tax_amount, total_amount, matched_concept_id, match_strategy, match_confidence, requires_user_context, metadata, created_at, updated_at",
    );

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as PersistedDocumentLineItemRecord[] | null);
}

export async function loadDocumentLineItems(
  supabase: SupabaseClient,
  draftId: string,
) {
  const { data, error } = await supabase
    .from("document_line_items")
    .select(
      "id, organization_id, document_id, draft_id, line_number, raw_concept_code, raw_concept_description, normalized_concept_code, normalized_concept_description, net_amount, tax_rate, tax_amount, total_amount, matched_concept_id, match_strategy, match_confidence, requires_user_context, metadata, created_at, updated_at",
    )
    .eq("draft_id", draftId)
    .order("line_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as PersistedDocumentLineItemRecord[] | null);
}

export async function loadDocumentAccountingContext(
  supabase: SupabaseClient,
  draftId: string,
) {
  const { data, error } = await supabase
    .from("document_accounting_contexts")
    .select(
      "id, organization_id, document_id, draft_id, status, reason_codes, user_free_text, structured_context_json, ai_request_payload_json, ai_response_json, provider_code, model_code, prompt_hash, request_latency_ms, created_at, updated_at",
    )
    .eq("draft_id", draftId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as DocumentAccountingContextRecord | null) ?? null;
}

export async function upsertDocumentAccountingContext(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
    draftId: string;
    actorId: string | null;
    context: AccountingContextResolution;
  },
) {
  const now = new Date().toISOString();
  const payload = {
    organization_id: input.organizationId,
    document_id: input.documentId,
    draft_id: input.draftId,
    status: input.context.status,
    reason_codes: input.context.reasonCodes,
    user_free_text: input.context.userFreeText,
    structured_context_json: input.context.structuredContext,
    ai_request_payload_json: input.context.aiRequestPayload,
    ai_response_json: input.context.aiResponse,
    provider_code: input.context.providerCode,
    model_code: input.context.modelCode,
    prompt_hash: input.context.promptHash,
    request_latency_ms: input.context.requestLatencyMs,
    updated_by: input.actorId,
    updated_at: now,
  };
  const { data, error } = await supabase
    .from("document_accounting_contexts")
    .upsert(
      {
        ...payload,
        created_by: input.actorId,
      },
      { onConflict: "draft_id" },
    )
    .select(
      "id, organization_id, document_id, draft_id, status, reason_codes, user_free_text, structured_context_json, ai_request_payload_json, ai_response_json, provider_code, model_code, prompt_hash, request_latency_ms, created_at, updated_at",
    )
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo persistir el contexto contable.");
  }

  return data as DocumentAccountingContextRecord;
}

function resolveAccountByIdOrCode(input: {
  accounts: ChartAccountRow[];
  accountId?: string | null;
  accountCode?: string | null;
}) {
  if (input.accountId) {
    const byId = input.accounts.find((account) => account.id === input.accountId);

    if (byId) {
      return byId;
    }
  }

  if (input.accountCode) {
    return input.accounts.find((account) => account.code === input.accountCode) ?? null;
  }

  return null;
}

async function loadOrganizationChartAccounts(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const selectClause = [
    "id",
    "organization_id",
    "code",
    "name",
    "account_type",
    "normal_side",
    "is_postable",
    "is_provisional",
    "source",
    "external_code",
    "statement_section",
    "nature_tag",
    "function_tag",
    "cashflow_tag",
    "tax_profile_hint",
    "currency_policy",
    "chapter_code",
    "presentation_code",
    "group_id",
    "currency_code",
    "natural_balance",
    "requires_party",
    "reconciliable",
    "tax_account_kind",
    "include_fx_revaluation",
    "cost_center_policy",
    "sort_order",
    "provider_managed",
    "source_provider",
    "external_parent_code",
    "account_level",
    "is_imputable",
    "uses_cost_centers",
    "literal_tributario",
    "source_channel",
    "provider_meta_json",
    "jurisdiction_meta_json",
    "last_synced_from_provider_at",
    "metadata",
  ].join(", ");
  const legacySelectClause =
    "id, organization_id, code, name, account_type, normal_side, is_postable, metadata";
  const primaryResult = await supabase
    .from("chart_of_accounts")
    .select(selectClause)
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  let data = primaryResult.data as unknown;
  let error = primaryResult.error;

  if (error && isMissingSupabaseColumnError(error, "chart_of_accounts")) {
    const legacyResult = await supabase
      .from("chart_of_accounts")
      .select(legacySelectClause)
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    data = legacyResult.data as unknown;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as ChartAccountRow[] | null);
}

async function loadOrganizationBaseCurrency(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organizations")
    .select("base_currency")
    .eq("id", organizationId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeCurrencyCode(asString(data?.base_currency) ?? "UYU") ?? "UYU";
}

async function loadAccountingSettingsWithFallback(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const functionalCurrencyCode = await loadOrganizationBaseCurrency(supabase, organizationId);
  const fallback = {
    id: null as string | null,
    functionalCurrencyCode,
    modificationsLockedBefore: null as string | null,
    usesForeignCurrency: false,
    usesCostCenters: false,
    usesReferences: false,
    usesTaxLiterals: false,
    metadata: {} as Record<string, unknown>,
  };

  const result = await supabase
    .from("accounting_settings")
    .select(
      "id, functional_currency_code, modifications_locked_before, uses_foreign_currency, uses_cost_centers, uses_references, uses_tax_literals, metadata",
    )
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();

  if (result.error && isMissingSupabaseRelationError(result.error, "accounting_settings")) {
    return fallback;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    return fallback;
  }

  return {
    id: asString(result.data.id),
    functionalCurrencyCode:
      normalizeCurrencyCode(asString(result.data.functional_currency_code) ?? functionalCurrencyCode)
      ?? functionalCurrencyCode,
    modificationsLockedBefore: asString(result.data.modifications_locked_before),
    usesForeignCurrency: asBoolean(result.data.uses_foreign_currency) ?? false,
    usesCostCenters: asBoolean(result.data.uses_cost_centers) ?? false,
    usesReferences: asBoolean(result.data.uses_references) ?? false,
    usesTaxLiterals: asBoolean(result.data.uses_tax_literals) ?? false,
    metadata: asRecord(result.data.metadata),
  };
}

async function ensureFiscalPeriodForDate(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentDate: string;
    actorId: string | null;
  },
) {
  const settings = await loadAccountingSettingsWithFallback(supabase, input.organizationId);

  if (
    settings.modificationsLockedBefore
    && input.documentDate <= settings.modificationsLockedBefore
  ) {
    throw new Error("La fecha contable cae en una ventana bloqueada por configuracion contable.");
  }

  const periodRange = buildAccountingMonthRange(input.documentDate);

  if (!periodRange) {
    throw new Error("La fecha contable no permite resolver un periodo mensual.");
  }

  const periodResult = await supabase
    .from("fiscal_periods")
    .select("id, status, starts_on, ends_on, locked_at")
    .eq("organization_id", input.organizationId)
    .eq("starts_on", periodRange.startDate)
    .eq("ends_on", periodRange.endDate)
    .limit(1)
    .maybeSingle();

  if (periodResult.error && isMissingSupabaseRelationError(periodResult.error, "fiscal_periods")) {
    return null;
  }

  if (periodResult.error) {
    throw new Error(periodResult.error.message);
  }

  let period = periodResult.data as Record<string, unknown> | null;

  if (!period) {
    const now = new Date().toISOString();
    const insertResult = await supabase
      .from("fiscal_periods")
      .insert({
        organization_id: input.organizationId,
        code: periodRange.code,
        label: periodRange.label,
        starts_on: periodRange.startDate,
        ends_on: periodRange.endDate,
        status: "open",
        is_current: getAccountingMonthKey(new Date().toISOString().slice(0, 10)) === periodRange.periodKey,
        metadata: {
          source: "kernel_auto_open",
          period_granularity: "month",
          period_key: periodRange.periodKey,
        },
        updated_at: now,
      })
      .select("id, status, starts_on, ends_on, locked_at")
      .limit(1)
      .single();

    if (insertResult.error && isMissingSupabaseRelationError(insertResult.error, "fiscal_periods")) {
      return null;
    }

    if (insertResult.error) {
      throw new Error(insertResult.error.message);
    }

    period = insertResult.data as Record<string, unknown> | null;
  }

  const status = asString(period?.status) ?? "open";
  const lockedAt = asString(period?.locked_at);

  if (isFiscalPeriodLockedForPosting({
    status,
    lockedAt,
  })) {
    throw new Error("No se puede postear en un periodo contable cerrado o bloqueado.");
  }

  return asString(period?.id);
}

async function materializeOrganizationAccountingSnapshot(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    ruleSnapshotId: string | null;
  },
) {
  const settings = await loadAccountingSettingsWithFallback(supabase, input.organizationId);
  const [accounts, accountRoleBindings] = await Promise.all([
    loadOrganizationChartAccounts(supabase, input.organizationId),
    loadOrganizationAccountRoleBindings(supabase, input.organizationId),
  ]);
  const snapshotJson = {
    settings: {
      functional_currency_code: settings.functionalCurrencyCode,
      modifications_locked_before: settings.modificationsLockedBefore,
      uses_foreign_currency: settings.usesForeignCurrency,
      uses_cost_centers: settings.usesCostCenters,
      uses_references: settings.usesReferences,
      uses_tax_literals: settings.usesTaxLiterals,
      metadata: settings.metadata,
    },
    chart_of_accounts: accounts
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((account) => ({
        id: account.id,
        code: account.code,
        name: account.name,
        account_type: account.account_type,
        normal_side: account.normal_side,
        is_postable: account.is_postable,
        is_provisional: account.is_provisional ?? false,
        external_code: account.external_code ?? null,
        chapter_code: account.chapter_code ?? null,
        presentation_code: account.presentation_code ?? null,
        source_channel: account.source_channel ?? null,
        source_provider: account.source_provider ?? null,
      })),
    account_role_bindings: accountRoleBindings
      .sort((left, right) =>
        left.binding_key.localeCompare(right.binding_key)
        || right.priority - left.priority)
      .map((binding) => ({
        id: binding.id,
        binding_key: binding.binding_key,
        role_code: binding.role_code,
        account_id: binding.account_id,
        document_role: binding.document_role,
        currency_code: binding.currency_code,
        settlement_method: binding.settlement_method,
        priority: binding.priority,
        source: binding.source,
      })),
  };
  const fingerprint = computeKernelHash(snapshotJson);

  const existingResult = await supabase
    .from("organization_accounting_snapshots")
    .select("id, fingerprint, version_number")
    .eq("organization_id", input.organizationId)
    .eq("fingerprint", fingerprint)
    .limit(1)
    .maybeSingle();

  if (
    existingResult.error
    && isMissingSupabaseRelationError(existingResult.error, "organization_accounting_snapshots")
  ) {
    return {
      id: null as string | null,
      fingerprint: null as string | null,
    };
  }

  if (existingResult.error) {
    throw new Error(existingResult.error.message);
  }

  if (existingResult.data?.id) {
    return {
      id: existingResult.data.id as string,
      fingerprint,
    };
  }

  const versionResult = await supabase
    .from("organization_accounting_snapshots")
    .select("version_number")
    .eq("organization_id", input.organizationId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    versionResult.error
    && isMissingSupabaseRelationError(versionResult.error, "organization_accounting_snapshots")
  ) {
    return {
      id: null as string | null,
      fingerprint: null as string | null,
    };
  }

  if (versionResult.error) {
    throw new Error(versionResult.error.message);
  }

  const nextVersion = (asNumber(versionResult.data?.version_number) ?? 0) + 1;
  const insertResult = await supabase
    .from("organization_accounting_snapshots")
    .insert({
      organization_id: input.organizationId,
      version_number: nextVersion,
      fingerprint,
      source_rule_snapshot_id: input.ruleSnapshotId,
      snapshot_json: snapshotJson,
      metadata: {
        source: "posting_confirmation",
      },
      created_by: input.actorId,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .limit(1)
    .single();

  if (
    insertResult.error
    && isMissingSupabaseRelationError(insertResult.error, "organization_accounting_snapshots")
  ) {
    return {
      id: null as string | null,
      fingerprint: null as string | null,
    };
  }

  if (insertResult.error || !insertResult.data?.id) {
    throw new Error(insertResult.error?.message ?? "No se pudo materializar la snapshot contable.");
  }

  return {
    id: insertResult.data.id as string,
    fingerprint,
  };
}

async function upsertSourceEventWithCompat(
  supabase: SupabaseClient,
  input: AccountingArtifactsPersistenceInput,
) {
  const payload = buildSourceEventPayload(input);
  const existingResult = await supabase
    .from("source_events")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("source_channel", payload.source_channel)
    .eq("source_entity_type", payload.source_entity_type)
    .eq("source_entity_id", input.documentId)
    .limit(1)
    .maybeSingle();

  if (existingResult.error && isMissingSupabaseRelationError(existingResult.error, "source_events")) {
    return null;
  }

  if (existingResult.error) {
    throw new Error(existingResult.error.message);
  }

  if (existingResult.data?.id) {
    const updateResult = await supabase
      .from("source_events")
      .update({
        source_document_id: input.documentId,
        binary_hash: payload.binary_hash,
        payload_hash: payload.payload_hash,
        source_ref_json: payload.source_ref_json,
        metadata_json: payload.metadata_json,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingResult.data.id)
      .select("id")
      .limit(1)
      .single();

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    return existingResult.data.id as string;
  }

  const insertResult = await supabase
    .from("source_events")
    .insert({
      organization_id: input.organizationId,
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .limit(1)
    .single();

  if (insertResult.error && isMissingSupabaseRelationError(insertResult.error, "source_events")) {
    return null;
  }

  if (insertResult.error || !insertResult.data?.id) {
    throw new Error(insertResult.error?.message ?? "No se pudo materializar el source event.");
  }

  return insertResult.data.id as string;
}

async function upsertSourceEventFactsWithCompat(
  supabase: SupabaseClient,
  input: AccountingArtifactsPersistenceInput,
  sourceEventId: string | null,
) {
  if (!sourceEventId) {
    return null;
  }

  const payload = buildSourceEventFactsPayload(input);
  const result = await supabase
    .from("source_event_facts")
    .upsert({
      organization_id: input.organizationId,
      source_event_id: sourceEventId,
      ...payload,
      created_by: input.actorId,
    }, {
      onConflict: "source_event_id,version_no",
    })
    .select("id")
    .limit(1)
    .single();

  if (result.error && isMissingSupabaseRelationError(result.error, "source_event_facts")) {
    return null;
  }

  if (result.error || !result.data?.id) {
    throw new Error(result.error?.message ?? "No se pudo versionar los facts del source event.");
  }

  return result.data.id as string;
}

async function createPostingProposalWithCompat(
  supabase: SupabaseClient,
  input: {
    artifacts: AccountingArtifactsPersistenceInput;
    sourceEventId: string | null;
    sourceEventFactsId: string | null;
    accountingSnapshotId: string | null;
    accountingSnapshotFingerprint: string | null;
  },
) {
  if (!input.sourceEventId || !input.sourceEventFactsId) {
    return null;
  }

  const versionResult = await supabase
    .from("posting_proposals")
    .select("proposal_version_no")
    .eq("organization_id", input.artifacts.organizationId)
    .eq("source_event_id", input.sourceEventId)
    .order("proposal_version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionResult.error && isMissingSupabaseRelationError(versionResult.error, "posting_proposals")) {
    return null;
  }

  if (versionResult.error) {
    throw new Error(versionResult.error.message);
  }

  const economicHash = buildEconomicEventHash(input.artifacts);
  const postingHash = buildJournalEntrySourceHash(input.artifacts);
  const proposalPayload = buildPostingProposalPayload({
    artifacts: input.artifacts,
    accountingSnapshotId: input.accountingSnapshotId,
    accountingSnapshotFingerprint: input.accountingSnapshotFingerprint,
    sourceEventFactsVersionNo: input.artifacts.revisionNumber,
    proposalVersionNo: (asNumber(versionResult.data?.proposal_version_no) ?? 0) + 1,
    economicHash,
    postingHash,
  });
  const result = await supabase
    .from("posting_proposals")
    .insert({
      organization_id: input.artifacts.organizationId,
      source_event_id: input.sourceEventId,
      source_event_facts_id: input.sourceEventFactsId,
      ...proposalPayload,
      created_by: input.artifacts.actorId,
      confirmed_by: input.artifacts.actorId,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id, proposal_hash, economic_hash")
    .limit(1)
    .single();

  if (result.error && isMissingSupabaseRelationError(result.error, "posting_proposals")) {
    return null;
  }

  if (result.error || !result.data?.id) {
    throw new Error(result.error?.message ?? "No se pudo crear la posting proposal.");
  }

  return {
    id: result.data.id as string,
    proposalHash: asString(result.data.proposal_hash) ?? postingHash,
    economicHash: asString(result.data.economic_hash) ?? economicHash,
    accountingSnapshotFingerprint: input.accountingSnapshotFingerprint,
  };
}

async function invalidateSupersededPostingProposalsWithCompat(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    sourceEventId: string | null;
    currentProposalId: string | null;
    reason: string;
  },
) {
  if (!input.sourceEventId || !input.currentProposalId) {
    return;
  }

  const result = await supabase
    .from("posting_proposals")
    .update({
      confirmability_status: "superseded",
      invalidated_at: new Date().toISOString(),
      invalidated_reason: input.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("source_event_id", input.sourceEventId)
    .neq("id", input.currentProposalId)
    .in("confirmability_status", ["confirmable", "stale_snapshot"]);

  if (result.error && isMissingSupabaseRelationError(result.error, "posting_proposals")) {
    return;
  }

  if (result.error && isMissingSupabaseColumnError(result.error, "posting_proposals")) {
    return;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function markPostingProposalMaterializedWithCompat(
  supabase: SupabaseClient,
  input: {
    proposalId: string | null;
    journalEntryId: string;
  },
) {
  if (!input.proposalId) {
    return;
  }

  const result = await supabase
    .from("posting_proposals")
    .update({
      confirmability_status: "materialized",
      materialized_journal_entry_id: input.journalEntryId,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.proposalId);

  if (result.error && isMissingSupabaseRelationError(result.error, "posting_proposals")) {
    return;
  }

  if (result.error && isMissingSupabaseColumnError(result.error, "posting_proposals")) {
    return;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function insertPostingProposalLinesWithCompat(
  supabase: SupabaseClient,
  input: AccountingArtifactsPersistenceInput,
  proposalId: string | null,
) {
  if (!proposalId) {
    return;
  }

  const payload = buildPostingProposalLinePayloads(input).map((line) => ({
    proposal_id: proposalId,
    ...line,
  }));

  const result = await supabase
    .from("posting_proposal_lines")
    .insert(payload);

  if (result.error && isMissingSupabaseRelationError(result.error, "posting_proposal_lines")) {
    return;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function insertPostingDecisionLogWithCompat(
  supabase: SupabaseClient,
  input: {
    artifacts: AccountingArtifactsPersistenceInput;
    sourceEventId: string | null;
    sourceEventFactsId: string | null;
    postingProposalId: string | null;
  },
) {
  if (!input.sourceEventId || !input.sourceEventFactsId || !input.postingProposalId) {
    return;
  }

  const result = await supabase
    .from("posting_decision_logs")
    .insert({
      organization_id: input.artifacts.organizationId,
      source_event_id: input.sourceEventId,
      source_event_facts_id: input.sourceEventFactsId,
      posting_proposal_id: input.postingProposalId,
      decision_stage: "proposal_confirmed",
      decision_source: "kernel",
      explanation: input.artifacts.derived.journalSuggestion.explanation,
      decision_json: {
        applied_rule: {
          rule_id: input.artifacts.derived.appliedRule.ruleId,
          scope: input.artifacts.derived.appliedRule.scope,
          priority: input.artifacts.derived.appliedRule.priority,
        },
        validation: input.artifacts.derived.validation,
        settlement_context: input.artifacts.derived.settlementContext,
      },
      created_by: input.artifacts.actorId,
    });

  if (result.error && isMissingSupabaseRelationError(result.error, "posting_decision_logs")) {
    return;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function loadLatestActiveJournalEntryForDocument(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
  },
) {
  let result = await supabase
    .from("journal_entries")
    .select(
      "id, organization_id, source_document_id, source_suggestion_id, fiscal_period_id, journal_type_id, auxiliary_book_id, source_channel, source_system, source_event_id, posting_proposal_id, accounting_snapshot_id, posting_mode, currency_code, fx_rate, fx_rate_date, fx_rate_source, fx_rate_bcu_value, fx_rate_bcu_date_used, functional_currency_code, functional_currency, reference, description, source_hash, economic_hash, immutable_at, status",
    )
    .eq("organization_id", input.organizationId)
    .eq("source_document_id", input.documentId)
    .is("reverses_journal_entry_id", null)
    .in("status", ["posted", "exported"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error && isMissingJournalEntryStep5ColumnError(result.error)) {
    result = await supabase
      .from("journal_entries")
      .select(
        "id, organization_id, source_document_id, source_suggestion_id, posting_mode, currency_code, fx_rate, fx_rate_date, fx_rate_source, functional_currency_code, functional_currency, reference, description",
      )
      .eq("organization_id", input.organizationId)
      .eq("source_document_id", input.documentId)
      .in("status", ["posted", "exported"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data as Record<string, unknown> | null) ?? null;
}

async function loadJournalEntryLinesForLedgerMutation(
  supabase: SupabaseClient,
  journalEntryId: string,
) {
  const primaryResult = await supabase
    .from("journal_entry_lines")
    .select(
      "line_no, account_id, debit, credit, currency_code, original_currency_code, original_amount, debit_original, credit_original, fx_rate, fx_rate_applied, functional_debit, functional_credit, functional_amount_uyu, functional_currency_code, tax_tag, party_id, tax_code_id, vendor_id, customer_id, description, role_code, line_purpose, tax_component, settlement_component, source_ref_json, source_hash, provider_managed, metadata",
    )
    .eq("journal_entry_id", journalEntryId)
    .order("line_no", { ascending: true });
  let data = primaryResult.data as unknown;
  let error = primaryResult.error;

  if (error && isMissingJournalEntryLineStep5ColumnError(error)) {
    const legacyResult = await supabase
      .from("journal_entry_lines")
      .select(
        "line_no, account_id, debit, credit, currency_code, original_currency_code, original_amount, fx_rate, fx_rate_applied, functional_debit, functional_credit, functional_amount_uyu, tax_tag, vendor_id, customer_id, description, metadata",
      )
      .eq("journal_entry_id", journalEntryId)
      .order("line_no", { ascending: true });
    data = legacyResult.data as unknown;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as Array<Record<string, unknown>> | null).map((line) => ({
    line_no: asNumber(line.line_no) ?? 0,
    account_id: asString(line.account_id),
    debit: asNumber(line.debit) ?? 0,
    credit: asNumber(line.credit) ?? 0,
    currency_code: asString(line.currency_code),
    original_currency_code: asString(line.original_currency_code),
    original_amount: asNumber(line.original_amount),
    debit_original: asNumber(line.debit_original),
    credit_original: asNumber(line.credit_original),
    fx_rate: asNumber(line.fx_rate),
    fx_rate_applied: asNumber(line.fx_rate_applied),
    functional_debit: asNumber(line.functional_debit),
    functional_credit: asNumber(line.functional_credit),
    functional_amount_uyu: asNumber(line.functional_amount_uyu),
    functional_currency_code: asString(line.functional_currency_code),
    tax_tag: asString(line.tax_tag),
    party_id: asString(line.party_id),
    tax_code_id: asString(line.tax_code_id),
    vendor_id: asString(line.vendor_id),
    customer_id: asString(line.customer_id),
    description: asString(line.description),
    role_code: asString(line.role_code),
    line_purpose: asString(line.line_purpose),
    tax_component: asString(line.tax_component),
    settlement_component: asString(line.settlement_component),
    source_ref_json: asRecord(line.source_ref_json),
    source_hash: asString(line.source_hash),
    provider_managed: asBoolean(line.provider_managed) ?? false,
    metadata: asRecord(line.metadata),
  }));
}

async function markJournalEntryReversedByWithCompat(
  supabase: SupabaseClient,
  input: {
    originalJournalEntryId: string;
    reversalJournalEntryId: string;
  },
) {
  const result = await supabase
    .from("journal_entries")
    .update({
      reversed_by_journal_entry_id: input.reversalJournalEntryId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.originalJournalEntryId);

  if (result.error && isMissingJournalEntryStep5ColumnError(result.error)) {
    return;
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function insertJournalEntryWithCompat(
  supabase: SupabaseClient,
  input: {
    payload: Record<string, unknown>;
  },
) {
  let insertResult = await supabase
    .from("journal_entries")
    .insert(input.payload)
    .select("id")
    .limit(1)
    .single();

  if (insertResult.error && isMissingJournalEntryStep5ColumnError(insertResult.error)) {
    insertResult = await supabase
      .from("journal_entries")
      .insert(omitJournalEntryStep5Columns(input.payload))
      .select("id")
      .limit(1)
      .single();
  }

  if (insertResult.error || !insertResult.data?.id) {
    throw new Error(insertResult.error?.message ?? "No se pudo crear el journal entry.");
  }

  return insertResult.data.id as string;
}

async function finalizeJournalEntryWithCompat(
  supabase: SupabaseClient,
  input: {
    journalEntryId: string;
    payload: Record<string, unknown>;
  },
) {
  let updateResult = await supabase
    .from("journal_entries")
    .update(input.payload)
    .eq("id", input.journalEntryId)
    .select("id")
    .limit(1)
    .single();

  if (updateResult.error && isMissingJournalEntryStep5ColumnError(updateResult.error)) {
    updateResult = await supabase
      .from("journal_entries")
      .update(omitJournalEntryStep5Columns(input.payload))
      .eq("id", input.journalEntryId)
      .select("id")
      .limit(1)
      .single();
  }

  if (updateResult.error || !updateResult.data?.id) {
    throw new Error(updateResult.error?.message ?? "No se pudo finalizar el journal entry.");
  }

  return updateResult.data.id as string;
}

async function insertJournalEntryLinesWithCompat(
  supabase: SupabaseClient,
  linePayload: Array<Record<string, unknown>>,
) {
  if (linePayload.length === 0) {
    return;
  }

  let insertResult = await supabase
    .from("journal_entry_lines")
    .insert(linePayload);

  if (insertResult.error && isMissingJournalEntryLineStep5ColumnError(insertResult.error)) {
    insertResult = await supabase
      .from("journal_entry_lines")
      .insert(linePayload.map((line) => omitJournalEntryLineStep5Columns(line)));
  }

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }
}

export async function persistApprovedAccountingArtifacts(
  supabase: SupabaseClient,
  input: AccountingArtifactsPersistenceInput,
) {
  const now = new Date().toISOString();
  const extractionId = await loadActiveExtractionId(supabase, input.documentId);
  const { data: suggestion, error: suggestionError } = await supabase
    .from("accounting_suggestions")
    .upsert(
      {
        organization_id: input.organizationId,
        document_id: input.documentId,
        extraction_id: extractionId,
        version_no: input.revisionNumber,
        status: "approved",
        confidence: input.confidence,
        explanation: input.derived.journalSuggestion.explanation,
        tax_treatment_json: input.derived.taxTreatment,
        rule_trace_json: [
          ...input.derived.taxTreatment.deterministicRuleRefs,
          {
            id: input.derived.appliedRule.ruleId,
            scope: input.derived.appliedRule.scope,
            priority: input.derived.appliedRule.priority,
            sourceReference: input.derived.appliedRule.provenance,
          },
        ],
        generated_by: input.derived.assistantSuggestion.status === "completed"
          ? "system+assistant"
          : "system",
        approved_by: input.actorId,
        approved_at: now,
      },
      {
        onConflict: "document_id,version_no",
      },
    )
    .select("id")
    .limit(1)
    .single();

  if (suggestionError || !suggestion?.id) {
    throw new Error(suggestionError?.message ?? "No se pudo persistir la sugerencia contable.");
  }

  const { error: deleteSuggestionLinesError } = await supabase
    .from("accounting_suggestion_lines")
    .delete()
    .eq("suggestion_id", suggestion.id);

  if (deleteSuggestionLinesError) {
    throw new Error(deleteSuggestionLinesError.message);
  }

  const suggestionLinePayload = input.derived.journalSuggestion.lines.map((line) => ({
    suggestion_id: suggestion.id,
    line_no: line.lineNumber,
    side: line.debit > 0 ? "debit" : "credit",
    account_id: line.accountId,
    amount: roundCurrency(line.debit > 0 ? line.debit : line.credit),
    tax_tag: line.taxTag,
    memo: line.accountName,
    metadata: {
      provenance: line.provenance,
      currency_code: line.currencyCode,
      fx_rate: line.fxRate,
      functional_debit: line.functionalDebit,
      functional_credit: line.functionalCredit,
      role_code: line.roleCode,
      line_purpose: line.linePurpose,
      tax_component: line.taxComponent,
      settlement_component: line.settlementComponent,
      is_provisional: line.isProvisional,
    },
  })).filter((line) => Boolean(line.account_id));

  if (suggestionLinePayload.length > 0) {
    const { error: suggestionLineError } = await supabase
      .from("accounting_suggestion_lines")
      .insert(suggestionLinePayload);

    if (suggestionLineError) {
      throw new Error(suggestionLineError.message);
    }
  }

  const accounts = await loadOrganizationChartAccounts(supabase, input.organizationId);
  const journalLines = input.derived.journalSuggestion.lines;
  const missingCodes = journalLines
    .filter((line) => !resolveAccountByIdOrCode({
      accounts,
      accountId: line.accountId,
      accountCode: line.accountCode,
    }))
    .map((line) => line.accountCode);
  if (missingCodes.length > 0) {
    throw new Error(
      `No se puede postear el documento porque faltan cuentas activas en el plan: ${missingCodes.join(", ")}.`,
    );
  }
  const description = missingCodes.length > 0
    ? `${input.derived.journalSuggestion.explanation} Template ${input.derived.journalSuggestion.templateCode ?? "sin_template"}. Lineas pendientes por falta de plan de cuentas: ${missingCodes.join(", ")}.`
    : `${input.derived.journalSuggestion.explanation} Template ${input.derived.journalSuggestion.templateCode ?? "sin_template"}.`;
  const sourceEventId = await upsertSourceEventWithCompat(supabase, input);
  const sourceEventFactsId = await upsertSourceEventFactsWithCompat(
    supabase,
    input,
    sourceEventId,
  );
  const accountingSnapshot = await materializeOrganizationAccountingSnapshot(supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    ruleSnapshotId: input.ruleSnapshotId,
  });
  const postingProposal = await createPostingProposalWithCompat(supabase, {
    artifacts: input,
    sourceEventId,
    sourceEventFactsId,
    accountingSnapshotId: accountingSnapshot.id,
    accountingSnapshotFingerprint: accountingSnapshot.fingerprint,
  });
  const postingProposalId = postingProposal?.id ?? null;

  await insertPostingProposalLinesWithCompat(supabase, input, postingProposalId);
  await insertPostingDecisionLogWithCompat(supabase, {
    artifacts: input,
    sourceEventId,
    sourceEventFactsId,
    postingProposalId,
  });
  await invalidateSupersededPostingProposalsWithCompat(supabase, {
    organizationId: input.organizationId,
    sourceEventId,
    currentProposalId: postingProposalId,
    reason: "superseded_by_new_proposal",
  });

  const fiscalPeriodId = await ensureFiscalPeriodForDate(supabase, {
    organizationId: input.organizationId,
    documentDate: input.documentDate,
    actorId: input.actorId,
  });
  const sourceHash = postingProposal?.proposalHash ?? buildJournalEntrySourceHash(input);
  const economicHash = postingProposal?.economicHash ?? buildEconomicEventHash(input);
  const latestActiveEntry = await loadLatestActiveJournalEntryForDocument(supabase, {
    organizationId: input.organizationId,
    documentId: input.documentId,
  });
  let reversalJournalEntryId: string | null = null;
  const reversalEntryDate = now.slice(0, 10);
  const reversalFiscalPeriodId = latestActiveEntry?.id
    ? await ensureFiscalPeriodForDate(supabase, {
      organizationId: input.organizationId,
      documentDate: reversalEntryDate,
      actorId: input.actorId,
    })
    : null;

  if (asString(latestActiveEntry?.source_hash) === sourceHash && asString(latestActiveEntry?.id)) {
    await markPostingProposalMaterializedWithCompat(supabase, {
      proposalId: postingProposalId,
      journalEntryId: asString(latestActiveEntry?.id) as string,
    });

    return {
      suggestionId: suggestion.id as string,
      journalEntryId: asString(latestActiveEntry?.id) as string,
      sourceEventId,
      sourceEventFactsId,
      postingProposalId,
      accountingSnapshotId: accountingSnapshot.id,
      reversalJournalEntryId,
    } satisfies AccountingArtifactsPersistenceResult;
  }

  if (latestActiveEntry?.id) {
    const previousLines = await loadJournalEntryLinesForLedgerMutation(
      supabase,
      latestActiveEntry.id as string,
    );
    const reversal = buildReversalJournalEntry({
      header: {
        organization_id: input.organizationId,
        source_document_id: input.documentId,
        source_suggestion_id: suggestion.id as string,
        fiscal_period_id: reversalFiscalPeriodId ?? fiscalPeriodId,
        journal_type_id: asString(latestActiveEntry.journal_type_id),
        auxiliary_book_id: asString(latestActiveEntry.auxiliary_book_id),
        source_channel: asString(latestActiveEntry.source_channel) ?? "documents",
        source_system: asString(latestActiveEntry.source_system) ?? "convertilabs",
        source_event_id: sourceEventId,
        posting_proposal_id: postingProposalId,
        accounting_snapshot_id: accountingSnapshot.id,
        posting_mode:
          asString(latestActiveEntry.posting_mode)
          ?? input.derived.journalSuggestion.postingMode,
        currency_code: asString(latestActiveEntry.currency_code) ?? input.currencyCode ?? "UYU",
        fx_rate: asNumber(latestActiveEntry.fx_rate) ?? input.derived.journalSuggestion.fxRate,
        fx_rate_date:
          asString(latestActiveEntry.fx_rate_date)
          ?? input.derived.journalSuggestion.fxRateDate,
        fx_rate_source:
          asString(latestActiveEntry.fx_rate_source)
          ?? input.derived.journalSuggestion.fxRateSource,
        fx_rate_bcu_value:
          asNumber(latestActiveEntry.fx_rate_bcu_value)
          ?? input.derived.journalSuggestion.fxRateBcuValue,
        fx_rate_bcu_date_used:
          asString(latestActiveEntry.fx_rate_bcu_date_used)
          ?? input.derived.journalSuggestion.fxRateBcuDateUsed,
        functional_currency_code:
          asString(latestActiveEntry.functional_currency_code)
          ?? input.derived.journalSuggestion.functionalCurrencyCode,
        functional_currency:
          asString(latestActiveEntry.functional_currency)
          ?? input.derived.journalSuggestion.functionalCurrencyCode,
        reference: asString(latestActiveEntry.reference) ?? input.reference,
        description: asString(latestActiveEntry.description) ?? description,
        entry_date: reversalEntryDate,
      },
      lines: previousLines,
      originalJournalEntryId: latestActiveEntry.id as string,
      actorId: input.actorId,
    });
    const reversalDraftId = await insertJournalEntryWithCompat(supabase, {
      payload: {
        ...reversal.header,
        status: "draft",
        immutable_at: null,
        created_at: now,
        updated_at: now,
      },
    });
    await insertJournalEntryLinesWithCompat(
      supabase,
      reversal.lines.map((line) => ({
        journal_entry_id: reversalDraftId,
        ...line,
      })),
    );
    reversalJournalEntryId = await finalizeJournalEntryWithCompat(supabase, {
      journalEntryId: reversalDraftId,
      payload: {
        status: "posted",
        immutable_at: now,
        updated_at: now,
      },
    });
    await markJournalEntryReversedByWithCompat(supabase, {
      originalJournalEntryId: latestActiveEntry.id as string,
      reversalJournalEntryId,
    });
  }

  const journalEntryDraftId = await insertJournalEntryWithCompat(supabase, {
    payload: {
      organization_id: input.organizationId,
      source_document_id: input.documentId,
      source_suggestion_id: suggestion.id as string,
      fiscal_period_id: fiscalPeriodId,
      source_channel: "documents",
      source_system: "convertilabs",
      source_event_id: sourceEventId,
      posting_proposal_id: postingProposalId,
      accounting_snapshot_id: accountingSnapshot.id,
      entry_date: input.documentDate,
      status: "draft",
      posting_mode: input.derived.journalSuggestion.postingMode,
      currency_code: input.currencyCode ?? "UYU",
      fx_rate: input.derived.journalSuggestion.fxRate,
      fx_rate_date: input.derived.journalSuggestion.fxRateDate,
      fx_rate_source: input.derived.journalSuggestion.fxRateSource,
      fx_rate_bcu_value: input.derived.journalSuggestion.fxRateBcuValue,
      fx_rate_bcu_date_used: input.derived.journalSuggestion.fxRateBcuDateUsed,
      functional_currency_code: input.derived.journalSuggestion.functionalCurrencyCode,
      functional_currency: input.derived.journalSuggestion.functionalCurrencyCode,
      source_currency_present:
        (input.currencyCode ?? "UYU").toUpperCase()
        !== input.derived.journalSuggestion.functionalCurrencyCode.toUpperCase(),
      reference: input.reference,
      description,
      total_debit: input.derived.journalSuggestion.totalDebit,
      total_credit: input.derived.journalSuggestion.totalCredit,
      functional_total_debit: input.derived.journalSuggestion.functionalTotalDebit,
      functional_total_credit: input.derived.journalSuggestion.functionalTotalCredit,
      first_seen_at: now,
      last_seen_at: now,
      legacy_immutable: false,
      adjusts_journal_entry_id: asString(latestActiveEntry?.id),
      source_hash: sourceHash,
      economic_hash: economicHash,
      created_by: input.actorId,
      created_at: now,
      updated_at: now,
    },
  });

  const linePayload = journalLines
    .map((line) => ({
      line,
      account: resolveAccountByIdOrCode({
        accounts,
        accountId: line.accountId,
        accountCode: line.accountCode,
      }),
    }))
    .filter((entry) => entry.account !== null)
    .map((entry) => ({
      journal_entry_id: journalEntryDraftId,
      line_no: entry.line.lineNumber,
      account_id: entry.account?.id,
      debit: roundCurrency(entry.line.debit),
      credit: roundCurrency(entry.line.credit),
      description: entry.line.accountName,
      tax_tag: entry.line.taxTag,
      currency_code: entry.line.currencyCode,
      original_currency_code: entry.line.currencyCode,
      original_amount: roundCurrency(
        entry.line.debit > 0 ? entry.line.debit : entry.line.credit,
      ),
      debit_original: roundCurrency(entry.line.debit),
      credit_original: roundCurrency(entry.line.credit),
      fx_rate: entry.line.fxRate,
      fx_rate_applied: entry.line.fxRate,
      functional_debit: roundCurrency(entry.line.functionalDebit),
      functional_credit: roundCurrency(entry.line.functionalCredit),
      functional_amount_uyu: roundCurrency(
        entry.line.functionalDebit > 0
          ? entry.line.functionalDebit
          : entry.line.functionalCredit,
      ),
      functional_currency_code: input.derived.journalSuggestion.functionalCurrencyCode,
      role_code: entry.line.roleCode,
      line_purpose: entry.line.linePurpose,
      tax_component: entry.line.taxComponent,
      settlement_component: entry.line.settlementComponent,
      source_hash: computeKernelHash({
        journal_entry_id: journalEntryDraftId,
        line_no: entry.line.lineNumber,
        account_id: entry.account?.id,
        debit: roundCurrency(entry.line.debit),
        credit: roundCurrency(entry.line.credit),
      }),
      source_ref_json: {
        source_document_id: input.documentId,
        draft_id: input.draftId,
        provenance: entry.line.provenance,
      },
      metadata: {
        provenance: entry.line.provenance,
        role_code: entry.line.roleCode,
        line_purpose: entry.line.linePurpose,
        tax_component: entry.line.taxComponent,
        settlement_component: entry.line.settlementComponent,
        is_provisional: entry.line.isProvisional,
      },
    }));

  await insertJournalEntryLinesWithCompat(supabase, linePayload);
  const journalEntryId = await finalizeJournalEntryWithCompat(supabase, {
    journalEntryId: journalEntryDraftId,
    payload: {
      status: "posted",
      immutable_at: now,
      updated_at: now,
    },
  });
  await markPostingProposalMaterializedWithCompat(supabase, {
    proposalId: postingProposalId,
    journalEntryId,
  });

  return {
    suggestionId: suggestion.id as string,
    journalEntryId,
    sourceEventId,
    sourceEventFactsId,
    postingProposalId,
    accountingSnapshotId: accountingSnapshot.id,
    reversalJournalEntryId,
  } satisfies AccountingArtifactsPersistenceResult;
}

async function ensureConceptForApproval(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentRole: AccountingRuleRecord["document_role"];
    conceptId: string | null;
    conceptName: string | null;
    defaultAccountId: string;
    defaultVatProfileJson: Record<string, unknown>;
    defaultOperationCategory: string | null;
  },
) {
  if (input.conceptId) {
    return input.conceptId;
  }

  const canonicalName = input.conceptName?.trim();

  if (!canonicalName) {
    return null;
  }

  const code = slugifyConceptCode(canonicalName) ?? `concept_${Date.now()}`;
  const { data, error } = await supabase
    .from("organization_concepts")
    .insert({
      organization_id: input.organizationId,
      code,
      canonical_name: canonicalName,
      description: canonicalName,
      document_role: input.documentRole,
      default_account_id: input.defaultAccountId,
      default_vat_profile_json: input.defaultVatProfileJson,
      default_operation_category: input.defaultOperationCategory,
      metadata: {
        source: "learned_from_approval",
      },
    })
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo crear el concepto canónico.");
  }

  return data.id as string;
}

async function createConceptAliasesFromApproval(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    conceptId: string;
    vendorId: string | null;
    lines: AccountingArtifactsPersistenceInput["derived"]["conceptResolution"]["lines"];
    scope: ApprovalLearningInput["scope"];
  },
) {
  const rows = input.lines
    .filter((line) => line.normalizedDescription || line.normalizedCode)
    .map((line) => ({
      organization_id: input.organizationId,
      concept_id: input.conceptId,
      vendor_id:
        input.scope === "vendor_concept" || input.scope === "vendor_concept_operation_category"
          ? input.vendorId
          : null,
      alias_code_normalized: line.normalizedCode,
      alias_description_normalized:
        line.normalizedDescription
        ?? line.normalizedCode
        ?? `line_${line.lineNumber}`,
      match_scope:
        input.scope === "vendor_concept" || input.scope === "vendor_concept_operation_category"
          ? "vendor"
          : "organization",
      source: "learned_from_approval",
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("organization_concept_aliases")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createRuleFromApproval(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
    actorId: string | null;
    documentRole: AccountingRuleRecord["document_role"];
    learning: ApprovalLearningInput;
    vendorId: string | null;
    conceptId: string | null;
    conceptName: string | null;
    accountId: string | null;
    operationCategory: string | null;
    linkedOperationType: string | null;
    operationKind?: string | null;
    paymentTerms?: string | null;
    settlementMethod?: string | null;
    vatProfileJson: Record<string, unknown>;
    taxProfileCode?: string | null;
    templateCode?: string | null;
    status?: AccountingRuleRecord["status"] | null;
    conceptLines: AccountingArtifactsPersistenceInput["derived"]["conceptResolution"]["lines"];
    rationale: string | null;
  },
) {
  if (input.learning.scope === "none") {
    return null;
  }

  if (!input.accountId) {
    throw new Error("No se puede aprender una regla sin cuenta aprobada.");
  }

  let conceptId = input.conceptId;

  if (
    input.learning.scope === "concept_global"
    || input.learning.scope === "vendor_concept"
    || input.learning.scope === "vendor_concept_operation_category"
  ) {
    conceptId = await ensureConceptForApproval(supabase, {
      organizationId: input.organizationId,
      documentRole: input.documentRole,
      conceptId,
      conceptName: input.learning.learnedConceptName ?? input.conceptName,
      defaultAccountId: input.accountId,
      defaultVatProfileJson: input.vatProfileJson,
      defaultOperationCategory: input.operationCategory,
    });
  }

  if (input.learning.scope === "vendor_default") {
    if (!input.vendorId) {
      throw new Error("No existe proveedor resuelto para guardar default de proveedor.");
    }

    const { error: vendorError } = await supabase
      .from("vendors")
      .update({
        default_account_id: input.accountId,
        default_tax_profile: input.vatProfileJson,
        default_operation_category: input.operationCategory,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.vendorId);

    if (vendorError) {
      throw new Error(vendorError.message);
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("accounting_rules")
    .insert({
      organization_id: input.organizationId,
      scope: input.learning.scope,
      document_id: input.learning.scope === "document_override" ? input.documentId : null,
      source_document_id: input.documentId,
      vendor_id:
        input.learning.scope === "vendor_concept"
        || input.learning.scope === "vendor_concept_operation_category"
        || input.learning.scope === "vendor_default"
          ? input.vendorId
          : null,
      concept_id:
        input.learning.scope === "vendor_concept"
        || input.learning.scope === "vendor_concept_operation_category"
        || input.learning.scope === "concept_global"
          ? conceptId
          : null,
      document_role: input.documentRole,
      account_id: input.accountId,
      status: input.status ?? "approved",
      vat_profile_json: input.vatProfileJson,
      tax_profile_code: input.taxProfileCode ?? null,
      operation_category: input.operationCategory,
      linked_operation_type: input.linkedOperationType,
      template_code: input.templateCode ?? null,
      lifecycle_status: "active",
      times_reused: 0,
      times_corrected: 0,
      times_matched: 0,
      times_applied: 0,
      priority:
        input.learning.scope === "document_override"
          ? 1000
          : input.learning.scope === "vendor_concept_operation_category"
            ? 950
          : input.learning.scope === "vendor_concept"
            ? 900
            : input.learning.scope === "concept_global"
              ? 800
              : 700,
      source: "learned_from_approval",
      created_from: "learning_approval",
      created_by: input.actorId,
      approved_by: input.actorId,
      activated_at: now,
      metadata: {
        rationale: input.rationale,
        operation_kind: input.operationKind ?? null,
        payment_terms: input.paymentTerms ?? null,
        settlement_method: input.settlementMethod ?? null,
      },
    })
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo guardar la regla contable aprobada.");
  }

  if (
    conceptId
    && (
      input.learning.scope === "vendor_concept"
      || input.learning.scope === "vendor_concept_operation_category"
      || input.learning.scope === "concept_global"
    )
  ) {
    await createConceptAliasesFromApproval(supabase, {
      organizationId: input.organizationId,
      conceptId,
      vendorId: input.vendorId,
      lines: input.conceptLines,
      scope: input.learning.scope,
    });
  }

  await recordAuditEvent(supabase, {
      organizationId: input.organizationId,
      actorId: input.actorId,
      entityType: "accounting_rule",
      entityId: data.id as string,
      action: `learned_rule:${input.learning.scope}`,
    afterJson: {
      scope: input.learning.scope,
      vendor_id: input.vendorId,
      concept_id: conceptId,
      account_id: input.accountId,
      operation_category: input.operationCategory,
      operation_kind: input.operationKind ?? null,
      payment_terms: input.paymentTerms ?? null,
      settlement_method: input.settlementMethod ?? null,
    },
    metadata: {
      document_id: input.documentId,
    },
  });
  await recordAccountingRuleLifecycleEvent(supabase, {
    organizationId: input.organizationId,
    ruleId: data.id as string,
    actorId: input.actorId,
    eventType: "created",
    reason: input.rationale,
    payload: {
      created_from: "learning_approval",
      learning_scope: input.learning.scope,
      source_document_id: input.documentId,
    },
  });

  return data.id as string;
}

export async function resolveDocumentDuplicateStatus(
  supabase: SupabaseClient,
  input: ResolveDuplicateInput,
) {
  const { data: currentIdentity, error: identityError } = await supabase
    .from("document_invoice_identities")
    .select(
      "id, duplicate_status, duplicate_of_document_id, duplicate_reason, resolution_notes",
    )
    .eq("document_id", input.documentId)
    .eq("organization_id", input.organizationId)
    .limit(1)
    .maybeSingle();

  if (identityError || !currentIdentity?.id) {
    throw new Error(identityError?.message ?? "No existe identidad de factura para este documento.");
  }

  const resolvedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("document_invoice_identities")
    .update({
      duplicate_status: input.action,
      resolution_notes: input.note,
      resolved_by: input.actorId,
      resolved_at: resolvedAt,
      updated_at: resolvedAt,
    })
    .eq("id", currentIdentity.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await recordAuditEvent(supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    entityType: "document_invoice_identity",
    entityId: currentIdentity.id,
    action: `duplicate_resolution:${input.action}`,
    beforeJson: currentIdentity,
    afterJson: {
      ...currentIdentity,
      duplicate_status: input.action,
      resolution_notes: input.note,
      resolved_by: input.actorId,
      resolved_at: resolvedAt,
    },
    metadata: {
      document_id: input.documentId,
    },
  });

  return {
    ok: true,
    duplicateStatus: input.action,
    message:
      input.action === "confirmed_duplicate"
        ? "Documento marcado como duplicado confirmado."
        : input.action === "false_positive"
          ? "Documento marcado como falso positivo."
          : "Documento habilitado para continuar con justificacion.",
  } satisfies DuplicateResolutionResult;
}
