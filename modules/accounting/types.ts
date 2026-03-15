import type {
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentIntakeLineItem,
  DocumentRoleCandidate,
} from "@/modules/ai/document-intake-contract";
import type {
  DeterministicRuleRef,
  OrganizationFiscalProfile,
  OrganizationRuleSnapshotContext,
  VatEngineResult,
} from "@/modules/tax/uy-vat-engine";

export type JsonRecord = Record<string, unknown>;

export type DocumentMonetarySnapshot = {
  currencyCode: string;
  netAmountOriginal: number;
  taxAmountOriginal: number;
  totalAmountOriginal: number;
  netAmountUyu: number;
  taxAmountUyu: number;
  totalAmountUyu: number;
  fx: {
    policyCode: string;
    currencyCode: string;
    functionalCurrencyCode: string;
    source: string;
    rate: number;
    bcuValue: number | null;
    bcuDateUsed: string | null;
    bcuSeries: string | null;
    documentValue: number | null;
    documentDate: string | null;
    overrideReason: string | null;
    warnings: string[];
    blockingReasons: string[];
  };
};

export type DraftStepCode =
  | "identity"
  | "fields"
  | "amounts"
  | "operation_context"
  | "accounting_context"
  | "journal"
  | "tax"
  | "confirmation";

export type DocumentPostingStatus =
  | "draft"
  | "vat_ready"
  | "posted_provisional"
  | "posted_final"
  | "locked";

export type JournalPostingMode =
  | "provisional"
  | "final";

export type DraftBlockerFamily =
  | "documental"
  | "fiscal"
  | "contable"
  | "ia"
  | "duplicados"
  | "periodo"
  | "razonabilidad_geografica";

export type ReviewJournalLine = {
  lineNumber: number;
  accountId: string | null;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  functionalDebit: number;
  functionalCredit: number;
  currencyCode: string;
  fxRate: number;
  provenance: string;
  taxTag: string | null;
};

export type ReviewJournalSuggestion = {
  ready: boolean;
  isBalanced: boolean;
  postingMode: JournalPostingMode;
  hasProvisionalAccounts: boolean;
  totalDebit: number;
  totalCredit: number;
  functionalTotalDebit: number;
  functionalTotalCredit: number;
  currencyCode: string;
  functionalCurrencyCode: string;
  fxRate: number;
  fxRateDate: string | null;
  fxRateSource: string;
  fxRateBcuValue: number | null;
  fxRateBcuDateUsed: string | null;
  fxRateBcuSeries: string | null;
  templateCode: string | null;
  taxProfileCode: string | null;
  explanation: string;
  lines: ReviewJournalLine[];
  blockingReasons: string[];
};

export type VendorResolutionStatus = "matched" | "unresolved" | "ambiguous";
export type VendorMatchStrategy = "tax_id" | "alias" | "name" | "none" | "ambiguous";

export type VendorAliasRecord = {
  id: string;
  vendor_id: string;
  alias_display: string | null;
  alias_normalized: string;
  source: string;
};

export type AccountingVendorRecord = {
  id: string;
  organization_id: string;
  name: string;
  tax_id: string | null;
  tax_id_normalized: string | null;
  name_normalized: string | null;
  default_account_id: string | null;
  default_payment_account_id: string | null;
  default_tax_profile: JsonRecord | null;
  default_operation_category: string | null;
  metadata: JsonRecord | null;
  aliases: VendorAliasRecord[];
};

export type VendorResolutionCandidate = {
  vendorId: string;
  vendorName: string;
  matchStrategy: VendorMatchStrategy;
};

export type VendorResolutionResult = {
  status: VendorResolutionStatus;
  matchStrategy: VendorMatchStrategy;
  vendorId: string | null;
  vendorName: string | null;
  normalizedTaxId: string | null;
  normalizedName: string | null;
  defaultAccountId: string | null;
  defaultPaymentAccountId: string | null;
  defaultTaxProfile: JsonRecord | null;
  defaultOperationCategory: string | null;
  candidates: VendorResolutionCandidate[];
  blockingReasons: string[];
};

export type InvoiceIdentityStrategy =
  | "tax_id_number_date"
  | "tax_id_number_total_currency"
  | "name_number_date_total_currency"
  | "insufficient_data";

export type InvoiceDuplicateStatus =
  | "clear"
  | "suspected_duplicate"
  | "confirmed_duplicate"
  | "false_positive"
  | "justified_non_duplicate";

export type InvoiceIdentityResult = {
  issuerTaxIdNormalized: string | null;
  issuerNameNormalized: string | null;
  documentNumberNormalized: string | null;
  documentDate: string | null;
  totalAmount: number | null;
  currencyCode: string | null;
  identityStrategy: InvoiceIdentityStrategy;
  invoiceIdentityKey: string | null;
  duplicateStatus: InvoiceDuplicateStatus;
  duplicateOfDocumentId: string | null;
  duplicateReason: string | null;
  shouldBlockConfirmation: boolean;
  blockingReasons: string[];
};

export type PersistedInvoiceIdentityRow = {
  id: string;
  organization_id: string;
  document_id: string;
  source_draft_id: string | null;
  vendor_id: string | null;
  issuer_tax_id_normalized: string | null;
  issuer_name_normalized: string | null;
  document_number_normalized: string | null;
  document_date: string | null;
  total_amount: number | null;
  currency_code: string | null;
  identity_strategy: InvoiceIdentityStrategy;
  invoice_identity_key: string | null;
  duplicate_status: InvoiceDuplicateStatus;
  duplicate_of_document_id: string | null;
  duplicate_reason: string | null;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationConceptRecord = {
  id: string;
  organization_id: string;
  code: string;
  canonical_name: string;
  description: string | null;
  document_role: DocumentRoleCandidate;
  default_account_id: string | null;
  default_vat_profile_json: JsonRecord | null;
  default_operation_category: string | null;
  is_active: boolean;
  metadata: JsonRecord | null;
};

export type OrganizationConceptAliasRecord = {
  id: string;
  organization_id: string;
  concept_id: string;
  vendor_id: string | null;
  alias_code_normalized: string | null;
  alias_description_normalized: string;
  match_scope: string;
  source: string;
};

export type ConceptMatchStrategy =
  | "vendor_alias_code"
  | "vendor_alias_description"
  | "organization_alias_code"
  | "organization_alias_description"
  | "semantic_similarity"
  | "fallback_amount_breakdown"
  | "unmatched";

export type ConceptResolutionLine = {
  lineNumber: number;
  rawCode: string | null;
  rawDescription: string | null;
  normalizedCode: string | null;
  normalizedDescription: string | null;
  source: "line_item" | "amount_breakdown";
  matchedConceptId: string | null;
  matchedConceptCode: string | null;
  matchedConceptName: string | null;
  matchStrategy: ConceptMatchStrategy;
  matchConfidence: number;
  requiresUserContext: boolean;
  candidateConceptIds: string[];
};

export type ConceptResolutionResult = {
  lines: ConceptResolutionLine[];
  fallbackUsed: boolean;
  primaryConceptLabels: string[];
  matchedConceptIds: string[];
  blockingReasons: string[];
  needsUserContext: boolean;
  unresolvedLineCount: number;
};

export type PersistedDocumentLineItemRecord = {
  id: string;
  organization_id: string;
  document_id: string;
  draft_id: string;
  line_number: number;
  raw_concept_code: string | null;
  raw_concept_description: string | null;
  normalized_concept_code: string | null;
  normalized_concept_description: string | null;
  net_amount: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  matched_concept_id: string | null;
  match_strategy: string;
  match_confidence: number;
  requires_user_context: boolean;
  metadata: JsonRecord | null;
  created_at: string;
  updated_at: string;
};

export type AccountingDraftFields = {
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  lineItems: DocumentIntakeLineItem[];
};

export type PostableAccountRecord = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  account_type: string;
  normal_side: "debit" | "credit";
  is_postable: boolean;
  is_provisional: boolean;
  source: string | null;
  external_code: string | null;
  statement_section: string | null;
  nature_tag: string | null;
  function_tag: string | null;
  cashflow_tag: string | null;
  tax_profile_hint: string | null;
  currency_policy: string | null;
  metadata: JsonRecord | null;
};

export type AccountingRuleScope =
  | "document_override"
  | "vendor_concept_operation_category"
  | "vendor_concept"
  | "concept_global"
  | "vendor_default";

export type AccountingRuleRecord = {
  id: string;
  organization_id: string;
  scope: AccountingRuleScope;
  document_id: string | null;
  source_document_id: string | null;
  vendor_id: string | null;
  concept_id: string | null;
  document_role: DocumentRoleCandidate;
  account_id: string;
  status: "candidate" | "provisional" | "approved";
  vat_profile_json: JsonRecord | null;
  tax_profile_code: string | null;
  operation_category: string | null;
  linked_operation_type: string | null;
  template_code: string | null;
  times_reused: number;
  times_corrected: number;
  priority: number;
  source: string;
  is_active: boolean;
  metadata: JsonRecord | null;
  created_at?: string;
};

export type ResolvedAccountingRule = {
  ruleId: string | null;
  scope: AccountingRuleScope | "assistant" | "manual_review";
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  accountIsProvisional: boolean;
  status: "candidate" | "provisional" | "approved" | "assistant" | "manual_review";
  vatProfileJson: JsonRecord | null;
  taxProfileCode: string | null;
  operationCategory: string | null;
  linkedOperationType: string | null;
  templateCode: string | null;
  provenance: string;
  priority: number | null;
  source: string | null;
  createdAt: string | null;
};

export type AccountingContextReasonCode =
  | "unmatched_concept"
  | "ambiguous_vendor"
  | "new_concept_without_rule"
  | "vat_operation_dependency"
  | "multiple_candidate_accounts"
  | "low_confidence"
  | "location_outlier"
  | "travel_pattern"
  | "sensitive_merchant_far_from_base";

export type AccountingContextStatus =
  | "not_required"
  | "required"
  | "provided"
  | "assistant_completed"
  | "manual_override";

export type DocumentAccountingContextRecord = {
  id: string;
  organization_id: string;
  document_id: string;
  draft_id: string;
  status: AccountingContextStatus;
  reason_codes: string[];
  user_free_text: string | null;
  structured_context_json: JsonRecord | null;
  ai_request_payload_json: JsonRecord | null;
  ai_response_json: JsonRecord | null;
  provider_code: string | null;
  model_code: string | null;
  prompt_hash: string | null;
  request_latency_ms: number | null;
  created_at: string;
  updated_at: string;
};

export type AccountingContextSaveInput = {
  userFreeText: string | null;
  businessPurposeNote: string | null;
  manualOverrideAccountId: string | null;
  manualOverrideConceptId: string | null;
  manualOverrideOperationCategory: string | null;
  learnedConceptName: string | null;
};

export type AccountingContextResolution = {
  status: AccountingContextStatus;
  reasonCodes: AccountingContextReasonCode[];
  userFreeText: string | null;
  businessPurposeNote: string | null;
  structuredContext: JsonRecord;
  aiRequestPayload: JsonRecord;
  aiResponse: JsonRecord;
  providerCode: string | null;
  modelCode: string | null;
  promptHash: string | null;
  requestLatencyMs: number | null;
  manualOverrideAccountId: string | null;
  manualOverrideConceptId: string | null;
  manualOverrideOperationCategory: string | null;
  learnedConceptName: string | null;
  shouldBlockConfirmation: boolean;
  canRunAssistant: boolean;
  blockingReasons: string[];
};

export type AccountingAssistantAllowedConcept = {
  id: string;
  code: string;
  canonicalName: string;
  documentRole: DocumentRoleCandidate;
  defaultAccountId: string | null;
  defaultOperationCategory: string | null;
};

export type PriorApprovalExample = {
  ruleId: string;
  scope: AccountingRuleScope;
  vendorId: string | null;
  conceptId: string | null;
  accountId: string;
  accountCode: string | null;
  accountName: string | null;
  rationale: string | null;
};

export type FiscalProfileSummary = {
  organizationSummary: string;
  ruleSnapshotSummary: string;
};

export type AccountingAssistantInput = {
  organizationId: string;
  documentId: string;
  draftId: string;
  vendor: VendorResolutionResult | null;
  invoiceIdentity: InvoiceIdentityResult | null;
  extractedFacts: DocumentIntakeFactMap;
  lineItems: ConceptResolutionLine[];
  candidateConcepts: AccountingAssistantAllowedConcept[];
  userContextText: string;
  allowedTargets?: PostableAccountRecord[];
  allowedAccounts?: PostableAccountRecord[];
  allowedConcepts: OrganizationConceptRecord[];
  priorApprovedExamples: PriorApprovalExample[];
  fiscalProfileSummary: FiscalProfileSummary;
};

export type AccountingAssistantOutput = {
  suggestedConceptId: string | null;
  suggestedAccountId: string | null;
  suggestedOperationCategory: string | null;
  linkedOperationType: string | null;
  vatContextHint: string | null;
  confidence: number;
  rationale: string;
  reviewFlags: string[];
  shouldBlockConfirmation: boolean;
};

export type AccountingAssistantStatus =
  | "not_requested"
  | "completed"
  | "failed";

export type AccountingAssistantResult = {
  status: AccountingAssistantStatus;
  shouldBlockConfirmation: boolean;
  confidence: number | null;
  rationale: string | null;
  output: AccountingAssistantOutput | null;
  providerCode: string | null;
  modelCode: string | null;
  promptHash: string | null;
  latencyMs: number | null;
  requestPayload: JsonRecord;
  responsePayload: JsonRecord;
  reviewFlags: string[];
};

export type AccountingSuggestionContext = {
  organizationId: string;
  documentId: string;
  draftId: string;
  documentRole: DocumentRoleCandidate;
  documentType: string | null;
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  lineItems: DocumentIntakeLineItem[];
  operationCategory: string | null;
  profile: OrganizationFiscalProfile | null;
  ruleSnapshot: OrganizationRuleSnapshotContext | null;
  monetarySnapshot: DocumentMonetarySnapshot | null;
  vendorResolution: VendorResolutionResult;
  invoiceIdentity: InvoiceIdentityResult | null;
  conceptResolution: ConceptResolutionResult;
  accountingContext: AccountingContextResolution;
  assistantSuggestion: AccountingAssistantResult;
  accounts: PostableAccountRecord[];
  activeRules: AccountingRuleRecord[];
};

export type DraftValidation = {
  canConfirm: boolean;
  blockers: string[];
  canPostProvisional: boolean;
  canConfirmFinal: boolean;
  postingStatus: DocumentPostingStatus;
  blockerGroups: Array<{
    family: DraftBlockerFamily;
    blockers: string[];
  }>;
};

export type DerivedDraftArtifacts = {
  monetarySnapshot: DocumentMonetarySnapshot | null;
  taxTreatment: VatEngineResult;
  journalSuggestion: ReviewJournalSuggestion;
  vendorResolution: VendorResolutionResult;
  invoiceIdentity: InvoiceIdentityResult | null;
  conceptResolution: ConceptResolutionResult;
  accountingContext: AccountingContextResolution;
  assistantSuggestion: AccountingAssistantResult;
  appliedRule: ResolvedAccountingRule;
  validation: DraftValidation;
};

export type AccountingDraftStepSnapshot = {
  step_code: DraftStepCode;
  status: "draft_saved" | "blocked";
  last_saved_at: string;
  stale_reason: string | null;
  snapshot_json: JsonRecord | ReviewJournalSuggestion | VatEngineResult;
};

export type AccountingArtifactsPersistenceInput = {
  organizationId: string;
  documentId: string;
  draftId: string;
  revisionNumber: number;
  documentDate: string;
  originalFilename: string;
  currencyCode: string | null;
  reference: string;
  confidence: number | null;
  actorId: string | null;
  derived: DerivedDraftArtifacts;
};

export type AccountingArtifactsPersistenceResult = {
  suggestionId: string;
  journalEntryId: string;
};

export type DuplicateResolutionAction =
  | "confirmed_duplicate"
  | "false_positive"
  | "justified_non_duplicate";

export type ResolveDuplicateInput = {
  organizationId: string;
  documentId: string;
  action: DuplicateResolutionAction;
  note: string | null;
  actorId: string | null;
};

export type DuplicateResolutionResult = {
  ok: boolean;
  duplicateStatus: InvoiceDuplicateStatus;
  message: string;
};

export type LearnApprovalScope =
  | "none"
  | "document_override"
  | "vendor_concept_operation_category"
  | "vendor_concept"
  | "concept_global"
  | "vendor_default";

export type ApprovalLearningInput = {
  scope: LearnApprovalScope;
  learnedConceptName: string | null;
};

export type LearningSuggestionScope =
  | "vendor_concept_operation_category"
  | "vendor_concept"
  | "concept_global"
  | "vendor_default";

export type AccountingLearningSuggestionOption = {
  scope: LearningSuggestionScope;
  label: string;
  reason: string;
  recommended: boolean;
  requiresConceptName: boolean;
};

export type AccountingLearningSuggestionSummary = {
  suggestedConceptName: string | null;
  recommendedScope: LearnApprovalScope;
  options: AccountingLearningSuggestionOption[];
};

export type AccountingRuntimeContext = {
  vendors: AccountingVendorRecord[];
  concepts: OrganizationConceptRecord[];
  conceptAliases: OrganizationConceptAliasRecord[];
  accounts: PostableAccountRecord[];
  activeRules: AccountingRuleRecord[];
};

export type DocumentAssignmentRunStatus =
  | "started"
  | "completed"
  | "failed"
  | "stale";

export type DocumentAssignmentRunRecord = {
  id: string;
  organizationId: string;
  documentId: string;
  draftId: string;
  triggeredByUserId: string | null;
  status: DocumentAssignmentRunStatus;
  requestPayload: JsonRecord;
  responseJson: JsonRecord;
  selectedAccountId: string | null;
  selectedOperationCategory: string | null;
  selectedTemplateCode: string | null;
  selectedTaxProfileCode: string | null;
  confidence: number | null;
  providerCode: string | null;
  modelCode: string | null;
  latencyMs: number | null;
  createdAt: string;
  updatedAt: string | null;
};

export type {
  DeterministicRuleRef,
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentIntakeLineItem,
  DocumentRoleCandidate,
  OrganizationFiscalProfile,
  OrganizationRuleSnapshotContext,
  VatEngineResult,
};
