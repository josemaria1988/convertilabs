import { resolveUyVatTreatment } from "@/modules/tax/uy-vat-engine";
import { resolveAccountingRuleWithPrecedence } from "@/modules/accounting/rules";
import {
  buildBlockedJournalSuggestion,
  buildJournalLine,
  buildJournalMonetaryContext,
  finalizeJournalSuggestion,
  resolveSystemAccount,
} from "@/modules/accounting/journal-builder";
import type {
  AccountingSuggestionContext,
  DerivedDraftArtifacts,
} from "@/modules/accounting/types";

function buildPurchaseJournalSuggestion(input: {
  context: AccountingSuggestionContext;
  taxTreatment: ReturnType<typeof resolveUyVatTreatment>;
}) {
  const appliedRule = resolveAccountingRuleWithPrecedence(input.context);
  const blockers = [
    ...input.context.accountingContext.blockingReasons,
    ...input.context.assistantSuggestion.reviewFlags,
  ];
  const monetary = buildJournalMonetaryContext({
    currencyCode: input.context.facts.currency_code,
    documentDate: input.context.facts.document_date,
  });

  if (!appliedRule.accountId || !appliedRule.accountCode || !appliedRule.accountName) {
    blockers.push("Falta una cuenta contable postable resuelta para el documento.");
  }

  if (!input.taxTreatment.ready || !input.taxTreatment.journalSeed) {
    return {
      appliedRule,
      journalSuggestion: buildBlockedJournalSuggestion({
        blockingReasons: [...blockers, ...input.taxTreatment.blockingReasons],
        explanation: "La sugerencia contable queda bloqueada hasta que el tratamiento IVA sea confirmable.",
        monetary,
      }),
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
      journalSuggestion: buildBlockedJournalSuggestion({
        blockingReasons: blockers,
        explanation: "La sugerencia contable se bloqueo porque faltan mappings contables obligatorios.",
        monetary,
      }),
    };
  }

  const lines = [
    buildJournalLine({
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
      monetary,
    }),
  ];

  if (
    input.taxTreatment.vatBucket === "input_creditable"
    && input.taxTreatment.taxAmount > 0
    && vatAccount
  ) {
    lines.push(buildJournalLine({
      lineNumber: 2,
      accountId: vatAccount.id,
      accountCode: vatAccount.code,
      accountName: vatAccount.name,
      debit: input.taxTreatment.taxAmount,
      credit: 0,
      provenance: "system_role:vat_input_creditable",
      taxTag: "vat_input_creditable",
      monetary,
    }));
  }

  lines.push(buildJournalLine({
    lineNumber: lines.length + 1,
    accountId: counterparty!.id,
    accountCode: counterparty!.code,
    accountName: counterparty!.name,
    debit: 0,
    credit: input.taxTreatment.journalSeed.totalAmount,
    provenance: "system_role:accounts_payable",
    taxTag: null,
    monetary,
  }));

  return {
    appliedRule,
    journalSuggestion: finalizeJournalSuggestion({
      lines,
      explanation: `Asiento sugerido con precedencia ${appliedRule.scope} y tratamiento ${input.taxTreatment.label.toLowerCase()}.`,
      blockingReasons: [],
      monetary,
    }),
  };
}

function buildSaleJournalSuggestion(input: {
  context: AccountingSuggestionContext;
  taxTreatment: ReturnType<typeof resolveUyVatTreatment>;
}) {
  const appliedRule = resolveAccountingRuleWithPrecedence(input.context);
  const blockers = [
    ...input.context.accountingContext.blockingReasons,
    ...input.context.assistantSuggestion.reviewFlags,
  ];
  const monetary = buildJournalMonetaryContext({
    currencyCode: input.context.facts.currency_code,
    documentDate: input.context.facts.document_date,
  });

  if (!appliedRule.accountId || !appliedRule.accountCode || !appliedRule.accountName) {
    blockers.push("Falta una cuenta de ingreso postable resuelta para el documento.");
  }

  if (!input.taxTreatment.ready || !input.taxTreatment.journalSeed) {
    return {
      appliedRule,
      journalSuggestion: buildBlockedJournalSuggestion({
        blockingReasons: [...blockers, ...input.taxTreatment.blockingReasons],
        explanation: "La sugerencia contable queda bloqueada hasta que el tratamiento IVA sea confirmable.",
        monetary,
      }),
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
      journalSuggestion: buildBlockedJournalSuggestion({
        blockingReasons: blockers,
        explanation: "La sugerencia contable se bloqueo porque faltan mappings contables obligatorios.",
        monetary,
      }),
    };
  }

  const lines = [
    buildJournalLine({
      lineNumber: 1,
      accountId: counterparty!.id,
      accountCode: counterparty!.code,
      accountName: counterparty!.name,
      debit: input.taxTreatment.journalSeed.totalAmount,
      credit: 0,
      provenance: "system_role:accounts_receivable",
      taxTag: null,
      monetary,
    }),
    buildJournalLine({
      lineNumber: 2,
      accountId: appliedRule.accountId,
      accountCode: appliedRule.accountCode!,
      accountName: appliedRule.accountName!,
      debit: 0,
      credit: input.taxTreatment.taxableAmount,
      provenance: appliedRule.provenance,
      taxTag: "vat_sale_base",
      monetary,
    }),
  ];

  if (input.taxTreatment.taxAmount > 0 && vatAccount) {
    lines.push(buildJournalLine({
      lineNumber: 3,
      accountId: vatAccount.id,
      accountCode: vatAccount.code,
      accountName: vatAccount.name,
      debit: 0,
      credit: input.taxTreatment.taxAmount,
      provenance: "system_role:vat_output_payable",
      taxTag: "vat_output_payable",
      monetary,
    }));
  }

  return {
    appliedRule,
    journalSuggestion: finalizeJournalSuggestion({
      lines,
      explanation: `Asiento sugerido con precedencia ${appliedRule.scope} y tratamiento ${input.taxTreatment.label.toLowerCase()}.`,
      blockingReasons: [],
      monetary,
    }),
  };
}

export function buildAccountingDraftArtifacts(input: AccountingSuggestionContext) {
  const appliedRule = resolveAccountingRuleWithPrecedence(input);
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
            journalSuggestion: buildBlockedJournalSuggestion({
              blockingReasons: ["Solo compra y venta entran en el flujo contable automatizado del MVP."],
              explanation: "No hay sugerencia contable automatica para documentos fuera de compra/venta.",
              monetary: buildJournalMonetaryContext({
                currencyCode: input.facts.currency_code,
                documentDate: input.facts.document_date,
              }),
            }),
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
