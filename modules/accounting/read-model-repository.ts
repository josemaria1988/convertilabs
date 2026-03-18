import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { roundCurrency } from "@/modules/accounting/normalization";
import {
  buildAccountingMonthRange,
  getAccountingMonthKey,
  sortAccountingMonthKeysDesc,
} from "@/modules/accounting/periods";
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

type TrialBalanceRowRaw = {
  organization_id: string;
  fiscal_period_id: string | null;
  fiscal_period_code: string | null;
  fiscal_period_label: string | null;
  source_channel: string | null;
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  account_type: string | null;
  chapter_code: string | null;
  presentation_code: string | null;
  statement_section: string | null;
  natural_balance: "debit" | "credit" | null;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  functional_debit: number | null;
  functional_credit: number | null;
  functional_balance: number | null;
  entry_count: number | null;
  line_count: number | null;
  first_entry_date: string | null;
  last_entry_date: string | null;
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

export type OpenItemOutstandingRow = {
  organizationId: string;
  openItemId: string;
  partyId: string | null;
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

const TRIAL_BALANCE_SELECT = [
  "organization_id",
  "fiscal_period_id",
  "fiscal_period_code",
  "fiscal_period_label",
  "source_channel",
  "account_id",
  "account_code",
  "account_name",
  "account_type",
  "chapter_code",
  "presentation_code",
  "statement_section",
  "natural_balance",
  "debit",
  "credit",
  "balance",
  "functional_debit",
  "functional_credit",
  "functional_balance",
  "entry_count",
  "line_count",
  "first_entry_date",
  "last_entry_date",
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

function mapOpenItemRow(row: OpenItemOutstandingRowRaw): OpenItemOutstandingRow {
  return {
    organizationId: row.organization_id,
    openItemId: row.open_item_id,
    partyId: row.party_id,
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

function mapTrialBalanceRow(row: TrialBalanceRowRaw): TrialBalanceReadRow {
  return {
    organizationId: row.organization_id,
    fiscalPeriodId: row.fiscal_period_id,
    fiscalPeriodCode: row.fiscal_period_code,
    fiscalPeriodLabel: row.fiscal_period_label,
    sourceChannel: row.source_channel,
    accountId: row.account_id,
    accountCode: row.account_code,
    accountName: row.account_name,
    accountType: row.account_type,
    chapterCode: row.chapter_code,
    presentationCode: row.presentation_code,
    statementSection: row.statement_section,
    naturalBalance: row.natural_balance,
    debit: roundAmount(row.debit),
    credit: roundAmount(row.credit),
    balance: roundAmount(row.balance),
    functionalDebit: roundAmount(row.functional_debit),
    functionalCredit: roundAmount(row.functional_credit),
    functionalBalance: roundAmount(row.functional_balance),
    entryCount: row.entry_count ?? 0,
    lineCount: row.line_count ?? 0,
    firstEntryDate: row.first_entry_date,
    lastEntryDate: row.last_entry_date,
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
