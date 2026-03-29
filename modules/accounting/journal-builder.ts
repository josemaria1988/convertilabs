import { roundCurrency } from "@/modules/accounting/normalization";
import type {
  AccountRoleCode,
  OperationKind,
  PaymentTerms,
  PostableAccountRecord,
  ReviewJournalLine,
  ReviewJournalSuggestion,
  SettlementMethod,
  SettlementStatus,
} from "@/modules/accounting/types";

export type JournalMonetaryContext = {
  currencyCode: string;
  functionalCurrencyCode: string;
  fxRate: number;
  fxRateDate: string | null;
  fxRateSource: string;
  fxRateBcuValue: number | null;
  fxRateBcuDateUsed: string | null;
  fxRateBcuSeries: string | null;
};

export function resolveSystemAccount(
  accounts: PostableAccountRecord[],
  role: string,
) {
  return accounts.find((account) => {
    const systemRole = account.metadata?.system_role;
    return typeof systemRole === "string" && systemRole.trim() === role;
  }) ?? null;
}

export function buildJournalMonetaryContext(input: {
  currencyCode: string | null | undefined;
  documentDate: string | null | undefined;
  functionalCurrencyCode?: string | null | undefined;
  fxRate?: number | null | undefined;
  fxRateSource?: string | null | undefined;
  fxRateBcuValue?: number | null | undefined;
  fxRateBcuDateUsed?: string | null | undefined;
  fxRateBcuSeries?: string | null | undefined;
}) {
  const currencyCode = input.currencyCode?.trim().toUpperCase() || "UYU";
  const functionalCurrencyCode =
    input.functionalCurrencyCode?.trim().toUpperCase() || "UYU";
  const fxRate =
    typeof input.fxRate === "number" && Number.isFinite(input.fxRate) && input.fxRate > 0
      ? input.fxRate
      : currencyCode === functionalCurrencyCode
        ? 1
        : 0;

  return {
    currencyCode,
    functionalCurrencyCode,
    fxRate,
    fxRateDate: input.fxRateBcuDateUsed ?? input.documentDate ?? null,
    fxRateSource:
      input.fxRateSource?.trim()
      || (currencyCode === functionalCurrencyCode ? "same_currency" : "document_default"),
    fxRateBcuValue:
      typeof input.fxRateBcuValue === "number" && Number.isFinite(input.fxRateBcuValue)
        ? input.fxRateBcuValue
        : currencyCode === functionalCurrencyCode
          ? 1
          : null,
    fxRateBcuDateUsed: input.fxRateBcuDateUsed ?? input.documentDate ?? null,
    fxRateBcuSeries: input.fxRateBcuSeries ?? null,
  } satisfies JournalMonetaryContext;
}

export function buildJournalLine(input: {
  lineNumber: number;
  accountId: string | null;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  provenance: string;
  taxTag: string | null;
  monetary: JournalMonetaryContext;
  roleCode?: AccountRoleCode | null;
  linePurpose?: string | null;
  taxComponent?: string | null;
  settlementComponent?: string | null;
  isProvisional?: boolean;
}) {
  return {
    lineNumber: input.lineNumber,
    accountId: input.accountId,
    accountCode: input.accountCode,
    accountName: input.accountName,
    debit: roundCurrency(input.debit),
    credit: roundCurrency(input.credit),
    functionalDebit: roundCurrency(input.debit * input.monetary.fxRate),
    functionalCredit: roundCurrency(input.credit * input.monetary.fxRate),
    currencyCode: input.monetary.currencyCode,
    fxRate: input.monetary.fxRate,
    provenance: input.provenance,
    taxTag: input.taxTag,
    roleCode: input.roleCode ?? null,
    linePurpose: input.linePurpose ?? null,
    taxComponent: input.taxComponent ?? null,
    settlementComponent: input.settlementComponent ?? null,
    isProvisional: input.isProvisional ?? false,
  } satisfies ReviewJournalLine;
}

export function buildBlockedJournalSuggestion(input: {
  blockingReasons: string[];
  explanation: string;
  monetary: JournalMonetaryContext;
  postingMode?: "provisional" | "final";
  hasProvisionalAccounts?: boolean;
  templateCode?: ReviewJournalSuggestion["templateCode"];
  taxProfileCode?: string | null;
  operationKind?: OperationKind | null;
  paymentTerms?: PaymentTerms;
  settlementMethod?: SettlementMethod;
  settlementStatus?: SettlementStatus;
  requiresFollowupSettlement?: boolean;
}) {
  return {
    ready: false,
    isBalanced: false,
    postingMode: input.postingMode ?? "final",
    hasProvisionalAccounts: input.hasProvisionalAccounts ?? false,
    totalDebit: 0,
    totalCredit: 0,
    functionalTotalDebit: 0,
    functionalTotalCredit: 0,
    currencyCode: input.monetary.currencyCode,
    functionalCurrencyCode: input.monetary.functionalCurrencyCode,
    fxRate: input.monetary.fxRate,
    fxRateDate: input.monetary.fxRateDate,
    fxRateSource: input.monetary.fxRateSource,
    fxRateBcuValue: input.monetary.fxRateBcuValue,
    fxRateBcuDateUsed: input.monetary.fxRateBcuDateUsed,
    fxRateBcuSeries: input.monetary.fxRateBcuSeries,
    templateCode: input.templateCode ?? null,
    taxProfileCode: input.taxProfileCode ?? null,
    operationKind: input.operationKind ?? null,
    paymentTerms: input.paymentTerms ?? "unknown",
    settlementMethod: input.settlementMethod ?? "unknown",
    settlementStatus: input.settlementStatus ?? "not_applicable",
    requiresFollowupSettlement: input.requiresFollowupSettlement ?? false,
    explanation: input.explanation,
    lines: [],
    blockingReasons: input.blockingReasons,
  } satisfies ReviewJournalSuggestion;
}

export function finalizeJournalSuggestion(input: {
  lines: ReviewJournalLine[];
  explanation: string;
  blockingReasons: string[];
  monetary: JournalMonetaryContext;
  postingMode?: "provisional" | "final";
  hasProvisionalAccounts?: boolean;
  templateCode?: ReviewJournalSuggestion["templateCode"];
  taxProfileCode?: string | null;
  operationKind?: OperationKind | null;
  paymentTerms?: PaymentTerms;
  settlementMethod?: SettlementMethod;
  settlementStatus?: SettlementStatus;
  requiresFollowupSettlement?: boolean;
}) {
  const totalDebit = roundCurrency(input.lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = roundCurrency(input.lines.reduce((sum, line) => sum + line.credit, 0));
  const functionalTotalDebit = roundCurrency(
    input.lines.reduce((sum, line) => sum + line.functionalDebit, 0),
  );
  const functionalTotalCredit = roundCurrency(
    input.lines.reduce((sum, line) => sum + line.functionalCredit, 0),
  );

  return {
    ready: true,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    postingMode: input.postingMode ?? "final",
    hasProvisionalAccounts: input.hasProvisionalAccounts ?? false,
    totalDebit,
    totalCredit,
    functionalTotalDebit,
    functionalTotalCredit,
    currencyCode: input.monetary.currencyCode,
    functionalCurrencyCode: input.monetary.functionalCurrencyCode,
    fxRate: input.monetary.fxRate,
    fxRateDate: input.monetary.fxRateDate,
    fxRateSource: input.monetary.fxRateSource,
    fxRateBcuValue: input.monetary.fxRateBcuValue,
    fxRateBcuDateUsed: input.monetary.fxRateBcuDateUsed,
    fxRateBcuSeries: input.monetary.fxRateBcuSeries,
    templateCode: input.templateCode ?? null,
    taxProfileCode: input.taxProfileCode ?? null,
    operationKind: input.operationKind ?? null,
    paymentTerms: input.paymentTerms ?? "unknown",
    settlementMethod: input.settlementMethod ?? "unknown",
    settlementStatus: input.settlementStatus ?? "not_applicable",
    requiresFollowupSettlement: input.requiresFollowupSettlement ?? false,
    explanation: input.explanation,
    lines: input.lines,
    blockingReasons: input.blockingReasons,
  } satisfies ReviewJournalSuggestion;
}
