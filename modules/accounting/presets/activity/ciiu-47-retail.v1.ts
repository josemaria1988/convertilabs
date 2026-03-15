import type { PresetBundle } from "@/modules/accounting/presets/types";

export const ciiu47RetailPresetV1: PresetBundle = {
  code: "CIIU_47_RETAIL_V1",
  version: "v1",
  kind: "activity_overlay",
  label: "Overlay comercio minorista",
  description: "Agrega estructura tipica para ventas por mostrador, tarjetas y cobranza minorista.",
  compatibleActivityCodes: ["47"],
  accounts: [
    { code: "1.1.1.05", name: "Cajas y medios de cobro retail", accountType: "asset", semanticKey: "retail_cash_drawer", natureTag: "cash" },
    { code: "1.1.2.05", name: "Tarjetas a cobrar", accountType: "asset", semanticKey: "card_receivables", natureTag: "receivables" },
    { code: "4.1.1.06", name: "Ventas minoristas", accountType: "revenue", semanticKey: "retail_sales", natureTag: "sales_basic", taxProfileHint: "UY_VAT_SALE_BASIC" }
  ],
  journalTemplates: [
    { code: "sale_retail_basic", label: "Venta minorista", description: "Venta retail o mostrador." }
  ],
  taxProfiles: [],
};
