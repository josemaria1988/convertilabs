import { resolveUyVatTreatment } from "@/modules/tax/uy-vat-engine";
import {
  roundCurrency,
} from "@/modules/accounting/normalization";
import { resolveAccountingRuleSelection } from "@/modules/accounting/rule-engine";
import type {
  AccountingSuggestionContext,
  DerivedDraftArtifacts,
  PostableAccountRecord,
  ReviewJournalLine,
  ReviewJournalSuggestion,
} from "@/modules/accounting/types";

function resolveSystemAccount(
  accounts: PostableAccountRecord[],
  role: string,
) {
  return accounts.find((account) => {
    const systemRole = account.metadata?.system_role;
    return typeof systemRole === "string" && systemRole.trim() === role;
  }) ?? null;
}

function buildBlockedJournalSuggestion(blockingReasons: string[], explanation: string) {
  return {
    ready: false,
    isBalanced: false,
    totalDebit: 0,
    totalCredit: 0,
    explanation,
    lines: [],
    blockingReasons,
  } satisfies ReviewJournalSuggestion;
}

function buildPurchaseJournalSuggestion(input: {
  context: AccountingSuggestionContext;
  taxTreatment: ReturnType<typeof resolveUyVatTreatment>;
}) {
  const appliedRule = resolveAccountingRuleSelection(input.context);
  const blockers = [
    ...input.context.accountingContext.blockingReasons,
    ...input.context.assistantSuggestion.reviewFlags,
  ];

  if (!appliedRule.accountId || !appliedRule.accountCode || !appliedRule.accountName) {
    blockers.push("Falta una cuenta contable postable resuelta para el documento.");
  }

  if (!input.taxTreatment.ready || !input.taxTreatment.journalSeed) {
    return {
      appliedRule,
      journalSuggestion: buildBlockedJournalSuggestion(
        [...blockers, ...input.taxTreatment.blockingReasons],
        "La sugerencia contable queda bloqueada hasta que el tratamiento IVA sea confirmable.",
      ),
    };
  }

  const counterparty = resolveSystemAccount(
    input.context.accounts,
    input.taxTreatment.journalSeed.counterpartyRole,
  );
  const vatAccount = input.taxTreatment.journalSeed.vatRole
    ? resolveSystemAccount(input.context.accounts, input.taxTreatment.journalSeed.vatRole)
    : null;

  if (!counterparty) {
    blockers.push("Falta la cuenta de contrapartida con metadata.system_role=accounts_payable.");
  }

  if (input.taxTreatment.journalSeed.vatRole && !vatAccount) {
    blockers.push("Falta la cuenta IVA compras con metadata.system_role=vat_input_creditable.");
  }

  if (blockers.length > 0) {
    return {
      appliedRule,
      journalSuggestion: buildBlockedJournalSuggestion(
        blockers,
        "La sugerencia contable se bloqueo porque faltan mappings contables obligatorios.",
      ),
    };
  }

  const lines: ReviewJournalLine[] = [
    {
      lineNumber: 1,
      accountId: appliedRule.accountId,
      accountCode: appliedRule.accountCode!,
      accountName: appliedRule.accountName!,
      debit:
        input.taxTreatment.vatBucket === "input_creditable"
          ? input.taxTreatment.taxableAmount
          : input.taxTreatment.journalSeed.totalAmount,
      credit: 0,
      provenance: appliedRule.provenance,
      taxTag:
        input.taxTreatment.vatBucket === "input_creditable"
          ? "vat_purchase_base"
          : "vat_purchase_non_deductible",
    },
  ];

  if (
    input.taxTreatment.vatBucket === "input_creditable"
    && input.taxTreatment.taxAmount > 0
    && vatAccount
  ) {
    lines.push({
      lineNumber: 2,
      accountId: vatAccount.id,
      accountCode: vatAccount.code,
      accountName: vatAccount.name,
      debit: input.taxTreatment.taxAmount,
      credit: 0,
      provenance: "system_role:vat_input_creditable",
      taxTag: "vat_input_creditable",
    });
  }

  lines.push({
    lineNumber: lines.length + 1,
    accountId: counterparty!.id,
    accountCode: counterparty!.code,
    accountName: counterparty!.name,
    debit: 0,
    credit: input.taxTreatment.journalSeed.totalAmount,
    provenance: "system_role:accounts_payable",
    taxTag: null,
  });

  return {
    appliedRule,
    journalSuggestion: {
      ready: true,
      isBalanced: true,
      totalDebit: roundCurrency(lines.reduce((sum, line) => sum + line.debit, 0)),
      totalCredit: roundCurrency(lines.reduce((sum, line) => sum + line.credit, 0)),
      explanation: `Asiento sugerido con precedencia ${appliedRule.scope} y tratamiento ${input.taxTreatment.label.toLowerCase()}.`,
      lines,
      blockingReasons: [],
    } satisfies ReviewJournalSuggestion,
  };
}

function buildSaleJournalSuggestion(input: {
  context: AccountingSuggestionContext;
  taxTreatment: ReturnType<typeof resolveUyVatTreatment>;
}) {
  const appliedRule = resolveAccountingRuleSelection(input.context);
  const blockers = [
    ...input.context.accountingContext.blockingReasons,
    ...input.context.assistantSuggestion.reviewFlags,
  ];

  if (!appliedRule.accountId || !appliedRule.accountCode || !appliedRule.accountName) {
    blockers.push("Falta una cuenta de ingreso postable resuelta para el documento.");
  }

  if (!input.taxTreatment.ready || !input.taxTreatment.journalSeed) {
    return {
      appliedRule,
      journalSuggestion: buildBlockedJournalSuggestion(
        [...blockers, ...input.taxTreatment.blockingReasons],
        "La sugerencia contable queda bloqueada hasta que el tratamiento IVA sea confirmable.",
      ),
    };
  }

  const counterparty = resolveSystemAccount(
    input.context.accounts,
    input.taxTreatment.journalSeed.counterpartyRole,
  );
  const vatAccount = input.taxTreatment.journalSeed.vatRole
    ? resolveSystemAccount(input.context.accounts, input.taxTreatment.journalSeed.vatRole)
    : null;

  if (!counterparty) {
    blockers.push("Falta la cuenta de contrapartida con metadata.system_role=accounts_receivable.");
  }

  if (input.taxTreatment.journalSeed.vatRole && !vatAccount) {
    blockers.push("Falta la cuenta IVA ventas con metadata.system_role=vat_output_payable.");
  }

  if (blockers.length > 0) {
    return {
      appliedRule,
      journalSuggestion: buildBlockedJournalSuggestion(
        blockers,
        "La sugerencia contable se bloqueo porque faltan mappings contables obligatorios.",
      ),
    };
  }

  const lines: ReviewJournalLine[] = [
    {
      lineNumber: 1,
      accountId: counterparty!.id,
      accountCode: counterparty!.code,
      accountName: counterparty!.name,
      debit: input.taxTreatment.journalSeed.totalAmount,
      credit: 0,
      provenance: "system_role:accounts_receivable",
      taxTag: null,
    },
    {
      lineNumber: 2,
      accountId: appliedRule.accountId,
      accountCode: appliedRule.accountCode!,
      accountName: appliedRule.accountName!,
      debit: 0,
      credit: input.taxTreatment.taxableAmount,
      provenance: appliedRule.provenance,
      taxTag: "vat_sale_base",
    },
  ];

  if (input.taxTreatment.taxAmount > 0 && vatAccount) {
    lines.push({
      lineNumber: 3,
      accountId: vatAccount.id,
      accountCode: vatAccount.code,
      accountName: vatAccount.name,
      debit: 0,
      credit: input.taxTreatment.taxAmount,
      provenance: "system_role:vat_output_payable",
      taxTag: "vat_output_payable",
    });
  }

  return {
    appliedRule,
    journalSuggestion: {
      ready: true,
      isBalanced: true,
      totalDebit: roundCurrency(lines.reduce((sum, line) => sum + line.debit, 0)),
      totalCredit: roundCurrency(lines.reduce((sum, line) => sum + line.credit, 0)),
      explanation: `Asiento sugerido con precedencia ${appliedRule.scope} y tratamiento ${input.taxTreatment.label.toLowerCase()}.`,
      lines,
      blockingReasons: [],
    } satisfies ReviewJournalSuggestion,
  };
}

export function buildAccountingDraftArtifacts(input: AccountingSuggestionContext) {
  const appliedRule = resolveAccountingRuleSelection(input);
  const conceptBlockers =
    appliedRule.scope === "manual_review"
      ? input.conceptResolution.blockingReasons
      : [];
  const taxTreatment = resolveUyVatTreatment({
    documentRole: input.documentRole,
    documentType: input.documentType,
    facts: input.facts,
    amountBreakdown: input.amountBreakdown,
    operationCategory: appliedRule.operationCategory ?? input.operationCategory,
    profile: input.profile,
    ruleSnapshot: input.ruleSnapshot,
    linkedOperationType: appliedRule.linkedOperationType,
    userContextText: input.accountingContext.userFreeText,
    vatProfile: appliedRule.vatProfileJson,
  });

  const resolved =
    input.documentRole === "purchase"
      ? buildPurchaseJournalSuggestion({
          context: input,
          taxTreatment,
        })
      : input.documentRole === "sale"
        ? buildSaleJournalSuggestion({
            context: input,
            taxTreatment,
          })
        : {
            appliedRule,
            journalSuggestion: buildBlockedJournalSuggestion(
              ["Solo compra y venta entran en el flujo contable automatizado del MVP."],
              "No hay sugerencia contable automatica para documentos fuera de compra/venta.",
            ),
          };
  const blockers = [
    ...input.vendorResolution.blockingReasons,
    ...(input.invoiceIdentity?.blockingReasons ?? []),
    ...conceptBlockers,
    ...input.accountingContext.blockingReasons,
    ...input.assistantSuggestion.reviewFlags,
    ...taxTreatment.blockingReasons,
    ...resolved.journalSuggestion.blockingReasons,
  ].filter((value, index, array) => array.indexOf(value) === index);

  return {
    taxTreatment,
    journalSuggestion: resolved.journalSuggestion,
    vendorResolution: input.vendorResolution,
    invoiceIdentity: input.invoiceIdentity,
    conceptResolution: input.conceptResolution,
    accountingContext: input.accountingContext,
    assistantSuggestion: input.assistantSuggestion,
    appliedRule: resolved.appliedRule,
    validation: {
      canConfirm:
        blockers.length === 0
        && resolved.journalSuggestion.isBalanced
        && resolved.journalSuggestion.totalDebit > 0,
      blockers,
    },
  } satisfies DerivedDraftArtifacts;
}
