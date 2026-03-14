export type PilotScenarioId =
  | "local_purchase"
  | "local_sale"
  | "credit_note"
  | "receipt_payment"
  | "duplicates"
  | "new_vendor"
  | "new_concept"
  | "standard_import"
  | "broker_invoice"
  | "spreadsheet_import"
  | "historical_vat"
  | "dgi_mapping";

export type PilotScenarioResult = {
  scenarioId: PilotScenarioId;
  usableExtraction: boolean;
  correctClassification: boolean;
  correctBlocking: boolean;
  correctVat: boolean;
  reviewMinutes: number;
  estimatedCostUsd: number;
};

export const RONTIL_PILOT_SCENARIOS: Array<{
  id: PilotScenarioId;
  label: string;
}> = [
  { id: "local_purchase", label: "Compra local" },
  { id: "local_sale", label: "Venta local" },
  { id: "credit_note", label: "Nota de credito" },
  { id: "receipt_payment", label: "Recibo o pago" },
  { id: "duplicates", label: "Duplicados" },
  { id: "new_vendor", label: "Proveedor nuevo" },
  { id: "new_concept", label: "Concepto nuevo" },
  { id: "standard_import", label: "Importacion estandar" },
  { id: "broker_invoice", label: "Factura despachante" },
  { id: "spreadsheet_import", label: "Import planilla" },
  { id: "historical_vat", label: "Historico IVA" },
  { id: "dgi_mapping", label: "Mapping DGI" },
];

export function buildRontilPilotSummary(results: PilotScenarioResult[]) {
  const expectedIds = new Set(RONTIL_PILOT_SCENARIOS.map((scenario) => scenario.id));
  const coveredIds = new Set(results.map((result) => result.scenarioId));
  const missingScenarios = Array.from(expectedIds).filter((id) => !coveredIds.has(id));
  const coverage = expectedIds.size === 0
    ? 1
    : (expectedIds.size - missingScenarios.length) / expectedIds.size;
  const usableExtractionRate = results.length === 0
    ? 0
    : results.filter((result) => result.usableExtraction).length / results.length;
  const correctClassificationRate = results.length === 0
    ? 0
    : results.filter((result) => result.correctClassification).length / results.length;
  const correctBlockingRate = results.length === 0
    ? 0
    : results.filter((result) => result.correctBlocking).length / results.length;
  const correctVatRate = results.length === 0
    ? 0
    : results.filter((result) => result.correctVat).length / results.length;
  const averageReviewMinutes = results.length === 0
    ? 0
    : results.reduce((sum, result) => sum + result.reviewMinutes, 0) / results.length;
  const averageCostUsd = results.length === 0
    ? 0
    : results.reduce((sum, result) => sum + result.estimatedCostUsd, 0) / results.length;

  return {
    coverage,
    missingScenarios,
    usableExtractionRate,
    correctClassificationRate,
    correctBlockingRate,
    correctVatRate,
    averageReviewMinutes,
    averageCostUsd,
    pilotReady:
      missingScenarios.length === 0
      && usableExtractionRate >= 0.9
      && correctClassificationRate >= 0.9
      && correctBlockingRate >= 0.95
      && correctVatRate >= 0.9
      && averageReviewMinutes <= 12,
  };
}
