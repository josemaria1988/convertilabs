import { isMissingSupabaseColumnError } from "@/lib/supabase/schema-compat";

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

const documentStep5Patterns = [
  /posting_status/i,
  /vat_ready_at/i,
  /posted_provisional_at/i,
  /posted_final_at/i,
  /original_currency_code/i,
  /original_subtotal_amount/i,
  /original_tax_amount/i,
  /original_total_amount/i,
  /functional_currency_code/i,
  /functional_subtotal_uyu/i,
  /functional_tax_amount_uyu/i,
  /functional_total_amount_uyu/i,
  /fx_rate_policy_code/i,
  /fx_rate_bcu_value/i,
  /fx_rate_bcu_date_used/i,
  /fx_rate_bcu_series/i,
  /fx_rate_document_value/i,
  /fx_rate_document_date/i,
  /fx_rate_source/i,
  /fx_rate_override_reason/i,
  /issuer_address_raw/i,
  /issuer_department/i,
  /issuer_city/i,
  /issuer_branch_code/i,
  /location_extraction_confidence/i,
  /location_signal_code/i,
  /location_signal_severity/i,
  /location_signal_payload/i,
  /requires_business_purpose_review/i,
  /business_purpose_note/i,
  /suggested_expense_family/i,
  /suggested_tax_profile_code/i,
  /vat_credit_category/i,
  /vat_deductibility_status/i,
  /vat_direct_tax_amount_uyu/i,
  /vat_indirect_tax_amount_uyu/i,
  /vat_deductible_tax_amount_uyu/i,
  /vat_nondeductible_tax_amount_uyu/i,
  /vat_proration_coefficient/i,
  /business_link_status/i,
  /dgi_reconciliation_status/i,
  /party_id/i,
  /vendor_party_id/i,
  /customer_party_id/i,
  /work_unit_id/i,
];

const journalEntryStep5Patterns = [
  /posting_mode/i,
  /functional_currency/i,
  /source_currency_present/i,
  /fx_rate_bcu_value/i,
  /fx_rate_bcu_date_used/i,
  /fiscal_period_id/i,
  /journal_type_id/i,
  /auxiliary_book_id/i,
  /source_channel/i,
  /source_system/i,
  /source_event_id/i,
  /posting_proposal_id/i,
  /accounting_snapshot_id/i,
  /provider_connection_id/i,
  /provider_managed/i,
  /source_provider/i,
  /source_hash/i,
  /economic_hash/i,
  /entry_number/i,
  /first_seen_at/i,
  /last_seen_at/i,
  /immutable_at/i,
  /legacy_immutable/i,
  /reverses_journal_entry_id/i,
  /reversed_by_journal_entry_id/i,
  /adjusts_journal_entry_id/i,
  /annulment_reason/i,
];

const journalLineStep5Patterns = [
  /original_currency_code/i,
  /original_amount/i,
  /fx_rate_applied/i,
  /functional_amount_uyu/i,
  /party_id/i,
  /tax_code_id/i,
  /debit_original/i,
  /credit_original/i,
  /functional_currency_code/i,
  /role_code/i,
  /line_purpose/i,
  /tax_component/i,
  /settlement_component/i,
  /source_ref_json/i,
  /source_hash/i,
  /provider_managed/i,
];

export function isMissingDocumentStep5ColumnError(
  error: SupabaseErrorLike | null | undefined,
) {
  const text = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ].filter(hasText).join(" ");

  return isMissingSupabaseColumnError(error, "documents")
    && matchesAny(text, documentStep5Patterns);
}

export function isMissingJournalEntryStep5ColumnError(
  error: SupabaseErrorLike | null | undefined,
) {
  const text = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ].filter(hasText).join(" ");

  return isMissingSupabaseColumnError(error, "journal_entries")
    && matchesAny(text, journalEntryStep5Patterns);
}

export function isMissingJournalEntryLineStep5ColumnError(
  error: SupabaseErrorLike | null | undefined,
) {
  const text = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ].filter(hasText).join(" ");

  return isMissingSupabaseColumnError(error, "journal_entry_lines")
    && matchesAny(text, journalLineStep5Patterns);
}

export function omitDocumentStep5Columns<T extends Record<string, unknown>>(
  payload: T,
) {
  const clone = { ...payload } as Record<string, unknown>;

  delete clone.posting_status;
  delete clone.vat_ready_at;
  delete clone.posted_provisional_at;
  delete clone.posted_final_at;
  delete clone.original_currency_code;
  delete clone.original_subtotal_amount;
  delete clone.original_tax_amount;
  delete clone.original_total_amount;
  delete clone.functional_currency_code;
  delete clone.functional_subtotal_uyu;
  delete clone.functional_tax_amount_uyu;
  delete clone.functional_total_amount_uyu;
  delete clone.fx_rate_policy_code;
  delete clone.fx_rate_bcu_value;
  delete clone.fx_rate_bcu_date_used;
  delete clone.fx_rate_bcu_series;
  delete clone.fx_rate_document_value;
  delete clone.fx_rate_document_date;
  delete clone.fx_rate_source;
  delete clone.fx_rate_override_reason;
  delete clone.issuer_address_raw;
  delete clone.issuer_department;
  delete clone.issuer_city;
  delete clone.issuer_branch_code;
  delete clone.location_extraction_confidence;
  delete clone.location_signal_code;
  delete clone.location_signal_severity;
  delete clone.location_signal_payload;
  delete clone.requires_business_purpose_review;
  delete clone.business_purpose_note;
  delete clone.suggested_expense_family;
  delete clone.suggested_tax_profile_code;
  delete clone.vat_credit_category;
  delete clone.vat_deductibility_status;
  delete clone.vat_direct_tax_amount_uyu;
  delete clone.vat_indirect_tax_amount_uyu;
  delete clone.vat_deductible_tax_amount_uyu;
  delete clone.vat_nondeductible_tax_amount_uyu;
  delete clone.vat_proration_coefficient;
  delete clone.business_link_status;
  delete clone.dgi_reconciliation_status;

  return clone as Omit<
    T,
    | "posting_status"
    | "vat_ready_at"
    | "posted_provisional_at"
    | "posted_final_at"
    | "original_currency_code"
    | "original_subtotal_amount"
    | "original_tax_amount"
    | "original_total_amount"
    | "functional_currency_code"
    | "functional_subtotal_uyu"
    | "functional_tax_amount_uyu"
    | "functional_total_amount_uyu"
    | "fx_rate_policy_code"
    | "fx_rate_bcu_value"
    | "fx_rate_bcu_date_used"
    | "fx_rate_bcu_series"
    | "fx_rate_document_value"
    | "fx_rate_document_date"
    | "fx_rate_source"
    | "fx_rate_override_reason"
    | "issuer_address_raw"
    | "issuer_department"
    | "issuer_city"
    | "issuer_branch_code"
    | "location_extraction_confidence"
    | "location_signal_code"
    | "location_signal_severity"
    | "location_signal_payload"
    | "requires_business_purpose_review"
    | "business_purpose_note"
    | "suggested_expense_family"
    | "suggested_tax_profile_code"
    | "vat_credit_category"
    | "vat_deductibility_status"
    | "vat_direct_tax_amount_uyu"
    | "vat_indirect_tax_amount_uyu"
    | "vat_deductible_tax_amount_uyu"
    | "vat_nondeductible_tax_amount_uyu"
    | "vat_proration_coefficient"
    | "business_link_status"
    | "dgi_reconciliation_status"
  >;
}

export function omitJournalEntryStep5Columns<T extends Record<string, unknown>>(
  payload: T,
) {
  const clone = { ...payload } as Record<string, unknown>;

  delete clone.posting_mode;
  delete clone.functional_currency;
  delete clone.source_currency_present;
  delete clone.fx_rate_bcu_value;
  delete clone.fx_rate_bcu_date_used;
  delete clone.fiscal_period_id;
  delete clone.journal_type_id;
  delete clone.auxiliary_book_id;
  delete clone.source_channel;
  delete clone.source_system;
  delete clone.source_event_id;
  delete clone.posting_proposal_id;
  delete clone.accounting_snapshot_id;
  delete clone.provider_connection_id;
  delete clone.provider_managed;
  delete clone.source_provider;
  delete clone.source_hash;
  delete clone.economic_hash;
  delete clone.entry_number;
  delete clone.first_seen_at;
  delete clone.last_seen_at;
  delete clone.immutable_at;
  delete clone.legacy_immutable;
  delete clone.reverses_journal_entry_id;
  delete clone.reversed_by_journal_entry_id;
  delete clone.adjusts_journal_entry_id;
  delete clone.annulment_reason;

  return clone as Omit<
    T,
    | "posting_mode"
    | "functional_currency"
    | "source_currency_present"
    | "fx_rate_bcu_value"
    | "fx_rate_bcu_date_used"
    | "fiscal_period_id"
    | "journal_type_id"
    | "auxiliary_book_id"
    | "source_channel"
    | "source_system"
    | "source_event_id"
    | "posting_proposal_id"
    | "accounting_snapshot_id"
    | "provider_connection_id"
    | "provider_managed"
    | "source_provider"
    | "source_hash"
    | "economic_hash"
    | "entry_number"
    | "first_seen_at"
    | "last_seen_at"
    | "immutable_at"
    | "legacy_immutable"
    | "reverses_journal_entry_id"
    | "reversed_by_journal_entry_id"
    | "adjusts_journal_entry_id"
    | "annulment_reason"
  >;
}

export function omitJournalEntryLineStep5Columns<T extends Record<string, unknown>>(
  payload: T,
) {
  const clone = { ...payload } as Record<string, unknown>;

  delete clone.original_currency_code;
  delete clone.original_amount;
  delete clone.fx_rate_applied;
  delete clone.functional_amount_uyu;
  delete clone.party_id;
  delete clone.tax_code_id;
  delete clone.debit_original;
  delete clone.credit_original;
  delete clone.functional_currency_code;
  delete clone.role_code;
  delete clone.line_purpose;
  delete clone.tax_component;
  delete clone.settlement_component;
  delete clone.source_ref_json;
  delete clone.source_hash;
  delete clone.provider_managed;

  return clone as Omit<
    T,
    | "original_currency_code"
    | "original_amount"
    | "fx_rate_applied"
    | "functional_amount_uyu"
    | "party_id"
    | "tax_code_id"
    | "debit_original"
    | "credit_original"
    | "functional_currency_code"
    | "role_code"
    | "line_purpose"
    | "tax_component"
    | "settlement_component"
    | "source_ref_json"
    | "source_hash"
    | "provider_managed"
  >;
}
