import type {
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentRoleCandidate,
} from "@/modules/ai/document-intake-contract";
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

type VatJournalSeed = {
  accountCode: string;
  accountName: string;
  counterpartyAccountCode: string;
  counterpartyAccountName: string;
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
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  operationCategory: string | null;
  profile: OrganizationFiscalProfile | null;
  ruleSnapshot: OrganizationRuleSnapshotContext | null;
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
}) {
  return {
    ready: false,
    treatmentCode: input.treatmentCode,
    label: input.label,
    vatBucket: null,
    taxableAmount: 0,
    taxAmount: 0,
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

export function resolvePurchaseCredit(input: VatEngineInput): VatEngineResult {
  const totalAmount = roundCurrency(
    input.facts.total_amount ?? (
      typeof input.facts.subtotal === "number" && typeof input.facts.tax_amount === "number"
        ? input.facts.subtotal + input.facts.tax_amount
        : null
    ),
  );
  const subtotal = roundCurrency(input.facts.subtotal);
  const taxAmount = roundCurrency(input.facts.tax_amount);
  const taxRate = inferTaxRate(input.amountBreakdown, input.facts);
  const category = resolvePurchaseCategory(input.operationCategory);
  const flags = getUyVatFeatureFlags();
  const profileGate = collectProfileGateBlockers(input.profile);
  const blockers = [...profileGate.blockers];
  const warnings = [...profileGate.warnings];
  const normalizedCategory = normalizeToken(input.operationCategory);
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

  if (flags.mixedUseManualReview && indicatesMixedUse) {
    blockers.push("Las compras de uso mixto quedan en revision manual en este MVP.");
  }

  if (flags.exportAutoDisabled && indicatesExportOrExempt) {
    blockers.push("Compras vinculadas a exportacion, exentas o no gravadas requieren revision manual.");
  }

  let vatBucket: Exclude<VatBucket, "output_vat" | null> =
    taxAmount > 0 ? (category?.vatBucket ?? "input_creditable") : "input_exempt";

  if (flags.simplifiedRegimeAutoDisabled && indicatesSimplifiedSupplier) {
    vatBucket = "input_non_deductible";
    warnings.push("Se detecto un indicio de proveedor simplificado/IVA minimo; no se otorga credito automatico.");
  }

  const label =
    vatBucket === "input_creditable"
      ? "IVA compras acreditable"
      : vatBucket === "input_non_deductible"
        ? "IVA compras no deducible"
        : "Compra exenta o sin IVA creditable";

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
            accountCode: category.accountCode,
            accountName: category.accountName,
            counterpartyAccountCode: "2110",
            counterpartyAccountName: "Proveedores",
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
    rate: taxRate,
    explanation: `La compra se encuadra como "${category?.label}" y se resuelve con reglas IVA deterministicas del snapshot organizacional.`,
    warnings,
    blockingReasons: [],
    normativeSummary: buildNormativeSummary(input.profile, input.ruleSnapshot),
    deterministicRuleRefs: input.ruleSnapshot?.deterministicRuleRefs ?? [],
    requiresManualReview: false,
    journalSeed: category
      ? {
          accountCode: category.accountCode,
          accountName: category.accountName,
          counterpartyAccountCode: "2110",
          counterpartyAccountName: "Proveedores",
          amountExcludingVat: subtotal,
          totalAmount,
          vatAmount: vatBucket === "input_creditable" ? taxAmount : 0,
        }
      : null,
  };
}

export function resolveSalesOutput(input: VatEngineInput): VatEngineResult {
  const totalAmount = roundCurrency(
    input.facts.total_amount ?? (
      typeof input.facts.subtotal === "number" && typeof input.facts.tax_amount === "number"
        ? input.facts.subtotal + input.facts.tax_amount
        : null
    ),
  );
  const subtotal = roundCurrency(input.facts.subtotal);
  const taxAmount = roundCurrency(input.facts.tax_amount);
  const taxRate = inferTaxRate(input.amountBreakdown, input.facts);
  const category = resolveSaleCategory(input.operationCategory, taxRate);
  const flags = getUyVatFeatureFlags();
  const profileGate = collectProfileGateBlockers(input.profile);
  const blockers = [...profileGate.blockers];
  const warnings = [...profileGate.warnings];
  const normalizedCategory = normalizeToken(input.operationCategory);

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
            accountCode: category.accountCode,
            accountName: category.accountName,
            counterpartyAccountCode: "1130",
            counterpartyAccountName: "Clientes",
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
    rate: category?.rate ?? taxRate,
    explanation: `La venta se resuelve como "${category?.label}" con reglas IVA deterministicas del snapshot organizacional.`,
    warnings,
    blockingReasons: [],
    normativeSummary: buildNormativeSummary(input.profile, input.ruleSnapshot),
    deterministicRuleRefs: input.ruleSnapshot?.deterministicRuleRefs ?? [],
    requiresManualReview: false,
    journalSeed: category
      ? {
          accountCode: category.accountCode,
          accountName: category.accountName,
          counterpartyAccountCode: "1130",
          counterpartyAccountName: "Clientes",
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
  });
}

export type {
  DeterministicRuleRef,
  OrganizationFiscalProfile,
  OrganizationRuleSnapshotContext,
  VatBucket,
  VatJournalSeed,
};
