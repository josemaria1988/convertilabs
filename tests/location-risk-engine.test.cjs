/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  evaluateLocationRisk,
} = require("@/modules/accounting/location-risk-engine");

test("location risk engine keeps same-city supermarket as informational only", () => {
  const result = evaluateLocationRisk({
    documentRole: "purchase",
    organizationDepartment: "Montevideo",
    organizationCity: "Montevideo",
    locationRiskPolicy: "warn_and_require_note",
    issuerName: "Supermercado Centro",
    issuerAddressRaw: "Av. 18 de Julio 1234, Montevideo",
    issuerDepartment: "Montevideo",
    issuerCity: "Montevideo",
    issuerBranchCode: null,
    merchantCategoryHints: ["supermercado"],
    locationExtractionConfidence: 0.95,
    operationCategory: "admin_expense",
    userContextText: "",
  });

  assert.equal(result.locationSignalCode, "same_city");
  assert.equal(result.locationSignalSeverity, "info");
  assert.equal(result.requiresUserJustification, false);
});

test("location risk engine flags far supermarket as sensitive and requires note", () => {
  const result = evaluateLocationRisk({
    documentRole: "purchase",
    organizationDepartment: "Montevideo",
    organizationCity: "Montevideo",
    locationRiskPolicy: "warn_and_require_note",
    issuerName: "Supermercado Norte",
    issuerAddressRaw: "Ruta 3 km 498, Salto",
    issuerDepartment: "Salto",
    issuerCity: "Salto",
    issuerBranchCode: "12",
    merchantCategoryHints: ["supermercado"],
    locationExtractionConfidence: 0.9,
    operationCategory: "admin_expense",
    userContextText: "",
  });

  assert.equal(result.locationSignalCode, "sensitive_merchant_far_from_base");
  assert.equal(result.locationSignalSeverity, "high");
  assert.equal(result.requiresBusinessPurposeReview, true);
  assert.equal(result.requiresUserJustification, true);
});

test("location risk engine suggests travel pattern without auto-denial", () => {
  const result = evaluateLocationRisk({
    documentRole: "purchase",
    organizationDepartment: "Montevideo",
    organizationCity: "Montevideo",
    locationRiskPolicy: "warn_and_require_note",
    issuerName: "Hotel Terminal",
    issuerAddressRaw: "Terminal Tres Cruces, Salto",
    issuerDepartment: "Salto",
    issuerCity: "Salto",
    issuerBranchCode: null,
    merchantCategoryHints: ["hotel"],
    locationExtractionConfidence: 0.82,
    operationCategory: "services",
    userContextText: "Viaje comercial para visitar cliente.",
  });

  assert.equal(result.locationSignalCode, "travel_pattern");
  assert.equal(result.locationSignalSeverity, "warning");
  assert.equal(result.suggestedExpenseFamily, "viaticos");
  assert.equal(result.suggestedTaxProfileCode, "UY_VAT_TRAVEL_REVIEW");
});
