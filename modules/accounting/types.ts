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

export type DraftStepCode =
  | "identity"
  | "fields"
  | "amounts"
  | "operation_context"
  | "journal"
  | "tax"
  | "confirmation";

export type ReviewJournalLine = {
  lineNumber: number;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  provenance: string;
};

export type ReviewJournalSuggestion = {
  ready: boolean;
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  explanation: string;
  lines: ReviewJournalLine[];
  blockingReasons: string[];
};

export type VendorResolutionStatus = "matched" | "unresolved" | "ambiguous";

export type VendorResolutionResult = {
  status: VendorResolutionStatus;
  matchStrategy: "tax_id" | "name" | "none" | "ambiguous";
  vendorId: string | null;
  vendorName: string | null;
  normalizedTaxId: string | null;
  normalizedName: string | null;
  blockingReasons: string[];
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
  metadata: JsonRecord | null;
};

export type InvoiceIdentityStrategy =
  | "tax_id_number_date"
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

export type ConceptResolutionLine = {
  lineNumber: number;
  rawCode: string | null;
  rawDescription: string | null;
  normalizedCode: string | null;
  normalizedDescription: string | null;
  source: "line_item" | "amount_breakdown";
};

export type ConceptResolutionResult = {
  lines: ConceptResolutionLine[];
  fallbackUsed: boolean;
  primaryConceptLabels: string[];
};

export type AccountingDraftFields = {
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  lineItems: DocumentIntakeLineItem[];
};

export type AccountingSuggestionContext = {
  documentRole: DocumentRoleCandidate;
  documentType: string | null;
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  lineItems: DocumentIntakeLineItem[];
  operationCategory: string | null;
  profile: OrganizationFiscalProfile | null;
  ruleSnapshot: OrganizationRuleSnapshotContext | null;
  vendorResolution: VendorResolutionResult;
  invoiceIdentity: InvoiceIdentityResult | null;
  conceptResolution: ConceptResolutionResult;
};

export type DraftValidation = {
  canConfirm: boolean;
  blockers: string[];
};

export type DerivedDraftArtifacts = {
  taxTreatment: VatEngineResult;
  journalSuggestion: ReviewJournalSuggestion;
  vendorResolution: VendorResolutionResult;
  invoiceIdentity: InvoiceIdentityResult | null;
  conceptResolution: ConceptResolutionResult;
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
