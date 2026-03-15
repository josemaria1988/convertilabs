import type { PresetBundle } from "@/modules/accounting/presets/types";

export const traitPublicTendersPresetV1: PresetBundle = {
  code: "TRAIT_PUBLIC_TENDERS_V1",
  version: "v1",
  kind: "trait_overlay",
  label: "Overlay licitaciones y organismos publicos",
  description: "Agrega cuentas utiles para garantias, retenciones y cobranzas del sector publico.",
  compatibleTraits: ["public_tenders"],
  accounts: [
    { code: "1.1.2.10", name: "Creditos organismos publicos", accountType: "asset", semanticKey: "public_sector_receivables", natureTag: "receivables" },
    { code: "1.1.5.20", name: "Garantias y depositos en licitaciones", accountType: "asset", semanticKey: "tender_guarantees", natureTag: "prepaid" },
    { code: "2.1.2.09", name: "Retenciones contractuales a regularizar", accountType: "liability", semanticKey: "tender_withholdings", natureTag: "tax_payable" }
  ],
  journalTemplates: [
    { code: "sale_public_tender", label: "Factura organismo publico", description: "Venta a organismo publico o licitacion." }
  ],
  taxProfiles: [],
};
