import type {
  AccountingLearningSuggestionSummary,
  AccountingSuggestionContext,
  LearnApprovalScope,
} from "@/modules/accounting/types";

function resolveSuggestedConceptName(input: {
  accountingContext: AccountingSuggestionContext["accountingContext"];
  conceptResolution: AccountingSuggestionContext["conceptResolution"];
}) {
  return input.accountingContext.learnedConceptName
    ?? input.conceptResolution.primaryConceptLabels[0]
    ?? null;
}

export function buildAccountingLearningSuggestions(input: {
  accountingContext: AccountingSuggestionContext["accountingContext"];
  conceptResolution: AccountingSuggestionContext["conceptResolution"];
  vendorResolution: AccountingSuggestionContext["vendorResolution"];
  operationCategory: string | null;
  appliedRule: {
    accountId: string | null;
  };
}) {
  const suggestedConceptName = resolveSuggestedConceptName({
    accountingContext: input.accountingContext,
    conceptResolution: input.conceptResolution,
  });
  const hasReusableConcept = Boolean(
    input.accountingContext.manualOverrideConceptId
    || input.conceptResolution.matchedConceptIds[0]
    || suggestedConceptName,
  );
  const hasVendor =
    input.vendorResolution.status === "matched" && Boolean(input.vendorResolution.vendorId);
  const hasOperationCategory = Boolean(input.operationCategory);
  const options: AccountingLearningSuggestionSummary["options"] = [];
  let recommendedScope: LearnApprovalScope = "none";

  if (hasVendor && hasReusableConcept && hasOperationCategory) {
    options.push({
      scope: "vendor_concept_operation_category",
      label: "Proveedor + concepto + operacion",
      reason: "Conviene cuando el mismo proveedor y concepto cambian de cuenta segun el tipo de operacion.",
      recommended: false,
      requiresConceptName: !input.conceptResolution.matchedConceptIds[0],
    });
  }

  if (hasVendor && hasReusableConcept) {
    options.push({
      scope: "vendor_concept",
      label: "Proveedor + concepto",
      reason: "Conviene cuando el criterio contable depende del proveedor y del concepto detectado.",
      recommended: false,
      requiresConceptName: !input.conceptResolution.matchedConceptIds[0],
    });
  }

  if (hasReusableConcept) {
    options.push({
      scope: "concept_global",
      label: "Concepto global",
      reason: "Reutiliza el mismo concepto canonico entre proveedores distintos.",
      recommended: false,
      requiresConceptName: !input.conceptResolution.matchedConceptIds[0],
    });
  }

  if (hasVendor) {
    options.push({
      scope: "vendor_default",
      label: "Default del proveedor",
      reason: "Sirve para proveedores recurrentes donde todavia no hay un concepto fino estable.",
      recommended: false,
      requiresConceptName: false,
    });
  }

  if (options.length > 0 && input.appliedRule.accountId) {
    if (hasVendor && hasReusableConcept && hasOperationCategory) {
      recommendedScope = "vendor_concept_operation_category";
    } else if (hasVendor && hasReusableConcept) {
      recommendedScope = "vendor_concept";
    } else if (hasReusableConcept) {
      recommendedScope = "concept_global";
    } else if (hasVendor) {
      recommendedScope = "vendor_default";
    }
  }

  return {
    suggestedConceptName,
    recommendedScope,
    options: options.map((option) => ({
      ...option,
      recommended: option.scope === recommendedScope,
    })),
  } satisfies AccountingLearningSuggestionSummary;
}
