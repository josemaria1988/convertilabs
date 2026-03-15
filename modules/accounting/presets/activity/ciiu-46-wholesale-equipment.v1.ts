import type { PresetBundle } from "@/modules/accounting/presets/types";

export const ciiu46WholesaleEquipmentPresetV1: PresetBundle = {
  code: "CIIU_46_WHOLESALE_EQUIPMENT_V1",
  version: "v1",
  kind: "activity_overlay",
  label: "Overlay comercio mayorista de equipos y repuestos",
  description: "Agrega cuentas tipicas de comercializacion mayorista de equipos, repuestos y mercaderia tecnica.",
  compatibleActivityCodes: ["46"],
  accounts: [
    { code: "1.1.4.03", name: "Repuestos", accountType: "asset", semanticKey: "inventory_spares", natureTag: "inventory_spares" },
    { code: "1.1.4.06", name: "Bonificaciones sobre compras a distribuir", accountType: "asset", semanticKey: "purchase_bonus_pool", natureTag: "inventory" },
    { code: "4.1.1.05", name: "Ventas mayoristas de equipos y repuestos", accountType: "revenue", semanticKey: "wholesale_equipment_sales", natureTag: "sales_basic", taxProfileHint: "UY_VAT_SALE_BASIC" },
    { code: "5.1.1.04", name: "Costo de equipos y repuestos vendidos", accountType: "expense", semanticKey: "wholesale_equipment_cogs", natureTag: "cogs" }
  ],
  journalTemplates: [
    { code: "sale_wholesale_equipment", label: "Venta mayorista de equipos", description: "Venta comercial de equipos o repuestos." }
  ],
  taxProfiles: [],
  uiHints: [
    { key: "actividad_principal", tone: "success", message: "Este overlay refuerza inventario, repuestos y ventas mayoristas." }
  ],
};
