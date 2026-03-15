import type {
  ResolvedAccountingRule,
  ReviewJournalSuggestion,
  VatEngineResult,
} from "@/modules/accounting/types";

export type AccountingImpactPreview = {
  ready: boolean;
  missingItems: string[];
  summary: {
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
}) {
  const mainLine =
    input.journalSuggestion.lines.find((line) => line.taxTag === "vat_purchase_base")
    ?? input.journalSuggestion.lines.find((line) => line.taxTag === "vat_sale_base")
    ?? input.journalSuggestion.lines[0]
    ?? null;
  const vatLine = input.journalSuggestion.lines.find((line) =>
    typeof line.taxTag === "string" && line.taxTag.includes("vat"),
  ) ?? null;
  const counterpartyLine =
    input.journalSuggestion.lines.find((line) => !line.taxTag && line.lineNumber !== mainLine?.lineNumber)
    ?? null;
  const missingItems = [
    input.journalSuggestion.ready ? null : "Falta un asiento contable utilizable.",
    input.taxTreatment.ready ? null : "Falta un tratamiento IVA listo para operar.",
    input.appliedRule.accountId ? null : "Falta una cuenta principal aprobable.",
  ].filter((value): value is string => Boolean(value));
  const warnings = [
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
      expected: Boolean(counterpartyLine),
      reason: counterpartyLine
        ? "El asiento ya incluye una contraparte que puede alimentar seguimiento de saldo."
        : "No se detecto una contraparte clara para open items.",
    },
    warnings,
  } satisfies AccountingImpactPreview;
}
