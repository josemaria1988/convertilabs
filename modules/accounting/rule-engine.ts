import type {
  AccountingDraftStepSnapshot,
  AccountingContextReasonCode,
  AccountingContextResolution,
  AccountingRuleRecord,
  AccountingSuggestionContext,
  DerivedDraftArtifacts,
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentIntakeLineItem,
  DocumentAccountingContextRecord,
  PostableAccountRecord,
  ResolvedAccountingRule,
} from "@/modules/accounting/types";
import { asRecord, asString } from "@/modules/accounting/normalization";

function parseStoredStructuredContext(record: DocumentAccountingContextRecord | null) {
  const structured = asRecord(record?.structured_context_json);

  return {
    manualOverrideAccountId: asString(structured.manual_override_account_id),
    manualOverrideConceptId: asString(structured.manual_override_concept_id),
    manualOverrideOperationCategory: asString(structured.manual_override_operation_category),
    learnedConceptName: asString(structured.learned_concept_name),
  };
}

export function resolveAccountingContext(input: {
  documentRole: AccountingSuggestionContext["documentRole"];
  vendorResolution: AccountingSuggestionContext["vendorResolution"];
  conceptResolution: AccountingSuggestionContext["conceptResolution"];
  operationCategory: string | null;
  storedContext: DocumentAccountingContextRecord | null;
}) {
  const stored = parseStoredStructuredContext(input.storedContext);
  const reasonCodes: AccountingContextReasonCode[] = [];

  if (input.vendorResolution.status === "ambiguous") {
    reasonCodes.push("ambiguous_vendor");
  }

  if (input.conceptResolution.needsUserContext) {
    reasonCodes.push("unmatched_concept");
    reasonCodes.push("new_concept_without_rule");
  }

  if (
    input.documentRole === "purchase"
    && (
      input.operationCategory === "transport"
      || input.operationCategory === "exempt_or_export"
      || input.operationCategory === "non_taxed"
    )
  ) {
    reasonCodes.push("vat_operation_dependency");
  }

  if (input.conceptResolution.unresolvedLineCount > 1) {
    reasonCodes.push("multiple_candidate_accounts");
  }

  const uniqueReasonCodes = reasonCodes.filter(
    (reason, index, array) => array.indexOf(reason) === index,
  );
  const hasManualOverride = Boolean(
    stored.manualOverrideAccountId || stored.manualOverrideOperationCategory,
  );
  const userFreeText = input.storedContext?.user_free_text ?? null;
  const hasAssistantPayload = Object.keys(asRecord(input.storedContext?.ai_response_json)).length > 0;
  const status =
    hasManualOverride
      ? "manual_override"
      : uniqueReasonCodes.length === 0
        ? "not_required"
        : hasAssistantPayload
          ? "assistant_completed"
          : userFreeText
            ? "provided"
            : "required";

  return {
    status,
    reasonCodes: uniqueReasonCodes,
    userFreeText,
    structuredContext: {
      manual_override_account_id: stored.manualOverrideAccountId,
      manual_override_concept_id: stored.manualOverrideConceptId,
      manual_override_operation_category: stored.manualOverrideOperationCategory,
      learned_concept_name: stored.learnedConceptName,
    },
    aiRequestPayload: asRecord(input.storedContext?.ai_request_payload_json),
    aiResponse: asRecord(input.storedContext?.ai_response_json),
    providerCode: input.storedContext?.provider_code ?? null,
    modelCode: input.storedContext?.model_code ?? null,
    promptHash: input.storedContext?.prompt_hash ?? null,
    requestLatencyMs: input.storedContext?.request_latency_ms ?? null,
    manualOverrideAccountId: stored.manualOverrideAccountId,
    manualOverrideConceptId: stored.manualOverrideConceptId,
    manualOverrideOperationCategory: stored.manualOverrideOperationCategory,
    learnedConceptName: stored.learnedConceptName,
    shouldBlockConfirmation: uniqueReasonCodes.length > 0 && !hasManualOverride && !userFreeText,
    canRunAssistant: uniqueReasonCodes.length > 0 && Boolean(userFreeText),
    blockingReasons:
      uniqueReasonCodes.length > 0 && !hasManualOverride && !userFreeText
        ? ["Falta contexto contable para clasificar el documento con suficiente confianza."]
        : [],
  } satisfies AccountingContextResolution;
}

function findAccount(accounts: PostableAccountRecord[], accountId: string | null | undefined) {
  if (!accountId) {
    return null;
  }

  return accounts.find((account) => account.id === accountId) ?? null;
}

function resolveCandidateConceptIds(input: {
  conceptResolution: AccountingSuggestionContext["conceptResolution"];
  accountingContext: AccountingSuggestionContext["accountingContext"];
  assistantSuggestion: AccountingSuggestionContext["assistantSuggestion"];
}) {
  const candidateIds = [
    input.accountingContext.manualOverrideConceptId,
    ...input.conceptResolution.matchedConceptIds,
    input.assistantSuggestion.output?.suggestedConceptId ?? null,
  ].filter((value): value is string => Boolean(value));

  return candidateIds.filter((value, index, array) => array.indexOf(value) === index);
}

function buildResolvedRule(input: {
  rule: AccountingRuleRecord | null;
  accounts: PostableAccountRecord[];
  scope: ResolvedAccountingRule["scope"];
  provenance: string;
  fallbackOperationCategory: string | null;
}) {
  if (!input.rule) {
    return null;
  }

  const account = findAccount(input.accounts, input.rule.account_id);

  return {
    ruleId: input.rule.id,
    scope: input.scope,
    accountId: account?.id ?? input.rule.account_id,
    accountCode: account?.code ?? null,
    accountName: account?.name ?? null,
    vatProfileJson: input.rule.vat_profile_json,
    operationCategory: input.rule.operation_category ?? input.fallbackOperationCategory,
    linkedOperationType: input.rule.linked_operation_type,
    provenance: input.provenance,
    priority: input.rule.priority,
    source: input.rule.source,
    createdAt: input.rule.created_at ?? null,
  } satisfies ResolvedAccountingRule;
}

export function resolveAccountingRuleSelection(input: AccountingSuggestionContext) {
  const documentOverrideRule = input.activeRules.find(
    (rule) =>
      rule.scope === "document_override"
      && rule.document_id === input.documentId
      && rule.document_role === input.documentRole,
  );

  if (input.accountingContext.manualOverrideAccountId) {
    const account = findAccount(input.accounts, input.accountingContext.manualOverrideAccountId);

    return {
      ruleId: null,
      scope: "document_override",
      accountId: account?.id ?? input.accountingContext.manualOverrideAccountId,
      accountCode: account?.code ?? null,
      accountName: account?.name ?? null,
      vatProfileJson: null,
      operationCategory:
        input.accountingContext.manualOverrideOperationCategory ?? input.operationCategory,
      linkedOperationType: null,
      provenance: "manual_override",
      priority: 1000,
      source: "manual",
      createdAt: null,
    } satisfies ResolvedAccountingRule;
  }

  if (documentOverrideRule) {
    return buildResolvedRule({
      rule: documentOverrideRule,
      accounts: input.accounts,
      scope: "document_override",
      provenance: "accounting_rule:document_override",
      fallbackOperationCategory: input.operationCategory,
    })!;
  }

  const candidateConceptIds = resolveCandidateConceptIds({
    conceptResolution: input.conceptResolution,
    accountingContext: input.accountingContext,
    assistantSuggestion: input.assistantSuggestion,
  });
  const vendorConceptRule = input.activeRules.find(
    (rule) =>
      rule.scope === "vendor_concept"
      && rule.vendor_id === input.vendorResolution.vendorId
      && rule.concept_id !== null
      && candidateConceptIds.includes(rule.concept_id)
      && rule.document_role === input.documentRole,
  );

  if (vendorConceptRule) {
    return buildResolvedRule({
      rule: vendorConceptRule,
      accounts: input.accounts,
      scope: "vendor_concept",
      provenance: "accounting_rule:vendor_concept",
      fallbackOperationCategory: input.operationCategory,
    })!;
  }

  const conceptGlobalRule = input.activeRules.find(
    (rule) =>
      rule.scope === "concept_global"
      && rule.concept_id !== null
      && candidateConceptIds.includes(rule.concept_id)
      && rule.document_role === input.documentRole,
  );

  if (conceptGlobalRule) {
    return buildResolvedRule({
      rule: conceptGlobalRule,
      accounts: input.accounts,
      scope: "concept_global",
      provenance: "accounting_rule:concept_global",
      fallbackOperationCategory: input.operationCategory,
    })!;
  }

  const vendorDefaultRule = input.activeRules.find(
    (rule) =>
      rule.scope === "vendor_default"
      && rule.vendor_id === input.vendorResolution.vendorId
      && rule.document_role === input.documentRole,
  );

  if (vendorDefaultRule) {
    return buildResolvedRule({
      rule: vendorDefaultRule,
      accounts: input.accounts,
      scope: "vendor_default",
      provenance: "accounting_rule:vendor_default",
      fallbackOperationCategory:
        input.vendorResolution.defaultOperationCategory ?? input.operationCategory,
    })!;
  }

  if (input.vendorResolution.defaultAccountId) {
    const account = findAccount(input.accounts, input.vendorResolution.defaultAccountId);

    return {
      ruleId: null,
      scope: "vendor_default",
      accountId: account?.id ?? input.vendorResolution.defaultAccountId,
      accountCode: account?.code ?? null,
      accountName: account?.name ?? null,
      vatProfileJson: input.vendorResolution.defaultTaxProfile,
      operationCategory:
        input.vendorResolution.defaultOperationCategory ?? input.operationCategory,
      linkedOperationType: null,
      provenance: "vendor_default_fields",
      priority: 650,
      source: "vendor_default",
      createdAt: null,
    } satisfies ResolvedAccountingRule;
  }

  if (input.assistantSuggestion.output?.suggestedAccountId) {
    const account = findAccount(
      input.accounts,
      input.assistantSuggestion.output.suggestedAccountId,
    );

    return {
      ruleId: null,
      scope: "assistant",
      accountId: account?.id ?? input.assistantSuggestion.output.suggestedAccountId,
      accountCode: account?.code ?? null,
      accountName: account?.name ?? null,
      vatProfileJson: null,
      operationCategory:
        input.assistantSuggestion.output.suggestedOperationCategory
        ?? input.operationCategory,
      linkedOperationType: input.assistantSuggestion.output.linkedOperationType,
      provenance: "assistant_second_pass",
      priority: 500,
      source: "assistant",
      createdAt: null,
    } satisfies ResolvedAccountingRule;
  }

  return {
    ruleId: null,
    scope: "manual_review",
    accountId: null,
    accountCode: null,
    accountName: null,
    vatProfileJson: null,
    operationCategory: input.operationCategory,
    linkedOperationType: null,
    provenance: "manual_review_required",
    priority: null,
    source: null,
    createdAt: null,
  } satisfies ResolvedAccountingRule;
}

function joinBlockers(values: string[]) {
  return values.length > 0 ? values.join(" ") : null;
}

export function buildDraftStepSnapshots(input: {
  documentRole: "purchase" | "sale" | "other";
  documentType: string | null;
  operationCategory: string | null;
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  lineItems: DocumentIntakeLineItem[];
  derived: DerivedDraftArtifacts;
  savedAt?: string;
}) {
  const savedAt = input.savedAt ?? new Date().toISOString();
  const accountingContextStatus =
    input.derived.accountingContext.status === "not_required"
      ? "draft_saved"
      : input.derived.accountingContext.shouldBlockConfirmation
        ? "blocked"
        : "draft_saved";
  const accountingContextReason =
    input.derived.accountingContext.status === "not_required"
      ? null
      : joinBlockers(input.derived.accountingContext.blockingReasons);

  const snapshots: AccountingDraftStepSnapshot[] = [
    {
      step_code: "identity",
      status: "draft_saved",
      last_saved_at: savedAt,
      stale_reason: null,
      snapshot_json: {
        document_role: input.documentRole,
        document_type: input.documentType,
        invoice_identity: input.derived.invoiceIdentity,
        vendor_resolution: input.derived.vendorResolution,
      },
    },
    {
      step_code: "fields",
      status: "draft_saved",
      last_saved_at: savedAt,
      stale_reason: null,
      snapshot_json: {
        facts: input.facts,
      },
    },
    {
      step_code: "amounts",
      status: "draft_saved",
      last_saved_at: savedAt,
      stale_reason: null,
      snapshot_json: {
        amount_breakdown: input.amountBreakdown,
        line_items: input.lineItems,
        concept_resolution: input.derived.conceptResolution,
      },
    },
    {
      step_code: "operation_context",
      status: "draft_saved",
      last_saved_at: savedAt,
      stale_reason: null,
      snapshot_json: {
        operation_category_candidate: input.operationCategory,
      },
    },
    {
      step_code: "accounting_context",
      status: accountingContextStatus,
      last_saved_at: savedAt,
      stale_reason: accountingContextReason,
      snapshot_json: input.derived.accountingContext,
    },
    {
      step_code: "journal",
      status: input.derived.journalSuggestion.ready ? "draft_saved" : "blocked",
      last_saved_at: savedAt,
      stale_reason: joinBlockers(input.derived.journalSuggestion.blockingReasons),
      snapshot_json: input.derived.journalSuggestion,
    },
    {
      step_code: "tax",
      status: input.derived.taxTreatment.ready ? "draft_saved" : "blocked",
      last_saved_at: savedAt,
      stale_reason: joinBlockers(input.derived.taxTreatment.blockingReasons),
      snapshot_json: input.derived.taxTreatment,
    },
    {
      step_code: "confirmation",
      status: input.derived.validation.canConfirm ? "draft_saved" : "blocked",
      last_saved_at: savedAt,
      stale_reason: joinBlockers(input.derived.validation.blockers),
      snapshot_json: {
        can_confirm: input.derived.validation.canConfirm,
        blockers: input.derived.validation.blockers,
      },
    },
  ];

  return snapshots;
}
