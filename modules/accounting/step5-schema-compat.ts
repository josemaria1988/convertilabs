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
  /fx_rate_policy_code/i,
  /fx_rate_bcu_value/i,
  /fx_rate_bcu_date_used/i,
  /fx_rate_bcu_series/i,
  /fx_rate_document_value/i,
  /fx_rate_document_date/i,
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
];

const journalEntryStep5Patterns = [
  /posting_mode/i,
  /functional_currency/i,
  /source_currency_present/i,
  /fx_rate_bcu_value/i,
  /fx_rate_bcu_date_used/i,
];

const journalLineStep5Patterns = [
  /original_currency_code/i,
  /original_amount/i,
  /fx_rate_applied/i,
  /functional_amount_uyu/i,
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

  return clone as Omit<
    T,
    | "posting_mode"
    | "functional_currency"
    | "source_currency_present"
    | "fx_rate_bcu_value"
    | "fx_rate_bcu_date_used"
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

  return clone as Omit<
    T,
    "original_currency_code" | "original_amount" | "fx_rate_applied" | "functional_amount_uyu"
  >;
}
