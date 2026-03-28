/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  evaluateImportReviewPolicy,
} = require("@/modules/imports/review-policy");

test("import review policy keeps standard dua in assisted mode", () => {
  const result = evaluateImportReviewPolicy({
    documentKind: "dua",
    warnings: [],
    duaNumber: "778899",
    referenceCode: "778899/2026",
    currencyCode: "USD",
    operationDate: "2026-03-05",
    paymentDate: null,
    looksLikeLocalExpense: false,
  });

  assert.equal(result.status, "assisted_ok");
  assert.equal(result.canPostProvisional, true);
  assert.equal(result.canConfirmFinal, false);
});

test("import review policy forces manual review for zona franca and local expense cases", () => {
  const result = evaluateImportReviewPolicy({
    documentKind: "broker_invoice",
    warnings: ["Se detecto zona franca y requiere revision manual."],
    duaNumber: null,
    referenceCode: "778899/2026",
    currencyCode: "UYU",
    operationDate: "2026-03-05",
    paymentDate: null,
    looksLikeLocalExpense: true,
  });

  assert.equal(result.status, "manual_required");
  assert.equal(result.canConfirmFinal, false);
});

test("import review policy blocks ambiguous import documents without reliable reference", () => {
  const result = evaluateImportReviewPolicy({
    documentKind: "unknown",
    warnings: ["Se detecto conflicto de moneda entre documentos vinculados."],
    duaNumber: null,
    referenceCode: "operacion-import",
    currencyCode: "USD",
    operationDate: "2026-03-05",
    paymentDate: null,
    looksLikeLocalExpense: false,
  });

  assert.equal(result.status, "manual_required");
});
