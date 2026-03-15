import type { PresetBundle } from "@/modules/accounting/presets/types";

export const traitExporterPresetV1: PresetBundle = {
  code: "TRAIT_EXPORTER_V1",
  version: "v1",
  kind: "trait_overlay",
  label: "Overlay exportador",
  description: "Agrega estructura de ventas al exterior y soporte para tratamiento fiscal de exportacion.",
  compatibleTraits: ["exports_goods", "exports_services", "possible_vat_suspenso"],
  accounts: [
    { code: "1.1.2.08", name: "Creditos por exportaciones", accountType: "asset", semanticKey: "export_receivables", natureTag: "receivables", currencyPolicy: "multi_currency" },
    { code: "4.1.1.04", name: "Exportaciones", accountType: "revenue", semanticKey: "export_sales", natureTag: "export_sales", taxProfileHint: "UY_VAT_EXPORT", currencyPolicy: "multi_currency" },
    { code: "4.1.2.04", name: "Servicios exportados", accountType: "revenue", semanticKey: "export_services", natureTag: "services", taxProfileHint: "UY_VAT_EXPORT", currencyPolicy: "multi_currency" }
  ],
  journalTemplates: [
    { code: "sale_export_basic", label: "Venta exportacion", description: "Venta o servicio al exterior." }
  ],
  taxProfiles: [
    { code: "UY_VAT_EXPORT", label: "Exportacion / tasa cero" }
  ],
};
