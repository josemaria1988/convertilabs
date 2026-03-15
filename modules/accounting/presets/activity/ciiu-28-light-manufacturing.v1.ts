import type { PresetBundle } from "@/modules/accounting/presets/types";

export const ciiu28LightManufacturingPresetV1: PresetBundle = {
  code: "CIIU_28_LIGHT_MANUFACTURING_V1",
  version: "v1",
  kind: "activity_overlay",
  label: "Overlay fabricacion y ensamble liviano",
  description: "Agrega proceso productivo, materias primas y terminados para manufactura o ensamble liviano.",
  compatibleActivityCodes: ["28"],
  accounts: [
    { code: "1.1.4.10", name: "Materias primas e insumos", accountType: "asset", semanticKey: "raw_materials", natureTag: "inventory" },
    { code: "1.1.4.11", name: "Produccion en proceso", accountType: "asset", semanticKey: "work_in_progress", natureTag: "inventory" },
    { code: "1.1.4.12", name: "Productos terminados", accountType: "asset", semanticKey: "finished_goods", natureTag: "inventory" },
    { code: "5.1.1.09", name: "Costo de fabricacion y ensamble", accountType: "expense", semanticKey: "manufacturing_cost", natureTag: "cogs" }
  ],
  journalTemplates: [
    { code: "purchase_raw_materials", label: "Compra de materias primas", description: "Compra de insumos productivos." }
  ],
  taxProfiles: [],
};
