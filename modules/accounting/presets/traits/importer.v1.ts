import type { PresetBundle } from "@/modules/accounting/presets/types";

export const traitImporterPresetV1: PresetBundle = {
  code: "TRAIT_IMPORTER_V1",
  version: "v1",
  kind: "trait_overlay",
  label: "Overlay importador",
  description: "Agrega cuentas de importacion, proveedores del exterior, IVA importacion y mercaderia en transito.",
  compatibleTraits: ["imports_goods"],
  accounts: [
    { code: "1.1.1.03", name: "Bancos USD", accountType: "asset", semanticKey: "bank_usd", natureTag: "cash_fx", currencyPolicy: "multi_currency" },
    { code: "1.1.3.02", name: "IVA importacion credito fiscal", accountType: "asset", semanticKey: "vat_input_import", natureTag: "vat_input_import", taxProfileHint: "UY_VAT_IMPORT_CREDITABLE" },
    { code: "1.1.3.03", name: "Anticipo IVA importacion recuperable", accountType: "asset", semanticKey: "vat_import_advance", natureTag: "vat_advance_import", taxProfileHint: "UY_VAT_IMPORT_ANTICIPO" },
    { code: "1.1.4.04", name: "Mercaderias en transito", accountType: "asset", semanticKey: "inventory_in_transit", natureTag: "inventory_in_transit", currencyPolicy: "multi_currency" },
    { code: "2.1.1.02", name: "Proveedores del exterior", accountType: "liability", semanticKey: "foreign_suppliers", natureTag: "payables_fx", currencyPolicy: "multi_currency" },
    { code: "2.1.2.05", name: "Tributos aduaneros a pagar", accountType: "liability", semanticKey: "customs_payable", natureTag: "customs_payable" }
  ],
  journalTemplates: [
    { code: "purchase_import_goods", label: "Compra importada", description: "Compra exterior con DUA y tributos asociados." }
  ],
  taxProfiles: [
    { code: "UY_VAT_IMPORT_CREDITABLE", label: "IVA importacion acreditable" },
    { code: "UY_VAT_IMPORT_ANTICIPO", label: "Anticipo IVA importacion" }
  ],
};
