import { resolveUyVatTreatment } from "@/modules/tax/uy-vat-engine";
import { buildJournalEntryPreview } from "@/modules/accounting/journal-entry-builder";
import { resolveAccountingRuleWithPrecedence } from "@/modules/accounting/rules";
import { resolveDocumentSettlementContext } from "@/modules/accounting/template-resolver";
import type {
  AccountingSuggestionContext,
  DerivedDraftArtifacts,
  DraftBlockerFamily,
  VatEngineResult,
} from "@/modules/accounting/types";

function unique(values: string[]) {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

function classifyBlockerFamily(blocker: string): DraftBlockerFamily {
  const normalized = blocker.toLowerCase();

  if (normalized.includes("geograf") || normalized.includes("proposito empresarial")) {
    return "razonabilidad_geografica";
  }

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
    || normalized.includes("settlement")
    || normalized.includes("plantilla")
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
      || normalized.includes("proposito empresarial")
      || normalized.includes("razonabilidad geografica")
    ) {
      return false;
    }

    return true;
  });
}

function hasManualClassificationResolution(
  context: AccountingSuggestionContext["accountingContext"],
) {
  return Boolean(
    context.manualOverrideAccountId
    || context.manualOverrideConceptId
    || context.manualOverrideOperationCategory,
  );
}

function buildAssistantBlockingReasons(input: {
  context: AccountingSuggestionContext;
  requiresPrimaryAccount: boolean;
  appliedRule: ReturnType<typeof resolveAccountingRuleWithPrecedence>;
}) {
  if (!input.requiresPrimaryAccount) {
    return [];
  }

  if (hasManualClassificationResolution(input.context.accountingContext)) {
    return [];
  }

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

function isInvoiceOperation(kind: ReturnType<typeof resolveDocumentSettlementContext>["operationKind"]) {
  return (
    kind === "sale_invoice"
    || kind === "purchase_invoice"
    || kind === "sale_credit_note"
    || kind === "purchase_credit_note"
  );
}

function buildSettlementEventTaxTreatment(input: AccountingSuggestionContext): VatEngineResult {
  const totalAmountUyu =
    input.monetarySnapshot?.totalAmountUyu
    ?? input.monetarySnapshot?.totalAmountOriginal
    ?? input.facts.total_amount
    ?? 0;

  return {
    ready: true,
    treatmentCode: "settlement_event_not_applicable",
    label: "Sin IVA directo",
    vatBucket: null,
    taxableAmount: 0,
    taxAmount: 0,
    taxableAmountUyu: 0,
    taxAmountUyu: 0,
    totalAmountUyu,
    vatCreditCategory: "not_applicable",
    vatDeductibilityStatus: "none",
    vatDirectTaxAmountUyu: 0,
    vatIndirectTaxAmountUyu: 0,
    vatDeductibleTaxAmountUyu: 0,
    vatNondeductibleTaxAmountUyu: 0,
    vatProrationCoefficient: null,
    businessLinkStatus: "linked",
    locationSignalCode: "none",
    locationSignalSeverity: "info",
    locationSignalExplanation: null,
    locationSignalPayload: {},
    requiresBusinessPurposeReview: false,
    requiresUserJustification: false,
    businessPurposeNote: input.accountingContext.businessPurposeNote,
    suggestedTaxProfileCode: null,
    suggestedExpenseFamily: null,
    rate: null,
    explanation: "El evento solo liquida un saldo previo; no genera IVA nuevo.",
    warnings: [],
    blockingReasons: [],
    normativeSummary:
      input.ruleSnapshot
        ? `Snapshot v${input.ruleSnapshot.versionNumber} desde ${input.ruleSnapshot.effectiveFrom}.`
        : "Sin snapshot activo.",
    deterministicRuleRefs: input.ruleSnapshot?.deterministicRuleRefs ?? [],
    requiresManualReview: false,
    journalSeed: null,
  } satisfies VatEngineResult;
}

export function buildAccountingDraftArtifacts(input: AccountingSuggestionContext) {
  const appliedRule = resolveAccountingRuleWithPrecedence(input);
  const settlementContext = resolveDocumentSettlementContext({
    documentRole: input.documentRole,
    documentType: input.documentType,
    intakeContext: input.intakeContext ?? null,
    facts: input.facts,
    accountingContext: input.accountingContext,
  });
  const requiresPrimaryAccount = Boolean(settlementContext.primaryAccountRole);
  const conceptBlockers =
    requiresPrimaryAccount && appliedRule.scope === "manual_review"
      ? input.conceptResolution.blockingReasons
      : [];
  const manualClassificationResolved = hasManualClassificationResolution(input.accountingContext);
  const assistantReviewFlags = manualClassificationResolved
    ? []
    : input.assistantSuggestion.reviewFlags;
  const assistantBlockers = buildAssistantBlockingReasons({
    context: input,
    requiresPrimaryAccount,
    appliedRule,
  });
  const taxTreatment =
    settlementContext.operationKind === "customer_receipt"
    || settlementContext.operationKind === "supplier_payment"
    || settlementContext.operationKind === "card_settlement"
    || settlementContext.operationKind === "bank_transfer_settlement"
    || settlementContext.operationKind === "manual_settlement_adjustment"
      ? buildSettlementEventTaxTreatment(input)
      : resolveUyVatTreatment({
          documentRole: input.documentRole,
          documentType: input.documentType,
          facts: input.facts,
          amountBreakdown: input.amountBreakdown,
          operationCategory: appliedRule.operationCategory ?? input.operationCategory,
          profile: input.profile,
          ruleSnapshot: input.ruleSnapshot,
          linkedOperationType: appliedRule.linkedOperationType,
          userContextText: input.accountingContext.userFreeText,
          businessPurposeNote: input.accountingContext.businessPurposeNote,
          vatProfile: appliedRule.vatProfileJson,
          monetarySnapshot: input.monetarySnapshot,
        });
  const journalSuggestion = buildJournalEntryPreview({
    documentRole: input.documentRole,
    facts: input.facts,
    monetarySnapshot: input.monetarySnapshot,
    settlementContext,
    taxTreatment,
    appliedRule,
    manualRoleOverrides: input.accountingContext.manualRoleOverrides,
    accounts: input.accounts,
    accountRoleBindings: input.accountRoleBindings,
  });
  const blockers = [
    ...(input.monetarySnapshot?.fx.blockingReasons ?? []),
    ...input.vendorResolution.blockingReasons,
    ...(isInvoiceOperation(settlementContext.operationKind)
      ? (input.invoiceIdentity?.blockingReasons ?? [])
      : []),
    ...conceptBlockers,
    ...input.accountingContext.blockingReasons,
    ...assistantReviewFlags,
    ...assistantBlockers,
    ...taxTreatment.blockingReasons,
    ...settlementContext.blockers,
    ...journalSuggestion.blockingReasons,
  ].filter((value, index, array) => array.indexOf(value) === index);
  const finalBlockers = unique(blockers);
  const provisionalBlockers = buildProvisionalBlockers(finalBlockers);
  const canPostProvisional =
    provisionalBlockers.length === 0
    && journalSuggestion.isBalanced
    && journalSuggestion.totalDebit > 0
    && taxTreatment.ready;
  const canConfirmFinal =
    finalBlockers.length === 0
    && journalSuggestion.isBalanced
    && journalSuggestion.totalDebit > 0
    && !journalSuggestion.hasProvisionalAccounts;

  return {
    monetarySnapshot: input.monetarySnapshot,
    taxTreatment,
    journalSuggestion,
    vendorResolution: input.vendorResolution,
    invoiceIdentity: input.invoiceIdentity,
    conceptResolution: input.conceptResolution,
    accountingContext: input.accountingContext,
    assistantSuggestion: input.assistantSuggestion,
    appliedRule,
    settlementContext,
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
