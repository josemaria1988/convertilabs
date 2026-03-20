import type {
  AccountRoleCode,
  DocumentSettlementContext,
  ResolvedAccountingRule,
  ReviewJournalSuggestion,
  VatEngineResult,
} from "@/modules/accounting/types";
import { formatAccountRoleCodeLabel } from "@/modules/presentation/labels";

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
    settlementAccount: string | null;
    vatAccount: string | null;
    counterpartyAccount: string | null;
    currencyCode: string;
    functionalCurrencyCode: string;
    fxRate: number;
    fxRateDate: string | null;
    fxRateSource: string;
    hasProvisionalAccounts: boolean;
    taxProfileCode: string | null;
  };
  journal: {
    isBalanced: boolean;
    totalDebit: number;
    totalCredit: number;
    functionalTotalDebit: number;
    functionalTotalCredit: number;
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

function formatMissingRoleMessage(roleCode: AccountRoleCode) {
  switch (roleCode) {
    case "revenue_account":
      return "Falta elegir una cuenta principal de ingresos para esta venta.";
    case "expense_account":
      return "Falta elegir una cuenta principal de gastos para esta compra.";
    case "inventory_account":
      return "Falta elegir una cuenta principal de inventario.";
    case "fixed_asset_account":
      return "Falta elegir una cuenta principal de activo.";
    case "output_vat_account":
      return "Falta resolver la cuenta de IVA ventas.";
    case "input_vat_account":
      return "Falta resolver la cuenta de IVA compras.";
    case "accounts_receivable_account":
      return "Falta resolver la cuenta de clientes.";
    case "accounts_payable_account":
      return "Falta resolver la cuenta de proveedores.";
    case "cash_account":
      return "Falta resolver la cuenta de caja para el cobro o pago.";
    case "bank_account":
      return "Falta resolver la cuenta bancaria para el cobro o pago.";
    case "card_clearing_account":
      return "Falta resolver la cuenta de tarjetas a cobrar.";
    case "check_clearing_account":
      return "Falta resolver la cuenta de cheques.";
    case "cash_sales_unidentified_account":
      return "Falta resolver la cuenta provisoria para cobros contado a identificar.";
    case "cash_purchases_unidentified_account":
      return "Falta resolver la cuenta provisoria para pagos contado a identificar.";
    case "bank_fees_account":
      return "Falta resolver la cuenta de comisiones o gastos bancarios.";
    case "fx_difference_account":
      return "Falta resolver la cuenta de diferencias de cambio.";
    default:
      return `Falta resolver ${formatAccountRoleCodeLabel(roleCode).toLowerCase()}.`;
  }
}

function formatJournalBlockingReason(reason: string) {
  const roleMatch = reason.match(/^Falta resolver la cuenta para el rol ([a-z_]+)\.$/i);

  if (roleMatch) {
    return formatMissingRoleMessage(roleMatch[1] as AccountRoleCode);
  }

  if (reason === "La suma del settlement mixto debe coincidir con el total del documento.") {
    return "La distribucion del cobro o pago mixto debe sumar exactamente el total del documento.";
  }

  return reason;
}

function unique(values: string[]) {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

export function buildAccountingImpactPreview(input: {
  journalSuggestion: ReviewJournalSuggestion;
  taxTreatment: VatEngineResult;
  appliedRule: ResolvedAccountingRule;
  settlementContext: DocumentSettlementContext;
}) {
  const mainLine =
    input.journalSuggestion.lines.find((line) => line.linePurpose === "main")
    ?? null;
  const vatLine = input.journalSuggestion.lines.find((line) =>
    line.linePurpose === "tax" || (typeof line.taxTag === "string" && line.taxTag.includes("vat")),
  ) ?? null;
  const settlementLine =
    input.journalSuggestion.lines.find((line) => line.linePurpose === "settlement")
    ?? null;
  const counterpartyLine =
    input.journalSuggestion.lines.find((line) => line.linePurpose === "counterparty")
    ?? null;
  const missingPrimaryAccount = Boolean(
    input.settlementContext.primaryAccountRole
    && input.journalSuggestion.blockingReasons.includes(
      `Falta resolver la cuenta para el rol ${input.settlementContext.primaryAccountRole}.`,
    ),
  );
  const journalMissingItems = input.journalSuggestion.ready
    ? []
    : input.journalSuggestion.blockingReasons.map((reason) => formatJournalBlockingReason(reason));
  const missingItems = unique([
    ...journalMissingItems,
    input.taxTreatment.ready ? null : "Falta un tratamiento IVA listo para operar.",
    input.settlementContext.templateCode
      ? null
      : "Falta terminar de definir la operacion para elegir una plantilla contable.",
    !input.journalSuggestion.ready && journalMissingItems.length === 0
      ? "Todavia no se pudo armar un asiento contable valido."
      : null,
  ].filter((value): value is string => Boolean(value)));
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
          : !missingPrimaryAccount && input.appliedRule.accountCode && input.appliedRule.accountName
            ? `${input.appliedRule.accountCode} - ${input.appliedRule.accountName}`
          : null,
      settlementAccount:
        settlementLine && settlementLine.accountCode && settlementLine.accountName
          ? `${settlementLine.accountCode} - ${settlementLine.accountName}`
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
      functionalCurrencyCode: input.journalSuggestion.functionalCurrencyCode,
      fxRate: input.journalSuggestion.fxRate,
      fxRateDate: input.journalSuggestion.fxRateDate,
      fxRateSource: input.journalSuggestion.fxRateSource,
      hasProvisionalAccounts: input.journalSuggestion.hasProvisionalAccounts,
      taxProfileCode: input.appliedRule.taxProfileCode,
    },
    journal: {
      isBalanced: input.journalSuggestion.isBalanced,
      totalDebit: input.journalSuggestion.totalDebit,
      totalCredit: input.journalSuggestion.totalCredit,
      functionalTotalDebit: input.journalSuggestion.functionalTotalDebit,
      functionalTotalCredit: input.journalSuggestion.functionalTotalCredit,
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
