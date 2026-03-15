import type { DocumentRoleCandidate } from "@/modules/accounting/types";

export type JournalTemplateCode =
  | "purchase_local_taxed_basic"
  | "purchase_local_taxed_minimum"
  | "purchase_local_partial_prorrata"
  | "purchase_local_non_deductible"
  | "sale_local_taxed_basic"
  | "sale_local_taxed_minimum"
  | "sale_export"
  | "purchase_import_supplier"
  | "purchase_import_dua"
  | "purchase_import_fixed_asset"
  | "credit_note_purchase"
  | "credit_note_sale"
  | "provisional_reclassification";

export type JournalTemplateDefinition = {
  templateCode: JournalTemplateCode;
  label: string;
  documentRole: DocumentRoleCandidate;
  operationFamily: string;
  requiredSlots: string[];
  allowsProvisionalMainAccount: boolean;
  requiresFxContext: boolean;
  defaultTaxProfileCode: string | null;
};

const journalTemplates: JournalTemplateDefinition[] = [
  {
    templateCode: "purchase_local_taxed_basic",
    label: "Compra local gravada 22%",
    documentRole: "purchase",
    operationFamily: "local_purchase",
    requiredSlots: ["main_account", "accounts_payable", "vat_input_creditable"],
    allowsProvisionalMainAccount: true,
    requiresFxContext: false,
    defaultTaxProfileCode: "UY_VAT_PURCHASE_BASIC",
  },
  {
    templateCode: "purchase_local_taxed_minimum",
    label: "Compra local tasa minima",
    documentRole: "purchase",
    operationFamily: "local_purchase",
    requiredSlots: ["main_account", "accounts_payable", "vat_input_creditable"],
    allowsProvisionalMainAccount: true,
    requiresFxContext: false,
    defaultTaxProfileCode: "UY_VAT_PURCHASE_MINIMUM",
  },
  {
    templateCode: "purchase_local_partial_prorrata",
    label: "Compra local con prorrata",
    documentRole: "purchase",
    operationFamily: "local_purchase",
    requiredSlots: ["main_account", "accounts_payable", "vat_input_creditable"],
    allowsProvisionalMainAccount: true,
    requiresFxContext: false,
    defaultTaxProfileCode: "UY_VAT_PURCHASE_BASIC",
  },
  {
    templateCode: "purchase_local_non_deductible",
    label: "Compra local IVA no deducible",
    documentRole: "purchase",
    operationFamily: "local_purchase",
    requiredSlots: ["main_account", "accounts_payable"],
    allowsProvisionalMainAccount: true,
    requiresFxContext: false,
    defaultTaxProfileCode: "UY_VAT_NON_DEDUCTIBLE",
  },
  {
    templateCode: "sale_local_taxed_basic",
    label: "Venta local gravada 22%",
    documentRole: "sale",
    operationFamily: "local_sale",
    requiredSlots: ["main_account", "accounts_receivable", "vat_output_payable"],
    allowsProvisionalMainAccount: true,
    requiresFxContext: false,
    defaultTaxProfileCode: "UY_VAT_SALE_BASIC",
  },
  {
    templateCode: "sale_local_taxed_minimum",
    label: "Venta local gravada 10%",
    documentRole: "sale",
    operationFamily: "local_sale",
    requiredSlots: ["main_account", "accounts_receivable", "vat_output_payable"],
    allowsProvisionalMainAccount: true,
    requiresFxContext: false,
    defaultTaxProfileCode: "UY_VAT_SALE_MINIMUM",
  },
  {
    templateCode: "sale_export",
    label: "Exportacion",
    documentRole: "sale",
    operationFamily: "export_sale",
    requiredSlots: ["main_account", "accounts_receivable"],
    allowsProvisionalMainAccount: true,
    requiresFxContext: true,
    defaultTaxProfileCode: "UY_VAT_EXPORT",
  },
  {
    templateCode: "purchase_import_supplier",
    label: "Factura proveedor exterior",
    documentRole: "purchase",
    operationFamily: "import_supplier",
    requiredSlots: ["main_account", "accounts_payable"],
    allowsProvisionalMainAccount: true,
    requiresFxContext: true,
    defaultTaxProfileCode: "UY_VAT_IMPORT_CREDITABLE",
  },
  {
    templateCode: "purchase_import_dua",
    label: "DUA y gastos aduaneros",
    documentRole: "purchase",
    operationFamily: "import_dua",
    requiredSlots: ["main_account", "accounts_payable", "vat_input_creditable"],
    allowsProvisionalMainAccount: true,
    requiresFxContext: true,
    defaultTaxProfileCode: "UY_VAT_IMPORT_CREDITABLE",
  },
  {
    templateCode: "purchase_import_fixed_asset",
    label: "Importacion de activo fijo",
    documentRole: "purchase",
    operationFamily: "import_fixed_asset",
    requiredSlots: ["main_account", "accounts_payable", "vat_input_creditable"],
    allowsProvisionalMainAccount: true,
    requiresFxContext: true,
    defaultTaxProfileCode: "UY_VAT_IMPORT_CREDITABLE",
  },
  {
    templateCode: "credit_note_purchase",
    label: "Nota de credito compra",
    documentRole: "purchase",
    operationFamily: "purchase_credit_note",
    requiredSlots: ["main_account", "accounts_payable", "vat_input_creditable"],
    allowsProvisionalMainAccount: true,
    requiresFxContext: false,
    defaultTaxProfileCode: "UY_VAT_PURCHASE_BASIC",
  },
  {
    templateCode: "credit_note_sale",
    label: "Nota de credito venta",
    documentRole: "sale",
    operationFamily: "sale_credit_note",
    requiredSlots: ["main_account", "accounts_receivable", "vat_output_payable"],
    allowsProvisionalMainAccount: true,
    requiresFxContext: false,
    defaultTaxProfileCode: "UY_VAT_SALE_BASIC",
  },
  {
    templateCode: "provisional_reclassification",
    label: "Reclasificacion de provisional a final",
    documentRole: "other",
    operationFamily: "reclassification",
    requiredSlots: ["from_account", "to_account"],
    allowsProvisionalMainAccount: false,
    requiresFxContext: false,
    defaultTaxProfileCode: null,
  },
];

export function listJournalTemplates() {
  return journalTemplates;
}

export function getJournalTemplateByCode(code: string | null | undefined) {
  return journalTemplates.find((template) => template.templateCode === code) ?? null;
}

export function resolveJournalTemplateCode(input: {
  documentRole: DocumentRoleCandidate;
  operationFamily?: string | null;
  linkedOperationType?: string | null;
  vatCreditCategory?: string | null;
  vatRate?: number | null;
}) {
  if (input.linkedOperationType === "import_operation" || input.operationFamily?.includes("import")) {
    return input.operationFamily?.includes("fixed_asset")
      ? "purchase_import_fixed_asset"
      : input.linkedOperationType === "dua"
        ? "purchase_import_dua"
        : "purchase_import_supplier";
  }

  if (input.documentRole === "sale") {
    if (input.vatRate === 10) {
      return "sale_local_taxed_minimum";
    }

    if (input.vatCreditCategory === "not_applicable") {
      return "sale_export";
    }

    return "sale_local_taxed_basic";
  }

  if (input.documentRole === "purchase") {
    if (input.vatCreditCategory === "input_non_deductible") {
      return "purchase_local_non_deductible";
    }

    if (input.vatRate === 10) {
      return "purchase_local_taxed_minimum";
    }

    return "purchase_local_taxed_basic";
  }

  return "provisional_reclassification";
}
