import type {
  AccountingContextResolution,
  ConceptResolutionResult,
  ResolvedAccountingRule,
  VendorResolutionResult,
} from "@/modules/accounting/types";

export type RuleApplicationExplanation = {
  title: string;
  summary: string;
  matchedPredicates: string[];
  impactSummary: string[];
  riskNotes: string[];
  canOverride: boolean;
};

function formatScopeLabel(scope: ResolvedAccountingRule["scope"]) {
  switch (scope) {
    case "document_override":
      return "Override puntual del documento";
    case "vendor_concept_operation_category":
      return "Proveedor + concepto + tipo de operacion";
    case "vendor_concept":
      return "Proveedor + concepto";
    case "concept_global":
      return "Concepto global";
    case "vendor_default":
      return "Default del proveedor";
    case "assistant":
      return "Asistente contable";
    default:
      return "Revision manual";
  }
}

export function buildRuleApplicationExplanation(input: {
  appliedRule: ResolvedAccountingRule;
  vendorResolution: VendorResolutionResult;
  conceptResolution: ConceptResolutionResult;
  accountingContext: AccountingContextResolution;
}) {
  const matchedPredicates = [
    input.vendorResolution.vendorName
      ? `Proveedor resuelto: ${input.vendorResolution.vendorName}`
      : null,
    input.conceptResolution.primaryConceptLabels[0]
      ? `Concepto principal: ${input.conceptResolution.primaryConceptLabels[0]}`
      : null,
    input.appliedRule.operationCategory
      ? `Operacion: ${input.appliedRule.operationCategory}`
      : null,
    input.appliedRule.priority !== null
      ? `Prioridad: ${input.appliedRule.priority}`
      : null,
    input.appliedRule.provenance
      ? `Provenance: ${input.appliedRule.provenance}`
      : null,
  ].filter((value): value is string => Boolean(value));
  const impactSummary = [
    input.appliedRule.accountCode && input.appliedRule.accountName
      ? `Cuenta aplicada: ${input.appliedRule.accountCode} - ${input.appliedRule.accountName}`
      : "No hay cuenta reusable aplicada.",
    input.appliedRule.taxProfileCode
      ? `Tax profile sugerido: ${input.appliedRule.taxProfileCode}`
      : "Sin tax profile explicito.",
    input.appliedRule.templateCode
      ? `Template sugerido: ${input.appliedRule.templateCode}`
      : "Sin template contable explicito.",
  ];
  const riskNotes = [
    input.appliedRule.accountIsProvisional
      ? "La cuenta seleccionada es provisional y conviene revisarla antes del cierre final."
      : null,
    input.appliedRule.scope === "assistant"
      ? "La decision depende del asistente y no de una regla reusable confirmada."
      : null,
    ...input.accountingContext.blockingReasons,
  ].filter((value): value is string => Boolean(value));

  return {
    title: `Regla aplicada: ${formatScopeLabel(input.appliedRule.scope)}`,
    summary:
      input.appliedRule.scope === "manual_review"
        ? "No se encontro una regla reusable ganadora; el documento sigue dependiendo de revision manual."
        : `El sistema resolvio esta clasificacion usando ${formatScopeLabel(input.appliedRule.scope).toLowerCase()}.`,
    matchedPredicates,
    impactSummary,
    riskNotes,
    canOverride: input.appliedRule.scope !== "manual_review",
  } satisfies RuleApplicationExplanation;
}
