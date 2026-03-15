import type { DocumentRoleCandidate } from "@/modules/ai/document-intake-contract";
import { parseUyIssuerLocation } from "@/modules/accounting/location-parser";
import {
  findUyLocationByCity,
  normalizeUyDepartment,
} from "@/modules/accounting/uy-location-registry";

export type LocationRiskPolicy =
  | "soft_warn"
  | "warn_and_require_note"
  | "suggest_non_deductible";

export type LocationSignalSeverity = "info" | "warning" | "high";

export type LocationSignalCode =
  | "none"
  | "same_city"
  | "same_department_other_city"
  | "other_department"
  | "travel_pattern"
  | "sensitive_merchant_far_from_base"
  | "missing_location_evidence";

export type LocationRiskEvaluation = {
  locationSignalCode: LocationSignalCode;
  locationSignalSeverity: LocationSignalSeverity;
  explanation: string;
  requiresBusinessPurposeReview: boolean;
  requiresUserJustification: boolean;
  suggestedTaxProfileCode: string | null;
  suggestedExpenseFamily: string | null;
  payload: Record<string, unknown>;
};

function normalizeToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

function buildKeywordBlob(values: Array<string | null | undefined>) {
  return values
    .map((value) => normalizeToken(value))
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function includesAny(blob: string, candidates: string[]) {
  return candidates.some((candidate) => blob.includes(candidate));
}

function resolveMerchantSignal(input: {
  merchantCategoryHints: string[];
  issuerName: string | null;
  issuerAddressRaw: string | null;
  userContextText: string | null;
  operationCategory: string | null;
}) {
  const blob = buildKeywordBlob([
    input.issuerName,
    input.issuerAddressRaw,
    input.userContextText,
    input.operationCategory,
    ...input.merchantCategoryHints,
  ]);

  if (includesAny(blob, ["hotel", "hostel", "posada", "alojamiento"])) {
    return "hotel";
  }

  if (includesAny(blob, ["peaje", "peaj", "toll"])) {
    return "peaje";
  }

  if (includesAny(blob, ["pasaje", "terminal", "aeropuerto", "vuelo", "omnibus", "bus"])) {
    return "pasaje";
  }

  if (includesAny(blob, ["restaurante", "restaurant", "comida", "almuerzo", "cena", "bar", "cafe"])) {
    return "restaurante";
  }

  if (includesAny(blob, ["supermercado", "super", "almacen", "mini mercado"])) {
    return "supermercado";
  }

  if (includesAny(blob, ["farmacia", "medicamento"])) {
    return "farmacia";
  }

  if (includesAny(blob, ["combustible", "nafta", "gasoil", "estacion"])) {
    return "combustible";
  }

  if (includesAny(blob, ["tienda", "retail", "shopping", "local comercial"])) {
    return "retail_general";
  }

  return null;
}

function resolveTravelPattern(input: {
  merchantSignal: string | null;
  userContextText: string | null;
  operationCategory: string | null;
}) {
  const blob = buildKeywordBlob([
    input.userContextText,
    input.operationCategory,
  ]);

  return (
    input.merchantSignal === "hotel"
    || input.merchantSignal === "peaje"
    || input.merchantSignal === "pasaje"
    || includesAny(blob, ["viaje", "viatico", "traslado", "visita", "cliente", "obra", "ruta", "comision"])
  );
}

function shouldRequireNote(input: {
  severity: LocationSignalSeverity;
  policy: LocationRiskPolicy;
  documentRole: DocumentRoleCandidate;
  travelPattern: boolean;
}) {
  if (input.documentRole !== "purchase") {
    return false;
  }

  if (input.policy === "soft_warn") {
    return false;
  }

  if (input.severity === "high") {
    return true;
  }

  return input.policy === "warn_and_require_note" && input.travelPattern;
}

export function evaluateLocationRisk(input: {
  documentRole: DocumentRoleCandidate;
  organizationDepartment: string | null;
  organizationCity: string | null;
  locationRiskPolicy?: LocationRiskPolicy | null;
  travelRadiusKmPolicy?: number | null;
  issuerName: string | null;
  issuerAddressRaw: string | null;
  issuerDepartment: string | null;
  issuerCity: string | null;
  issuerBranchCode: string | null;
  merchantCategoryHints?: string[] | null;
  locationExtractionConfidence?: number | null;
  operationCategory?: string | null;
  userContextText?: string | null;
}) {
  const policy = input.locationRiskPolicy ?? "warn_and_require_note";
  const organizationDepartment = normalizeUyDepartment(input.organizationDepartment);
  const organizationCity =
    findUyLocationByCity({
      city: input.organizationCity,
      department: organizationDepartment,
    })?.city
    ?? normalizeToken(input.organizationCity);
  const issuerLocation = parseUyIssuerLocation({
    issuerAddressRaw: input.issuerAddressRaw,
    issuerDepartment: input.issuerDepartment,
    issuerCity: input.issuerCity,
    issuerBranchCode: input.issuerBranchCode,
    locationExtractionConfidence: input.locationExtractionConfidence ?? null,
  });
  const merchantSignal = resolveMerchantSignal({
    merchantCategoryHints: input.merchantCategoryHints ?? [],
    issuerName: input.issuerName,
    issuerAddressRaw: input.issuerAddressRaw,
    userContextText: input.userContextText ?? null,
    operationCategory: input.operationCategory ?? null,
  });
  const travelPattern = resolveTravelPattern({
    merchantSignal,
    userContextText: input.userContextText ?? null,
    operationCategory: input.operationCategory ?? null,
  });

  if (input.documentRole !== "purchase") {
    return {
      locationSignalCode: "none",
      locationSignalSeverity: "info",
      explanation: "La razonabilidad geografica fiscal se evalua solo en compras en esta etapa.",
      requiresBusinessPurposeReview: false,
      requiresUserJustification: false,
      suggestedTaxProfileCode: null,
      suggestedExpenseFamily: null,
      payload: {
        policy,
        merchant_signal: merchantSignal,
      },
    } satisfies LocationRiskEvaluation;
  }

  if (!organizationDepartment || !issuerLocation.issuerDepartment) {
    return {
      locationSignalCode: "missing_location_evidence",
      locationSignalSeverity: "info",
      explanation: "Falta evidencia suficiente para comparar la geografia del gasto contra la base operativa.",
      requiresBusinessPurposeReview: false,
      requiresUserJustification: false,
      suggestedTaxProfileCode: null,
      suggestedExpenseFamily: travelPattern ? "viaticos" : null,
      payload: {
        policy,
        organization_department: organizationDepartment,
        organization_city: organizationCity,
        issuer_department: issuerLocation.issuerDepartment,
        issuer_city: issuerLocation.issuerCity,
        issuer_branch_code: issuerLocation.issuerBranchCode,
        merchant_signal: merchantSignal,
        travel_pattern: travelPattern,
        location_confidence: issuerLocation.locationExtractionConfidence,
      },
    } satisfies LocationRiskEvaluation;
  }

  const sameDepartment = organizationDepartment === issuerLocation.issuerDepartment;
  const sameCity =
    sameDepartment
    && Boolean(organizationCity)
    && Boolean(issuerLocation.issuerCity)
    && organizationCity === issuerLocation.issuerCity;

  if (sameCity) {
    return {
      locationSignalCode: "same_city",
      locationSignalSeverity: "info",
      explanation: "La ubicacion del emisor coincide con la ciudad base de la organizacion.",
      requiresBusinessPurposeReview: false,
      requiresUserJustification: false,
      suggestedTaxProfileCode: null,
      suggestedExpenseFamily: null,
      payload: {
        policy,
        organization_department: organizationDepartment,
        organization_city: organizationCity,
        issuer_department: issuerLocation.issuerDepartment,
        issuer_city: issuerLocation.issuerCity,
        issuer_branch_code: issuerLocation.issuerBranchCode,
        merchant_signal: merchantSignal,
        travel_pattern: travelPattern,
        location_confidence: issuerLocation.locationExtractionConfidence,
      },
    } satisfies LocationRiskEvaluation;
  }

  if (sameDepartment) {
    const severity: LocationSignalSeverity = merchantSignal === "supermercado" ? "warning" : "info";
    const requiresUserJustification = shouldRequireNote({
      severity,
      policy,
      documentRole: input.documentRole,
      travelPattern,
    });

    return {
      locationSignalCode: "same_department_other_city",
      locationSignalSeverity: severity,
      explanation: "El gasto ocurre en el mismo departamento pero fuera de la ciudad base; revisar contexto si el comercio es sensible.",
      requiresBusinessPurposeReview: requiresUserJustification,
      requiresUserJustification,
      suggestedTaxProfileCode: null,
      suggestedExpenseFamily: travelPattern ? "viaticos" : null,
      payload: {
        policy,
        organization_department: organizationDepartment,
        organization_city: organizationCity,
        issuer_department: issuerLocation.issuerDepartment,
        issuer_city: issuerLocation.issuerCity,
        issuer_branch_code: issuerLocation.issuerBranchCode,
        merchant_signal: merchantSignal,
        travel_pattern: travelPattern,
        location_confidence: issuerLocation.locationExtractionConfidence,
      },
    } satisfies LocationRiskEvaluation;
  }

  if (travelPattern) {
    const severity: LocationSignalSeverity = "warning";
    const requiresUserJustification = shouldRequireNote({
      severity,
      policy,
      documentRole: input.documentRole,
      travelPattern,
    });

    return {
      locationSignalCode: "travel_pattern",
      locationSignalSeverity: severity,
      explanation: "La ubicacion y el tipo de gasto sugieren patron de viaje o viaticos. No se niega automaticamente el credito; se requiere contexto.",
      requiresBusinessPurposeReview: true,
      requiresUserJustification,
      suggestedTaxProfileCode: "UY_VAT_TRAVEL_REVIEW",
      suggestedExpenseFamily: "viaticos",
      payload: {
        policy,
        organization_department: organizationDepartment,
        organization_city: organizationCity,
        issuer_department: issuerLocation.issuerDepartment,
        issuer_city: issuerLocation.issuerCity,
        issuer_branch_code: issuerLocation.issuerBranchCode,
        merchant_signal: merchantSignal,
        travel_pattern: travelPattern,
        location_confidence: issuerLocation.locationExtractionConfidence,
        travel_radius_km_policy: input.travelRadiusKmPolicy ?? null,
      },
    } satisfies LocationRiskEvaluation;
  }

  if (merchantSignal && ["supermercado", "restaurante", "farmacia", "retail_general"].includes(merchantSignal)) {
    const severity: LocationSignalSeverity = "high";
    const requiresUserJustification = shouldRequireNote({
      severity,
      policy,
      documentRole: input.documentRole,
      travelPattern,
    });

    return {
      locationSignalCode: "sensitive_merchant_far_from_base",
      locationSignalSeverity: severity,
      explanation: "El gasto ocurre en otro departamento y el comercio es sensible para analisis de proposito empresarial.",
      requiresBusinessPurposeReview: true,
      requiresUserJustification,
      suggestedTaxProfileCode:
        policy === "suggest_non_deductible" ? "UY_VAT_NON_DEDUCTIBLE_REVIEW" : "UY_VAT_GEO_REVIEW",
      suggestedExpenseFamily:
        merchantSignal === "restaurante" ? "representacion" : "consumo_no_habitual",
      payload: {
        policy,
        organization_department: organizationDepartment,
        organization_city: organizationCity,
        issuer_department: issuerLocation.issuerDepartment,
        issuer_city: issuerLocation.issuerCity,
        issuer_branch_code: issuerLocation.issuerBranchCode,
        merchant_signal: merchantSignal,
        travel_pattern: false,
        location_confidence: issuerLocation.locationExtractionConfidence,
      },
    } satisfies LocationRiskEvaluation;
  }

  return {
    locationSignalCode: "other_department",
    locationSignalSeverity: "warning",
    explanation: "El emisor esta en otro departamento. La geografia queda como evidencia contextual, sin negar credito automaticamente.",
    requiresBusinessPurposeReview: false,
    requiresUserJustification: false,
    suggestedTaxProfileCode: null,
    suggestedExpenseFamily: null,
    payload: {
      policy,
      organization_department: organizationDepartment,
      organization_city: organizationCity,
      issuer_department: issuerLocation.issuerDepartment,
      issuer_city: issuerLocation.issuerCity,
      issuer_branch_code: issuerLocation.issuerBranchCode,
      merchant_signal: merchantSignal,
      travel_pattern: false,
      location_confidence: issuerLocation.locationExtractionConfidence,
    },
  } satisfies LocationRiskEvaluation;
}
