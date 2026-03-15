import type { PresetBundle } from "@/modules/accounting/presets/types";

export const ciiu0103AgroPresetV1: PresetBundle = {
  code: "CIIU_01_03_AGRO_V1",
  version: "v1",
  kind: "activity_overlay",
  label: "Overlay agro y agroindustrial",
  description: "Agrega cuentas de insumos, produccion y ventas propias del agro y la operativa primaria.",
  compatibleActivityCodes: ["01", "02", "03"],
  accounts: [
    { code: "1.1.4.08", name: "Insumos agropecuarios", accountType: "asset", semanticKey: "agro_supplies", natureTag: "inventory" },
    { code: "1.1.4.09", name: "Activos biologicos corrientes", accountType: "asset", semanticKey: "biological_assets", natureTag: "inventory" },
    { code: "4.1.1.08", name: "Ventas agropecuarias", accountType: "revenue", semanticKey: "agro_sales", natureTag: "sales_basic", taxProfileHint: "UY_VAT_SALE_BASIC" },
    { code: "5.1.1.08", name: "Costo de produccion agropecuaria", accountType: "expense", semanticKey: "agro_cogs", natureTag: "cogs" }
  ],
  journalTemplates: [
    { code: "sale_agro_basic", label: "Venta agro", description: "Venta de produccion primaria o agroindustrial." }
  ],
  taxProfiles: [],
};
