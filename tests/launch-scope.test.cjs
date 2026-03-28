/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  evaluateOrganizationLaunchScope,
  evaluateDocumentLaunchScope,
  formatLaunchSupportLevelLabel,
} = require("@/modules/launch/scope");

test("organization scope marks SA IRAE general as automatic", () => {
  const result = evaluateOrganizationLaunchScope({
    countryCode: "UY",
    legalEntityType: "SA",
    taxRegimeCode: "IRAE_GENERAL",
    vatRegime: "GENERAL",
  });

  assert.equal(result.supportLevel, "automatic");
  assert.equal(result.allowedActions.canConfirmFinal, true);
});

test("organization scope degrades unsupported legal and tax regimes to assisted mode", () => {
  const result = evaluateOrganizationLaunchScope({
    countryCode: "UY",
    legalEntityType: "UNIPERSONAL",
    taxRegimeCode: "IRAE_LITERAL_E",
    vatRegime: "GENERAL",
  });

  assert.equal(result.supportLevel, "assisted_only");
  assert.equal(result.allowedActions.canConfirmFinal, false);
  assert.match(result.reasons.join(" "), /forma juridica/i);
});

test("document scope blocks foreign currency without trusted fx", () => {
  const result = evaluateDocumentLaunchScope({
    countryCode: "UY",
    legalEntityType: "SA",
    taxRegimeCode: "IRAE_GENERAL",
    vatRegime: "GENERAL",
    documentRole: "purchase",
    documentType: "factura",
    currencyCode: "USD",
    functionalCurrencyCode: "UYU",
    hasTrustedFxSnapshot: false,
    duplicateStatus: "clear",
    isImportOperation: false,
    hasImportWarnings: false,
    requiresCrossCurrencySettlement: false,
  });

  assert.equal(result.supportLevel, "blocked");
  assert.equal(result.allowedActions.canPostProvisional, false);
  assert.match(result.reasons.join(" "), /fx|tipo de cambio/i);
});

test("document scope marks imports as assisted only", () => {
  const result = evaluateDocumentLaunchScope({
    countryCode: "UY",
    legalEntityType: "SA",
    taxRegimeCode: "IRAE_GENERAL",
    vatRegime: "GENERAL",
    documentRole: "purchase",
    documentType: "DUA",
    currencyCode: "USD",
    functionalCurrencyCode: "UYU",
    hasTrustedFxSnapshot: true,
    duplicateStatus: "clear",
    isImportOperation: true,
    hasImportWarnings: false,
    requiresCrossCurrencySettlement: false,
  });

  assert.equal(result.supportLevel, "assisted_only");
  assert.equal(result.allowedActions.canPostProvisional, true);
  assert.equal(result.allowedActions.canConfirmFinal, false);
  assert.equal(formatLaunchSupportLevelLabel(result.supportLevel), "Modo asistido");
});
