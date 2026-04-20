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
  ManualAccountRoleOverrides,
  PostableAccountRecord,
  ResolvedAccountingRule,
} from "@/modules/accounting/types";
import { asNumber, asRecord, asString } from "@/modules/accounting/normalization";
import { isAccountRoleCode } from "@/modules/accounting/account-roles";
import { MISSING_FX_RATE_ERROR_CODE } from "@/modules/accounting/fx-policy";

function parseStoredSettlementAllocations(value: unknown) {
  const entries = Array.isArray(value) ? value : [];

  return entries
    .map((entry) => {
      const record = asRecord(entry);
      const method = asString(record.method);
      const amount = asNumber(record.amount);

      if (
        (
          method === "cash"
          || method === "bank_transfer"
          || method === "card"
          || method === "check"
        )
        && typeof amount === "number"
        && Number.isFinite(amount)
        && amount > 0
      ) {
        return {
          method,
          amount,
        };
      }

      return null;
    })
    .filter((entry): entry is { method: "cash" | "bank_transfer" | "card" | "check"; amount: number } => Boolean(entry));
}

function parseStoredManualRoleOverrides(value: unknown) {
  const structured = asRecord(value);

  return Object.entries(structured).reduce((overrides, [roleCode, accountId]) => {
    if (!isAccountRoleCode(roleCode)) {
      return overrides;
    }

    overrides[roleCode] = asString(accountId) ?? null;
    return overrides;
  }, {} as ManualAccountRoleOverrides);
}

function parseStoredStructuredContext(record: DocumentAccountingContextRecord | null) {
  const structured = asRecord(record?.structured_context_json);

  return {
    businessPurposeNote: asString(structured.business_purpose_note),
    manualOverrideAccountId: asString(structured.manual_override_account_id),
    manualRoleOverrides: parseStoredManualRoleOverrides(structured.manual_role_overrides),
    manualOverrideConceptId: asString(structured.manual_override_concept_id),
    manualOverrideOperationCategory: asString(structured.manual_override_operation_category),
    learnedConceptName: asString(structured.learned_concept_name),
    operationKind: asString(structured.operation_kind),
    paymentTerms: asString(structured.payment_terms),
    settlementMethod: asString(structured.settlement_method),
    settlementEvidenceSource: asString(structured.settlement_evidence_source),
    settlementAllocations: parseStoredSettlementAllocations(structured.settlement_allocations),
    fxRate: asNumber(structured.document_fx_rate),
    fxRateSource: asString(structured.document_fx_rate_source),
    fxRateDate: asString(structured.document_fx_rate_date),
    fxMissingErrorCode: asString(structured.document_fx_missing_error_code),
    fxBlockingReason: asString(structured.document_fx_blocking_reason),
  };
}

function matchesRuleSettlementMetadata(input: {
  rule: AccountingRuleRecord;
  accountingContext: AccountingSuggestionContext["accountingContext"];
}) {
  const metadata = asRecord(input.rule.metadata);
  const operationKind = asString(metadata.operation_kind);
  const paymentTerms = asString(metadata.payment_terms);
  const settlementMethod = asString(metadata.settlement_method);

  if (operationKind && operationKind !== input.accountingContext.operationKind) {
    return false;
  }

  if (paymentTerms && paymentTerms !== input.accountingContext.paymentTerms) {
    return false;
  }

  if (
    settlementMethod
    && settlementMethod !== input.accountingContext.settlementMethod
    && settlementMethod !== "unknown"
  ) {
    return false;
  }

  return true;
}

export function hasTrustedAccountingRuleCoverage(input: {
  documentId: string;
  documentRole: AccountingSuggestionContext["documentRole"];
  vendorResolution: AccountingSuggestionContext["vendorResolution"];
  conceptResolution: AccountingSuggestionContext["conceptResolution"];
  activeRules: AccountingSuggestionContext["activeRules"];
  operationCategory: string | null;
  accountingContext: AccountingSuggestionContext["accountingContext"];
}) {
  const candidateConceptIds = input.conceptResolution.matchedConceptIds;

  if (input.activeRules.some(
    (rule) =>
      rule.scope === "document_override"
      && rule.document_id === input.documentId
      && rule.document_role === input.documentRole
      && matchesRuleSettlementMetadata({
        rule,
        accountingContext: input.accountingContext,
      }),
  )) {
    return true;
  }

  if (
    input.vendorResolution.vendorId
    && input.operationCategory
    && input.activeRules.some(
      (rule) =>
        rule.scope === "vendor_concept_operation_category"
        && rule.vendor_id === input.vendorResolution.vendorId
        && rule.concept_id !== null
        && candidateConceptIds.includes(rule.concept_id)
        && rule.operation_category === input.operationCategory
        && rule.document_role === input.documentRole
        && matchesRuleSettlementMetadata({
          rule,
          accountingContext: input.accountingContext,
        }),
    )
  ) {
    return true;
  }

  if (
    input.vendorResolution.vendorId
    && input.activeRules.some(
      (rule) =>
        rule.scope === "vendor_concept"
        && rule.vendor_id === input.vendorResolution.vendorId
        && rule.concept_id !== null
        && candidateConceptIds.includes(rule.concept_id)
        && rule.document_role === input.documentRole
        && matchesRuleSettlementMetadata({
          rule,
          accountingContext: input.accountingContext,
        }),
    )
  ) {
    return true;
  }

  if (input.activeRules.some(
      (rule) =>
        rule.scope === "concept_global"
        && rule.concept_id !== null
        && candidateConceptIds.includes(rule.concept_id)
        && rule.document_role === input.documentRole
        && matchesRuleSettlementMetadata({
          rule,
          accountingContext: input.accountingContext,
        }),
  )) {
    return true;
  }

  if (
    input.vendorResolution.vendorId
    && input.activeRules.some(
      (rule) =>
        rule.scope === "vendor_default"
        && rule.vendor_id === input.vendorResolution.vendorId
        && rule.document_role === input.documentRole
        && matchesRuleSettlementMetadata({
          rule,
          accountingContext: input.accountingContext,
        }),
    )
  ) {
    return true;
  }

  return Boolean(input.vendorResolution.defaultAccountId);
}

export function resolveAccountingContext(input: {
  documentId: string;
  documentRole: AccountingSuggestionContext["documentRole"];
  vendorResolution: AccountingSuggestionContext["vendorResolution"];
  conceptResolution: AccountingSuggestionContext["conceptResolution"];
  activeRules: AccountingSuggestionContext["activeRules"];
  operationCategory: string | null;
  storedContext: DocumentAccountingContextRecord | null;
  locationSignal?: {
    code: string;
    requiresBusinessPurposeReview: boolean;
  } | null;
}) {
  const stored = parseStoredStructuredContext(input.storedContext);
  const primaryRoleFromDocumentRole =
    input.documentRole === "sale"
      ? "revenue_account"
      : input.documentRole === "purchase"
        ? "expense_account"
        : null;
  const manualRoleOverrides: ManualAccountRoleOverrides = {
    ...stored.manualRoleOverrides,
  };

  if (
    primaryRoleFromDocumentRole
    && stored.manualOverrideAccountId
    && !manualRoleOverrides[primaryRoleFromDocumentRole]
  ) {
    manualRoleOverrides[primaryRoleFromDocumentRole] = stored.manualOverrideAccountId;
  }
  const reasonCodes: AccountingContextReasonCode[] = [];
  const hasTrustedRuleCoverage = hasTrustedAccountingRuleCoverage({
    documentId: input.documentId,
    documentRole: input.documentRole,
    vendorResolution: input.vendorResolution,
    conceptResolution: input.conceptResolution,
    activeRules: input.activeRules,
    operationCategory: input.operationCategory,
    accountingContext: {
      status: "not_required",
      reasonCodes: [],
      userFreeText: input.storedContext?.user_free_text ?? null,
      businessPurposeNote: stored.businessPurposeNote ?? null,
      structuredContext: {},
      aiRequestPayload: {},
      aiResponse: {},
      providerCode: null,
      modelCode: null,
      promptHash: null,
      requestLatencyMs: null,
      manualOverrideAccountId: stored.manualOverrideAccountId,
      manualRoleOverrides,
      manualOverrideConceptId: stored.manualOverrideConceptId,
      manualOverrideOperationCategory: stored.manualOverrideOperationCategory,
      learnedConceptName: stored.learnedConceptName,
      operationKind:
        (
          stored.operationKind === "sale_invoice"
          || stored.operationKind === "purchase_invoice"
          || stored.operationKind === "customer_receipt"
          || stored.operationKind === "supplier_payment"
          || stored.operationKind === "sale_credit_note"
          || stored.operationKind === "purchase_credit_note"
          || stored.operationKind === "card_settlement"
          || stored.operationKind === "bank_transfer_settlement"
          || stored.operationKind === "manual_settlement_adjustment"
        )
          ? stored.operationKind
          : null,
      paymentTerms:
        stored.paymentTerms === "cash" || stored.paymentTerms === "credit"
          ? stored.paymentTerms
          : "unknown",
      settlementMethod:
        stored.settlementMethod === "cash"
        || stored.settlementMethod === "bank_transfer"
        || stored.settlementMethod === "card"
        || stored.settlementMethod === "check"
        || stored.settlementMethod === "paid_by_partner"
        || stored.settlementMethod === "mixed"
          ? stored.settlementMethod
          : "unknown",
      settlementEvidenceSource:
        stored.settlementEvidenceSource === "invoice_document"
        || stored.settlementEvidenceSource === "receipt_document"
        || stored.settlementEvidenceSource === "bank_statement"
        || stored.settlementEvidenceSource === "card_settlement_document"
        || stored.settlementEvidenceSource === "user_input"
        || stored.settlementEvidenceSource === "imported_erp"
          ? stored.settlementEvidenceSource
          : "none",
      settlementAllocations: stored.settlementAllocations,
      shouldBlockConfirmation: false,
      canRunAssistant: false,
      blockingReasons: [],
    },
  });

  if (input.vendorResolution.status === "ambiguous") {
    reasonCodes.push("ambiguous_vendor");
  }

  if (input.conceptResolution.needsUserContext && !hasTrustedRuleCoverage) {
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

  if (input.conceptResolution.unresolvedLineCount > 1 && !hasTrustedRuleCoverage) {
    reasonCodes.push("multiple_candidate_accounts");
  }

  if (stored.fxMissingErrorCode === MISSING_FX_RATE_ERROR_CODE) {
    reasonCodes.push("missing_fx_rate");
  }

  if (input.locationSignal?.requiresBusinessPurposeReview) {
    if (input.locationSignal.code === "travel_pattern") {
      reasonCodes.push("travel_pattern");
    } else if (input.locationSignal.code === "sensitive_merchant_far_from_base") {
      reasonCodes.push("sensitive_merchant_far_from_base");
    } else {
      reasonCodes.push("location_outlier");
    }
  }

  const uniqueReasonCodes = reasonCodes.filter(
    (reason, index, array) => array.indexOf(reason) === index,
  );
  const hasManualOverride = Boolean(
    stored.manualOverrideAccountId
    || stored.manualOverrideOperationCategory
    || Object.values(manualRoleOverrides).some((value) => typeof value === "string" && value.trim()),
  );
  const userFreeText = input.storedContext?.user_free_text ?? null;
  const businessPurposeNote = stored.businessPurposeNote ?? null;
  const hasAssistantPayload = Object.keys(asRecord(input.storedContext?.ai_response_json)).length > 0;
  const status =
    hasManualOverride
      ? "manual_override"
      : uniqueReasonCodes.length === 0
        ? "not_required"
        : hasAssistantPayload
          ? "assistant_completed"
          : userFreeText || businessPurposeNote
            ? "provided"
            : "required";
  const blockingReasons =
    uniqueReasonCodes.length > 0 && !hasManualOverride && !userFreeText && !businessPurposeNote
      ? [stored.fxBlockingReason ?? "Falta contexto contable para clasificar el documento con suficiente confianza."]
      : [];

  return {
    status,
    reasonCodes: uniqueReasonCodes,
    userFreeText,
    businessPurposeNote,
    structuredContext: {
      business_purpose_note: businessPurposeNote,
      manual_override_account_id: stored.manualOverrideAccountId,
      manual_role_overrides: manualRoleOverrides,
      manual_override_concept_id: stored.manualOverrideConceptId,
      manual_override_operation_category: stored.manualOverrideOperationCategory,
      learned_concept_name: stored.learnedConceptName,
      operation_kind: stored.operationKind,
      payment_terms: stored.paymentTerms,
      settlement_method: stored.settlementMethod,
      settlement_evidence_source: stored.settlementEvidenceSource,
      settlement_allocations: stored.settlementAllocations,
      document_fx_rate: stored.fxRate,
      document_fx_rate_source: stored.fxRateSource,
      document_fx_rate_date: stored.fxRateDate,
      document_fx_missing_error_code: stored.fxMissingErrorCode,
      document_fx_blocking_reason: stored.fxBlockingReason,
    },
    aiRequestPayload: asRecord(input.storedContext?.ai_request_payload_json),
    aiResponse: asRecord(input.storedContext?.ai_response_json),
    providerCode: input.storedContext?.provider_code ?? null,
    modelCode: input.storedContext?.model_code ?? null,
    promptHash: input.storedContext?.prompt_hash ?? null,
    requestLatencyMs: input.storedContext?.request_latency_ms ?? null,
    manualOverrideAccountId: stored.manualOverrideAccountId,
    manualRoleOverrides,
    manualOverrideConceptId: stored.manualOverrideConceptId,
    manualOverrideOperationCategory: stored.manualOverrideOperationCategory,
    learnedConceptName: stored.learnedConceptName,
    operationKind:
      (
        stored.operationKind === "sale_invoice"
        || stored.operationKind === "purchase_invoice"
        || stored.operationKind === "customer_receipt"
        || stored.operationKind === "supplier_payment"
        || stored.operationKind === "sale_credit_note"
        || stored.operationKind === "purchase_credit_note"
        || stored.operationKind === "card_settlement"
        || stored.operationKind === "bank_transfer_settlement"
        || stored.operationKind === "manual_settlement_adjustment"
      )
        ? stored.operationKind
        : null,
    paymentTerms:
      stored.paymentTerms === "cash" || stored.paymentTerms === "credit"
        ? stored.paymentTerms
        : "unknown",
    settlementMethod:
      stored.settlementMethod === "cash"
      || stored.settlementMethod === "bank_transfer"
      || stored.settlementMethod === "card"
      || stored.settlementMethod === "check"
      || stored.settlementMethod === "paid_by_partner"
      || stored.settlementMethod === "mixed"
        ? stored.settlementMethod
        : "unknown",
    settlementEvidenceSource:
      stored.settlementEvidenceSource === "invoice_document"
      || stored.settlementEvidenceSource === "receipt_document"
      || stored.settlementEvidenceSource === "bank_statement"
      || stored.settlementEvidenceSource === "card_settlement_document"
      || stored.settlementEvidenceSource === "user_input"
      || stored.settlementEvidenceSource === "imported_erp"
        ? stored.settlementEvidenceSource
        : "none",
    settlementAllocations: stored.settlementAllocations,
    shouldBlockConfirmation:
      uniqueReasonCodes.length > 0
      && !hasManualOverride
      && !userFreeText
      && !businessPurposeNote,
    canRunAssistant: uniqueReasonCodes.length > 0 && Boolean(userFreeText || businessPurposeNote),
    blockingReasons,
  } satisfies AccountingContextResolution;
}

function findAccount(accounts: PostableAccountRecord[], accountId: string | null | undefined) {
  if (!accountId) {
    return null;
  }

  return accounts.find((account) => account.id === accountId) ?? null;
}

function isProvisionalAccount(account: PostableAccountRecord | null) {
  return Boolean(
    account?.is_provisional
    || (typeof account?.code === "string" && account.code.startsWith("TEMP-")),
    );
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
    accountIsProvisional: isProvisionalAccount(account),
    status: input.rule.status,
    vatProfileJson: input.rule.vat_profile_json,
    taxProfileCode: input.rule.tax_profile_code,
    operationCategory: input.rule.operation_category ?? input.fallbackOperationCategory,
    linkedOperationType: input.rule.linked_operation_type,
    templateCode: input.rule.template_code,
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
      && rule.document_role === input.documentRole
      && matchesRuleSettlementMetadata({
        rule,
        accountingContext: input.accountingContext,
      }),
  );

  if (input.accountingContext.manualOverrideAccountId) {
    const account = findAccount(input.accounts, input.accountingContext.manualOverrideAccountId);

    return {
      ruleId: null,
      scope: "document_override",
      accountId: account?.id ?? input.accountingContext.manualOverrideAccountId,
      accountCode: account?.code ?? null,
      accountName: account?.name ?? null,
      accountIsProvisional: isProvisionalAccount(account),
      status: isProvisionalAccount(account) ? "provisional" : "approved",
      vatProfileJson: null,
      taxProfileCode: account?.tax_profile_hint ?? null,
      operationCategory:
        input.accountingContext.manualOverrideOperationCategory ?? input.operationCategory,
      linkedOperationType: null,
      templateCode: null,
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
  const targetOperationCategory =
    input.accountingContext.manualOverrideOperationCategory ?? input.operationCategory;
  const vendorConceptOperationCategoryRule = input.activeRules.find(
    (rule) =>
      rule.scope === "vendor_concept_operation_category"
      && rule.vendor_id === input.vendorResolution.vendorId
      && rule.concept_id !== null
      && candidateConceptIds.includes(rule.concept_id)
      && rule.operation_category === targetOperationCategory
      && rule.document_role === input.documentRole
      && matchesRuleSettlementMetadata({
        rule,
        accountingContext: input.accountingContext,
      }),
  );

  if (vendorConceptOperationCategoryRule) {
    return buildResolvedRule({
      rule: vendorConceptOperationCategoryRule,
      accounts: input.accounts,
      scope: "vendor_concept_operation_category",
      provenance: "accounting_rule:vendor_concept_operation_category",
      fallbackOperationCategory: targetOperationCategory,
    })!;
  }

  const vendorConceptRule = input.activeRules.find(
    (rule) =>
      rule.scope === "vendor_concept"
      && rule.vendor_id === input.vendorResolution.vendorId
      && rule.concept_id !== null
      && candidateConceptIds.includes(rule.concept_id)
      && rule.document_role === input.documentRole
      && matchesRuleSettlementMetadata({
        rule,
        accountingContext: input.accountingContext,
      }),
  );

  if (vendorConceptRule) {
    return buildResolvedRule({
      rule: vendorConceptRule,
      accounts: input.accounts,
      scope: "vendor_concept",
      provenance: "accounting_rule:vendor_concept",
      fallbackOperationCategory: targetOperationCategory,
    })!;
  }

  const conceptGlobalRule = input.activeRules.find(
    (rule) =>
      rule.scope === "concept_global"
      && rule.concept_id !== null
      && candidateConceptIds.includes(rule.concept_id)
      && rule.document_role === input.documentRole
      && matchesRuleSettlementMetadata({
        rule,
        accountingContext: input.accountingContext,
      }),
  );

  if (conceptGlobalRule) {
    return buildResolvedRule({
      rule: conceptGlobalRule,
      accounts: input.accounts,
      scope: "concept_global",
      provenance: "accounting_rule:concept_global",
      fallbackOperationCategory: targetOperationCategory,
    })!;
  }

  const vendorDefaultRule = input.activeRules.find(
    (rule) =>
      rule.scope === "vendor_default"
      && rule.vendor_id === input.vendorResolution.vendorId
      && rule.document_role === input.documentRole
      && matchesRuleSettlementMetadata({
        rule,
        accountingContext: input.accountingContext,
      }),
  );

  if (vendorDefaultRule) {
    return buildResolvedRule({
      rule: vendorDefaultRule,
      accounts: input.accounts,
      scope: "vendor_default",
      provenance: "accounting_rule:vendor_default",
      fallbackOperationCategory:
        input.vendorResolution.defaultOperationCategory ?? targetOperationCategory,
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
      accountIsProvisional: isProvisionalAccount(account),
      status: isProvisionalAccount(account) ? "provisional" : "approved",
      vatProfileJson: input.vendorResolution.defaultTaxProfile,
      taxProfileCode: account?.tax_profile_hint ?? null,
      operationCategory:
        input.vendorResolution.defaultOperationCategory ?? targetOperationCategory,
      linkedOperationType: null,
      templateCode: null,
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
      accountIsProvisional: isProvisionalAccount(account),
      status: isProvisionalAccount(account) ? "provisional" : "assistant",
      vatProfileJson: null,
      taxProfileCode: account?.tax_profile_hint ?? null,
      operationCategory:
        input.assistantSuggestion.output.suggestedOperationCategory
        ?? targetOperationCategory,
      linkedOperationType: input.assistantSuggestion.output.linkedOperationType,
      templateCode: null,
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
    accountIsProvisional: false,
    status: "manual_review",
    vatProfileJson: null,
    taxProfileCode: null,
    operationCategory: targetOperationCategory,
    linkedOperationType: null,
    templateCode: null,
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
        operation_kind: input.derived.settlementContext.operationKind,
        payment_terms: input.derived.settlementContext.paymentTerms,
        settlement_method: input.derived.settlementContext.settlementMethod,
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
