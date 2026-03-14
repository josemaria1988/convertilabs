import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeTaxId,
  normalizeTextToken,
  roundCurrency,
  slugifyConceptCode,
} from "@/modules/accounting/normalization";
import type {
  AccountingArtifactsPersistenceInput,
  AccountingArtifactsPersistenceResult,
  AccountingContextResolution,
  AccountingRuleRecord,
  AccountingRuntimeContext,
  AccountingVendorRecord,
  ApprovalLearningInput,
  DocumentAccountingContextRecord,
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
  metadata: Record<string, unknown> | null;
};

type AccountingRuleRow = {
  id: string;
  organization_id: string;
  scope: AccountingRuleRecord["scope"];
  document_id: string | null;
  vendor_id: string | null;
  concept_id: string | null;
  document_role: AccountingRuleRecord["document_role"];
  account_id: string;
  vat_profile_json: Record<string, unknown> | null;
  operation_category: string | null;
  linked_operation_type: string | null;
  priority: number;
  source: string;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function asArray<T>(value: T[] | null | undefined) {
  return value ?? [];
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
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id, organization_id, code, name, account_type, normal_side, is_postable, metadata")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("is_postable", true)
    .order("code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as PostableAccountRecord[] | null);
}

export async function loadActiveAccountingRules(
  supabase: SupabaseClient,
  organizationId: string,
  documentRole?: AccountingRuleRecord["document_role"] | null,
) {
  let query = supabase
    .from("accounting_rules")
    .select(
      "id, organization_id, scope, document_id, vendor_id, concept_id, document_role, account_id, vat_profile_json, operation_category, linked_operation_type, priority, source, is_active, metadata, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (documentRole) {
    query = query.eq("document_role", documentRole);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as AccountingRuleRow[] | null);
}

export async function loadAccountingRuntimeContext(
  supabase: SupabaseClient,
  organizationId: string,
  documentRole?: AccountingRuleRecord["document_role"] | null,
) {
  const [vendors, concepts, conceptAliases, accounts, activeRules] = await Promise.all([
    loadOrganizationVendors(supabase, organizationId),
    loadOrganizationConcepts(supabase, organizationId, documentRole),
    loadOrganizationConceptAliases(supabase, organizationId),
    loadOrganizationPostableAccounts(supabase, organizationId),
    loadActiveAccountingRules(supabase, organizationId, documentRole),
  ]);

  return {
    vendors,
    concepts,
    conceptAliases,
    accounts,
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
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id, organization_id, code, name, account_type, normal_side, is_postable, metadata")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  return asArray(data as ChartAccountRow[] | null);
}

export async function persistApprovedAccountingArtifacts(
  supabase: SupabaseClient,
  input: AccountingArtifactsPersistenceInput,
) {
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
        approved_at: new Date().toISOString(),
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
  const description = missingCodes.length > 0
    ? `${input.derived.journalSuggestion.explanation} Lineas pendientes por falta de plan de cuentas: ${missingCodes.join(", ")}.`
    : input.derived.journalSuggestion.explanation;
  const { data: journalEntry, error: journalEntryError } = await supabase
    .from("journal_entries")
    .insert({
      organization_id: input.organizationId,
      source_document_id: input.documentId,
      source_suggestion_id: suggestion.id,
      entry_date: input.documentDate,
      status: "draft",
      currency_code: input.currencyCode ?? "UYU",
      fx_rate: input.derived.journalSuggestion.fxRate,
      fx_rate_date: input.derived.journalSuggestion.fxRateDate,
      fx_rate_source: input.derived.journalSuggestion.fxRateSource,
      functional_currency_code: input.derived.journalSuggestion.functionalCurrencyCode,
      reference: input.reference,
      description,
      total_debit: input.derived.journalSuggestion.totalDebit,
      total_credit: input.derived.journalSuggestion.totalCredit,
      functional_total_debit: input.derived.journalSuggestion.functionalTotalDebit,
      functional_total_credit: input.derived.journalSuggestion.functionalTotalCredit,
      created_by: input.actorId,
    })
    .select("id")
    .limit(1)
    .single();

  if (journalEntryError || !journalEntry?.id) {
    throw new Error(journalEntryError?.message ?? "No se pudo crear el journal entry draft.");
  }

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
      journal_entry_id: journalEntry.id,
      line_no: entry.line.lineNumber,
      account_id: entry.account?.id,
      debit: roundCurrency(entry.line.debit),
      credit: roundCurrency(entry.line.credit),
      description: entry.line.accountName,
      tax_tag: entry.line.taxTag,
      currency_code: entry.line.currencyCode,
      fx_rate: entry.line.fxRate,
      functional_debit: roundCurrency(entry.line.functionalDebit),
      functional_credit: roundCurrency(entry.line.functionalCredit),
      metadata: {
        provenance: entry.line.provenance,
      },
    }));

  if (linePayload.length > 0) {
    const { error: lineError } = await supabase
      .from("journal_entry_lines")
      .insert(linePayload);

    if (lineError) {
      throw new Error(lineError.message);
    }
  }

  return {
    suggestionId: suggestion.id as string,
    journalEntryId: journalEntry.id as string,
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
      vendor_id: input.scope === "vendor_concept" ? input.vendorId : null,
      alias_code_normalized: line.normalizedCode,
      alias_description_normalized:
        line.normalizedDescription
        ?? line.normalizedCode
        ?? `line_${line.lineNumber}`,
      match_scope: input.scope === "vendor_concept" ? "vendor" : "organization",
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
    vatProfileJson: Record<string, unknown>;
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

  if (input.learning.scope === "concept_global" || input.learning.scope === "vendor_concept") {
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

  const { data, error } = await supabase
    .from("accounting_rules")
    .insert({
      organization_id: input.organizationId,
      scope: input.learning.scope,
      document_id: input.learning.scope === "document_override" ? input.documentId : null,
      vendor_id:
        input.learning.scope === "vendor_concept" || input.learning.scope === "vendor_default"
          ? input.vendorId
          : null,
      concept_id:
        input.learning.scope === "vendor_concept" || input.learning.scope === "concept_global"
          ? conceptId
          : null,
      document_role: input.documentRole,
      account_id: input.accountId,
      vat_profile_json: input.vatProfileJson,
      operation_category: input.operationCategory,
      linked_operation_type: input.linkedOperationType,
      priority:
        input.learning.scope === "document_override"
          ? 1000
          : input.learning.scope === "vendor_concept"
            ? 900
            : input.learning.scope === "concept_global"
              ? 800
              : 700,
      source: "learned_from_approval",
      created_by: input.actorId,
      approved_by: input.actorId,
      metadata: {
        rationale: input.rationale,
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
    && (input.learning.scope === "vendor_concept" || input.learning.scope === "concept_global")
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
    },
    metadata: {
      document_id: input.documentId,
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
