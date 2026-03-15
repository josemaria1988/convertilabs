import { resolveUyVatTreatment } from "@/modules/tax/uy-vat-engine";
import { resolveJournalTemplateCode } from "@/modules/accounting/journal-templates";
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
  DraftBlockerFamily,
} from "@/modules/accounting/types";

function unique(values: string[]) {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

function classifyBlockerFamily(blocker: string): DraftBlockerFamily {
  const normalized = blocker.toLowerCase();

  if (normalized.includes("duplicad")) {
    return "duplicados";
  }

  if (normalized.includes("period") || normalized.includes("cierre")) {
    return "periodo";
  }

  if (normalized.includes("iva") || normalized.includes("fiscal") || normalized.includes("prorrata")) {
    return "fiscal";
  }

  if (normalized.includes("ia") || normalized.includes("asistente")) {
    return "ia";
  }

  if (
    normalized.includes("cuenta")
    || normalized.includes("contable")
    || normalized.includes("journal")
    || normalized.includes("contrapartida")
  ) {
    return "contable";
  }

  return "documental";
}

function buildBlockerGroups(blockers: string[]) {
  const groups = new Map<DraftBlockerFamily, string[]>();

  for (const blocker of blockers) {
    const family = classifyBlockerFamily(blocker);
    const current = groups.get(family) ?? [];
    current.push(blocker);
    groups.set(family, unique(current));
  }

  return Array.from(groups.entries()).map(([family, familyBlockers]) => ({
    family,
    blockers: familyBlockers,
  }));
}

function buildProvisionalBlockers(blockers: string[]) {
  return blockers.filter((blocker) => {
    const normalized = blocker.toLowerCase();

    if (
      normalized.includes("segunda ia")
      || normalized.includes("baja confianza")
      || normalized.includes("resolucion contable confiable")
      || normalized.includes("cuenta de ingreso postable resuelta")
      || normalized.includes("cuenta contable postable resuelta")
    ) {
      return false;
    }

    return true;
  });
}

function buildAssistantBlockingReasons(input: {
  context: AccountingSuggestionContext;
  appliedRule: ReturnType<typeof resolveAccountingRuleWithPrecedence>;
}) {
  const blockers: string[] = [];
  const contextStatus = input.context.accountingContext.status;
  const assistant = input.context.assistantSuggestion;
  const assistantWorkflowActive =
    contextStatus === "provided"
    || contextStatus === "assistant_completed"
    || assistant.status === "completed";

  if (
    assistant.status === "failed"
    && assistantWorkflowActive
    && !input.context.accountingContext.manualOverrideAccountId
  ) {
    blockers.push(
      "La segunda IA no pudo completar la clasificacion y el documento requiere override manual o una regla confiable.",
    );
  }

  if (assistant.shouldBlockConfirmation) {
    blockers.push(
      "La segunda IA marco el documento para revision manual antes de confirmar.",
    );
  }

  if (input.appliedRule.scope === "assistant") {
    if ((assistant.confidence ?? 0) < 0.75) {
      blockers.push(
        "La segunda IA devolvio baja confianza y requiere revision manual antes de confirmar.",
      );
    }

    if (!assistant.output?.suggestedAccountId) {
      blockers.push(
        "La segunda IA no pudo elegir una cuenta permitida para confirmar el documento.",
      );
    }
  }

  if (
    assistantWorkflowActive
    && input.appliedRule.scope === "manual_review"
    && !input.context.accountingContext.manualOverrideAccountId
  ) {
    blockers.push(
      "Aun falta una resolucion contable confiable despues del contexto del usuario.",
    );
  }

  return blockers.filter((value, index, array) => array.indexOf(value) === index);
}

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
    currencyCode: input.context.monetarySnapshot?.currencyCode ?? input.context.facts.currency_code,
    documentDate:
      input.context.monetarySnapshot?.fx.documentDate ?? input.context.facts.document_date,
    functionalCurrencyCode: input.context.monetarySnapshot?.fx.functionalCurrencyCode,
    fxRate: input.context.monetarySnapshot?.fx.rate,
    fxRateSource: input.context.monetarySnapshot?.fx.source,
    fxRateBcuValue: input.context.monetarySnapshot?.fx.bcuValue,
    fxRateBcuDateUsed: input.context.monetarySnapshot?.fx.bcuDateUsed,
    fxRateBcuSeries: input.context.monetarySnapshot?.fx.bcuSeries,
  });
  const templateCode = resolveJournalTemplateCode({
    documentRole: input.context.documentRole,
    operationFamily: appliedRule.operationCategory,
    linkedOperationType: appliedRule.linkedOperationType,
    vatCreditCategory: input.taxTreatment.vatBucket === "input_non_deductible"
      ? "input_non_deductible"
      : "input_direct",
    vatRate: input.taxTreatment.rate,
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
        postingMode: "final",
        hasProvisionalAccounts: false,
        templateCode,
        taxProfileCode: appliedRule.taxProfileCode,
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
        postingMode: appliedRule.accountIsProvisional ? "provisional" : "final",
        hasProvisionalAccounts: appliedRule.accountIsProvisional,
        templateCode,
        taxProfileCode: appliedRule.taxProfileCode,
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
      postingMode: appliedRule.accountIsProvisional ? "provisional" : "final",
      hasProvisionalAccounts: appliedRule.accountIsProvisional,
      templateCode,
      taxProfileCode: appliedRule.taxProfileCode,
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
    currencyCode: input.context.monetarySnapshot?.currencyCode ?? input.context.facts.currency_code,
    documentDate:
      input.context.monetarySnapshot?.fx.documentDate ?? input.context.facts.document_date,
    functionalCurrencyCode: input.context.monetarySnapshot?.fx.functionalCurrencyCode,
    fxRate: input.context.monetarySnapshot?.fx.rate,
    fxRateSource: input.context.monetarySnapshot?.fx.source,
    fxRateBcuValue: input.context.monetarySnapshot?.fx.bcuValue,
    fxRateBcuDateUsed: input.context.monetarySnapshot?.fx.bcuDateUsed,
    fxRateBcuSeries: input.context.monetarySnapshot?.fx.bcuSeries,
  });
  const templateCode = resolveJournalTemplateCode({
    documentRole: input.context.documentRole,
    operationFamily: appliedRule.operationCategory,
    linkedOperationType: appliedRule.linkedOperationType,
    vatCreditCategory: "not_applicable",
    vatRate: input.taxTreatment.rate,
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
        postingMode: "final",
        hasProvisionalAccounts: false,
        templateCode,
        taxProfileCode: appliedRule.taxProfileCode,
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
        postingMode: appliedRule.accountIsProvisional ? "provisional" : "final",
        hasProvisionalAccounts: appliedRule.accountIsProvisional,
        templateCode,
        taxProfileCode: appliedRule.taxProfileCode,
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
      postingMode: appliedRule.accountIsProvisional ? "provisional" : "final",
      hasProvisionalAccounts: appliedRule.accountIsProvisional,
      templateCode,
      taxProfileCode: appliedRule.taxProfileCode,
    }),
  };
}

export function buildAccountingDraftArtifacts(input: AccountingSuggestionContext) {
  const appliedRule = resolveAccountingRuleWithPrecedence(input);
  const conceptBlockers =
    appliedRule.scope === "manual_review"
      ? input.conceptResolution.blockingReasons
      : [];
  const assistantBlockers = buildAssistantBlockingReasons({
    context: input,
    appliedRule,
  });
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
    monetarySnapshot: input.monetarySnapshot,
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
                currencyCode: input.monetarySnapshot?.currencyCode ?? input.facts.currency_code,
                documentDate:
                  input.monetarySnapshot?.fx.documentDate ?? input.facts.document_date,
                functionalCurrencyCode: input.monetarySnapshot?.fx.functionalCurrencyCode,
                fxRate: input.monetarySnapshot?.fx.rate,
                fxRateSource: input.monetarySnapshot?.fx.source,
                fxRateBcuValue: input.monetarySnapshot?.fx.bcuValue,
                fxRateBcuDateUsed: input.monetarySnapshot?.fx.bcuDateUsed,
                fxRateBcuSeries: input.monetarySnapshot?.fx.bcuSeries,
              }),
              postingMode: "final",
              hasProvisionalAccounts: false,
              templateCode: null,
              taxProfileCode: null,
            }),
          };
  const blockers = [
    ...input.vendorResolution.blockingReasons,
    ...(input.invoiceIdentity?.blockingReasons ?? []),
    ...conceptBlockers,
    ...input.accountingContext.blockingReasons,
    ...input.assistantSuggestion.reviewFlags,
    ...assistantBlockers,
    ...taxTreatment.blockingReasons,
    ...resolved.journalSuggestion.blockingReasons,
  ].filter((value, index, array) => array.indexOf(value) === index);

  const finalBlockers = unique(blockers);
  const provisionalBlockers = buildProvisionalBlockers(finalBlockers);
  const canPostProvisional =
    provisionalBlockers.length === 0
    && resolved.journalSuggestion.isBalanced
    && resolved.journalSuggestion.totalDebit > 0
    && taxTreatment.ready;
  const canConfirmFinal =
    finalBlockers.length === 0
    && resolved.journalSuggestion.isBalanced
    && resolved.journalSuggestion.totalDebit > 0
    && !resolved.journalSuggestion.hasProvisionalAccounts;

  return {
    monetarySnapshot: input.monetarySnapshot,
    taxTreatment,
    journalSuggestion: resolved.journalSuggestion,
    vendorResolution: input.vendorResolution,
    invoiceIdentity: input.invoiceIdentity,
    conceptResolution: input.conceptResolution,
    accountingContext: input.accountingContext,
    assistantSuggestion: input.assistantSuggestion,
    appliedRule: resolved.appliedRule,
    validation: {
      canConfirm: canConfirmFinal,
      blockers: finalBlockers,
      canPostProvisional,
      canConfirmFinal,
      postingStatus: canPostProvisional ? "vat_ready" : "draft",
      blockerGroups: buildBlockerGroups(finalBlockers),
    },
  } satisfies DerivedDraftArtifacts;
}
