/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  resolveUyVatTreatment,
} = require("@/modules/tax/uy-vat-engine");

function buildBaseInput() {
  return {
    documentRole: "purchase",
    documentType: "Factura Compra",
    facts: {
      issuer_name: "Supermercado Norte",
      issuer_tax_id: "211111110019",
      issuer_address_raw: "Ruta 3 km 498, Salto",
      issuer_department: "Salto",
      issuer_city: "Salto",
      issuer_branch_code: "12",
      merchant_category_hints: ["supermercado"],
      location_extraction_confidence: 0.9,
      receiver_name: "Rontil S.A.",
      receiver_tax_id: "213554700012",
      document_number: "6410",
      series: "A",
      currency_code: "UYU",
      document_date: "2026-03-15",
      due_date: null,
      subtotal: 100,
      tax_amount: 22,
      total_amount: 122,
      purchase_category_candidate: "admin_expense",
      sale_category_candidate: null,
    },
    amountBreakdown: [
      {
        label: "Subtotal",
        amount: 100,
        tax_rate: 22,
        tax_code: "IVA22",
      },
    ],
    operationCategory: "admin_expense",
    profile: {
      countryCode: "UY",
      legalEntityType: "SAS",
      taxRegimeCode: "IRAE_GENERAL",
      vatRegime: "GENERAL",
      dgiGroup: "NO_CEDE",
      cfeStatus: "ELECTRONIC_ISSUER",
      taxId: "213554700012",
      fiscalDepartment: "Montevideo",
      fiscalCity: "Montevideo",
      locationRiskPolicy: "warn_and_require_note",
      travelRadiusKmPolicy: null,
    },
    ruleSnapshot: {
      id: "snapshot-1",
      versionNumber: 1,
      effectiveFrom: "2026-03-01",
      promptSummary: "snapshot",
      deterministicRuleRefs: [],
    },
    linkedOperationType: null,
    userContextText: "",
    vatProfile: null,
    monetarySnapshot: {
      currencyCode: "UYU",
      netAmountOriginal: 100,
      taxAmountOriginal: 22,
      totalAmountOriginal: 122,
      netAmountUyu: 100,
      taxAmountUyu: 22,
      totalAmountUyu: 122,
    },
  };
}

test("VAT engine blocks final confirmation when a geographic outlier lacks business-purpose note", () => {
  const result = resolveUyVatTreatment(buildBaseInput());

  assert.equal(result.locationSignalCode, "sensitive_merchant_far_from_base");
  assert.equal(result.requiresUserJustification, true);
  assert.equal(result.ready, false);
  assert.equal(
    result.blockingReasons.includes(
      "Falta justificar el proposito empresarial de un gasto con razonabilidad geografica sensible.",
    ),
    true,
  );
});

test("VAT engine allows deterministic treatment once the business-purpose note is present", () => {
  const result = resolveUyVatTreatment({
    ...buildBaseInput(),
    businessPurposeNote: "Compra para abastecer equipo desplazado en obra de cliente.",
  });

  assert.equal(result.locationSignalCode, "sensitive_merchant_far_from_base");
  assert.equal(result.requiresUserJustification, true);
  assert.equal(result.ready, true);
  assert.equal(result.blockingReasons.length, 0);
  assert.equal(result.businessPurposeNote, "Compra para abastecer equipo desplazado en obra de cliente.");
});
