import type { DocumentRoleCandidate } from "@/modules/accounting/types";

export type UyTaxProfileCode =
  | "UY_VAT_PURCHASE_BASIC"
  | "UY_VAT_PURCHASE_MINIMUM"
  | "UY_VAT_PURCHASE_EXEMPT"
  | "UY_VAT_SALE_BASIC"
  | "UY_VAT_SALE_MINIMUM"
  | "UY_VAT_EXPORT"
  | "UY_VAT_IMPORT_CREDITABLE"
  | "UY_VAT_IMPORT_SUSPENSO"
  | "UY_VAT_IMPORT_ANTICIPO"
  | "UY_VAT_NON_DEDUCTIBLE";

export type UyTaxProfileDefinition = {
  code: UyTaxProfileCode;
  documentRole: DocumentRoleCandidate;
  documentTypeScope: string | null;
  vatRate: number | null;
  isCreditable: boolean;
  isExportRelated: boolean;
  isImportRelated: boolean;
  requiresLinkedImportOperation: boolean;
  resultKind: "input" | "output" | "not_applicable";
  vatCreditCategory:
    | "input_direct"
    | "input_indirect"
    | "input_import"
    | "input_non_deductible"
    | "not_applicable";
  deductibilityMode: "full" | "partial_prorrata" | "none" | "pending_review";
  requiresProration: boolean;
  requiresBusinessPurposeReview: boolean;
  defaultDgiMappingKey: string | null;
  blockIfMissingFxRate: boolean;
};

const profiles: UyTaxProfileDefinition[] = [
  {
    code: "UY_VAT_PURCHASE_BASIC",
    documentRole: "purchase",
    documentTypeScope: null,
    vatRate: 22,
    isCreditable: true,
    isExportRelated: false,
    isImportRelated: false,
    requiresLinkedImportOperation: false,
    resultKind: "input",
    vatCreditCategory: "input_direct",
    deductibilityMode: "full",
    requiresProration: false,
    requiresBusinessPurposeReview: false,
    defaultDgiMappingKey: "purchase_basic",
    blockIfMissingFxRate: true,
  },
  {
    code: "UY_VAT_PURCHASE_MINIMUM",
    documentRole: "purchase",
    documentTypeScope: null,
    vatRate: 10,
    isCreditable: true,
    isExportRelated: false,
    isImportRelated: false,
    requiresLinkedImportOperation: false,
    resultKind: "input",
    vatCreditCategory: "input_direct",
    deductibilityMode: "full",
    requiresProration: false,
    requiresBusinessPurposeReview: false,
    defaultDgiMappingKey: "purchase_minimum",
    blockIfMissingFxRate: true,
  },
  {
    code: "UY_VAT_PURCHASE_EXEMPT",
    documentRole: "purchase",
    documentTypeScope: null,
    vatRate: 0,
    isCreditable: false,
    isExportRelated: false,
    isImportRelated: false,
    requiresLinkedImportOperation: false,
    resultKind: "not_applicable",
    vatCreditCategory: "not_applicable",
    deductibilityMode: "none",
    requiresProration: false,
    requiresBusinessPurposeReview: false,
    defaultDgiMappingKey: "purchase_exempt",
    blockIfMissingFxRate: false,
  },
  {
    code: "UY_VAT_SALE_BASIC",
    documentRole: "sale",
    documentTypeScope: null,
    vatRate: 22,
    isCreditable: false,
    isExportRelated: false,
    isImportRelated: false,
    requiresLinkedImportOperation: false,
    resultKind: "output",
    vatCreditCategory: "not_applicable",
    deductibilityMode: "none",
    requiresProration: false,
    requiresBusinessPurposeReview: false,
    defaultDgiMappingKey: "sale_basic",
    blockIfMissingFxRate: true,
  },
  {
    code: "UY_VAT_SALE_MINIMUM",
    documentRole: "sale",
    documentTypeScope: null,
    vatRate: 10,
    isCreditable: false,
    isExportRelated: false,
    isImportRelated: false,
    requiresLinkedImportOperation: false,
    resultKind: "output",
    vatCreditCategory: "not_applicable",
    deductibilityMode: "none",
    requiresProration: false,
    requiresBusinessPurposeReview: false,
    defaultDgiMappingKey: "sale_minimum",
    blockIfMissingFxRate: true,
  },
  {
    code: "UY_VAT_EXPORT",
    documentRole: "sale",
    documentTypeScope: null,
    vatRate: 0,
    isCreditable: false,
    isExportRelated: true,
    isImportRelated: false,
    requiresLinkedImportOperation: false,
    resultKind: "not_applicable",
    vatCreditCategory: "not_applicable",
    deductibilityMode: "none",
    requiresProration: false,
    requiresBusinessPurposeReview: false,
    defaultDgiMappingKey: "sale_export",
    blockIfMissingFxRate: true,
  },
  {
    code: "UY_VAT_IMPORT_CREDITABLE",
    documentRole: "purchase",
    documentTypeScope: "import",
    vatRate: 22,
    isCreditable: true,
    isExportRelated: false,
    isImportRelated: true,
    requiresLinkedImportOperation: true,
    resultKind: "input",
    vatCreditCategory: "input_import",
    deductibilityMode: "full",
    requiresProration: false,
    requiresBusinessPurposeReview: true,
    defaultDgiMappingKey: "import_creditable",
    blockIfMissingFxRate: true,
  },
  {
    code: "UY_VAT_IMPORT_SUSPENSO",
    documentRole: "purchase",
    documentTypeScope: "import",
    vatRate: 0,
    isCreditable: false,
    isExportRelated: false,
    isImportRelated: true,
    requiresLinkedImportOperation: true,
    resultKind: "not_applicable",
    vatCreditCategory: "not_applicable",
    deductibilityMode: "pending_review",
    requiresProration: false,
    requiresBusinessPurposeReview: true,
    defaultDgiMappingKey: "import_suspenso",
    blockIfMissingFxRate: true,
  },
  {
    code: "UY_VAT_IMPORT_ANTICIPO",
    documentRole: "purchase",
    documentTypeScope: "import",
    vatRate: 22,
    isCreditable: true,
    isExportRelated: false,
    isImportRelated: true,
    requiresLinkedImportOperation: true,
    resultKind: "input",
    vatCreditCategory: "input_import",
    deductibilityMode: "full",
    requiresProration: false,
    requiresBusinessPurposeReview: true,
    defaultDgiMappingKey: "import_advance",
    blockIfMissingFxRate: true,
  },
  {
    code: "UY_VAT_NON_DEDUCTIBLE",
    documentRole: "purchase",
    documentTypeScope: null,
    vatRate: 22,
    isCreditable: false,
    isExportRelated: false,
    isImportRelated: false,
    requiresLinkedImportOperation: false,
    resultKind: "input",
    vatCreditCategory: "input_non_deductible",
    deductibilityMode: "none",
    requiresProration: false,
    requiresBusinessPurposeReview: true,
    defaultDgiMappingKey: "purchase_non_deductible",
    blockIfMissingFxRate: true,
  },
];

export function listUyTaxProfiles() {
  return profiles;
}

export function getUyTaxProfileByCode(code: string | null | undefined) {
  return profiles.find((profile) => profile.code === code) ?? null;
}
