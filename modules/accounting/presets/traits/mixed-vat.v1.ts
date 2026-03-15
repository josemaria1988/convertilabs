import type { PresetBundle } from "@/modules/accounting/presets/types";

export const traitMixedVatPresetV1: PresetBundle = {
  code: "TRAIT_MIXED_VAT_V1",
  version: "v1",
  kind: "trait_overlay",
  label: "Overlay IVA mixto / prorrata",
  description: "Agrega estructura para IVA indirecto, no deducible y seguimiento de operativa mixta.",
  compatibleTraits: ["mixed_vat_operations", "vat_exempt_or_non_taxed_operations"],
  accounts: [
    { code: "1.1.3.05", name: "IVA compras indirecto a distribuir", accountType: "asset", semanticKey: "vat_indirect_pool", natureTag: "vat_input", taxProfileHint: "UY_VAT_PURCHASE_MIXED_USE" },
    { code: "5.2.1.20", name: "IVA no deducible", accountType: "expense", semanticKey: "vat_non_deductible_expense", natureTag: "admin_expense", taxProfileHint: "UY_VAT_NON_DEDUCTIBLE" }
  ],
  journalTemplates: [
    { code: "purchase_mixed_vat", label: "Compra con IVA mixto", description: "Compra que puede requerir prorrata o revision manual." }
  ],
  taxProfiles: [
    { code: "UY_VAT_PURCHASE_MIXED_USE", label: "IVA compras mixto" },
    { code: "UY_VAT_NON_DEDUCTIBLE", label: "IVA no deducible" }
  ],
};
