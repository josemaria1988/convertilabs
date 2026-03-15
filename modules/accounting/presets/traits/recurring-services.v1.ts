import type { PresetBundle } from "@/modules/accounting/presets/types";

export const traitRecurringServicesPresetV1: PresetBundle = {
  code: "TRAIT_RECURRING_SERVICES_V1",
  version: "v1",
  kind: "trait_overlay",
  label: "Overlay contratos recurrentes",
  description: "Agrega estructura para abonos, ingresos diferidos y contratos de servicio repetitivos.",
  compatibleTraits: ["recurring_service_contracts", "provides_services", "technical_installation_or_maintenance"],
  accounts: [
    { code: "1.1.2.09", name: "Creditos por contratos recurrentes", accountType: "asset", semanticKey: "recurring_contract_receivables", natureTag: "receivables" },
    { code: "2.1.2.08", name: "Ingresos diferidos por abonos", accountType: "liability", semanticKey: "deferred_service_revenue", natureTag: "advances_received" },
    { code: "4.1.2.05", name: "Ingresos por contratos recurrentes", accountType: "revenue", semanticKey: "recurring_service_revenue", natureTag: "services", taxProfileHint: "UY_VAT_SALE_BASIC" }
  ],
  journalTemplates: [
    { code: "sale_recurring_service", label: "Contrato recurrente", description: "Alta de abono o servicio recurrente." }
  ],
  taxProfiles: [],
};
