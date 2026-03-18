import { createHash } from "node:crypto";
import { roundCurrency } from "@/modules/accounting/normalization";
import type {
  AccountingArtifactsPersistenceInput,
  AccountingSourceChannel,
  JsonRecord,
  TrialBalanceRow,
} from "@/modules/accounting/types";

type ReversibleJournalEntryHeader = {
  organization_id: string;
  source_document_id?: string | null;
  source_suggestion_id?: string | null;
  fiscal_period_id?: string | null;
  journal_type_id?: string | null;
  auxiliary_book_id?: string | null;
  source_channel?: string | null;
  source_system?: string | null;
  source_event_id?: string | null;
  posting_proposal_id?: string | null;
  accounting_snapshot_id?: string | null;
  posting_mode?: string | null;
  currency_code?: string | null;
  fx_rate?: number | null;
  fx_rate_date?: string | null;
  fx_rate_source?: string | null;
  fx_rate_bcu_value?: number | null;
  fx_rate_bcu_date_used?: string | null;
  functional_currency_code?: string | null;
  functional_currency?: string | null;
  reference?: string | null;
  description?: string | null;
  entry_date?: string | null;
};

type ReversibleJournalEntryLine = {
  line_no: number;
  account_id: string | null;
  debit: number;
  credit: number;
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
  party_id?: string | null;
  tax_code_id?: string | null;
  vendor_id?: string | null;
  customer_id?: string | null;
  description?: string | null;
  role_code?: string | null;
  line_purpose?: string | null;
  tax_component?: string | null;
  settlement_component?: string | null;
  source_ref_json?: JsonRecord | null;
  source_hash?: string | null;
  provider_managed?: boolean | null;
  metadata?: JsonRecord | null;
};

type TrialBalanceInputLine = {
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  debit: number;
  credit: number;
  functionalDebit?: number | null;
  functionalCredit?: number | null;
};

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeysDeep(entry));
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

export function stableSerialize(value: unknown) {
  return JSON.stringify(sortKeysDeep(value));
}

export function computeKernelHash(value: unknown) {
  return createHash("sha256")
    .update(stableSerialize(value))
    .digest("hex");
}

export function buildSourceEventPayload(input: AccountingArtifactsPersistenceInput) {
  const binaryHash = input.fileHash?.trim() || computeKernelHash({
    documentId: input.documentId,
    draftId: input.draftId,
    originalFilename: input.originalFilename,
  });
  const payloadHash = computeKernelHash({
    documentId: input.documentId,
    revisionNumber: input.revisionNumber,
    facts: input.facts,
    amountBreakdown: input.amountBreakdown,
    lineItems: input.lineItems,
  });

  return {
    source_channel: "documents" satisfies AccountingSourceChannel,
    source_entity_type: "document",
    source_entity_id: input.documentId,
    source_external_id: input.reference,
    source_document_id: input.documentId,
    binary_hash: binaryHash,
    payload_hash: payloadHash,
    source_ref_json: {
      document_id: input.documentId,
      draft_id: input.draftId,
      revision_number: input.revisionNumber,
      document_role: input.documentRole,
      document_type: input.documentType,
      reference: input.reference,
      original_filename: input.originalFilename,
    },
    metadata_json: {
      source_channel: "documents",
      source: "document_review_confirmation",
      rule_snapshot_id: input.ruleSnapshotId,
    },
  };
}

export function buildEconomicEventHash(input: AccountingArtifactsPersistenceInput) {
  return computeKernelHash({
    document_role: input.documentRole,
    document_type: input.documentType,
    facts: {
      issuer_tax_id: input.facts.issuer_tax_id,
      receiver_tax_id: input.facts.receiver_tax_id,
      document_number: input.facts.document_number,
      series: input.facts.series,
      currency_code: input.facts.currency_code,
      document_date: input.facts.document_date,
      due_date: input.facts.due_date,
      subtotal: roundCurrency(input.facts.subtotal ?? 0),
      tax_amount: roundCurrency(input.facts.tax_amount ?? 0),
      total_amount: roundCurrency(input.facts.total_amount ?? 0),
      purchase_category_candidate: input.facts.purchase_category_candidate,
      sale_category_candidate: input.facts.sale_category_candidate,
    },
    amount_breakdown: input.amountBreakdown.map((entry) => ({
      label: entry.label,
      amount: roundCurrency(entry.amount ?? 0),
      tax_rate: entry.tax_rate ?? null,
      tax_code: entry.tax_code ?? null,
    })),
    line_items: input.lineItems.map((entry) => ({
      line_number: entry.line_number ?? null,
      concept_code: entry.concept_code ?? null,
      concept_description: entry.concept_description ?? null,
      quantity: entry.quantity ?? null,
      unit_amount: roundCurrency(entry.unit_amount ?? 0),
      net_amount: roundCurrency(entry.net_amount ?? 0),
      tax_rate: entry.tax_rate ?? null,
      tax_amount: roundCurrency(entry.tax_amount ?? 0),
      total_amount: roundCurrency(entry.total_amount ?? 0),
    })),
    settlement_context: {
      operation_kind: input.derived.settlementContext.operationKind,
      payment_terms: input.derived.settlementContext.paymentTerms,
      settlement_method: input.derived.settlementContext.settlementMethod,
      settlement_status: input.derived.settlementContext.settlementStatus,
      settlement_allocations: input.derived.settlementContext.settlementAllocations.map((entry) => ({
        method: entry.method,
        amount: roundCurrency(entry.amount),
      })),
      counterparty_role: input.derived.settlementContext.counterpartyRole,
      open_item_kind: input.derived.settlementContext.openItemKind,
      requires_followup_settlement: input.derived.settlementContext.requiresFollowupSettlement,
    },
  });
}

export function buildSourceEventFactsPayload(input: AccountingArtifactsPersistenceInput) {
  const sourceEventPayload = buildSourceEventPayload(input);

  return {
    source_document_id: input.documentId,
    draft_id: input.draftId,
    version_no: input.revisionNumber,
    facts_json: {
      ...input.facts,
      document_role: input.documentRole,
      document_type: input.documentType,
      reference: input.reference,
    },
    amount_breakdown_json: input.amountBreakdown,
    line_items_json: input.lineItems,
    payload_hash: computeKernelHash({
      facts: input.facts,
      amountBreakdown: input.amountBreakdown,
      lineItems: input.lineItems,
      revisionNumber: input.revisionNumber,
    }),
    economic_hash: buildEconomicEventHash(input),
    source_binary_hash: sourceEventPayload.binary_hash,
  };
}

export function buildPostingProposalPayload(input: {
  artifacts: AccountingArtifactsPersistenceInput;
  accountingSnapshotId: string | null;
  accountingSnapshotFingerprint: string | null;
  sourceEventFactsVersionNo: number;
  proposalVersionNo: number;
  economicHash: string;
  postingHash: string;
}) {
  const { artifacts } = input;

  return {
    source_event_facts_version_no: input.sourceEventFactsVersionNo,
    accounting_snapshot_id: input.accountingSnapshotId,
    accounting_snapshot_fingerprint: input.accountingSnapshotFingerprint,
    proposal_version_no: input.proposalVersionNo,
    status: "confirmed",
    posting_mode: artifacts.derived.journalSuggestion.postingMode,
    proposal_hash: input.postingHash,
    economic_hash: input.economicHash,
    confirmability_status: "confirmable",
    explanation: artifacts.derived.journalSuggestion.explanation,
    journal_preview_json: {
      journal_suggestion: artifacts.derived.journalSuggestion,
      tax_treatment: artifacts.derived.taxTreatment,
      settlement_context: artifacts.derived.settlementContext,
    },
    warnings_json: artifacts.derived.assistantSuggestion.reviewFlags,
    blockers_json: artifacts.derived.validation.blockers,
    metadata_json: {
      confidence: artifacts.confidence,
      template_code: artifacts.derived.journalSuggestion.templateCode,
      tax_profile_code:
        artifacts.derived.journalSuggestion.taxProfileCode
        ?? artifacts.derived.appliedRule.taxProfileCode
        ?? null,
      operation_kind: artifacts.derived.settlementContext.operationKind,
      payment_terms: artifacts.derived.settlementContext.paymentTerms,
      settlement_method: artifacts.derived.settlementContext.settlementMethod,
      requires_followup_settlement: artifacts.derived.settlementContext.requiresFollowupSettlement,
      economic_hash: input.economicHash,
      posting_hash: input.postingHash,
      accounting_snapshot_fingerprint: input.accountingSnapshotFingerprint,
    },
  };
}

export function buildPostingProposalLinePayloads(input: AccountingArtifactsPersistenceInput) {
  return input.derived.journalSuggestion.lines.map((line) => ({
    line_no: line.lineNumber,
    account_id: line.accountId,
    side: line.debit > 0 ? "debit" : "credit",
    debit: roundCurrency(line.debit),
    credit: roundCurrency(line.credit),
    original_currency_code: line.currencyCode,
    debit_original: roundCurrency(line.debit),
    credit_original: roundCurrency(line.credit),
    functional_currency_code: input.derived.journalSuggestion.functionalCurrencyCode,
    functional_debit: roundCurrency(line.functionalDebit),
    functional_credit: roundCurrency(line.functionalCredit),
    fx_rate_applied: line.fxRate,
    tax_tag: line.taxTag,
    role_code: line.roleCode,
    line_purpose: line.linePurpose,
    tax_component: line.taxComponent,
    settlement_component: line.settlementComponent,
    source_ref_json: {
      provenance: line.provenance,
      account_code: line.accountCode,
      account_name: line.accountName,
    },
    metadata_json: {
      is_provisional: line.isProvisional,
    },
  }));
}

export function buildJournalPostingHash(input: AccountingArtifactsPersistenceInput) {
  return computeKernelHash({
    postingMode: input.derived.journalSuggestion.postingMode,
    entryDate: input.documentDate,
    currencyCode: input.currencyCode ?? "UYU",
    functionalCurrencyCode: input.derived.journalSuggestion.functionalCurrencyCode,
    fxRate: input.derived.journalSuggestion.fxRate,
    settlementContext: {
      operationKind: input.derived.settlementContext.operationKind,
      paymentTerms: input.derived.settlementContext.paymentTerms,
      settlementMethod: input.derived.settlementContext.settlementMethod,
      settlementStatus: input.derived.settlementContext.settlementStatus,
    },
    journalLines: input.derived.journalSuggestion.lines.map((line) => ({
      lineNumber: line.lineNumber,
      accountId: line.accountId,
      accountCode: line.accountCode,
      debit: roundCurrency(line.debit),
      credit: roundCurrency(line.credit),
      functionalDebit: roundCurrency(line.functionalDebit),
      functionalCredit: roundCurrency(line.functionalCredit),
      currencyCode: line.currencyCode,
      fxRate: line.fxRate,
      taxTag: line.taxTag,
      roleCode: line.roleCode,
      linePurpose: line.linePurpose,
      taxComponent: line.taxComponent,
      settlementComponent: line.settlementComponent,
    })),
  });
}

export function buildJournalEntrySourceHash(input: AccountingArtifactsPersistenceInput) {
  return buildJournalPostingHash(input);
}

export function buildReversalJournalEntry(input: {
  header: ReversibleJournalEntryHeader;
  lines: ReversibleJournalEntryLine[];
  originalJournalEntryId: string;
  actorId: string | null;
}) {
  const reversedLines = input.lines.map((line) => ({
    line_no: line.line_no,
    account_id: line.account_id,
    debit: roundCurrency(line.credit),
    credit: roundCurrency(line.debit),
    currency_code: line.currency_code ?? line.original_currency_code ?? "UYU",
    original_currency_code: line.original_currency_code ?? line.currency_code ?? "UYU",
    original_amount: roundCurrency(
      (line.credit_original ?? 0) > 0
        ? line.credit_original ?? 0
        : line.debit_original ?? line.original_amount ?? 0,
    ),
    debit_original: roundCurrency(line.credit_original ?? 0),
    credit_original: roundCurrency(line.debit_original ?? 0),
    fx_rate: line.fx_rate ?? line.fx_rate_applied ?? 1,
    fx_rate_applied: line.fx_rate_applied ?? line.fx_rate ?? 1,
    functional_debit: roundCurrency(line.functional_credit ?? 0),
    functional_credit: roundCurrency(line.functional_debit ?? 0),
    functional_amount_uyu: roundCurrency(
      (line.functional_credit ?? 0) > 0
        ? line.functional_credit ?? 0
        : line.functional_debit ?? 0,
    ),
    functional_currency_code:
      line.functional_currency_code
      ?? input.header.functional_currency_code
      ?? input.header.functional_currency
      ?? "UYU",
    tax_tag: line.tax_tag ?? null,
    party_id: line.party_id ?? null,
    tax_code_id: line.tax_code_id ?? null,
    vendor_id: line.vendor_id ?? null,
    customer_id: line.customer_id ?? null,
    description: line.description ?? null,
    role_code: line.role_code ?? null,
    line_purpose: line.line_purpose ?? null,
    tax_component: line.tax_component ?? null,
    settlement_component: line.settlement_component ?? null,
    source_ref_json: {
      ...(line.source_ref_json ?? {}),
      reversal_of_journal_entry_id: input.originalJournalEntryId,
      reversal_of_line_no: line.line_no,
    },
    source_hash: computeKernelHash({
      reversal_of_journal_entry_id: input.originalJournalEntryId,
      reversal_of_line_no: line.line_no,
      account_id: line.account_id,
      debit: line.credit,
      credit: line.debit,
    }),
    provider_managed: line.provider_managed ?? false,
    metadata: {
      ...(line.metadata ?? {}),
      reversal_of_journal_entry_id: input.originalJournalEntryId,
      reversal_of_line_no: line.line_no,
    },
  }));

  const totalDebit = reversedLines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = reversedLines.reduce((sum, line) => sum + line.credit, 0);
  const functionalTotalDebit = reversedLines.reduce((sum, line) => sum + line.functional_debit, 0);
  const functionalTotalCredit = reversedLines.reduce((sum, line) => sum + line.functional_credit, 0);

  return {
    header: {
      organization_id: input.header.organization_id,
      source_document_id: input.header.source_document_id ?? null,
      source_suggestion_id: input.header.source_suggestion_id ?? null,
      fiscal_period_id: input.header.fiscal_period_id ?? null,
      journal_type_id: input.header.journal_type_id ?? null,
      auxiliary_book_id: input.header.auxiliary_book_id ?? null,
      source_channel: input.header.source_channel ?? "documents",
      source_system: input.header.source_system ?? "convertilabs",
      source_event_id: input.header.source_event_id ?? null,
      posting_proposal_id: input.header.posting_proposal_id ?? null,
      accounting_snapshot_id: input.header.accounting_snapshot_id ?? null,
      entry_date: input.header.entry_date ?? new Date().toISOString().slice(0, 10),
      status: "posted",
      posting_mode: input.header.posting_mode ?? "final",
      currency_code: input.header.currency_code ?? "UYU",
      fx_rate: input.header.fx_rate ?? 1,
      fx_rate_date: input.header.fx_rate_date ?? null,
      fx_rate_source: input.header.fx_rate_source ?? "reversal",
      fx_rate_bcu_value: input.header.fx_rate_bcu_value ?? null,
      fx_rate_bcu_date_used: input.header.fx_rate_bcu_date_used ?? null,
      functional_currency_code:
        input.header.functional_currency_code
        ?? input.header.functional_currency
        ?? "UYU",
      functional_currency:
        input.header.functional_currency
        ?? input.header.functional_currency_code
        ?? "UYU",
      source_currency_present: input.header.currency_code !== input.header.functional_currency_code,
      reference: input.header.reference
        ? `REV-${input.header.reference}`
        : `REV-${input.originalJournalEntryId}`,
      description: input.header.description
        ? `Reversion automatica de ${input.header.description}`
        : `Reversion automatica del asiento ${input.originalJournalEntryId}`,
      total_debit: roundCurrency(totalDebit),
      total_credit: roundCurrency(totalCredit),
      functional_total_debit: roundCurrency(functionalTotalDebit),
      functional_total_credit: roundCurrency(functionalTotalCredit),
      created_by: input.actorId,
      immutable_at: new Date().toISOString(),
      reverses_journal_entry_id: input.originalJournalEntryId,
      source_hash: computeKernelHash({
        reversal_of_journal_entry_id: input.originalJournalEntryId,
        lines: reversedLines.map((line) => ({
          line_no: line.line_no,
          account_id: line.account_id,
          debit: line.debit,
          credit: line.credit,
        })),
      }),
      economic_hash: computeKernelHash({
        reversal_of_journal_entry_id: input.originalJournalEntryId,
        lines: reversedLines.map((line) => ({
          line_no: line.line_no,
          account_id: line.account_id,
          debit: line.debit,
          credit: line.credit,
        })),
      }),
      legacy_immutable: false,
    },
    lines: reversedLines,
  };
}

export function buildTrialBalance(lines: TrialBalanceInputLine[]) {
  const grouped = new Map<string, TrialBalanceRow>();

  for (const line of lines) {
    const key = line.accountId ?? line.accountCode ?? `unknown:${grouped.size}`;
    const current = grouped.get(key) ?? {
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      debit: 0,
      credit: 0,
      balance: 0,
      functionalDebit: 0,
      functionalCredit: 0,
      functionalBalance: 0,
    };

    current.debit = roundCurrency(current.debit + roundCurrency(line.debit));
    current.credit = roundCurrency(current.credit + roundCurrency(line.credit));
    current.balance = roundCurrency(current.debit - current.credit);
    current.functionalDebit = roundCurrency(
      current.functionalDebit + roundCurrency(line.functionalDebit ?? line.debit),
    );
    current.functionalCredit = roundCurrency(
      current.functionalCredit + roundCurrency(line.functionalCredit ?? line.credit),
    );
    current.functionalBalance = roundCurrency(current.functionalDebit - current.functionalCredit);

    grouped.set(key, current);
  }

  return [...grouped.values()].sort((left, right) =>
    (left.accountCode ?? left.accountId ?? "").localeCompare(right.accountCode ?? right.accountId ?? ""));
}
