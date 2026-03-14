/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildDgiFormSummary,
  buildFallbackDgiMappings,
} = require("@/modules/exports");
const {
  spreadsheetCanonicalToAccountingPayload,
  spreadsheetCanonicalToTaxPayload,
} = require("@/modules/spreadsheets");

test("historical VAT spreadsheet payload converts to canonical tax metrics", () => {
  const payload = spreadsheetCanonicalToTaxPayload({
    importType: "historical_vat_liquidation",
    organizationId: "org-1",
    sourceType: "imported_from_spreadsheet",
    periods: [
      {
        periodLabel: "2026-02",
        documentCount: 0,
        purchaseTaxableBase: 1000,
        saleTaxableBase: 2000,
        outputVat: 440,
        inputVatCreditable: 220,
        inputVatNonDeductible: 0,
        importVat: 150,
        importVatAdvance: 50,
        netVatPayable: 20,
        notes: "",
        sourceType: "imported_from_spreadsheet",
      },
    ],
    warnings: [],
  });

  assert.equal(payload.metrics.find((metric) => metric.metricKey === "importVat").value, 150);
  assert.equal(payload.metrics.find((metric) => metric.metricKey === "outputVat").sourceType, "imported_from_spreadsheet");
});

test("DGI form summary uses configurable line mappings", () => {
  const summary = buildDgiFormSummary({
    organizationId: "org-1",
    vatRunId: "vat-1",
    formCode: "2176",
    metrics: [
      {
        metricKey: "outputVat",
        value: 440,
        sourceType: "system_generated",
        warnings: [],
      },
      {
        metricKey: "importVat",
        value: 150,
        sourceType: "imported_from_document",
        warnings: [],
      },
    ],
    mappings: buildFallbackDgiMappings(),
  });

  assert.equal(summary.lines[0].lineCode, "114");
  assert.equal(summary.lines.find((line) => line.metricKey === "importVat").value, 150);
});

test("spreadsheet accounting canon keeps template semantics", () => {
  const payload = spreadsheetCanonicalToAccountingPayload({
    importType: "journal_template_import",
    organizationId: "org-1",
    sourceType: "imported_from_spreadsheet",
    templates: [
      {
        templateName: "Combustible",
        documentRole: "purchase",
        documentSubtype: null,
        operationCategory: "fuel_and_lubricants",
        conceptName: "Combustible",
        mainAccountCode: "6105",
        vatAccountCode: "1181",
        counterpartyAccountCode: "2110",
        notes: null,
      },
    ],
    warnings: [],
  });

  assert.equal(payload.payloadType, "journal_templates");
  assert.equal(payload.templates[0].mainAccountCode, "6105");
});
