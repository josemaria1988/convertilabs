import type {
  DocumentSettlementContext,
  ResolvedAccountingRule,
  ReviewJournalSuggestion,
  VatEngineResult,
} from "@/modules/accounting/types";

export type AccountingImpactPreview = {
  ready: boolean;
  missingItems: string[];
  summary: {
    templateCode: string | null;
    operationKind: string | null;
    paymentTerms: string;
    settlementMethod: string;
    settlementStatus: string;
    requiresFollowupSettlement: boolean;
    mainAccount: string | null;
    vatAccount: string | null;
    counterpartyAccount: string | null;
    currencyCode: string;
    fxRate: number;
    hasProvisionalAccounts: boolean;
    taxProfileCode: string | null;
  };
  journal: {
    isBalanced: boolean;
    totalDebit: number;
    totalCredit: number;
    lines: ReviewJournalSuggestion["lines"];
  };
  vat: {
    label: string;
    bucket: string | null;
    rate: number | null;
    taxAmount: number;
    taxAmountUyu: number;
    deductibilityStatus: string;
  };
  openItems: {
    expected: boolean;
    reason: string;
  };
  warnings: string[];
};

export function buildAccountingImpactPreview(input: {
  journalSuggestion: ReviewJournalSuggestion;
  taxTreatment: VatEngineResult;
  appliedRule: ResolvedAccountingRule;
  settlementContext: DocumentSettlementContext;
}) {
  const mainLine =
    input.journalSuggestion.lines.find((line) => line.linePurpose === "main")
    ?? input.journalSuggestion.lines[0]
    ?? null;
  const vatLine = input.journalSuggestion.lines.find((line) =>
    line.linePurpose === "tax" || (typeof line.taxTag === "string" && line.taxTag.includes("vat")),
  ) ?? null;
  const counterpartyLine =
    input.journalSuggestion.lines.find((line) => line.linePurpose === "settlement")
    ?? null;
  const missingItems = [
    input.journalSuggestion.ready ? null : "Falta un asiento contable utilizable.",
    input.taxTreatment.ready ? null : "Falta un tratamiento IVA listo para operar.",
    input.settlementContext.templateCode ? null : "Falta una plantilla contable resoluble.",
    input.settlementContext.primaryAccountRole && input.appliedRule.accountId
      ? null
      : input.settlementContext.primaryAccountRole
        ? "Falta una cuenta principal aprobable."
        : null,
  ].filter((value): value is string => Boolean(value));
  const warnings = [
    ...input.settlementContext.warnings,
    ...input.taxTreatment.warnings,
    ...input.journalSuggestion.blockingReasons,
    ...(input.journalSuggestion.hasProvisionalAccounts
      ? ["El asiento usa al menos una cuenta provisional."]
      : []),
  ];

  return {
    ready: missingItems.length === 0,
    missingItems,
    summary: {
      templateCode: input.settlementContext.templateCode,
      operationKind: input.settlementContext.operationKind,
      paymentTerms: input.settlementContext.paymentTerms,
      settlementMethod: input.settlementContext.settlementMethod,
      settlementStatus: input.settlementContext.settlementStatus,
      requiresFollowupSettlement: input.settlementContext.requiresFollowupSettlement,
      mainAccount:
        mainLine && mainLine.accountCode && mainLine.accountName
          ? `${mainLine.accountCode} - ${mainLine.accountName}`
          : null,
      vatAccount:
        vatLine && vatLine.accountCode && vatLine.accountName
          ? `${vatLine.accountCode} - ${vatLine.accountName}`
          : null,
      counterpartyAccount:
        counterpartyLine && counterpartyLine.accountCode && counterpartyLine.accountName
          ? `${counterpartyLine.accountCode} - ${counterpartyLine.accountName}`
          : null,
      currencyCode: input.journalSuggestion.currencyCode,
      fxRate: input.journalSuggestion.fxRate,
      hasProvisionalAccounts: input.journalSuggestion.hasProvisionalAccounts,
      taxProfileCode: input.appliedRule.taxProfileCode,
    },
    journal: {
      isBalanced: input.journalSuggestion.isBalanced,
      totalDebit: input.journalSuggestion.totalDebit,
      totalCredit: input.journalSuggestion.totalCredit,
      lines: input.journalSuggestion.lines,
    },
    vat: {
      label: input.taxTreatment.label,
      bucket: input.taxTreatment.vatBucket,
      rate: input.taxTreatment.rate,
      taxAmount: input.taxTreatment.taxAmount,
      taxAmountUyu: input.taxTreatment.taxAmountUyu,
      deductibilityStatus: input.taxTreatment.vatDeductibilityStatus,
    },
    openItems: {
      expected: Boolean(input.settlementContext.openItemKind),
      reason: input.settlementContext.openItemKind
        ? `El documento abre o mueve un saldo tipo ${input.settlementContext.openItemKind}.`
        : "No se espera un open item en este template.",
    },
    warnings,
  } satisfies AccountingImpactPreview;
}
