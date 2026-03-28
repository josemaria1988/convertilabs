import type { DocumentSupportLevel } from "@/modules/documents/workflow-state";
import { isAutomaticUyVatLegalEntityType } from "@/modules/tax/uy-vat-profile";

export type LaunchSupportAssessment = {
  supportLevel: DocumentSupportLevel;
  reasons: string[];
  allowedActions: {
    canExtract: boolean;
    canReview: boolean;
    canPreview: boolean;
    canPostProvisional: boolean;
    canConfirmFinal: boolean;
  };
};

export type OrganizationLaunchScopeInput = {
  countryCode: string | null | undefined;
  legalEntityType: string | null | undefined;
  taxRegimeCode: string | null | undefined;
  vatRegime: string | null | undefined;
};

export type DocumentLaunchScopeInput = OrganizationLaunchScopeInput & {
  documentRole: string | null | undefined;
  documentType: string | null | undefined;
  currencyCode: string | null | undefined;
  functionalCurrencyCode: string | null | undefined;
  hasTrustedFxSnapshot: boolean;
  duplicateStatus?: string | null | undefined;
  isImportOperation?: boolean;
  hasImportWarnings?: boolean;
  requiresCrossCurrencySettlement?: boolean;
};

function normalizeCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function buildAllowedActions(input: {
  supportLevel: DocumentSupportLevel;
  canPostProvisional: boolean;
  canConfirmFinal: boolean;
}) {
  return {
    canExtract: input.supportLevel !== "blocked",
    canReview: input.supportLevel !== "blocked",
    canPreview: input.supportLevel !== "blocked",
    canPostProvisional: input.canPostProvisional,
    canConfirmFinal: input.canConfirmFinal,
  };
}

function isUnresolvedDuplicateStatus(value: string | null | undefined) {
  return value === "suspected_duplicate" || value === "confirmed_duplicate";
}

function isLocalStandardDocumentType(value: string | null | undefined) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return false;
  }

  if (
    normalized.includes("dua")
    || normalized.includes("import")
    || normalized.includes("aduan")
    || normalized.includes("broker")
    || normalized.includes("freight")
    || normalized.includes("insurance")
    || normalized.includes("servicio local relacionado")
  ) {
    return false;
  }

  return (
    normalized.includes("invoice")
    || normalized.includes("factura")
    || normalized.includes("ticket")
    || normalized.includes("recibo")
    || normalized.includes("nota de credito")
    || normalized.includes("credit_note")
    || normalized.includes("nota de debito")
    || normalized.includes("debit_note")
  );
}

export function evaluateOrganizationLaunchScope(
  input: OrganizationLaunchScopeInput,
) {
  const reasons: string[] = [];
  const countryCode = normalizeCode(input.countryCode);
  const taxRegimeCode = normalizeCode(input.taxRegimeCode);
  const vatRegime = normalizeCode(input.vatRegime);
  const legalEntityType = normalizeCode(input.legalEntityType);

  if (!countryCode || !legalEntityType || !taxRegimeCode || !vatRegime) {
    reasons.push("Faltan datos fiscales minimos de la organizacion para evaluar el alcance.");

    return {
      supportLevel: "blocked",
      reasons,
      allowedActions: buildAllowedActions({
        supportLevel: "blocked",
        canPostProvisional: false,
        canConfirmFinal: false,
      }),
    } satisfies LaunchSupportAssessment;
  }

  if (countryCode !== "UY") {
    reasons.push("El lanzamiento actual solo opera organizaciones de Uruguay.");
  }

  if (!isAutomaticUyVatLegalEntityType(legalEntityType)) {
    reasons.push("La forma juridica queda fuera del perimetro automatico del MVP.");
  }

  if (taxRegimeCode !== "IRAE_GENERAL") {
    reasons.push("El regimen tributario queda fuera del perimetro automatico del MVP.");
  }

  if (vatRegime !== "GENERAL") {
    reasons.push("El regimen IVA queda fuera del perimetro automatico del MVP.");
  }

  const supportLevel = reasons.length === 0 ? "automatic" : "assisted_only";

  return {
    supportLevel,
    reasons,
    allowedActions: buildAllowedActions({
      supportLevel,
      canPostProvisional: true,
      canConfirmFinal: supportLevel === "automatic",
    }),
  } satisfies LaunchSupportAssessment;
}

export function evaluateDocumentLaunchScope(
  input: DocumentLaunchScopeInput,
) {
  const organizationScope = evaluateOrganizationLaunchScope(input);
  const reasons = [...organizationScope.reasons];
  const currencyCode = normalizeCode(input.currencyCode) || "UYU";
  const functionalCurrencyCode = normalizeCode(input.functionalCurrencyCode) || "UYU";
  const documentRole = normalizeText(input.documentRole);
  const isForeignCurrency = currencyCode !== functionalCurrencyCode;
  const isImportOperation = input.isImportOperation === true;

  if (documentRole !== "purchase" && documentRole !== "sale") {
    reasons.push("El flujo automatico del MVP solo cubre compras y ventas locales estandar.");
  }

  if (!isLocalStandardDocumentType(input.documentType)) {
    reasons.push("El tipo documental no entra dentro del flujo local estandar del MVP.");
  }

  if (isImportOperation) {
    reasons.push("Las importaciones corren en modo asistido en esta etapa del producto.");
  }

  if (input.hasImportWarnings) {
    reasons.push("La importacion tiene observaciones que obligan revision manual.");
  }

  if (isUnresolvedDuplicateStatus(input.duplicateStatus)) {
    reasons.push("El documento tiene un duplicado no resuelto.");

    return {
      supportLevel: "blocked",
      reasons,
      allowedActions: buildAllowedActions({
        supportLevel: "blocked",
        canPostProvisional: false,
        canConfirmFinal: false,
      }),
    } satisfies LaunchSupportAssessment;
  }

  if (isForeignCurrency && !input.hasTrustedFxSnapshot) {
    reasons.push("El documento esta en moneda extranjera y no tiene snapshot FX confiable.");

    return {
      supportLevel: "blocked",
      reasons,
      allowedActions: buildAllowedActions({
        supportLevel: "blocked",
        canPostProvisional: false,
        canConfirmFinal: false,
      }),
    } satisfies LaunchSupportAssessment;
  }

  if (input.requiresCrossCurrencySettlement) {
    reasons.push("El settlement cross-currency queda fuera del alcance automatico del MVP.");

    return {
      supportLevel: "blocked",
      reasons,
      allowedActions: buildAllowedActions({
        supportLevel: "blocked",
        canPostProvisional: false,
        canConfirmFinal: false,
      }),
    } satisfies LaunchSupportAssessment;
  }

  if (organizationScope.supportLevel === "blocked") {
    return organizationScope;
  }

  const supportLevel = reasons.length === 0 ? "automatic" : "assisted_only";

  return {
    supportLevel,
    reasons,
    allowedActions: buildAllowedActions({
      supportLevel,
      canPostProvisional: true,
      canConfirmFinal: supportLevel === "automatic",
    }),
  } satisfies LaunchSupportAssessment;
}

export function formatLaunchSupportLevelLabel(
  value: DocumentSupportLevel,
) {
  switch (value) {
    case "automatic":
      return "Modo automatico";
    case "assisted_only":
      return "Modo asistido";
    default:
      return "Bloqueado";
  }
}
