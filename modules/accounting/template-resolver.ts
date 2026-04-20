import {
  asRecord,
  asString,
  normalizeTextToken,
  roundCurrency,
} from "@/modules/accounting/normalization";
import type {
  AccountingContextResolution,
  DocumentIntakeFactMap,
  DocumentRoleCandidate,
  DocumentSettlementContext,
  OperationKind,
  PaymentTerms,
  PostingTemplateCode,
  SettlementAllocation,
  SettlementEvidenceSource,
  SettlementMethod,
} from "@/modules/accounting/types";

function hasKeyword(value: string | null | undefined, keywords: string[]) {
  const normalized = normalizeTextToken(value);

  if (!normalized) {
    return false;
  }

  return keywords.some((keyword) => normalized.includes(keyword));
}

function normalizeOperationKind(value: string | null | undefined): OperationKind | null {
  switch (value) {
    case "sale_invoice":
    case "purchase_invoice":
    case "customer_receipt":
    case "supplier_payment":
    case "sale_credit_note":
    case "purchase_credit_note":
    case "card_settlement":
    case "bank_transfer_settlement":
    case "manual_settlement_adjustment":
      return value;
    default:
      return null;
  }
}

function inferOperationKind(input: {
  documentRole: DocumentRoleCandidate;
  documentType: string | null;
  accountingContext: AccountingContextResolution;
}) {
  const manual = normalizeOperationKind(input.accountingContext.operationKind);

  if (manual) {
    return manual;
  }

  if (hasKeyword(input.documentType, ["nota de credito", "credit note", "credit_note"])) {
    return input.documentRole === "sale"
      ? "sale_credit_note"
      : input.documentRole === "purchase"
        ? "purchase_credit_note"
        : null;
  }

  if (hasKeyword(input.documentType, ["recibo", "receipt", "cobranza"])) {
    return "customer_receipt";
  }

  if (hasKeyword(input.documentType, ["payment_support", "comprobante de pago", "payment", "pago"])) {
    return "supplier_payment";
  }

  if (hasKeyword(input.documentType, ["card settlement", "liquidacion tarjeta", "card_settlement"])) {
    return "card_settlement";
  }

  if (input.documentRole === "sale") {
    return "sale_invoice";
  }

  if (input.documentRole === "purchase") {
    return "purchase_invoice";
  }

  return null;
}

function normalizePaymentTerms(value: string | null | undefined): PaymentTerms | null {
  switch (value) {
    case "cash":
    case "credit":
    case "unknown":
      return value;
    default:
      return null;
  }
}

function inferPaymentTerms(input: {
  operationKind: OperationKind | null;
  facts: DocumentIntakeFactMap;
  accountingContext: AccountingContextResolution;
  settlementHints: IntakeSettlementHints;
}) {
  const manual = normalizePaymentTerms(input.accountingContext.paymentTerms);

  if (manual && manual !== "unknown") {
    return manual;
  }

  if (
    input.operationKind === "customer_receipt"
    || input.operationKind === "supplier_payment"
    || input.operationKind === "card_settlement"
    || input.operationKind === "bank_transfer_settlement"
    || input.operationKind === "manual_settlement_adjustment"
  ) {
    return "cash" satisfies PaymentTerms;
  }

  if (input.settlementHints.paymentTerms && input.settlementHints.paymentTerms !== "unknown") {
    return input.settlementHints.paymentTerms;
  }

  if (
    typeof input.facts.due_date === "string"
    && input.facts.due_date
    && input.facts.due_date !== input.facts.document_date
  ) {
    return "credit" satisfies PaymentTerms;
  }

  if (
    input.operationKind === "sale_invoice"
    || input.operationKind === "purchase_invoice"
  ) {
    return "credit" satisfies PaymentTerms;
  }

  return "unknown" satisfies PaymentTerms;
}

function normalizeSettlementMethod(value: string | null | undefined): SettlementMethod | null {
  switch (value) {
    case "cash":
    case "bank_transfer":
    case "card":
    case "check":
    case "paid_by_partner":
    case "mixed":
    case "unknown":
      return value;
    default:
      return null;
  }
}

type IntakeSettlementHints = {
  paymentTerms: PaymentTerms | null;
  settlementMethodExplicit: SettlementMethod | null;
  settlementMethodEvidenceText: string | null;
  hasReceiptLanguage: boolean;
  hasCardVoucherLanguage: boolean;
  hasBankTransferReference: boolean;
};

function parseIntakeSettlementHints(value: Record<string, unknown> | null | undefined): IntakeSettlementHints {
  const context = asRecord(value);
  const settlementHints = asRecord(context.settlement_hints);

  return {
    paymentTerms: normalizePaymentTerms(asString(settlementHints.payment_terms)),
    settlementMethodExplicit: normalizeSettlementMethod(
      asString(settlementHints.settlement_method_explicit),
    ),
    settlementMethodEvidenceText: asString(settlementHints.settlement_method_evidence_text),
    hasReceiptLanguage: settlementHints.has_receipt_language === true,
    hasCardVoucherLanguage: settlementHints.has_card_voucher_language === true,
    hasBankTransferReference: settlementHints.has_bank_transfer_reference === true,
  };
}

function inferSettlementMethod(input: {
  operationKind: OperationKind | null;
  paymentTerms: PaymentTerms;
  documentType: string | null;
  accountingContext: AccountingContextResolution;
  settlementHints: IntakeSettlementHints;
}) {
  const manual = normalizeSettlementMethod(input.accountingContext.settlementMethod);

  if (manual && manual !== "unknown") {
    return manual;
  }

  if (input.paymentTerms === "credit") {
    return "unknown" satisfies SettlementMethod;
  }

  if (
    input.settlementHints.settlementMethodExplicit
    && input.settlementHints.settlementMethodExplicit !== "unknown"
  ) {
    return input.settlementHints.settlementMethodExplicit;
  }

  if (input.operationKind === "card_settlement") {
    return "bank_transfer" satisfies SettlementMethod;
  }

  if (
    input.settlementHints.hasBankTransferReference
    || hasKeyword(input.settlementHints.settlementMethodEvidenceText, [
      "transferencia",
      "transfer",
      "brou",
      "itau",
      "bbva",
      "santander",
      "scotia",
      "cuenta",
      "cta cte",
      "iban",
      "swift",
    ])
  ) {
    return "bank_transfer" satisfies SettlementMethod;
  }

  if (
    input.settlementHints.hasCardVoucherLanguage
    || hasKeyword(input.settlementHints.settlementMethodEvidenceText, [
      "tarjeta",
      "card",
      "pos",
      "visa",
      "mastercard",
    ])
  ) {
    return "card" satisfies SettlementMethod;
  }

  if (
    input.settlementHints.hasReceiptLanguage
    || hasKeyword(input.settlementHints.settlementMethodEvidenceText, [
      "efectivo",
      "cash",
    ])
  ) {
    return "cash" satisfies SettlementMethod;
  }

  if (hasKeyword(input.documentType, ["tarjeta", "card", "pos"])) {
    return "card" satisfies SettlementMethod;
  }

  if (hasKeyword(input.documentType, ["transferencia", "transfer"])) {
    return "bank_transfer" satisfies SettlementMethod;
  }

  if (hasKeyword(input.documentType, ["cheque", "check"])) {
    return "check" satisfies SettlementMethod;
  }

  return "unknown" satisfies SettlementMethod;
}

function normalizeEvidenceSource(
  value: string | null | undefined,
): SettlementEvidenceSource | null {
  switch (value) {
    case "invoice_document":
    case "receipt_document":
    case "bank_statement":
    case "card_settlement_document":
    case "user_input":
    case "imported_erp":
    case "none":
      return value;
    default:
      return null;
  }
}

function inferEvidenceSource(input: {
  operationKind: OperationKind | null;
  accountingContext: AccountingContextResolution;
  settlementHints: IntakeSettlementHints;
}) {
  const manual = normalizeEvidenceSource(input.accountingContext.settlementEvidenceSource);

  if (manual && manual !== "none") {
    return manual;
  }

  if (
    input.accountingContext.operationKind
    || input.accountingContext.paymentTerms !== "unknown"
    || input.accountingContext.settlementMethod !== "unknown"
  ) {
    return "user_input" satisfies SettlementEvidenceSource;
  }

  if (input.operationKind === "customer_receipt" || input.operationKind === "supplier_payment") {
    return "receipt_document" satisfies SettlementEvidenceSource;
  }

  if (input.operationKind === "card_settlement") {
    return "card_settlement_document" satisfies SettlementEvidenceSource;
  }

  if (
    (input.settlementHints.paymentTerms && input.settlementHints.paymentTerms !== "unknown")
    || (
      input.settlementHints.settlementMethodExplicit
      && input.settlementHints.settlementMethodExplicit !== "unknown"
    )
    || input.settlementHints.hasReceiptLanguage
    || input.settlementHints.hasCardVoucherLanguage
    || input.settlementHints.hasBankTransferReference
    || Boolean(input.settlementHints.settlementMethodEvidenceText)
  ) {
    return "invoice_document" satisfies SettlementEvidenceSource;
  }

  return "none" satisfies SettlementEvidenceSource;
}

function normalizeSettlementAllocations(
  allocations: SettlementAllocation[] | undefined,
): SettlementAllocation[] {
  return (allocations ?? [])
    .filter((entry) => entry.amount > 0)
    .map((entry) => ({
      method: entry.method,
      amount: roundCurrency(entry.amount),
    }));
}

function includesCardAllocation(allocations: SettlementAllocation[]) {
  return allocations.some((entry) => entry.method === "card");
}

function resolveTemplateCode(input: {
  operationKind: OperationKind | null;
  paymentTerms: PaymentTerms;
  settlementMethod: SettlementMethod;
}) {
  if (input.operationKind === "sale_invoice") {
    if (input.paymentTerms === "credit") {
      return "sale_local_credit" satisfies PostingTemplateCode;
    }

    if (input.paymentTerms === "cash" && input.settlementMethod === "card") {
      return "card_sale_clearing" satisfies PostingTemplateCode;
    }

    if (input.paymentTerms === "cash" && input.settlementMethod === "unknown") {
      return "sale_cash_unknown_clearing" satisfies PostingTemplateCode;
    }

    if (input.paymentTerms === "cash") {
      return "sale_local_cash" satisfies PostingTemplateCode;
    }
  }

  if (input.operationKind === "purchase_invoice") {
    if (input.paymentTerms === "cash" && input.settlementMethod === "paid_by_partner") {
      return "purchase_expense_paid_by_partner.v1" satisfies PostingTemplateCode;
    }

    if (input.paymentTerms === "credit") {
      return "purchase_local_credit" satisfies PostingTemplateCode;
    }

    if (input.paymentTerms === "cash" && input.settlementMethod === "unknown") {
      return "purchase_cash_unknown_clearing" satisfies PostingTemplateCode;
    }

    if (input.paymentTerms === "cash") {
      return "purchase_local_cash" satisfies PostingTemplateCode;
    }
  }

  if (input.operationKind === "sale_credit_note") {
    return "sale_credit_note" satisfies PostingTemplateCode;
  }

  if (input.operationKind === "purchase_credit_note") {
    return "purchase_credit_note" satisfies PostingTemplateCode;
  }

  if (input.operationKind === "customer_receipt") {
    return "customer_collection" satisfies PostingTemplateCode;
  }

  if (input.operationKind === "supplier_payment") {
    return "supplier_payment" satisfies PostingTemplateCode;
  }

  if (input.operationKind === "card_settlement") {
    return "card_settlement" satisfies PostingTemplateCode;
  }

  return null;
}

export function resolveDocumentSettlementContext(input: {
  documentRole: DocumentRoleCandidate;
  documentType: string | null;
  intakeContext?: Record<string, unknown> | null;
  facts: DocumentIntakeFactMap;
  accountingContext: AccountingContextResolution;
}) {
  const settlementHints = parseIntakeSettlementHints(input.intakeContext);
  const operationKind = inferOperationKind(input);
  const paymentTerms = inferPaymentTerms({
    operationKind,
    facts: input.facts,
    accountingContext: input.accountingContext,
    settlementHints,
  });
  const settlementMethod = inferSettlementMethod({
    operationKind,
    paymentTerms,
    documentType: input.documentType,
    accountingContext: input.accountingContext,
    settlementHints,
  });
  const settlementEvidenceSource = inferEvidenceSource({
    operationKind,
    accountingContext: input.accountingContext,
    settlementHints,
  });
  const settlementAllocations = normalizeSettlementAllocations(
    input.accountingContext.settlementAllocations,
  );
  const templateCode = resolveTemplateCode({
    operationKind,
    paymentTerms,
    settlementMethod,
  });
  const blockers: string[] = [];
  const warnings: string[] = [];
  const isCommercialInvoice =
    operationKind === "sale_invoice" || operationKind === "purchase_invoice";

  if (!operationKind) {
    blockers.push("Falta definir la operacion contable del documento.");
  }

  if (isCommercialInvoice && paymentTerms === "unknown") {
    blockers.push("Falta definir si la operacion es contado o credito.");
  }

  if (settlementMethod === "mixed" && settlementAllocations.length === 0) {
    blockers.push("El settlement mixto necesita al menos una distribucion por medio.");
  }

  if (paymentTerms === "cash" && settlementMethod === "unknown") {
    warnings.push("El documento no prueba el medio real de settlement; se usara clearing provisional.");
  }

  if (paymentTerms === "cash" && settlementMethod === "mixed") {
    warnings.push("El asiento se resolvera con varias lineas por settlement.");
  }

  if (
    paymentTerms === "credit"
    && settlementMethod !== "unknown"
    && operationKind !== "customer_receipt"
    && operationKind !== "supplier_payment"
  ) {
    warnings.push("En operaciones a credito el settlement queda separado del documento comercial.");
  }

  const includesCard =
    settlementMethod === "card"
    || (settlementMethod === "mixed" && includesCardAllocation(settlementAllocations));
  const settlementStatus =
    operationKind === "sale_invoice" && paymentTerms === "credit"
      ? "open_receivable"
      : operationKind === "purchase_invoice"
        && (paymentTerms === "credit" || settlementMethod === "paid_by_partner")
        ? "open_payable"
        : paymentTerms === "cash" && settlementMethod === "unknown"
          ? "pending_resolution"
          : paymentTerms === "cash" && includesCard
            ? "pending_followup_event"
            : operationKind === "customer_receipt" || operationKind === "supplier_payment"
              ? "resolved"
              : operationKind === "card_settlement"
                ? "resolved"
                : paymentTerms === "cash"
                  ? "settled_on_document"
                  : "not_applicable";
  const openItemKind =
    operationKind === "sale_invoice" && paymentTerms === "credit"
      ? "receivable"
      : operationKind === "purchase_invoice"
        && (paymentTerms === "credit" || settlementMethod === "paid_by_partner")
        ? "payable"
        : paymentTerms === "cash"
          && (
            settlementMethod === "unknown"
            || settlementMethod === "card"
            || settlementMethod === "mixed"
          )
          ? "clearing"
          : null;
  const counterpartyRole =
    input.documentRole === "sale"
      ? "customer"
      : input.documentRole === "purchase"
        ? "supplier"
        : null;
  const primaryAccountRole =
    input.documentRole === "sale"
      ? "revenue_account"
      : input.documentRole === "purchase"
        ? "expense_account"
        : null;

  return {
    operationKind,
    paymentTerms,
    settlementMethod,
    settlementEvidenceSource,
    settlementStatus,
    settlementAllocations,
    counterpartyRole,
    templateCode,
    requiresFollowupSettlement:
      settlementStatus === "pending_followup_event"
      || settlementStatus === "pending_resolution"
      || settlementMethod === "paid_by_partner",
    primaryAccountRole,
    openItemKind,
    blockers,
    warnings,
  } satisfies DocumentSettlementContext;
}
