import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { roundCurrency } from "@/modules/accounting/normalization";
import {
  buildAccountingMonthRange,
  getAccountingMonthKey,
  sortAccountingMonthKeysDesc,
} from "@/modules/accounting/periods";
import { isFiscalPeriodMutableForDocument } from "@/modules/accounting/fiscal-period-status";
import {
  buildBalanceSheetRows,
  buildIncomeStatementRows,
  type StatementReadInputRow,
} from "@/modules/accounting/read-models";
import {
  isMissingJournalEntryLineStep5ColumnError,
} from "@/modules/accounting/step5-schema-compat";

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type JsonRecord = Record<string, unknown>;

type JournalEntryReadRowRaw = {
  organization_id: string;
  journal_entry_id: string;
  entry_number: number | null;
  entry_date: string | null;
  status: string | null;
  posting_mode: string | null;
  source_channel: string | null;
  source_system: string | null;
  source_provider: string | null;
  provider_managed: boolean | null;
  source_document_id: string | null;
  source_event_id: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  source_external_id: string | null;
  posting_proposal_id: string | null;
  posting_proposal_confirmability_status: string | null;
  accounting_snapshot_fingerprint: string | null;
  fiscal_period_id: string | null;
  fiscal_period_code: string | null;
  fiscal_period_label: string | null;
  fiscal_period_status: string | null;
  journal_type_id: string | null;
  journal_type_code: string | null;
  journal_type_name: string | null;
  auxiliary_book_id: string | null;
  auxiliary_book_code: string | null;
  auxiliary_book_name: string | null;
  reference: string | null;
  description: string | null;
  currency_code: string | null;
  functional_currency_code: string | null;
  fx_rate: number | null;
  fx_rate_date: string | null;
  fx_rate_source: string | null;
  total_debit: number | null;
  total_credit: number | null;
  functional_total_debit: number | null;
  functional_total_credit: number | null;
  source_hash: string | null;
  economic_hash: string | null;
  line_count: number | null;
  distinct_account_count: number | null;
  open_item_count: number | null;
  open_item_outstanding_amount: number | null;
  open_item_functional_amount: number | null;
  settlement_link_count: number | null;
  settlement_amount: number | null;
  settlement_functional_amount: number | null;
  last_settled_at: string | null;
  lineage_kind: "base" | "reversal" | "adjustment" | null;
  lineage_root_journal_entry_id: string | null;
  lineage_depth: number | null;
  reverses_journal_entry_id: string | null;
  reversed_by_journal_entry_id: string | null;
  adjusts_journal_entry_id: string | null;
  annulment_reason: string | null;
  is_immutable: boolean | null;
  is_active_leaf: boolean | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type JournalLineageRowRaw = {
  organization_id: string;
  journal_entry_id: string;
  entry_number: number | null;
  entry_date: string | null;
  entry_status: string | null;
  lineage_root_journal_entry_id: string | null;
  related_journal_entry_id: string;
  related_entry_number: number | null;
  related_entry_date: string | null;
  related_entry_status: string | null;
  related_lineage_root_journal_entry_id: string | null;
  relation_type: "reverses" | "reversed_by" | "adjusts";
};

type OpenItemOutstandingRowRaw = {
  organization_id: string;
  open_item_id: string;
  party_id: string | null;
  work_unit_id: string | null;
  work_unit_name: string | null;
  work_unit_code: string | null;
  counterparty_type: string | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
  counterparty_tax_id_normalized: string | null;
  source_channel: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  source_document_id: string | null;
  document_role: string | null;
  document_type: string | null;
  issue_date: string | null;
  due_date: string | null;
  days_overdue: number | null;
  currency_code: string | null;
  original_currency_code: string | null;
  functional_currency_code: string | null;
  fx_rate: number | null;
  fx_rate_date: string | null;
  fx_rate_source: string | null;
  original_amount: number | null;
  functional_amount: number | null;
  settled_amount: number | null;
  outstanding_amount: number | null;
  status: string | null;
  opening_journal_entry_id: string | null;
  opening_entry_number: number | null;
  opening_entry_date: string | null;
  opening_journal_entry_line_id: string | null;
  settlement_count: number | null;
  settled_amount_linked: number | null;
  settled_functional_amount_linked: number | null;
  last_settled_at: string | null;
  is_residual_credit_balance: boolean | null;
  provider_managed: boolean | null;
  source_hash: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type GeneralLedgerLineRaw = {
  journal_entry_id: string;
  line_no: number | null;
  debit: number | null;
  credit: number | null;
  debit_original?: number | null;
  credit_original?: number | null;
  functional_debit?: number | null;
  functional_credit?: number | null;
  original_currency_code?: string | null;
  fx_rate_applied?: number | null;
  description: string | null;
  role_code?: string | null;
  line_purpose?: string | null;
};

type ChartAccountRelationRaw =
  | {
      id?: string | null;
      code?: string | null;
      name?: string | null;
      account_type?: string | null;
      normal_side?: "debit" | "credit" | null;
      external_code?: string | null;
      provider_managed?: boolean | null;
      source_provider?: string | null;
      is_postable?: boolean | null;
      is_imputable?: boolean | null;
      metadata?: JsonRecord | null;
    }
  | Array<{
      id?: string | null;
      code?: string | null;
      name?: string | null;
      account_type?: string | null;
      normal_side?: "debit" | "credit" | null;
      external_code?: string | null;
      provider_managed?: boolean | null;
      source_provider?: string | null;
      is_postable?: boolean | null;
      is_imputable?: boolean | null;
      metadata?: JsonRecord | null;
    }>
  | null;

type JournalEntryDetailLineRaw = {
  id: string;
  journal_entry_id: string;
  line_no: number | null;
  account_id: string | null;
  debit: number | null;
  credit: number | null;
  currency_code?: string | null;
  original_currency_code?: string | null;
  original_amount?: number | null;
  debit_original?: number | null;
  credit_original?: number | null;
  fx_rate?: number | null;
  fx_rate_applied?: number | null;
  functional_debit?: number | null;
  functional_credit?: number | null;
  functional_amount_uyu?: number | null;
  functional_currency_code?: string | null;
  tax_tag?: string | null;
  description: string | null;
  role_code?: string | null;
  line_purpose?: string | null;
  tax_component?: string | null;
  settlement_component?: string | null;
  source_ref_json?: JsonRecord | null;
  source_hash?: string | null;
  provider_managed?: boolean | null;
  metadata?: JsonRecord | null;
  chart_of_accounts: ChartAccountRelationRaw;
};

type PostingProposalAuditRaw = {
  id: string;
  source_event_id: string | null;
  source_event_facts_id: string | null;
  source_event_facts_version_no: number | null;
  accounting_snapshot_id: string | null;
  accounting_snapshot_fingerprint: string | null;
  proposal_version_no: number | null;
  status: string | null;
  posting_mode: string | null;
  proposal_hash: string | null;
  economic_hash: string | null;
  confirmability_status: string | null;
  explanation: string | null;
  journal_preview_json: JsonRecord | null;
  warnings_json: unknown;
  blockers_json: unknown;
  metadata_json: JsonRecord | null;
  invalidated_at: string | null;
  invalidated_reason: string | null;
  materialized_journal_entry_id: string | null;
  confirmed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SourceEventAuditRaw = {
  id: string;
  source_channel: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  source_external_id: string | null;
  source_document_id: string | null;
  binary_hash: string | null;
  payload_hash: string | null;
  source_ref_json: JsonRecord | null;
  metadata_json: JsonRecord | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type JournalEntryReadRow = {
  organizationId: string;
  journalEntryId: string;
  entryNumber: number | null;
  entryDate: string | null;
  status: string | null;
  postingMode: string | null;
  sourceChannel: string | null;
  sourceSystem: string | null;
  sourceProvider: string | null;
  providerManaged: boolean;
  sourceDocumentId: string | null;
  sourceEventId: string | null;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  sourceExternalId: string | null;
  postingProposalId: string | null;
  postingProposalConfirmabilityStatus: string | null;
  accountingSnapshotFingerprint: string | null;
  fiscalPeriodId: string | null;
  fiscalPeriodCode: string | null;
  fiscalPeriodLabel: string | null;
  fiscalPeriodStatus: string | null;
  journalTypeId: string | null;
  journalTypeCode: string | null;
  journalTypeName: string | null;
  auxiliaryBookId: string | null;
  auxiliaryBookCode: string | null;
  auxiliaryBookName: string | null;
  reference: string | null;
  description: string | null;
  currencyCode: string | null;
  functionalCurrencyCode: string | null;
  fxRate: number | null;
  fxRateDate: string | null;
  fxRateSource: string | null;
  totalDebit: number;
  totalCredit: number;
  functionalTotalDebit: number;
  functionalTotalCredit: number;
  sourceHash: string | null;
  economicHash: string | null;
  lineCount: number;
  distinctAccountCount: number;
  openItemCount: number;
  openItemOutstandingAmount: number;
  openItemFunctionalAmount: number;
  settlementLinkCount: number;
  settlementAmount: number;
  settlementFunctionalAmount: number;
  lastSettledAt: string | null;
  lineageKind: "base" | "reversal" | "adjustment";
  lineageRootJournalEntryId: string | null;
  lineageDepth: number;
  reversesJournalEntryId: string | null;
  reversedByJournalEntryId: string | null;
  adjustsJournalEntryId: string | null;
  annulmentReason: string | null;
  isImmutable: boolean;
  isActiveLeaf: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type JournalLineageReadRow = {
  organizationId: string;
  journalEntryId: string;
  entryNumber: number | null;
  entryDate: string | null;
  entryStatus: string | null;
  lineageRootJournalEntryId: string | null;
  relatedJournalEntryId: string;
  relatedEntryNumber: number | null;
  relatedEntryDate: string | null;
  relatedEntryStatus: string | null;
  relatedLineageRootJournalEntryId: string | null;
  relationType: "reverses" | "reversed_by" | "adjusts";
};

export type JournalEntryDetailLine = {
  id: string;
  journalEntryId: string;
  lineNo: number;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  accountNormalSide: "debit" | "credit" | null;
  externalAccountCode: string | null;
  accountProviderManaged: boolean;
  accountSourceProvider: string | null;
  accountIsPostable: boolean | null;
  accountIsImputable: boolean | null;
  debit: number;
  credit: number;
  currencyCode: string | null;
  originalCurrencyCode: string | null;
  originalAmount: number;
  debitOriginal: number;
  creditOriginal: number;
  functionalDebit: number;
  functionalCredit: number;
  functionalAmount: number;
  functionalCurrencyCode: string | null;
  fxRate: number | null;
  fxRateApplied: number | null;
  description: string | null;
  taxTag: string | null;
  roleCode: string | null;
  linePurpose: string | null;
  taxComponent: string | null;
  settlementComponent: string | null;
  sourceRef: JsonRecord;
  sourceHash: string | null;
  providerManaged: boolean;
  metadata: JsonRecord;
};

export type JournalEntryDetail = {
  isAvailable: true;
  entry: JournalEntryReadRow;
  lines: JournalEntryDetailLine[];
  totals: {
    debit: number;
    credit: number;
    imbalance: number;
    functionalDebit: number;
    functionalCredit: number;
    functionalImbalance: number;
    lineCount: number;
  };
  sourceEvent: {
    id: string;
    sourceChannel: string | null;
    sourceEntityType: string | null;
    sourceEntityId: string | null;
    sourceExternalId: string | null;
    sourceDocumentId: string | null;
    binaryHash: string | null;
    payloadHash: string | null;
    sourceRef: JsonRecord;
    metadata: JsonRecord;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  } | null;
  proposal: {
    id: string;
    sourceEventId: string | null;
    sourceEventFactsId: string | null;
    sourceEventFactsVersionNo: number | null;
    accountingSnapshotId: string | null;
    accountingSnapshotFingerprint: string | null;
    proposalVersionNo: number | null;
    status: string | null;
    postingMode: string | null;
    proposalHash: string | null;
    economicHash: string | null;
    confirmabilityStatus: string | null;
    explanation: string | null;
    journalPreview: JsonRecord;
    warnings: string[];
    blockers: string[];
    metadata: JsonRecord;
    invalidatedAt: string | null;
    invalidatedReason: string | null;
    materializedJournalEntryId: string | null;
    confirmedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  } | null;
  lineageRows: JournalLineageReadRow[];
  adjustment: {
    canPrepare: boolean;
    unavailableReason: string | null;
  };
};

export type DocumentJournalAuditState =
  | {
      mode: "materialized";
      documentId: string;
      detail: JournalEntryDetail;
      previewReason: null;
    }
  | {
      mode: "preview";
      documentId: string;
      detail: null;
      previewReason: string;
    }
  | {
      mode: "unavailable";
      documentId: string;
      detail: null;
      previewReason: string;
    };

export type OpenItemOutstandingRow = {
  organizationId: string;
  openItemId: string;
  partyId: string | null;
  workUnitId: string | null;
  workUnitName: string | null;
  workUnitCode: string | null;
  counterpartyType: string | null;
  counterpartyId: string | null;
  counterpartyName: string | null;
  counterpartyTaxIdNormalized: string | null;
  sourceChannel: string | null;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  sourceDocumentId: string | null;
  documentRole: string | null;
  documentType: string | null;
  issueDate: string | null;
  dueDate: string | null;
  daysOverdue: number;
  currencyCode: string | null;
  originalCurrencyCode: string | null;
  functionalCurrencyCode: string | null;
  fxRate: number | null;
  fxRateDate: string | null;
  fxRateSource: string | null;
  originalAmount: number;
  functionalAmount: number;
  settledAmount: number;
  outstandingAmount: number;
  status: string | null;
  openingJournalEntryId: string | null;
  openingEntryNumber: number | null;
  openingEntryDate: string | null;
  openingJournalEntryLineId: string | null;
  settlementCount: number;
  settledAmountLinked: number;
  settledFunctionalAmountLinked: number;
  lastSettledAt: string | null;
  isResidualCreditBalance: boolean;
  providerManaged: boolean;
  sourceHash: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TrialBalanceReadRow = {
  organizationId: string;
  fiscalPeriodId: string | null;
  fiscalPeriodCode: string | null;
  fiscalPeriodLabel: string | null;
  sourceChannel: string | null;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  chapterCode: string | null;
  presentationCode: string | null;
  statementSection: string | null;
  naturalBalance: "debit" | "credit" | null;
  debit: number;
  credit: number;
  balance: number;
  functionalDebit: number;
  functionalCredit: number;
  functionalBalance: number;
  entryCount: number;
  lineCount: number;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
};

export type GeneralLedgerRow = {
  journalEntryId: string;
  entryNumber: number | null;
  entryDate: string | null;
  status: string | null;
  sourceChannel: string | null;
  reference: string | null;
  entryDescription: string | null;
  lineNo: number;
  lineDescription: string | null;
  debit: number;
  credit: number;
  debitOriginal: number;
  creditOriginal: number;
  functionalDebit: number;
  functionalCredit: number;
  originalCurrencyCode: string | null;
  fxRateApplied: number | null;
  roleCode: string | null;
  linePurpose: string | null;
  runningFunctionalBalance: number;
};

export type StatementSectionTotal = {
  reportSection: string;
  presentationBalance: number;
};

export type ReadModelFilterOptions = {
  statuses: string[];
  sourceChannels: string[];
  fiscalPeriodCodes: string[];
  journalTypeCodes: string[];
  counterpartyTypes: string[];
  accountTypes: string[];
};

export type JournalEntriesWorkspaceData = {
  isAvailable: boolean;
  selectedFiscalPeriodCode: string | null;
  rows: JournalEntryReadRow[];
  lineageRows: JournalLineageReadRow[];
  summary: {
    totalEntries: number;
    activeLeafCount: number;
    immutableCount: number;
    providerManagedCount: number;
    reversalCount: number;
    openItemCount: number;
    settlementLinkCount: number;
  };
  filterOptions: ReadModelFilterOptions;
};

export type OpenItemsWorkspaceData = {
  isAvailable: boolean;
  selectedFiscalPeriodCode: string | null;
  rows: OpenItemOutstandingRow[];
  summary: {
    totalItems: number;
    outstandingAmount: number;
    overdueCount: number;
    foreignCurrencyCount: number;
    residualCreditCount: number;
  };
  agingBuckets: Array<{
    label: string;
    count: number;
    outstandingAmount: number;
  }>;
  filterOptions: ReadModelFilterOptions;
};

export type TrialBalanceWorkspaceData = {
  isAvailable: boolean;
  selectedFiscalPeriodCode: string | null;
  rows: TrialBalanceReadRow[];
  generalLedgerRows: GeneralLedgerRow[];
  summary: {
    accountCount: number;
    debit: number;
    credit: number;
    functionalDebit: number;
    functionalCredit: number;
    imbalance: number;
  };
  balanceSheetTotals: StatementSectionTotal[];
  incomeStatementTotals: StatementSectionTotal[];
  filterOptions: ReadModelFilterOptions;
};

const JOURNAL_ENTRY_READ_SELECT = [
  "organization_id",
  "journal_entry_id",
  "entry_number",
  "entry_date",
  "status",
  "posting_mode",
  "source_channel",
  "source_system",
  "source_provider",
  "provider_managed",
  "source_document_id",
  "source_event_id",
  "source_entity_type",
  "source_entity_id",
  "source_external_id",
  "posting_proposal_id",
  "posting_proposal_confirmability_status",
  "accounting_snapshot_fingerprint",
  "fiscal_period_id",
  "fiscal_period_code",
  "fiscal_period_label",
  "fiscal_period_status",
  "journal_type_id",
  "journal_type_code",
  "journal_type_name",
  "auxiliary_book_id",
  "auxiliary_book_code",
  "auxiliary_book_name",
  "reference",
  "description",
  "currency_code",
  "functional_currency_code",
  "fx_rate",
  "fx_rate_date",
  "fx_rate_source",
  "total_debit",
  "total_credit",
  "functional_total_debit",
  "functional_total_credit",
  "source_hash",
  "economic_hash",
  "line_count",
  "distinct_account_count",
  "open_item_count",
  "open_item_outstanding_amount",
  "open_item_functional_amount",
  "settlement_link_count",
  "settlement_amount",
  "settlement_functional_amount",
  "last_settled_at",
  "lineage_kind",
  "lineage_root_journal_entry_id",
  "lineage_depth",
  "reverses_journal_entry_id",
  "reversed_by_journal_entry_id",
  "adjusts_journal_entry_id",
  "annulment_reason",
  "is_immutable",
  "is_active_leaf",
  "first_seen_at",
  "last_seen_at",
  "created_at",
  "updated_at",
].join(", ");

const JOURNAL_LINEAGE_SELECT = [
  "organization_id",
  "journal_entry_id",
  "entry_number",
  "entry_date",
  "entry_status",
  "lineage_root_journal_entry_id",
  "related_journal_entry_id",
  "related_entry_number",
  "related_entry_date",
  "related_entry_status",
  "related_lineage_root_journal_entry_id",
  "relation_type",
].join(", ");

const OPEN_ITEMS_OUTSTANDING_SELECT = [
  "organization_id",
  "open_item_id",
  "party_id",
  "work_unit_id",
  "work_unit_name",
  "work_unit_code",
  "counterparty_type",
  "counterparty_id",
  "counterparty_name",
  "counterparty_tax_id_normalized",
  "source_channel",
  "source_entity_type",
  "source_entity_id",
  "source_document_id",
  "document_role",
  "document_type",
  "issue_date",
  "due_date",
  "days_overdue",
  "currency_code",
  "original_currency_code",
  "functional_currency_code",
  "fx_rate",
  "fx_rate_date",
  "fx_rate_source",
  "original_amount",
  "functional_amount",
  "settled_amount",
  "outstanding_amount",
  "status",
  "opening_journal_entry_id",
  "opening_entry_number",
  "opening_entry_date",
  "opening_journal_entry_line_id",
  "settlement_count",
  "settled_amount_linked",
  "settled_functional_amount_linked",
  "last_settled_at",
  "is_residual_credit_balance",
  "provider_managed",
  "source_hash",
  "created_at",
  "updated_at",
].join(", ");

const GENERAL_LEDGER_LINE_SELECT = [
  "journal_entry_id",
  "line_no",
  "debit",
  "credit",
  "debit_original",
  "credit_original",
  "functional_debit",
  "functional_credit",
  "original_currency_code",
  "fx_rate_applied",
  "description",
  "role_code",
  "line_purpose",
].join(", ");

const GENERAL_LEDGER_LINE_SELECT_LEGACY = [
  "journal_entry_id",
  "line_no",
  "debit",
  "credit",
  "description",
].join(", ");

const JOURNAL_ENTRY_DETAIL_LINE_SELECT = [
  "id",
  "journal_entry_id",
  "line_no",
  "account_id",
  "debit",
  "credit",
  "currency_code",
  "original_currency_code",
  "original_amount",
  "debit_original",
  "credit_original",
  "fx_rate",
  "fx_rate_applied",
  "functional_debit",
  "functional_credit",
  "functional_amount_uyu",
  "functional_currency_code",
  "tax_tag",
  "description",
  "role_code",
  "line_purpose",
  "tax_component",
  "settlement_component",
  "source_ref_json",
  "source_hash",
  "provider_managed",
  "metadata",
  "chart_of_accounts(id, code, name, account_type, normal_side, external_code, provider_managed, source_provider, is_postable, is_imputable, metadata)",
].join(", ");

const JOURNAL_ENTRY_DETAIL_LINE_SELECT_LEGACY = [
  "id",
  "journal_entry_id",
  "line_no",
  "account_id",
  "debit",
  "credit",
  "currency_code",
  "original_currency_code",
  "original_amount",
  "fx_rate",
  "functional_debit",
  "functional_credit",
  "functional_amount_uyu",
  "tax_tag",
  "description",
  "metadata",
  "chart_of_accounts(id, code, name, account_type, normal_side, is_postable, metadata)",
].join(", ");

const POSTING_PROPOSAL_AUDIT_SELECT = [
  "id",
  "source_event_id",
  "source_event_facts_id",
  "source_event_facts_version_no",
  "accounting_snapshot_id",
  "accounting_snapshot_fingerprint",
  "proposal_version_no",
  "status",
  "posting_mode",
  "proposal_hash",
  "economic_hash",
  "confirmability_status",
  "explanation",
  "journal_preview_json",
  "warnings_json",
  "blockers_json",
  "metadata_json",
  "invalidated_at",
  "invalidated_reason",
  "materialized_journal_entry_id",
  "confirmed_at",
  "created_at",
  "updated_at",
].join(", ");

const SOURCE_EVENT_AUDIT_SELECT = [
  "id",
  "source_channel",
  "source_entity_type",
  "source_entity_id",
  "source_external_id",
  "source_document_id",
  "binary_hash",
  "payload_hash",
  "source_ref_json",
  "metadata_json",
  "first_seen_at",
  "last_seen_at",
  "created_at",
  "updated_at",
].join(", ");

const TRIAL_BALANCE_LINE_SELECT = [
  "journal_entry_id",
  "account_id",
  "line_no",
  "debit",
  "credit",
  "functional_debit",
  "functional_credit",
  "chart_of_accounts(id, code, name, account_type, chapter_code, presentation_code, statement_section, natural_balance, normal_side)",
].join(", ");

const TRIAL_BALANCE_LINE_SELECT_LEGACY = [
  "journal_entry_id",
  "account_id",
  "line_no",
  "debit",
  "credit",
  "chart_of_accounts(id, code, name, account_type, chapter_code, presentation_code, statement_section, natural_balance, normal_side)",
].join(", ");

const ACCOUNTING_READ_MODEL_RELATIONS = [
  "v_journal_entries_read",
  "v_journal_lineage",
  "v_trial_balance",
  "v_open_items_outstanding",
  "v_balance_sheet",
  "v_income_statement",
];

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function sortTextValues(values: Iterable<string>) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function roundAmount(value: number | null | undefined) {
  return roundCurrency(typeof value === "number" ? value : 0);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function getChartAccountRelation(row: { chart_of_accounts: ChartAccountRelationRaw }) {
  return Array.isArray(row.chart_of_accounts)
    ? row.chart_of_accounts[0] ?? null
    : row.chart_of_accounts;
}

function includesSearch(values: Array<string | number | null | undefined>, searchTerm: string | null | undefined) {
  const normalized = normalizeText(searchTerm);

  if (!normalized) {
    return true;
  }

  return values.some((value) => normalizeText(String(value ?? "")).includes(normalized));
}

function mapJournalEntryRow(row: JournalEntryReadRowRaw): JournalEntryReadRow {
  return {
    organizationId: row.organization_id,
    journalEntryId: row.journal_entry_id,
    entryNumber: row.entry_number,
    entryDate: row.entry_date,
    status: row.status,
    postingMode: row.posting_mode,
    sourceChannel: row.source_channel,
    sourceSystem: row.source_system,
    sourceProvider: row.source_provider,
    providerManaged: row.provider_managed === true,
    sourceDocumentId: row.source_document_id,
    sourceEventId: row.source_event_id,
    sourceEntityType: row.source_entity_type,
    sourceEntityId: row.source_entity_id,
    sourceExternalId: row.source_external_id,
    postingProposalId: row.posting_proposal_id,
    postingProposalConfirmabilityStatus: row.posting_proposal_confirmability_status,
    accountingSnapshotFingerprint: row.accounting_snapshot_fingerprint,
    fiscalPeriodId: row.fiscal_period_id,
    fiscalPeriodCode: row.fiscal_period_code,
    fiscalPeriodLabel: row.fiscal_period_label,
    fiscalPeriodStatus: row.fiscal_period_status,
    journalTypeId: row.journal_type_id,
    journalTypeCode: row.journal_type_code,
    journalTypeName: row.journal_type_name,
    auxiliaryBookId: row.auxiliary_book_id,
    auxiliaryBookCode: row.auxiliary_book_code,
    auxiliaryBookName: row.auxiliary_book_name,
    reference: row.reference,
    description: row.description,
    currencyCode: row.currency_code,
    functionalCurrencyCode: row.functional_currency_code,
    fxRate: row.fx_rate,
    fxRateDate: row.fx_rate_date,
    fxRateSource: row.fx_rate_source,
    totalDebit: roundAmount(row.total_debit),
    totalCredit: roundAmount(row.total_credit),
    functionalTotalDebit: roundAmount(row.functional_total_debit),
    functionalTotalCredit: roundAmount(row.functional_total_credit),
    sourceHash: row.source_hash,
    economicHash: row.economic_hash,
    lineCount: row.line_count ?? 0,
    distinctAccountCount: row.distinct_account_count ?? 0,
    openItemCount: row.open_item_count ?? 0,
    openItemOutstandingAmount: roundAmount(row.open_item_outstanding_amount),
    openItemFunctionalAmount: roundAmount(row.open_item_functional_amount),
    settlementLinkCount: row.settlement_link_count ?? 0,
    settlementAmount: roundAmount(row.settlement_amount),
    settlementFunctionalAmount: roundAmount(row.settlement_functional_amount),
    lastSettledAt: row.last_settled_at,
    lineageKind: row.lineage_kind ?? "base",
    lineageRootJournalEntryId: row.lineage_root_journal_entry_id,
    lineageDepth: row.lineage_depth ?? 0,
    reversesJournalEntryId: row.reverses_journal_entry_id,
    reversedByJournalEntryId: row.reversed_by_journal_entry_id,
    adjustsJournalEntryId: row.adjusts_journal_entry_id,
    annulmentReason: row.annulment_reason,
    isImmutable: row.is_immutable === true,
    isActiveLeaf: row.is_active_leaf === true,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJournalLineageRow(row: JournalLineageRowRaw): JournalLineageReadRow {
  return {
    organizationId: row.organization_id,
    journalEntryId: row.journal_entry_id,
    entryNumber: row.entry_number,
    entryDate: row.entry_date,
    entryStatus: row.entry_status,
    lineageRootJournalEntryId: row.lineage_root_journal_entry_id,
    relatedJournalEntryId: row.related_journal_entry_id,
    relatedEntryNumber: row.related_entry_number,
    relatedEntryDate: row.related_entry_date,
    relatedEntryStatus: row.related_entry_status,
    relatedLineageRootJournalEntryId: row.related_lineage_root_journal_entry_id,
    relationType: row.relation_type,
  };
}

function mapJournalEntryDetailLine(
  row: JournalEntryDetailLineRaw,
  entry: Pick<JournalEntryReadRow, "currencyCode" | "functionalCurrencyCode" | "fxRate">,
): JournalEntryDetailLine {
  const account = getChartAccountRelation(row);
  const debit = roundAmount(row.debit);
  const credit = roundAmount(row.credit);
  const functionalDebit = roundAmount(row.functional_debit ?? row.debit);
  const functionalCredit = roundAmount(row.functional_credit ?? row.credit);
  const debitOriginal = roundAmount(row.debit_original ?? row.debit);
  const creditOriginal = roundAmount(row.credit_original ?? row.credit);

  return {
    id: row.id,
    journalEntryId: row.journal_entry_id,
    lineNo: row.line_no ?? 0,
    accountId: row.account_id ?? account?.id ?? null,
    accountCode: account?.code ?? null,
    accountName: account?.name ?? null,
    accountType: account?.account_type ?? null,
    accountNormalSide: account?.normal_side ?? null,
    externalAccountCode: account?.external_code ?? null,
    accountProviderManaged: account?.provider_managed === true,
    accountSourceProvider: account?.source_provider ?? null,
    accountIsPostable: typeof account?.is_postable === "boolean" ? account.is_postable : null,
    accountIsImputable: typeof account?.is_imputable === "boolean" ? account.is_imputable : null,
    debit,
    credit,
    currencyCode: row.currency_code ?? entry.currencyCode ?? null,
    originalCurrencyCode: row.original_currency_code ?? row.currency_code ?? entry.currencyCode ?? null,
    originalAmount: roundAmount(row.original_amount ?? (debit > 0 ? debitOriginal : creditOriginal)),
    debitOriginal,
    creditOriginal,
    functionalDebit,
    functionalCredit,
    functionalAmount: roundAmount(row.functional_amount_uyu ?? (functionalDebit - functionalCredit)),
    functionalCurrencyCode: row.functional_currency_code ?? entry.functionalCurrencyCode ?? null,
    fxRate: row.fx_rate ?? entry.fxRate ?? null,
    fxRateApplied: row.fx_rate_applied ?? row.fx_rate ?? entry.fxRate ?? null,
    description: row.description,
    taxTag: row.tax_tag ?? null,
    roleCode: row.role_code ?? null,
    linePurpose: row.line_purpose ?? null,
    taxComponent: row.tax_component ?? null,
    settlementComponent: row.settlement_component ?? null,
    sourceRef: asRecord(row.source_ref_json),
    sourceHash: row.source_hash ?? null,
    providerManaged: row.provider_managed === true,
    metadata: asRecord(row.metadata),
  };
}

function mapPostingProposalAuditRow(row: PostingProposalAuditRaw): JournalEntryDetail["proposal"] {
  return {
    id: row.id,
    sourceEventId: row.source_event_id,
    sourceEventFactsId: row.source_event_facts_id,
    sourceEventFactsVersionNo: row.source_event_facts_version_no,
    accountingSnapshotId: row.accounting_snapshot_id,
    accountingSnapshotFingerprint: row.accounting_snapshot_fingerprint,
    proposalVersionNo: row.proposal_version_no,
    status: row.status,
    postingMode: row.posting_mode,
    proposalHash: row.proposal_hash,
    economicHash: row.economic_hash,
    confirmabilityStatus: row.confirmability_status,
    explanation: row.explanation,
    journalPreview: asRecord(row.journal_preview_json),
    warnings: asStringArray(row.warnings_json),
    blockers: asStringArray(row.blockers_json),
    metadata: asRecord(row.metadata_json),
    invalidatedAt: row.invalidated_at,
    invalidatedReason: row.invalidated_reason,
    materializedJournalEntryId: row.materialized_journal_entry_id,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSourceEventAuditRow(row: SourceEventAuditRaw): JournalEntryDetail["sourceEvent"] {
  return {
    id: row.id,
    sourceChannel: row.source_channel,
    sourceEntityType: row.source_entity_type,
    sourceEntityId: row.source_entity_id,
    sourceExternalId: row.source_external_id,
    sourceDocumentId: row.source_document_id,
    binaryHash: row.binary_hash,
    payloadHash: row.payload_hash,
    sourceRef: asRecord(row.source_ref_json),
    metadata: asRecord(row.metadata_json),
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildJournalEntryAdjustmentPolicy(entry: JournalEntryReadRow) {
  if (!entry.sourceDocumentId) {
    return {
      canPrepare: false,
      unavailableReason: "Este asiento no tiene un documento origen para remapear.",
    };
  }

  if (entry.providerManaged) {
    return {
      canPrepare: false,
      unavailableReason: "Los asientos administrados por proveedor quedan solo lectura en v1.",
    };
  }

  if (!entry.isActiveLeaf) {
    return {
      canPrepare: false,
      unavailableReason: "Este asiento ya fue reemplazado por una reversa o ajuste posterior.",
    };
  }

  if (!["posted", "exported"].includes(entry.status ?? "")) {
    return {
      canPrepare: false,
      unavailableReason: "Solo los asientos posteados pueden ajustarse mediante reversa y reemplazo.",
    };
  }

  if (!isFiscalPeriodMutableForDocument(entry.fiscalPeriodStatus)) {
    return {
      canPrepare: false,
      unavailableReason: "El periodo contable no admite ajustes documentales sin reapertura formal.",
    };
  }

  return {
    canPrepare: true,
    unavailableReason: null,
  };
}

function mapOpenItemRow(row: OpenItemOutstandingRowRaw): OpenItemOutstandingRow {
  return {
    organizationId: row.organization_id,
    openItemId: row.open_item_id,
    partyId: row.party_id,
    workUnitId: row.work_unit_id,
    workUnitName: row.work_unit_name,
    workUnitCode: row.work_unit_code,
    counterpartyType: row.counterparty_type,
    counterpartyId: row.counterparty_id,
    counterpartyName: row.counterparty_name,
    counterpartyTaxIdNormalized: row.counterparty_tax_id_normalized,
    sourceChannel: row.source_channel,
    sourceEntityType: row.source_entity_type,
    sourceEntityId: row.source_entity_id,
    sourceDocumentId: row.source_document_id,
    documentRole: row.document_role,
    documentType: row.document_type,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    daysOverdue: row.days_overdue ?? 0,
    currencyCode: row.currency_code,
    originalCurrencyCode: row.original_currency_code,
    functionalCurrencyCode: row.functional_currency_code,
    fxRate: row.fx_rate,
    fxRateDate: row.fx_rate_date,
    fxRateSource: row.fx_rate_source,
    originalAmount: roundAmount(row.original_amount),
    functionalAmount: roundAmount(row.functional_amount),
    settledAmount: roundAmount(row.settled_amount),
    outstandingAmount: roundAmount(row.outstanding_amount),
    status: row.status,
    openingJournalEntryId: row.opening_journal_entry_id,
    openingEntryNumber: row.opening_entry_number,
    openingEntryDate: row.opening_entry_date,
    openingJournalEntryLineId: row.opening_journal_entry_line_id,
    settlementCount: row.settlement_count ?? 0,
    settledAmountLinked: roundAmount(row.settled_amount_linked),
    settledFunctionalAmountLinked: roundAmount(row.settled_functional_amount_linked),
    lastSettledAt: row.last_settled_at,
    isResidualCreditBalance: row.is_residual_credit_balance === true,
    providerManaged: row.provider_managed === true,
    sourceHash: row.source_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildStatementTotals(rows: StatementReadInputRow[], kind: "balance" | "income") {
  const statementRows = kind === "balance"
    ? buildBalanceSheetRows(rows)
    : buildIncomeStatementRows(rows);
  const totals = new Map<string, number>();

  for (const row of statementRows) {
    totals.set(
      row.reportSection,
      roundAmount((totals.get(row.reportSection) ?? 0) + row.presentationBalance),
    );
  }

  return Array.from(totals.entries())
    .map(([reportSection, presentationBalance]) => ({
      reportSection,
      presentationBalance,
    }))
    .sort((left, right) => left.reportSection.localeCompare(right.reportSection));
}

function buildFilterOptions(input: {
  rows?: Array<{
    status?: string | null;
    sourceChannel?: string | null;
    fiscalPeriodCode?: string | null;
    journalTypeCode?: string | null;
    counterpartyType?: string | null;
    accountType?: string | null;
  }>;
  fiscalPeriodCodes?: string[] | null;
}) {
  const rows = input.rows ?? [];

  return {
    statuses: sortTextValues(rows.map((row) => row.status).filter((value): value is string => Boolean(value))),
    sourceChannels: sortTextValues(rows.map((row) => row.sourceChannel).filter((value): value is string => Boolean(value))),
    fiscalPeriodCodes:
      input.fiscalPeriodCodes
      ?? sortTextValues(rows.map((row) => row.fiscalPeriodCode).filter((value): value is string => Boolean(value))),
    journalTypeCodes: sortTextValues(rows.map((row) => row.journalTypeCode).filter((value): value is string => Boolean(value))),
    counterpartyTypes: sortTextValues(rows.map((row) => row.counterpartyType).filter((value): value is string => Boolean(value))),
    accountTypes: sortTextValues(rows.map((row) => row.accountType).filter((value): value is string => Boolean(value))),
  } satisfies ReadModelFilterOptions;
}

async function loadAvailableAccountingPeriodCodesFromEntries(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("v_journal_entries_read")
    .select("entry_date")
    .eq("organization_id", organizationId)
    .order("entry_date", { ascending: false })
    .limit(1000);

  if (error) {
    if (isMissingAccountingReadModelRelationError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  return sortAccountingMonthKeysDesc(
    (((data as Array<{ entry_date: string | null }> | null) ?? []))
      .map((row) => getAccountingMonthKey(row.entry_date))
      .filter((value): value is string => Boolean(value)),
  );
}

async function loadAvailableAccountingPeriodCodesFromOpenItems(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("v_open_items_outstanding")
    .select("opening_entry_date")
    .eq("organization_id", organizationId)
    .order("opening_entry_date", { ascending: false })
    .limit(1000);

  if (error) {
    if (isMissingAccountingReadModelRelationError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  return sortAccountingMonthKeysDesc(
    (((data as Array<{ opening_entry_date: string | null }> | null) ?? []))
      .map((row) => getAccountingMonthKey(row.opening_entry_date))
      .filter((value): value is string => Boolean(value)),
  );
}

function resolveSelectedAccountingPeriodCode(
  requestedPeriodCode: string | null | undefined,
  availablePeriodCodes: string[],
) {
  const normalizedRequested = getAccountingMonthKey(requestedPeriodCode);

  if (normalizedRequested) {
    return normalizedRequested;
  }

  return availablePeriodCodes[0] ?? null;
}

export function isMissingAccountingReadModelRelationError(error: SupabaseErrorLike | null | undefined) {
  return ACCOUNTING_READ_MODEL_RELATIONS.some((relationName) =>
    isMissingSupabaseRelationError(error, relationName));
}

export async function loadJournalEntriesWorkspaceData(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    status?: string | null;
    sourceChannel?: string | null;
    fiscalPeriodCode?: string | null;
    journalTypeCode?: string | null;
    searchTerm?: string | null;
  },
): Promise<JournalEntriesWorkspaceData> {
  const availablePeriodCodes = await loadAvailableAccountingPeriodCodesFromEntries(
    supabase,
    input.organizationId,
  );

  if (availablePeriodCodes === null) {
    return {
      isAvailable: false,
      selectedFiscalPeriodCode: null,
      rows: [],
      lineageRows: [],
      summary: {
        totalEntries: 0,
        activeLeafCount: 0,
        immutableCount: 0,
        providerManagedCount: 0,
        reversalCount: 0,
        openItemCount: 0,
        settlementLinkCount: 0,
      },
      filterOptions: buildFilterOptions({ rows: [] }),
    };
  }

  const selectedFiscalPeriodCode = resolveSelectedAccountingPeriodCode(
    input.fiscalPeriodCode ?? null,
    availablePeriodCodes,
  );
  const selectedPeriodRange = buildAccountingMonthRange(selectedFiscalPeriodCode);
  let query = supabase
    .from("v_journal_entries_read")
    .select(JOURNAL_ENTRY_READ_SELECT)
    .eq("organization_id", input.organizationId);

  if (input.status) {
    query = query.eq("status", input.status);
  }

  if (input.sourceChannel) {
    query = query.eq("source_channel", input.sourceChannel);
  }

  if (selectedPeriodRange) {
    query = query
      .gte("entry_date", selectedPeriodRange.startDate)
      .lt("entry_date", selectedPeriodRange.nextStartDate);
  }

  if (input.journalTypeCode) {
    query = query.eq("journal_type_code", input.journalTypeCode);
  }

  const { data, error } = await query
    .order("entry_date", { ascending: false })
    .order("entry_number", { ascending: false })
    .limit(160);

  if (error) {
    if (isMissingAccountingReadModelRelationError(error)) {
      return {
        isAvailable: false,
        selectedFiscalPeriodCode: null,
        rows: [],
        lineageRows: [],
        summary: {
          totalEntries: 0,
          activeLeafCount: 0,
          immutableCount: 0,
          providerManagedCount: 0,
          reversalCount: 0,
          openItemCount: 0,
          settlementLinkCount: 0,
        },
        filterOptions: buildFilterOptions({ rows: [] }),
      };
    }

    throw new Error(error.message);
  }

  const allRows = ((data as unknown as JournalEntryReadRowRaw[] | null) ?? []).map(mapJournalEntryRow);
  const rows = allRows.filter((row) =>
    includesSearch(
      [
        row.entryNumber,
        row.entryDate,
        row.status,
        row.sourceChannel,
        row.reference,
        row.description,
        row.fiscalPeriodCode,
        row.journalTypeCode,
        row.sourceExternalId,
      ],
      input.searchTerm,
    ));

  const entryIds = new Set(rows.map((row) => row.journalEntryId));
  let lineageRows: JournalLineageReadRow[] = [];

  if (entryIds.size > 0) {
    const lineageResult = await supabase
      .from("v_journal_lineage")
      .select(JOURNAL_LINEAGE_SELECT)
      .eq("organization_id", input.organizationId)
      .limit(320);

    if (lineageResult.error) {
      if (!isMissingAccountingReadModelRelationError(lineageResult.error)) {
        throw new Error(lineageResult.error.message);
      }
    } else {
      lineageRows = ((lineageResult.data as unknown as JournalLineageRowRaw[] | null) ?? [])
        .map(mapJournalLineageRow)
        .filter((row) =>
          entryIds.has(row.journalEntryId)
          || entryIds.has(row.relatedJournalEntryId));
    }
  }

  return {
    isAvailable: true,
    selectedFiscalPeriodCode,
    rows,
    lineageRows,
    summary: {
      totalEntries: rows.length,
      activeLeafCount: rows.filter((row) => row.isActiveLeaf).length,
      immutableCount: rows.filter((row) => row.isImmutable).length,
      providerManagedCount: rows.filter((row) => row.providerManaged).length,
      reversalCount: rows.filter((row) => row.lineageKind === "reversal" || row.lineageKind === "adjustment").length,
      openItemCount: rows.reduce((sum, row) => sum + row.openItemCount, 0),
      settlementLinkCount: rows.reduce((sum, row) => sum + row.settlementLinkCount, 0),
    },
    filterOptions: buildFilterOptions({
      rows,
      fiscalPeriodCodes: availablePeriodCodes,
    }),
  };
}

async function loadJournalEntryLineageRows(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    journalEntryIds: string[];
  },
) {
  if (input.journalEntryIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("v_journal_lineage")
    .select(JOURNAL_LINEAGE_SELECT)
    .eq("organization_id", input.organizationId)
    .limit(500);

  if (error) {
    if (isMissingAccountingReadModelRelationError(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  const entryIds = new Set(input.journalEntryIds);

  return ((data as unknown as JournalLineageRowRaw[] | null) ?? [])
    .map(mapJournalLineageRow)
    .filter((row) =>
      entryIds.has(row.journalEntryId)
      || entryIds.has(row.relatedJournalEntryId));
}

async function loadPostingProposalAudit(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    postingProposalId: string | null;
  },
) {
  if (!input.postingProposalId) {
    return null;
  }

  const { data, error } = await supabase
    .from("posting_proposals")
    .select(POSTING_PROPOSAL_AUDIT_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("id", input.postingProposalId)
    .limit(1);

  if (error) {
    if (isMissingSupabaseRelationError(error, "posting_proposals")) {
      return null;
    }

    throw new Error(error.message);
  }

  const row = ((data as unknown as PostingProposalAuditRaw[] | null) ?? [])[0] ?? null;

  return row ? mapPostingProposalAuditRow(row) : null;
}

async function loadSourceEventAudit(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    sourceEventId: string | null;
  },
) {
  if (!input.sourceEventId) {
    return null;
  }

  const { data, error } = await supabase
    .from("source_events")
    .select(SOURCE_EVENT_AUDIT_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("id", input.sourceEventId)
    .limit(1);

  if (error) {
    if (isMissingSupabaseRelationError(error, "source_events")) {
      return null;
    }

    throw new Error(error.message);
  }

  const row = ((data as unknown as SourceEventAuditRaw[] | null) ?? [])[0] ?? null;

  return row ? mapSourceEventAuditRow(row) : null;
}

export async function loadJournalEntryDetail(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    journalEntryId: string;
  },
): Promise<JournalEntryDetail | null> {
  const entryResult = await supabase
    .from("v_journal_entries_read")
    .select(JOURNAL_ENTRY_READ_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("journal_entry_id", input.journalEntryId)
    .limit(1);

  if (entryResult.error) {
    if (isMissingAccountingReadModelRelationError(entryResult.error)) {
      return null;
    }

    throw new Error(entryResult.error.message);
  }

  const entryRaw = ((entryResult.data as unknown as JournalEntryReadRowRaw[] | null) ?? [])[0] ?? null;

  if (!entryRaw) {
    return null;
  }

  const entry = mapJournalEntryRow(entryRaw);
  const runLineQuery = async (selectClause: string) =>
    supabase
      .from("journal_entry_lines")
      .select(selectClause)
      .eq("journal_entry_id", input.journalEntryId)
      .order("line_no", { ascending: true })
      .limit(400);

  let { data: linesData, error: linesError } = await runLineQuery(JOURNAL_ENTRY_DETAIL_LINE_SELECT);

  if (linesError && isMissingJournalEntryLineStep5ColumnError(linesError)) {
    ({ data: linesData, error: linesError } = await runLineQuery(JOURNAL_ENTRY_DETAIL_LINE_SELECT_LEGACY));
  }

  if (linesError) {
    throw new Error(linesError.message);
  }

  const lines = ((linesData as unknown as JournalEntryDetailLineRaw[] | null) ?? [])
    .map((line) => mapJournalEntryDetailLine(line, entry));
  const [lineageRows, proposal, sourceEvent] = await Promise.all([
    loadJournalEntryLineageRows(supabase, {
      organizationId: input.organizationId,
      journalEntryIds: [input.journalEntryId],
    }),
    loadPostingProposalAudit(supabase, {
      organizationId: input.organizationId,
      postingProposalId: entry.postingProposalId,
    }),
    loadSourceEventAudit(supabase, {
      organizationId: input.organizationId,
      sourceEventId: entry.sourceEventId,
    }),
  ]);
  const debit = roundAmount(lines.reduce((sum, line) => sum + line.debit, 0));
  const credit = roundAmount(lines.reduce((sum, line) => sum + line.credit, 0));
  const functionalDebit = roundAmount(lines.reduce((sum, line) => sum + line.functionalDebit, 0));
  const functionalCredit = roundAmount(lines.reduce((sum, line) => sum + line.functionalCredit, 0));

  return {
    isAvailable: true,
    entry,
    lines,
    totals: {
      debit,
      credit,
      imbalance: roundAmount(debit - credit),
      functionalDebit,
      functionalCredit,
      functionalImbalance: roundAmount(functionalDebit - functionalCredit),
      lineCount: lines.length,
    },
    sourceEvent,
    proposal,
    lineageRows,
    adjustment: buildJournalEntryAdjustmentPolicy(entry),
  };
}

export async function loadDocumentJournalAuditState(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
  },
): Promise<DocumentJournalAuditState> {
  const { data, error } = await supabase
    .from("v_journal_entries_read")
    .select(JOURNAL_ENTRY_READ_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("source_document_id", input.documentId)
    .in("status", ["posted", "exported"])
    .order("is_active_leaf", { ascending: false })
    .order("entry_date", { ascending: false })
    .order("entry_number", { ascending: false })
    .limit(1);

  if (error) {
    if (isMissingAccountingReadModelRelationError(error)) {
      return {
        mode: "unavailable",
        documentId: input.documentId,
        detail: null,
        previewReason: "El read model de asientos todavia no esta disponible en esta base.",
      };
    }

    throw new Error(error.message);
  }

  const row = ((data as unknown as JournalEntryReadRowRaw[] | null) ?? [])[0] ?? null;

  if (!row) {
    return {
      mode: "preview",
      documentId: input.documentId,
      detail: null,
      previewReason: "El documento todavia no tiene un asiento materializado; se muestra la propuesta del kernel.",
    };
  }

  const detail = await loadJournalEntryDetail(supabase, {
    organizationId: input.organizationId,
    journalEntryId: row.journal_entry_id,
  });

  if (!detail) {
    return {
      mode: "unavailable",
      documentId: input.documentId,
      detail: null,
      previewReason: "No pudimos cargar el detalle del asiento materializado.",
    };
  }

  return {
    mode: "materialized",
    documentId: input.documentId,
    detail,
    previewReason: null,
  };
}

export async function loadOpenItemsWorkspaceData(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    status?: string | null;
    sourceChannel?: string | null;
    fiscalPeriodCode?: string | null;
    counterpartyType?: string | null;
    searchTerm?: string | null;
    overdueOnly?: boolean;
  },
): Promise<OpenItemsWorkspaceData> {
  const availablePeriodCodes = await loadAvailableAccountingPeriodCodesFromOpenItems(
    supabase,
    input.organizationId,
  );

  if (availablePeriodCodes === null) {
    return {
      isAvailable: false,
      selectedFiscalPeriodCode: null,
      rows: [],
      summary: {
        totalItems: 0,
        outstandingAmount: 0,
        overdueCount: 0,
        foreignCurrencyCount: 0,
        residualCreditCount: 0,
      },
      agingBuckets: [],
      filterOptions: buildFilterOptions({ rows: [] }),
    };
  }

  const selectedFiscalPeriodCode = resolveSelectedAccountingPeriodCode(
    input.fiscalPeriodCode ?? null,
    availablePeriodCodes,
  );
  const selectedPeriodRange = buildAccountingMonthRange(selectedFiscalPeriodCode);
  let query = supabase
    .from("v_open_items_outstanding")
    .select(OPEN_ITEMS_OUTSTANDING_SELECT)
    .eq("organization_id", input.organizationId);

  if (input.status) {
    query = query.eq("status", input.status);
  }

  if (input.sourceChannel) {
    query = query.eq("source_channel", input.sourceChannel);
  }

  if (input.counterpartyType) {
    query = query.eq("counterparty_type", input.counterpartyType);
  }

  if (selectedPeriodRange) {
    query = query
      .gte("opening_entry_date", selectedPeriodRange.startDate)
      .lt("opening_entry_date", selectedPeriodRange.nextStartDate);
  }

  const { data, error } = await query
    .order("due_date", { ascending: true })
    .order("issue_date", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingAccountingReadModelRelationError(error)) {
      return {
        isAvailable: false,
        selectedFiscalPeriodCode: null,
        rows: [],
        summary: {
          totalItems: 0,
          outstandingAmount: 0,
          overdueCount: 0,
          foreignCurrencyCount: 0,
          residualCreditCount: 0,
        },
        agingBuckets: [],
        filterOptions: buildFilterOptions({ rows: [] }),
      };
    }

    throw new Error(error.message);
  }

  const allRows = ((data as unknown as OpenItemOutstandingRowRaw[] | null) ?? []).map(mapOpenItemRow);
  const rows = allRows.filter((row) => {
    if (input.overdueOnly && row.daysOverdue <= 0) {
      return false;
    }

    return includesSearch(
      [
        row.counterpartyName,
        row.counterpartyTaxIdNormalized,
        row.documentType,
        row.documentRole,
        row.sourceChannel,
        row.status,
        row.openingEntryNumber,
      ],
      input.searchTerm,
    );
  });

  const agingBuckets = [
    { label: "Al dia", min: Number.NEGATIVE_INFINITY, max: 0 },
    { label: "1-30", min: 1, max: 30 },
    { label: "31-60", min: 31, max: 60 },
    { label: "61+", min: 61, max: Number.POSITIVE_INFINITY },
  ].map((bucket) => {
    const bucketRows = rows.filter((row) => row.daysOverdue >= bucket.min && row.daysOverdue <= bucket.max);

    return {
      label: bucket.label,
      count: bucketRows.length,
      outstandingAmount: roundAmount(bucketRows.reduce((sum, row) => sum + row.outstandingAmount, 0)),
    };
  });

  return {
    isAvailable: true,
    selectedFiscalPeriodCode,
    rows,
    summary: {
      totalItems: rows.length,
      outstandingAmount: roundAmount(rows.reduce((sum, row) => sum + row.outstandingAmount, 0)),
      overdueCount: rows.filter((row) => row.daysOverdue > 0).length,
      foreignCurrencyCount: rows.filter((row) =>
        row.originalCurrencyCode
        && row.functionalCurrencyCode
        && row.originalCurrencyCode !== row.functionalCurrencyCode).length,
      residualCreditCount: rows.filter((row) => row.isResidualCreditBalance).length,
    },
    agingBuckets,
    filterOptions: buildFilterOptions({
      rows,
      fiscalPeriodCodes: availablePeriodCodes,
    }),
  };
}

async function loadGeneralLedgerRows(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    accountId: string | null;
    fiscalPeriodCode?: string | null;
    sourceChannel?: string | null;
  },
): Promise<GeneralLedgerRow[]> {
  if (!input.accountId) {
    return [];
  }

  const runLineQuery = async (selectClause: string) =>
    supabase
      .from("journal_entry_lines")
      .select(selectClause)
      .eq("account_id", input.accountId)
      .order("line_no", { ascending: true })
      .limit(240);

  let { data, error } = await runLineQuery(GENERAL_LEDGER_LINE_SELECT);

  if (error && isMissingJournalEntryLineStep5ColumnError(error)) {
    ({ data, error } = await runLineQuery(GENERAL_LEDGER_LINE_SELECT_LEGACY));
  }

  if (error) {
    throw new Error(error.message);
  }

  const lines = (data as unknown as GeneralLedgerLineRaw[] | null) ?? [];
  const entryIds = Array.from(new Set(lines.map((line) => line.journal_entry_id)));

  if (entryIds.length === 0) {
    return [];
  }

  let entryQuery = supabase
    .from("v_journal_entries_read")
    .select(JOURNAL_ENTRY_READ_SELECT)
    .eq("organization_id", input.organizationId)
    .in("journal_entry_id", entryIds);

  if (input.fiscalPeriodCode) {
    entryQuery = entryQuery.eq("fiscal_period_code", input.fiscalPeriodCode);
  }

  if (input.sourceChannel) {
    entryQuery = entryQuery.eq("source_channel", input.sourceChannel);
  }

  const entryResult = await entryQuery.limit(240);

  if (entryResult.error) {
    if (isMissingAccountingReadModelRelationError(entryResult.error)) {
      return [];
    }

    throw new Error(entryResult.error.message);
  }

  const entryById = new Map(
    ((entryResult.data as unknown as JournalEntryReadRowRaw[] | null) ?? [])
      .map(mapJournalEntryRow)
      .filter((row) => row.isImmutable && (row.status === "posted" || row.status === "exported"))
      .map((row) => [row.journalEntryId, row]),
  );

  const sortedLines = lines
    .filter((line) => entryById.has(line.journal_entry_id))
    .sort((left, right) => {
      const leftEntry = entryById.get(left.journal_entry_id);
      const rightEntry = entryById.get(right.journal_entry_id);

      return (leftEntry?.entryDate ?? "").localeCompare(rightEntry?.entryDate ?? "")
        || (leftEntry?.entryNumber ?? Number.MAX_SAFE_INTEGER) - (rightEntry?.entryNumber ?? Number.MAX_SAFE_INTEGER)
        || (left.line_no ?? 0) - (right.line_no ?? 0);
    });

  let runningFunctionalBalance = 0;

  return sortedLines.map((line) => {
    const entry = entryById.get(line.journal_entry_id);
    const functionalDebit = roundAmount(line.functional_debit ?? line.debit);
    const functionalCredit = roundAmount(line.functional_credit ?? line.credit);
    runningFunctionalBalance = roundAmount(runningFunctionalBalance + functionalDebit - functionalCredit);

    return {
      journalEntryId: line.journal_entry_id,
      entryNumber: entry?.entryNumber ?? null,
      entryDate: entry?.entryDate ?? null,
      status: entry?.status ?? null,
      sourceChannel: entry?.sourceChannel ?? null,
      reference: entry?.reference ?? null,
      entryDescription: entry?.description ?? null,
      lineNo: line.line_no ?? 0,
      lineDescription: line.description,
      debit: roundAmount(line.debit),
      credit: roundAmount(line.credit),
      debitOriginal: roundAmount(line.debit_original ?? line.debit),
      creditOriginal: roundAmount(line.credit_original ?? line.credit),
      functionalDebit,
      functionalCredit,
      originalCurrencyCode: line.original_currency_code ?? entry?.currencyCode ?? null,
      fxRateApplied: line.fx_rate_applied ?? entry?.fxRate ?? null,
      roleCode: line.role_code ?? null,
      linePurpose: line.line_purpose ?? null,
      runningFunctionalBalance,
    } satisfies GeneralLedgerRow;
  });
}

async function loadTrialBalanceRowsForPeriod(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    fiscalPeriodCode: string | null;
    sourceChannel?: string | null;
    accountType?: string | null;
  },
) {
  const periodRange = buildAccountingMonthRange(input.fiscalPeriodCode);

  if (!periodRange) {
    return [];
  }

  let entryQuery = supabase
    .from("v_journal_entries_read")
    .select(JOURNAL_ENTRY_READ_SELECT)
    .eq("organization_id", input.organizationId)
    .gte("entry_date", periodRange.startDate)
    .lt("entry_date", periodRange.nextStartDate);

  if (input.sourceChannel) {
    entryQuery = entryQuery.eq("source_channel", input.sourceChannel);
  }

  const entryResult = await entryQuery
    .order("entry_date", { ascending: true })
    .limit(2000);

  if (entryResult.error) {
    if (isMissingAccountingReadModelRelationError(entryResult.error)) {
      return [];
    }

    throw new Error(entryResult.error.message);
  }

  const entries = (((entryResult.data as unknown as JournalEntryReadRowRaw[] | null) ?? []))
    .map(mapJournalEntryRow)
    .filter((row) => row.isImmutable && (row.status === "posted" || row.status === "exported"));
  const entryById = new Map(entries.map((row) => [row.journalEntryId, row]));
  const entryIds = entries.map((row) => row.journalEntryId);

  if (entryIds.length === 0) {
    return [];
  }

  const runLineQuery = async (selectClause: string) =>
    supabase
      .from("journal_entry_lines")
      .select(selectClause)
      .in("journal_entry_id", entryIds)
      .order("line_no", { ascending: true })
      .limit(5000);

  let { data, error } = await runLineQuery(TRIAL_BALANCE_LINE_SELECT);

  if (error && isMissingJournalEntryLineStep5ColumnError(error)) {
    ({ data, error } = await runLineQuery(TRIAL_BALANCE_LINE_SELECT_LEGACY));
  }

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<string, {
    organizationId: string;
    fiscalPeriodId: string | null;
    fiscalPeriodCode: string;
    fiscalPeriodLabel: string;
    sourceChannel: string | null;
    accountId: string | null;
    accountCode: string | null;
    accountName: string | null;
    accountType: string | null;
    chapterCode: string | null;
    presentationCode: string | null;
    statementSection: string | null;
    naturalBalance: "debit" | "credit" | null;
    debit: number;
    credit: number;
    functionalDebit: number;
    functionalCredit: number;
    entryIds: Set<string>;
    lineCount: number;
    firstEntryDate: string | null;
    lastEntryDate: string | null;
  }>();

  for (const row of ((data as Array<{
    journal_entry_id: string;
    account_id: string | null;
    line_no: number | null;
    debit: number | null;
    credit: number | null;
    functional_debit?: number | null;
    functional_credit?: number | null;
    chart_of_accounts:
      | {
          id?: string | null;
          code?: string | null;
          name?: string | null;
          account_type?: string | null;
          chapter_code?: string | null;
          presentation_code?: string | null;
          statement_section?: string | null;
          natural_balance?: "debit" | "credit" | null;
          normal_side?: "debit" | "credit" | null;
        }
      | Array<{
          id?: string | null;
          code?: string | null;
          name?: string | null;
          account_type?: string | null;
          chapter_code?: string | null;
          presentation_code?: string | null;
          statement_section?: string | null;
          natural_balance?: "debit" | "credit" | null;
          normal_side?: "debit" | "credit" | null;
        }>
      | null;
  }> | null) ?? [])) {
    const entry = entryById.get(row.journal_entry_id);

    if (!entry) {
      continue;
    }

    const account = Array.isArray(row.chart_of_accounts)
      ? row.chart_of_accounts[0]
      : row.chart_of_accounts;
    const accountType = account?.account_type ?? null;

    if (input.accountType && accountType !== input.accountType) {
      continue;
    }

    const accountId = row.account_id ?? account?.id ?? null;
    const accountCode = account?.code ?? null;
    const sourceChannel = entry.sourceChannel ?? null;
    const key = [
      sourceChannel ?? "no_source",
      accountId ?? accountCode ?? `unknown:${grouped.size}`,
    ].join("::");
    const current = grouped.get(key) ?? {
      organizationId: input.organizationId,
      fiscalPeriodId: entry.fiscalPeriodId ?? null,
      fiscalPeriodCode: periodRange.periodKey,
      fiscalPeriodLabel: `Periodo ${periodRange.periodKey}`,
      sourceChannel,
      accountId,
      accountCode,
      accountName: account?.name ?? null,
      accountType,
      chapterCode: account?.chapter_code ?? null,
      presentationCode: account?.presentation_code ?? null,
      statementSection: account?.statement_section ?? null,
      naturalBalance: account?.natural_balance ?? account?.normal_side ?? null,
      debit: 0,
      credit: 0,
      functionalDebit: 0,
      functionalCredit: 0,
      entryIds: new Set(),
      lineCount: 0,
      firstEntryDate: entry.entryDate,
      lastEntryDate: entry.entryDate,
    };

    current.debit = roundAmount(current.debit + roundAmount(row.debit));
    current.credit = roundAmount(current.credit + roundAmount(row.credit));
    current.functionalDebit = roundAmount(
      current.functionalDebit + roundAmount(row.functional_debit ?? row.debit),
    );
    current.functionalCredit = roundAmount(
      current.functionalCredit + roundAmount(row.functional_credit ?? row.credit),
    );
    current.entryIds.add(entry.journalEntryId);
    current.lineCount += 1;

    if (entry.entryDate && (!current.firstEntryDate || entry.entryDate < current.firstEntryDate)) {
      current.firstEntryDate = entry.entryDate;
    }

    if (entry.entryDate && (!current.lastEntryDate || entry.entryDate > current.lastEntryDate)) {
      current.lastEntryDate = entry.entryDate;
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((row) => ({
      organizationId: row.organizationId,
      fiscalPeriodId: row.fiscalPeriodId,
      fiscalPeriodCode: row.fiscalPeriodCode,
      fiscalPeriodLabel: row.fiscalPeriodLabel,
      sourceChannel: row.sourceChannel,
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountType: row.accountType,
      chapterCode: row.chapterCode,
      presentationCode: row.presentationCode,
      statementSection: row.statementSection,
      naturalBalance: row.naturalBalance,
      debit: row.debit,
      credit: row.credit,
      balance: roundAmount(row.debit - row.credit),
      functionalDebit: row.functionalDebit,
      functionalCredit: row.functionalCredit,
      functionalBalance: roundAmount(row.functionalDebit - row.functionalCredit),
      entryCount: row.entryIds.size,
      lineCount: row.lineCount,
      firstEntryDate: row.firstEntryDate,
      lastEntryDate: row.lastEntryDate,
    } satisfies TrialBalanceReadRow))
    .sort((left, right) =>
      (left.chapterCode ?? "").localeCompare(right.chapterCode ?? "")
      || (left.presentationCode ?? "").localeCompare(right.presentationCode ?? "")
      || (left.accountCode ?? "").localeCompare(right.accountCode ?? ""));
}

export async function loadTrialBalanceWorkspaceData(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    fiscalPeriodCode?: string | null;
    sourceChannel?: string | null;
    accountType?: string | null;
    searchTerm?: string | null;
    selectedAccountId?: string | null;
  },
): Promise<TrialBalanceWorkspaceData> {
  const availablePeriodCodes = await loadAvailableAccountingPeriodCodesFromEntries(
    supabase,
    input.organizationId,
  );

  if (availablePeriodCodes === null) {
    return {
      isAvailable: false,
      selectedFiscalPeriodCode: null,
      rows: [],
      generalLedgerRows: [],
      summary: {
        accountCount: 0,
        debit: 0,
        credit: 0,
        functionalDebit: 0,
        functionalCredit: 0,
        imbalance: 0,
      },
      balanceSheetTotals: [],
      incomeStatementTotals: [],
      filterOptions: buildFilterOptions({ rows: [] }),
    };
  }

  const selectedFiscalPeriodCode = resolveSelectedAccountingPeriodCode(
    input.fiscalPeriodCode ?? null,
    availablePeriodCodes,
  );
  const allRows = await loadTrialBalanceRowsForPeriod(supabase, {
    organizationId: input.organizationId,
    fiscalPeriodCode: selectedFiscalPeriodCode,
    sourceChannel: input.sourceChannel,
    accountType: input.accountType,
  });
  const rows = allRows.filter((row) =>
    includesSearch(
      [
        row.accountCode,
        row.accountName,
        row.accountType,
        row.sourceChannel,
        row.fiscalPeriodCode,
      ],
      input.searchTerm,
    ));
  const selectedAccountId = rows.some((row) => row.accountId === input.selectedAccountId)
    ? input.selectedAccountId ?? null
    : (rows[0]?.accountId ?? null);
  const generalLedgerRows = await loadGeneralLedgerRows(supabase, {
    organizationId: input.organizationId,
    accountId: selectedAccountId,
    fiscalPeriodCode: selectedFiscalPeriodCode,
    sourceChannel: input.sourceChannel,
  });
  const statementRows: StatementReadInputRow[] = rows.map((row) => ({
    organizationId: row.organizationId,
    fiscalPeriodId: row.fiscalPeriodId,
    fiscalPeriodCode: row.fiscalPeriodCode,
    accountId: row.accountId,
    accountCode: row.accountCode,
    accountName: row.accountName,
    accountType: row.accountType,
    chapterCode: row.chapterCode,
    presentationCode: row.presentationCode,
    statementSection: row.statementSection,
    naturalBalance: row.naturalBalance,
    debit: row.debit,
    credit: row.credit,
    functionalDebit: row.functionalDebit,
    functionalCredit: row.functionalCredit,
    balance: row.balance,
    functionalBalance: row.functionalBalance,
  }));

  return {
    isAvailable: true,
    selectedFiscalPeriodCode,
    rows,
    generalLedgerRows,
    summary: {
      accountCount: rows.length,
      debit: roundAmount(rows.reduce((sum, row) => sum + row.debit, 0)),
      credit: roundAmount(rows.reduce((sum, row) => sum + row.credit, 0)),
      functionalDebit: roundAmount(rows.reduce((sum, row) => sum + row.functionalDebit, 0)),
      functionalCredit: roundAmount(rows.reduce((sum, row) => sum + row.functionalCredit, 0)),
      imbalance: roundAmount(rows.reduce((sum, row) => sum + row.functionalDebit - row.functionalCredit, 0)),
    },
    balanceSheetTotals: buildStatementTotals(statementRows, "balance"),
    incomeStatementTotals: buildStatementTotals(statementRows, "income"),
    filterOptions: buildFilterOptions({
      rows,
      fiscalPeriodCodes: availablePeriodCodes,
    }),
  };
}
