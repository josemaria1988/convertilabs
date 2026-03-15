import type { PresetBundle } from "@/modules/accounting/presets/types";

export const ciiu33RepairInstallationPresetV1: PresetBundle = {
  code: "CIIU_33_REPAIR_INSTALLATION_V1",
  version: "v1",
  kind: "activity_overlay",
  label: "Overlay servicios tecnicos e instalacion",
  description: "Agrega estructura para instalacion, mantenimiento tecnico y trabajos recurrentes de servicio.",
  compatibleActivityCodes: ["33", "43210"],
  accounts: [
    { code: "1.1.5.11", name: "Materiales aplicados a servicios", accountType: "asset", semanticKey: "service_materials", natureTag: "inventory_spares" },
    { code: "4.1.2.02", name: "Servicios de instalacion y mantenimiento", accountType: "revenue", semanticKey: "technical_services_revenue", natureTag: "services", taxProfileHint: "UY_VAT_SALE_BASIC" },
    { code: "4.1.2.03", name: "Abonos y contratos de mantenimiento", accountType: "revenue", semanticKey: "maintenance_contracts_revenue", natureTag: "services", taxProfileHint: "UY_VAT_SALE_BASIC" },
    { code: "5.2.1.06", name: "Costo tecnico de servicios y mantenimiento", accountType: "expense", semanticKey: "technical_service_cost", natureTag: "admin_expense" }
  ],
  journalTemplates: [
    { code: "sale_technical_service", label: "Servicio tecnico", description: "Servicio de instalacion o mantenimiento." }
  ],
  taxProfiles: [],
};
