import type { ImportLinkedDocumentType } from "@/modules/imports/types";

export type ImportReviewPolicyStatus =
  | "not_import"
  | "assisted_ok"
  | "manual_required"
  | "blocked";

export type ImportReviewPolicyResult = {
  status: ImportReviewPolicyStatus;
  reasons: string[];
  indicators: string[];
  isImportFlow: boolean;
  canPostProvisional: boolean;
  canConfirmFinal: boolean;
};

type ImportReviewPolicyInput = {
  documentKind: ImportLinkedDocumentType;
  warnings: string[];
  duaNumber: string | null;
  referenceCode: string | null;
  currencyCode: string | null;
  operationDate: string | null;
  paymentDate: string | null;
  looksLikeLocalExpense: boolean;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function hasManualWarning(warnings: string[]) {
  return warnings.some((warning) => {
    const normalized = normalizeText(warning);

    return (
      normalized.includes("zona franca")
      || normalized.includes("suspenso")
      || normalized.includes("reliquid")
      || normalized.includes("exoner")
      || normalized.includes("parcial")
      || normalized.includes("conflicto")
    );
  });
}

function hasImportIndicators(input: ImportReviewPolicyInput) {
  const explicitImportKind =
    input.documentKind === "dua"
    || input.documentKind === "broker_invoice"
    || input.documentKind === "freight_invoice"
    || input.documentKind === "insurance_invoice"
    || input.documentKind === "local_related_service";

  return (
    explicitImportKind
    || (
      input.documentKind === "commercial_invoice"
      && (Boolean(input.duaNumber) || Boolean(input.referenceCode))
    )
    || Boolean(input.duaNumber)
    || Boolean(input.referenceCode)
    || input.looksLikeLocalExpense
    || input.warnings.length > 0
  );
}

export function evaluateImportReviewPolicy(
  input: ImportReviewPolicyInput,
) {
  const indicators = [
    input.documentKind !== "unknown" ? `document_kind:${input.documentKind}` : null,
    input.duaNumber ? "dua_number" : null,
    input.referenceCode ? "reference_code" : null,
    input.looksLikeLocalExpense ? "local_related_expense" : null,
    hasManualWarning(input.warnings) ? "warning_requires_manual_review" : null,
  ].filter((value): value is string => Boolean(value));
  const isImportFlow = hasImportIndicators(input);

  if (!isImportFlow) {
    return {
      status: "not_import",
      reasons: [],
      indicators: [],
      isImportFlow: false,
      canPostProvisional: true,
      canConfirmFinal: true,
    } satisfies ImportReviewPolicyResult;
  }

  const reasons: string[] = [
    "Las importaciones quedan en modo asistido para esta etapa del MVP.",
  ];

  if (hasManualWarning(input.warnings)) {
    reasons.push("La documentacion incluye observaciones que obligan revision manual.");

    return {
      status: "manual_required",
      reasons,
      indicators,
      isImportFlow: true,
      canPostProvisional: true,
      canConfirmFinal: false,
    } satisfies ImportReviewPolicyResult;
  }

  if (input.documentKind === "unknown") {
    reasons.push("No pudimos identificar con confianza el tipo de documento de importacion.");

    return {
      status: "blocked",
      reasons,
      indicators,
      isImportFlow: true,
      canPostProvisional: false,
      canConfirmFinal: false,
    } satisfies ImportReviewPolicyResult;
  }

  if (!input.referenceCode && input.documentKind === "dua") {
    reasons.push("Falta una referencia aduanera confiable para consolidar la operacion.");

    return {
      status: "blocked",
      reasons,
      indicators,
      isImportFlow: true,
      canPostProvisional: false,
      canConfirmFinal: false,
    } satisfies ImportReviewPolicyResult;
  }

  if (input.looksLikeLocalExpense) {
    reasons.push("El documento parece gasto local relacionado y requiere confirmacion manual de tratamiento.");

    return {
      status: "manual_required",
      reasons,
      indicators,
      isImportFlow: true,
      canPostProvisional: true,
      canConfirmFinal: false,
    } satisfies ImportReviewPolicyResult;
  }

  if (!input.operationDate) {
    reasons.push("Falta fecha operativa confiable para la importacion.");

    return {
      status: "blocked",
      reasons,
      indicators,
      isImportFlow: true,
      canPostProvisional: false,
      canConfirmFinal: false,
    } satisfies ImportReviewPolicyResult;
  }

  if (!input.currencyCode) {
    reasons.push("Falta la moneda del documento para tratar la importacion con trazabilidad.");

    return {
      status: "blocked",
      reasons,
      indicators,
      isImportFlow: true,
      canPostProvisional: false,
      canConfirmFinal: false,
    } satisfies ImportReviewPolicyResult;
  }

  return {
    status: "assisted_ok",
    reasons,
    indicators,
    isImportFlow: true,
    canPostProvisional: true,
    canConfirmFinal: false,
  } satisfies ImportReviewPolicyResult;
}
