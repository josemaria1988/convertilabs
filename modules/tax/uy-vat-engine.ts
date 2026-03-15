import type {
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentRoleCandidate,
} from "@/modules/ai/document-intake-contract";
import {
  evaluateLocationRisk,
  type LocationRiskEvaluation,
  type LocationRiskPolicy,
  type LocationSignalCode,
  type LocationSignalSeverity,
} from "@/modules/accounting/location-risk-engine";
import { getUyVatFeatureFlags } from "@/modules/tax/feature-flags";
import { isAutomaticUyVatLegalEntityType } from "@/modules/tax/uy-vat-profile";

type DeterministicRuleRef = {
  id: string | null;
  scope: string | null;
  priority: number | null;
  sourceReference: string | null;
};

type OrganizationFiscalProfile = {
  countryCode: string;
  legalEntityType: string;
  taxRegimeCode: string;
  vatRegime: string;
  dgiGroup: string;
  cfeStatus: string;
  taxId: string;
  fiscalDepartment?: string | null;
  fiscalCity?: string | null;
  fiscalAddressText?: string | null;
  locationRiskPolicy?: LocationRiskPolicy | null;
  travelRadiusKmPolicy?: number | null;
};

type OrganizationRuleSnapshotContext = {
  id: string;
  versionNumber: number;
  effectiveFrom: string;
  promptSummary: string;
  deterministicRuleRefs: DeterministicRuleRef[];
};

type VatBucket =
  | "input_creditable"
  | "input_non_deductible"
  | "input_exempt"
  | "output_vat"
  | null;

type VatCreditCategory =
  | "input_direct"
  | "input_indirect"
  | "input_import"
  | "input_non_deductible"
  | "not_applicable";

type VatDeductibilityStatus =
  | "full"
  | "partial_prorrata"
  | "none"
  | "pending_review";

type BusinessLinkStatus =
  | "linked"
  | "not_linked"
  | "needs_review";

type VatJournalSeed = {
  counterpartyRole: "accounts_payable" | "accounts_receivable";
  vatRole: "vat_input_creditable" | "vat_output_payable" | null;
  amountExcludingVat: number;
  totalAmount: number;
  vatAmount: number;
};

export type VatEngineResult = {
  ready: boolean;
  treatmentCode: string;
  label: string;
  vatBucket: VatBucket;
  taxableAmount: number;
  taxAmount: number;
  taxableAmountUyu: number;
  taxAmountUyu: number;
  totalAmountUyu: number;
  vatCreditCategory: VatCreditCategory;
  vatDeductibilityStatus: VatDeductibilityStatus;
  vatDirectTaxAmountUyu: number;
  vatIndirectTaxAmountUyu: number;
  vatDeductibleTaxAmountUyu: number;
  vatNondeductibleTaxAmountUyu: number;
  vatProrationCoefficient: number | null;
  businessLinkStatus: BusinessLinkStatus;
  locationSignalCode: LocationSignalCode;
  locationSignalSeverity: LocationSignalSeverity;
  locationSignalExplanation: string | null;
  locationSignalPayload: Record<string, unknown>;
  requiresBusinessPurposeReview: boolean;
  requiresUserJustification: boolean;
  businessPurposeNote: string | null;
  suggestedTaxProfileCode: string | null;
  suggestedExpenseFamily: string | null;
  rate: number | null;
  explanation: string;
  warnings: string[];
  blockingReasons: string[];
  normativeSummary: string;
  deterministicRuleRefs: DeterministicRuleRef[];
  requiresManualReview: boolean;
  journalSeed: VatJournalSeed | null;
};

type VatEngineInput = {
  documentRole: DocumentRoleCandidate;
  documentType?: string | null;
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  operationCategory: string | null;
  profile: OrganizationFiscalProfile | null;
  ruleSnapshot: OrganizationRuleSnapshotContext | null;
  linkedOperationType?: string | null;
  userContextText?: string | null;
  businessPurposeNote?: string | null;
  vatProfile?: Record<string, unknown> | null;
  monetarySnapshot?: {
    currencyCode: string;
    netAmountOriginal: number;
    taxAmountOriginal: number;
    totalAmountOriginal: number;
    netAmountUyu: number;
    taxAmountUyu: number;
    totalAmountUyu: number;
  } | null;
};

type PurchaseCategory = {
  code: string;
  label: string;
  accountCode: string;
  accountName: string;
  keywords: string[];
  vatBucket: Exclude<VatBucket, "output_vat" | null>;
};

type SaleCategory = {
  code: string;
  label: string;
  accountCode: string;
  accountName: string;
  keywords: string[];
  rate: 0 | 10 | 22;
};

const purchaseCategories: PurchaseCategory[] = [
  {
    code: "goods_resale",
    label: "Mercaderias para reventa",
    accountCode: "5101",
    accountName: "Mercaderias para reventa",
    keywords: ["mercader", "reventa", "stock", "inventario"],
    vatBucket: "input_creditable",
  },
  {
    code: "services",
    label: "Servicios",
    accountCode: "5201",
    accountName: "Servicios",
    keywords: ["servicio", "service"],
    vatBucket: "input_creditable",
  },
  {
    code: "admin_expense",
    label: "Gastos administrativos / oficina",
    accountCode: "6101",
    accountName: "Gastos administrativos",
    keywords: ["oficina", "administr", "papeler", "licencia"],
    vatBucket: "input_creditable",
  },
  {
    code: "transport",
    label: "Transporte / fletes",
    accountCode: "6199",
    accountName: "Transporte y fletes",
    keywords: ["transporte", "flete", "envio", "logistica"],
    vatBucket: "input_creditable",
  },
  {
    code: "fuel_and_lubricants",
    label: "Combustible y lubricantes",
    accountCode: "6125",
    accountName: "Combustible y lubricantes",
    keywords: ["combustible", "nafta", "gasoil", "lubric"],
    vatBucket: "input_non_deductible",
  },
  {
    code: "professional_fees",
    label: "Honorarios profesionales",
    accountCode: "6210",
    accountName: "Honorarios profesionales",
    keywords: ["honorario", "profesional", "contador", "abogado"],
    vatBucket: "input_creditable",
  },
  {
    code: "rent",
    label: "Alquileres",
    accountCode: "6220",
    accountName: "Alquileres",
    keywords: ["alquiler", "arrendamiento", "rent"],
    vatBucket: "input_creditable",
  },
];

const saleCategories: SaleCategory[] = [
  {
    code: "taxed_basic_22",
    label: "Gravadas basico (22%)",
    accountCode: "4101",
    accountName: "Ventas gravadas 22%",
    keywords: ["22", "basico", "gravada"],
    rate: 22,
  },
  {
    code: "taxed_minimum_10",
    label: "Gravadas minimo (10%)",
    accountCode: "4102",
    accountName: "Ventas gravadas 10%",
    keywords: ["10", "minimo"],
    rate: 10,
  },
  {
    code: "exempt_or_export",
    label: "Exentas / exportaciones",
    accountCode: "4103",
    accountName: "Ventas exentas o exportacion",
    keywords: ["exenta", "export", "exonerada"],
    rate: 0,
  },
  {
    code: "non_taxed",
    label: "No gravadas",
    accountCode: "4104",
    accountName: "Ventas no gravadas",
    keywords: ["no grav", "sin iva"],
    rate: 0,
  },
];

function roundCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100) / 100;
}

function normalizeToken(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function resolveVatProfileBucket(vatProfile: Record<string, unknown> | null | undefined) {
  const bucket = typeof vatProfile?.vat_bucket === "string"
    ? vatProfile.vat_bucket
    : typeof vatProfile?.vatBucket === "string"
      ? vatProfile.vatBucket
      : null;

  if (
    bucket === "input_creditable"
    || bucket === "input_non_deductible"
    || bucket === "input_exempt"
    || bucket === "output_vat"
  ) {
    return bucket;
  }

  if (vatProfile?.deductible === false) {
    return "input_non_deductible";
  }

  return null;
}

function inferTaxRate(
  amountBreakdown: DocumentIntakeAmountBreakdown[],
  facts: DocumentIntakeFactMap,
) {
  const explicitRates = amountBreakdown
    .map((entry) => entry.tax_rate)
    .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));

  if (explicitRates.includes(22)) {
    return 22;
  }

  if (explicitRates.includes(10)) {
    return 10;
  }

  if (
    typeof facts.subtotal === "number"
    && typeof facts.tax_amount === "number"
    && facts.subtotal > 0
    && facts.tax_amount > 0
  ) {
    const ratio = Math.round((facts.tax_amount / facts.subtotal) * 100);

    if (Math.abs(ratio - 22) <= 1) {
      return 22;
    }

    if (Math.abs(ratio - 10) <= 1) {
      return 10;
    }
  }

  return null;
}

function resolvePurchaseCategory(code: string | null) {
  const normalizedCode = normalizeToken(code);

  if (!normalizedCode) {
    return null;
  }

  return (
    purchaseCategories.find((category) => category.code === normalizedCode)
    ?? purchaseCategories.find((category) =>
      category.keywords.some((keyword) => normalizedCode.includes(keyword)))
    ?? null
  );
}

function resolveSaleCategory(code: string | null, rate: number | null) {
  const normalizedCode = normalizeToken(code);

  if (normalizedCode) {
    const exact = saleCategories.find((category) => category.code === normalizedCode);

    if (exact) {
      return exact;
    }

    const keywordMatch = saleCategories.find((category) =>
      category.keywords.some((keyword) => normalizedCode.includes(keyword)));

    if (keywordMatch) {
      return keywordMatch;
    }
  }

  if (rate === 22) {
    return saleCategories.find((category) => category.code === "taxed_basic_22") ?? null;
  }

  if (rate === 10) {
    return saleCategories.find((category) => category.code === "taxed_minimum_10") ?? null;
  }

  return null;
}

function hasAnyKeyword(value: string | null, keywords: string[]) {
  const normalized = normalizeToken(value);
  return keywords.some((keyword) => normalized.includes(keyword));
}

function parseLocalizedNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,(?=\d{1,4}(?:\D|$))/g, ".")
    .replace(/[^0-9.\-]/g, "");
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function clampCoefficient(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return Math.round(value * 10_000) / 10_000;
}

function resolveProrationCoefficient(input: {
  userContextText?: string | null;
  vatProfile?: Record<string, unknown> | null;
}) {
  const fromProfile =
    typeof input.vatProfile?.proration_coefficient === "number"
      ? input.vatProfile.proration_coefficient
      : typeof input.vatProfile?.vat_proration_coefficient === "number"
        ? input.vatProfile.vat_proration_coefficient
        : null;

  if (typeof fromProfile === "number") {
    return clampCoefficient(fromProfile);
  }

  const text = input.userContextText ?? "";
  const percentMatch = text.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);

  if (percentMatch) {
    return clampCoefficient((parseLocalizedNumber(percentMatch[1]) ?? 0) / 100);
  }

  const keywordMatch = text.match(/(?:prorrata|coeficiente|porcentaje)\D+(\d{1,3}(?:[.,]\d+)?)/i);

  if (keywordMatch) {
    const parsed = parseLocalizedNumber(keywordMatch[1]);
    return clampCoefficient(typeof parsed === "number" && parsed > 1 ? parsed / 100 : parsed);
  }

  return null;
}

function resolveMonetaryAmounts(input: VatEngineInput) {
  const totalOriginal = roundCurrency(
    input.monetarySnapshot?.totalAmountOriginal
    ?? input.facts.total_amount
    ?? (
      typeof input.facts.subtotal === "number" && typeof input.facts.tax_amount === "number"
        ? input.facts.subtotal + input.facts.tax_amount
        : null
    ),
  );
  const subtotalOriginal = roundCurrency(
    input.monetarySnapshot?.netAmountOriginal ?? input.facts.subtotal,
  );
  const taxOriginal = roundCurrency(
    input.monetarySnapshot?.taxAmountOriginal ?? input.facts.tax_amount,
  );
  const totalUyu = roundCurrency(
    input.monetarySnapshot?.totalAmountUyu ?? totalOriginal,
  );
  const subtotalUyu = roundCurrency(
    input.monetarySnapshot?.netAmountUyu ?? subtotalOriginal,
  );
  const taxUyu = roundCurrency(
    input.monetarySnapshot?.taxAmountUyu ?? taxOriginal,
  );

  return {
    totalOriginal,
    subtotalOriginal,
    taxOriginal,
    totalUyu,
    subtotalUyu,
    taxUyu,
  };
}

function buildLocationRisk(input: VatEngineInput) {
  return evaluateLocationRisk({
    documentRole: input.documentRole,
    organizationDepartment: input.profile?.fiscalDepartment ?? null,
    organizationCity: input.profile?.fiscalCity ?? null,
    locationRiskPolicy: input.profile?.locationRiskPolicy ?? null,
    travelRadiusKmPolicy: input.profile?.travelRadiusKmPolicy ?? null,
    issuerName: input.facts.issuer_name,
    issuerAddressRaw: input.facts.issuer_address_raw,
    issuerDepartment: input.facts.issuer_department,
    issuerCity: input.facts.issuer_city,
    issuerBranchCode: input.facts.issuer_branch_code,
    merchantCategoryHints: input.facts.merchant_category_hints,
    locationExtractionConfidence: input.facts.location_extraction_confidence,
    operationCategory: input.operationCategory,
    userContextText: input.userContextText,
  });
}

function applyLocationRiskToReview(input: {
  blockers: string[];
  warnings: string[];
  locationRisk: LocationRiskEvaluation;
  businessPurposeNote?: string | null;
}) {
  const blockers = [...input.blockers];
  const warnings = [...input.warnings];
  const note = input.businessPurposeNote?.trim() ?? "";

  if (input.locationRisk.locationSignalCode !== "none") {
    warnings.push(input.locationRisk.explanation);
  }

  if (input.locationRisk.requiresUserJustification && !note) {
    blockers.push(
      "Falta justificar el proposito empresarial de un gasto con razonabilidad geografica sensible.",
    );
  }

  if (input.locationRisk.requiresUserJustification && note) {
    warnings.push("La razonabilidad geografica quedo respaldada con nota auditada.");
  }

  return {
    blockers: blockers.filter((value, index, array) => array.indexOf(value) === index),
    warnings: warnings.filter((value, index, array) => array.indexOf(value) === index),
  };
}

function buildFiscalCreditResult(input: {
  documentRole: DocumentRoleCandidate;
  vatBucket: VatBucket;
  linkedOperationType?: string | null;
  operationCategory?: string | null;
  userContextText?: string | null;
  vatProfile?: Record<string, unknown> | null;
  ready: boolean;
  taxAmountUyu: number;
}) {
  if (input.documentRole !== "purchase") {
    return {
      vatCreditCategory: "not_applicable",
      vatDeductibilityStatus: "none",
      vatDirectTaxAmountUyu: 0,
      vatIndirectTaxAmountUyu: 0,
      vatDeductibleTaxAmountUyu: 0,
      vatNondeductibleTaxAmountUyu: 0,
      vatProrationCoefficient: null,
      businessLinkStatus: "linked",
    } satisfies Pick<
      VatEngineResult,
      | "vatCreditCategory"
      | "vatDeductibilityStatus"
      | "vatDirectTaxAmountUyu"
      | "vatIndirectTaxAmountUyu"
      | "vatDeductibleTaxAmountUyu"
      | "vatNondeductibleTaxAmountUyu"
      | "vatProrationCoefficient"
      | "businessLinkStatus"
    >;
  }

  if (!input.ready) {
    return {
      vatCreditCategory:
        input.vatBucket === "input_non_deductible"
          ? "input_non_deductible"
          : input.linkedOperationType?.includes("import")
            ? "input_import"
            : "input_direct",
      vatDeductibilityStatus: "pending_review",
      vatDirectTaxAmountUyu: 0,
      vatIndirectTaxAmountUyu: 0,
      vatDeductibleTaxAmountUyu: 0,
      vatNondeductibleTaxAmountUyu: 0,
      vatProrationCoefficient: null,
      businessLinkStatus: "needs_review",
    } satisfies Pick<
      VatEngineResult,
      | "vatCreditCategory"
      | "vatDeductibilityStatus"
      | "vatDirectTaxAmountUyu"
      | "vatIndirectTaxAmountUyu"
      | "vatDeductibleTaxAmountUyu"
      | "vatNondeductibleTaxAmountUyu"
      | "vatProrationCoefficient"
      | "businessLinkStatus"
    >;
  }

  if (input.vatBucket === "input_non_deductible") {
    return {
      vatCreditCategory: "input_non_deductible",
      vatDeductibilityStatus: "none",
      vatDirectTaxAmountUyu: 0,
      vatIndirectTaxAmountUyu: 0,
      vatDeductibleTaxAmountUyu: 0,
      vatNondeductibleTaxAmountUyu: input.taxAmountUyu,
      vatProrationCoefficient: 0,
      businessLinkStatus: "not_linked",
    } satisfies Pick<
      VatEngineResult,
      | "vatCreditCategory"
      | "vatDeductibilityStatus"
      | "vatDirectTaxAmountUyu"
      | "vatIndirectTaxAmountUyu"
      | "vatDeductibleTaxAmountUyu"
      | "vatNondeductibleTaxAmountUyu"
      | "vatProrationCoefficient"
      | "businessLinkStatus"
    >;
  }

  const normalizedScope = [
    input.operationCategory,
    input.linkedOperationType,
    input.userContextText,
  ].map((value) => normalizeToken(value)).join(" ");
  const prorationCoefficient = resolveProrationCoefficient({
    userContextText: input.userContextText,
    vatProfile: input.vatProfile,
  });
  const isImport = normalizedScope.includes("import");
  const isIndirect = hasAnyKeyword(normalizedScope, [
    "indirect",
    "administr",
    "oficina",
    "general",
    "mixt",
    "parcial",
  ]);

  if (typeof prorationCoefficient === "number" && prorationCoefficient > 0 && prorationCoefficient < 1) {
    const deductible = roundCurrency(input.taxAmountUyu * prorationCoefficient);
    const nonDeductible = roundCurrency(input.taxAmountUyu - deductible);

    return {
      vatCreditCategory: isImport ? "input_import" : "input_indirect",
      vatDeductibilityStatus: "partial_prorrata",
      vatDirectTaxAmountUyu: 0,
      vatIndirectTaxAmountUyu: input.taxAmountUyu,
      vatDeductibleTaxAmountUyu: deductible,
      vatNondeductibleTaxAmountUyu: nonDeductible,
      vatProrationCoefficient: prorationCoefficient,
      businessLinkStatus: "linked",
    } satisfies Pick<
      VatEngineResult,
      | "vatCreditCategory"
      | "vatDeductibilityStatus"
      | "vatDirectTaxAmountUyu"
      | "vatIndirectTaxAmountUyu"
      | "vatDeductibleTaxAmountUyu"
      | "vatNondeductibleTaxAmountUyu"
      | "vatProrationCoefficient"
      | "businessLinkStatus"
    >;
  }

  return {
    vatCreditCategory: isImport ? "input_import" : isIndirect ? "input_indirect" : "input_direct",
    vatDeductibilityStatus: "full",
    vatDirectTaxAmountUyu: isIndirect || isImport ? 0 : input.taxAmountUyu,
    vatIndirectTaxAmountUyu: isIndirect || isImport ? input.taxAmountUyu : 0,
    vatDeductibleTaxAmountUyu: input.taxAmountUyu,
    vatNondeductibleTaxAmountUyu: 0,
    vatProrationCoefficient: 1,
    businessLinkStatus: "linked",
  } satisfies Pick<
    VatEngineResult,
    | "vatCreditCategory"
    | "vatDeductibilityStatus"
    | "vatDirectTaxAmountUyu"
    | "vatIndirectTaxAmountUyu"
    | "vatDeductibleTaxAmountUyu"
    | "vatNondeductibleTaxAmountUyu"
    | "vatProrationCoefficient"
    | "businessLinkStatus"
  >;
}

function collectProfileGateBlockers(profile: OrganizationFiscalProfile | null) {
  const flags = getUyVatFeatureFlags();
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!flags.mvpEnabled) {
    blockers.push("El motor IVA Uruguay MVP esta deshabilitado por feature flag.");
  }

  if (!profile) {
    blockers.push("Falta el perfil fiscal versionado de la organizacion.");
    return { blockers, warnings };
  }

  if (profile.countryCode !== "UY") {
    blockers.push("La automatizacion IVA V1 solo aplica a organizaciones Uruguay.");
  }

  if (!isAutomaticUyVatLegalEntityType(profile.legalEntityType)) {
    blockers.push("La forma juridica queda fuera del alcance automatico IVA MVP.");
  }

  if (profile.vatRegime !== "GENERAL") {
    blockers.push("Solo se automatiza IVA para organizaciones con vat_regime GENERAL.");
  }

  if (!profile.taxId) {
    blockers.push("Falta el RUT de la organizacion para trazar la liquidacion.");
  }

  if (profile.dgiGroup === "UNKNOWN") {
    warnings.push("El grupo DGI de la organizacion sigue sin definir.");
  }

  if (profile.cfeStatus === "UNKNOWN") {
    warnings.push("El estado CFE de la organizacion sigue sin definir.");
  }

  return { blockers, warnings };
}

function buildNormativeSummary(
  profile: OrganizationFiscalProfile | null,
  ruleSnapshot: OrganizationRuleSnapshotContext | null,
) {
  if (!profile || !ruleSnapshot) {
    return "Sin profile version o snapshot vigente; se requiere revision manual.";
  }

  return (
    `Snapshot v${ruleSnapshot.versionNumber} (${profile.legalEntityType} / ${profile.taxRegimeCode} / IVA ${profile.vatRegime}) `
    + `vigente desde ${ruleSnapshot.effectiveFrom}.`
  );
}

function buildManualReviewResult(input: {
  label: string;
  treatmentCode: string;
  explanation: string;
  warnings: string[];
  blockers: string[];
  ruleSnapshot: OrganizationRuleSnapshotContext | null;
  profile: OrganizationFiscalProfile | null;
  locationRisk?: LocationRiskEvaluation | null;
  businessPurposeNote?: string | null;
}) {
  return {
    ready: false,
    treatmentCode: input.treatmentCode,
    label: input.label,
    vatBucket: null,
    taxableAmount: 0,
    taxAmount: 0,
    taxableAmountUyu: 0,
    taxAmountUyu: 0,
    totalAmountUyu: 0,
    vatCreditCategory: "not_applicable",
    vatDeductibilityStatus: "pending_review",
    vatDirectTaxAmountUyu: 0,
    vatIndirectTaxAmountUyu: 0,
    vatDeductibleTaxAmountUyu: 0,
    vatNondeductibleTaxAmountUyu: 0,
    vatProrationCoefficient: null,
    businessLinkStatus: "needs_review",
    locationSignalCode: input.locationRisk?.locationSignalCode ?? "none",
    locationSignalSeverity: input.locationRisk?.locationSignalSeverity ?? "info",
    locationSignalExplanation: input.locationRisk?.explanation ?? null,
    locationSignalPayload: input.locationRisk?.payload ?? {},
    requiresBusinessPurposeReview: input.locationRisk?.requiresBusinessPurposeReview ?? false,
    requiresUserJustification: input.locationRisk?.requiresUserJustification ?? false,
    businessPurposeNote: input.businessPurposeNote ?? null,
    suggestedTaxProfileCode: input.locationRisk?.suggestedTaxProfileCode ?? null,
    suggestedExpenseFamily: input.locationRisk?.suggestedExpenseFamily ?? null,
    rate: null,
    explanation: input.explanation,
    warnings: input.warnings,
    blockingReasons: input.blockers,
    normativeSummary: buildNormativeSummary(input.profile, input.ruleSnapshot),
    deterministicRuleRefs: input.ruleSnapshot?.deterministicRuleRefs ?? [],
    requiresManualReview: true,
    journalSeed: null,
  } satisfies VatEngineResult;
}

function buildLocationRiskFields(input: {
  locationRisk: LocationRiskEvaluation;
  businessPurposeNote?: string | null;
}) {
  return {
    locationSignalCode: input.locationRisk.locationSignalCode,
    locationSignalSeverity: input.locationRisk.locationSignalSeverity,
    locationSignalExplanation: input.locationRisk.explanation,
    locationSignalPayload: input.locationRisk.payload,
    requiresBusinessPurposeReview: input.locationRisk.requiresBusinessPurposeReview,
    requiresUserJustification: input.locationRisk.requiresUserJustification,
    businessPurposeNote: input.businessPurposeNote ?? null,
    suggestedTaxProfileCode: input.locationRisk.suggestedTaxProfileCode,
    suggestedExpenseFamily: input.locationRisk.suggestedExpenseFamily,
  } satisfies Pick<
    VatEngineResult,
    | "locationSignalCode"
    | "locationSignalSeverity"
    | "locationSignalExplanation"
    | "locationSignalPayload"
    | "requiresBusinessPurposeReview"
    | "requiresUserJustification"
    | "businessPurposeNote"
    | "suggestedTaxProfileCode"
    | "suggestedExpenseFamily"
  >;
}

export function resolvePurchaseCredit(input: VatEngineInput): VatEngineResult {
  const monetaryAmounts = resolveMonetaryAmounts(input);
  const totalAmount = monetaryAmounts.totalOriginal;
  const subtotal = monetaryAmounts.subtotalOriginal;
  const taxAmount = monetaryAmounts.taxOriginal;
  const totalAmountUyu = monetaryAmounts.totalUyu;
  const subtotalUyu = monetaryAmounts.subtotalUyu;
  const taxAmountUyu = monetaryAmounts.taxUyu;
  const taxRate = inferTaxRate(input.amountBreakdown, input.facts);
  const category = resolvePurchaseCategory(input.operationCategory);
  const flags = getUyVatFeatureFlags();
  const profileGate = collectProfileGateBlockers(input.profile);
  const locationRisk = buildLocationRisk(input);
  let blockers = [...profileGate.blockers];
  let warnings = [...profileGate.warnings];
  const normalizedCategory = [
    input.operationCategory,
    input.userContextText,
    input.linkedOperationType,
  ].map((value) => normalizeToken(value)).join(" ");
  const vatProfileBucket = resolveVatProfileBucket(input.vatProfile);
  const indicatesMixedUse = hasAnyKeyword(normalizedCategory, ["mixt", "parcial"]);
  const indicatesExportOrExempt = hasAnyKeyword(normalizedCategory, [
    "export",
    "exent",
    "exoner",
    "no grav",
  ]);
  const indicatesSimplifiedSupplier = hasAnyKeyword(normalizedCategory, [
    "iva minimo",
    "simplificado",
    "literal e",
  ]);
  const prorationCoefficient = resolveProrationCoefficient({
    userContextText: input.userContextText,
    vatProfile: input.vatProfile,
  });

  if (!category) {
    blockers.push("La compra no encuadra en una categoria fiscal aprobada del MVP.");
  }

  if (!input.facts.document_date) {
    blockers.push("Falta la fecha del documento.");
  }

  if (totalAmount <= 0) {
    blockers.push("Falta el total del documento para determinar IVA.");
  }

  if (taxAmount <= 0) {
    blockers.push("La compra no explicita IVA creditable y requiere revision manual.");
  }

  if (taxAmount > 0 && taxRate === null) {
    blockers.push("No se pudo determinar una tasa IVA valida a partir del documento.");
  }

  if (flags.mixedUseManualReview && indicatesMixedUse && prorationCoefficient === null) {
    blockers.push("Las compras de uso mixto quedan en revision manual en este MVP.");
  }

  if (indicatesMixedUse && prorationCoefficient !== null) {
    warnings.push(`Se aplico prorrata fiscal ${Math.round(prorationCoefficient * 100)}% segun contexto del documento.`);
  }

  if (flags.exportAutoDisabled && indicatesExportOrExempt) {
    blockers.push("Compras vinculadas a exportacion, exentas o no gravadas requieren revision manual.");
  }

  let vatBucket: Exclude<VatBucket, "output_vat" | null> =
    vatProfileBucket === "input_creditable"
      || vatProfileBucket === "input_non_deductible"
      || vatProfileBucket === "input_exempt"
      ? vatProfileBucket
      : taxAmount > 0
        ? (category?.vatBucket ?? "input_creditable")
        : "input_exempt";

  if (flags.simplifiedRegimeAutoDisabled && indicatesSimplifiedSupplier) {
    vatBucket = "input_non_deductible";
    warnings.push("Se detecto un indicio de proveedor simplificado/IVA minimo; no se otorga credito automatico.");
  }

  ({ blockers, warnings } = applyLocationRiskToReview({
    blockers,
    warnings,
    locationRisk,
    businessPurposeNote: input.businessPurposeNote,
  }));

  const label =
    vatBucket === "input_creditable"
      ? "IVA compras acreditable"
      : vatBucket === "input_non_deductible"
        ? "IVA compras no deducible"
        : "Compra exenta o sin IVA creditable";
  const fiscalCredit = buildFiscalCreditResult({
    documentRole: input.documentRole,
    vatBucket,
    linkedOperationType: input.linkedOperationType,
    operationCategory: input.operationCategory,
    userContextText: input.userContextText,
    vatProfile: input.vatProfile,
    ready: blockers.length === 0,
    taxAmountUyu,
  });
  const adjustedFiscalCredit = {
    ...fiscalCredit,
    businessLinkStatus:
      locationRisk.requiresBusinessPurposeReview && !(input.businessPurposeNote?.trim())
        ? "needs_review"
        : fiscalCredit.businessLinkStatus,
  };

  if (blockers.length > 0) {
    return {
      ready: false,
      treatmentCode:
        vatBucket === "input_creditable"
          ? "vat_purchase_creditable"
          : vatBucket === "input_non_deductible"
            ? "vat_purchase_non_deductible"
            : "manual_review_required",
      label,
      vatBucket,
      taxableAmount: subtotal,
      taxAmount,
      taxableAmountUyu: subtotalUyu,
      taxAmountUyu,
      totalAmountUyu,
      ...adjustedFiscalCredit,
      ...buildLocationRiskFields({
        locationRisk,
        businessPurposeNote: input.businessPurposeNote,
      }),
      rate: taxAmount > 0 ? taxRate : null,
      explanation:
        category
          ? `La compra se detecto como ${category.label}, pero el caso queda fuera de la automatizacion segura del MVP.`
          : "La compra requiere clasificacion manual antes de confirmar tratamiento IVA.",
      warnings,
      blockingReasons: blockers,
      normativeSummary: buildNormativeSummary(input.profile, input.ruleSnapshot),
      deterministicRuleRefs: input.ruleSnapshot?.deterministicRuleRefs ?? [],
      requiresManualReview: true,
      journalSeed: category
        ? {
            counterpartyRole: "accounts_payable",
            vatRole: vatBucket === "input_creditable" ? "vat_input_creditable" : null,
            amountExcludingVat: subtotal,
            totalAmount,
            vatAmount: vatBucket === "input_creditable" ? taxAmount : 0,
          }
        : null,
    };
  }

  return {
    ready: true,
    treatmentCode:
      vatBucket === "input_creditable"
        ? "vat_purchase_creditable"
        : vatBucket === "input_non_deductible"
          ? "vat_purchase_non_deductible"
          : "vat_purchase_exempt",
    label,
    vatBucket,
    taxableAmount: subtotal,
    taxAmount,
    taxableAmountUyu: subtotalUyu,
    taxAmountUyu,
    totalAmountUyu,
    ...adjustedFiscalCredit,
    ...buildLocationRiskFields({
      locationRisk,
      businessPurposeNote: input.businessPurposeNote,
    }),
    rate: taxRate,
    explanation: `La compra se encuadra como "${category?.label}" y se resuelve con reglas IVA deterministicas del snapshot organizacional.`,
    warnings,
    blockingReasons: [],
    normativeSummary: buildNormativeSummary(input.profile, input.ruleSnapshot),
    deterministicRuleRefs: input.ruleSnapshot?.deterministicRuleRefs ?? [],
    requiresManualReview: false,
    journalSeed: category
      ? {
          counterpartyRole: "accounts_payable",
          vatRole: vatBucket === "input_creditable" ? "vat_input_creditable" : null,
          amountExcludingVat: subtotal,
          totalAmount,
          vatAmount: vatBucket === "input_creditable" ? taxAmount : 0,
        }
      : null,
  };
}

export function resolveSalesOutput(input: VatEngineInput): VatEngineResult {
  const monetaryAmounts = resolveMonetaryAmounts(input);
  const totalAmount = monetaryAmounts.totalOriginal;
  const subtotal = monetaryAmounts.subtotalOriginal;
  const taxAmount = monetaryAmounts.taxOriginal;
  const totalAmountUyu = monetaryAmounts.totalUyu;
  const subtotalUyu = monetaryAmounts.subtotalUyu;
  const taxAmountUyu = monetaryAmounts.taxUyu;
  const taxRate = inferTaxRate(input.amountBreakdown, input.facts);
  const category = resolveSaleCategory(input.operationCategory, taxRate);
  const flags = getUyVatFeatureFlags();
  const profileGate = collectProfileGateBlockers(input.profile);
  const locationRisk = buildLocationRisk(input);
  let blockers = [...profileGate.blockers];
  let warnings = [...profileGate.warnings];
  const normalizedCategory = [
    input.operationCategory,
    input.userContextText,
    input.linkedOperationType,
  ].map((value) => normalizeToken(value)).join(" ");

  if (!category) {
    blockers.push("La venta no encuadra en una categoria fiscal aprobada del MVP.");
  }

  if (!input.facts.document_date) {
    blockers.push("Falta la fecha del documento.");
  }

  if (totalAmount <= 0) {
    blockers.push("Falta el total del documento para determinar IVA.");
  }

  if (flags.mixedUseManualReview && hasAnyKeyword(normalizedCategory, ["mixt", "parcial"])) {
    blockers.push("Las operaciones mixtas quedan en revision manual en este MVP.");
  }

  if (category?.code === "exempt_or_export" && flags.exportAutoDisabled) {
    blockers.push("Las ventas exentas o de exportacion quedan en revision manual en este MVP.");
  }

  if (category?.code === "non_taxed") {
    blockers.push("Las ventas no gravadas requieren snapshot/regla explicita antes de automatizar.");
  }

  if (category && category.rate > 0 && taxAmount <= 0) {
    blockers.push("La venta gravada no trae IVA suficiente para liquidacion automatica.");
  }

  if (category && category.rate > 0 && taxRate === null) {
    blockers.push("No se pudo determinar una tasa IVA valida a partir del documento.");
  }

  if (category && category.rate === 0 && taxAmount > 0) {
    blockers.push("El documento trae IVA detectado pero la categoria elegida no deberia llevar output IVA.");
    warnings.push("Revisa si el documento fue clasificado como exento, exportacion o no gravado de forma correcta.");
  }

  const taxableAmount =
    category?.code === "exempt_or_export" || category?.code === "non_taxed"
      ? totalAmount
      : subtotal;
  const resolvedTaxAmount =
    category?.code === "exempt_or_export" || category?.code === "non_taxed"
      ? 0
      : taxAmount;
  const taxableAmountUyu =
    category?.code === "exempt_or_export" || category?.code === "non_taxed"
      ? totalAmountUyu
      : subtotalUyu;
  const resolvedTaxAmountUyu =
    category?.code === "exempt_or_export" || category?.code === "non_taxed"
      ? 0
      : taxAmountUyu;
  const fiscalCredit = buildFiscalCreditResult({
    documentRole: input.documentRole,
    vatBucket: "output_vat",
    linkedOperationType: input.linkedOperationType,
    operationCategory: input.operationCategory,
    userContextText: input.userContextText,
    vatProfile: input.vatProfile,
    ready: blockers.length === 0,
    taxAmountUyu: resolvedTaxAmountUyu,
  });

  ({ blockers, warnings } = applyLocationRiskToReview({
    blockers,
    warnings,
    locationRisk,
    businessPurposeNote: input.businessPurposeNote,
  }));

  if (blockers.length > 0) {
    return {
      ready: false,
      treatmentCode:
        category?.code === "taxed_basic_22"
          ? "vat_sale_basic_rate"
          : category?.code === "taxed_minimum_10"
            ? "vat_sale_minimum_rate"
            : "manual_review_required",
      label: category?.label ?? "Venta pendiente de clasificacion fiscal",
      vatBucket: "output_vat",
      taxableAmount,
      taxAmount: resolvedTaxAmount,
      taxableAmountUyu,
      taxAmountUyu: resolvedTaxAmountUyu,
      totalAmountUyu,
      ...fiscalCredit,
      ...buildLocationRiskFields({
        locationRisk,
        businessPurposeNote: input.businessPurposeNote,
      }),
      rate: category?.rate ?? taxRate,
      explanation:
        category
          ? `La venta se detecto como ${category.label}, pero el caso queda fuera de la automatizacion segura del MVP.`
          : "La venta requiere clasificacion manual antes de confirmar IVA output.",
      warnings,
      blockingReasons: blockers,
      normativeSummary: buildNormativeSummary(input.profile, input.ruleSnapshot),
      deterministicRuleRefs: input.ruleSnapshot?.deterministicRuleRefs ?? [],
      requiresManualReview: true,
      journalSeed: category
        ? {
            counterpartyRole: "accounts_receivable",
            vatRole: resolvedTaxAmount > 0 ? "vat_output_payable" : null,
            amountExcludingVat: subtotal,
            totalAmount,
            vatAmount: resolvedTaxAmount,
          }
        : null,
    };
  }

  return {
    ready: true,
    treatmentCode:
      category?.code === "taxed_basic_22"
        ? "vat_sale_basic_rate"
        : category?.code === "taxed_minimum_10"
          ? "vat_sale_minimum_rate"
          : "manual_review_required",
    label: category?.label ?? "Venta gravada",
    vatBucket: "output_vat",
    taxableAmount,
    taxAmount: resolvedTaxAmount,
    taxableAmountUyu,
    taxAmountUyu: resolvedTaxAmountUyu,
    totalAmountUyu,
    ...fiscalCredit,
    ...buildLocationRiskFields({
      locationRisk,
      businessPurposeNote: input.businessPurposeNote,
    }),
    rate: category?.rate ?? taxRate,
    explanation: `La venta se resuelve como "${category?.label}" con reglas IVA deterministicas del snapshot organizacional.`,
    warnings,
    blockingReasons: [],
    normativeSummary: buildNormativeSummary(input.profile, input.ruleSnapshot),
    deterministicRuleRefs: input.ruleSnapshot?.deterministicRuleRefs ?? [],
    requiresManualReview: false,
    journalSeed: category
      ? {
          counterpartyRole: "accounts_receivable",
          vatRole: resolvedTaxAmount > 0 ? "vat_output_payable" : null,
          amountExcludingVat: subtotal,
          totalAmount,
          vatAmount: resolvedTaxAmount,
        }
      : null,
  };
}

export function resolveUyVatTreatment(input: VatEngineInput): VatEngineResult {
  if (input.documentRole === "purchase") {
    return resolvePurchaseCredit(input);
  }

  if (input.documentRole === "sale") {
    return resolveSalesOutput(input);
  }

  return buildManualReviewResult({
    label: "Revision manual requerida",
    treatmentCode: "manual_review_required",
    explanation: "Solo compra y venta entran en el flujo IVA automatizable del MVP.",
    warnings: [],
    blockers: ["Los documentos fuera de compra/venta quedan en revision manual."],
    ruleSnapshot: input.ruleSnapshot,
    profile: input.profile,
    locationRisk: buildLocationRisk(input),
    businessPurposeNote: input.businessPurposeNote ?? null,
  });
}

export type {
  DeterministicRuleRef,
  OrganizationFiscalProfile,
  OrganizationRuleSnapshotContext,
  LocationRiskPolicy,
  LocationSignalCode,
  LocationSignalSeverity,
  VatBucket,
  VatJournalSeed,
};
