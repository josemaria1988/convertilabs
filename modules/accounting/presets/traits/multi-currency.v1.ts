import type { PresetBundle } from "@/modules/accounting/presets/types";

export const traitMultiCurrencyPresetV1: PresetBundle = {
  code: "TRAIT_MULTI_CURRENCY_V1",
  version: "v1",
  kind: "trait_overlay",
  label: "Overlay multi-moneda",
  description: "Agrega cuentas y templates para moneda extranjera y diferencia de cambio.",
  compatibleTraits: ["multi_currency_operations", "imports_goods", "exports_goods", "exports_services"],
  accounts: [
    { code: "1.1.1.03", name: "Bancos USD", accountType: "asset", semanticKey: "bank_usd", natureTag: "cash_fx", currencyPolicy: "multi_currency" },
    { code: "4.1.9.02", name: "Diferencias de cambio ganadas", accountType: "revenue", semanticKey: "fx_gain", natureTag: "fx_gain", currencyPolicy: "multi_currency" },
    { code: "5.2.1.11", name: "Diferencias de cambio perdidas", accountType: "expense", semanticKey: "fx_loss", natureTag: "fx_loss", currencyPolicy: "multi_currency" }
  ],
  journalTemplates: [
    { code: "fx_adjustment_manual", label: "Ajuste manual FX", description: "Plantilla simple para seguimiento FX hasta automatizacion posterior." }
  ],
  taxProfiles: [],
};
