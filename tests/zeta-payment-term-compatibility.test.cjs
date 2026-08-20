/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

test("condiciones Zeta usan mappings configurados antes que heuristicas", () => {
  const {
    classifyZetaPaymentTerm,
  } = require("@/modules/integrations/zeta/export/payment-term-compatibility");

  assert.equal(classifyZetaPaymentTerm({
    code: "001",
    label: "Nombre personalizado",
    configuredCashCode: "001",
    configuredCreditCode: "003",
  }), "cash");
  assert.equal(classifyZetaPaymentTerm({
    code: "003",
    label: "Nombre personalizado",
    configuredCashCode: "001",
    configuredCreditCode: "003",
  }), "credit");
});

test("condiciones Zeta adicionales se clasifican por semantica visible", () => {
  const {
    classifyZetaPaymentTerm,
  } = require("@/modules/integrations/zeta/export/payment-term-compatibility");

  assert.equal(classifyZetaPaymentTerm({
    code: "001",
    label: "Contado efectivo",
  }), "cash");
  assert.equal(classifyZetaPaymentTerm({
    code: "004",
    label: "Credito 45 dias",
  }), "credit");
});

test("compatibilidad impide cruzar condicion contado y credito", () => {
  const {
    isZetaPaymentTermCompatible,
  } = require("@/modules/integrations/zeta/export/payment-term-compatibility");

  assert.equal(isZetaPaymentTermCompatible({
    kind: "cash",
    paymentTerms: "credit",
  }), false);
  assert.equal(isZetaPaymentTermCompatible({
    kind: "credit",
    paymentTerms: "cash",
  }), false);
  assert.equal(isZetaPaymentTermCompatible({
    kind: "credit",
    paymentTerms: "credit",
  }), true);
});

test("condicion especial solo aplica al flujo pagado por socio", () => {
  const {
    isZetaPaymentTermCompatible,
  } = require("@/modules/integrations/zeta/export/payment-term-compatibility");

  assert.equal(isZetaPaymentTermCompatible({
    kind: "special",
    paymentTerms: "cash",
    settlementMethod: "paid_by_partner",
  }), true);
  assert.equal(isZetaPaymentTermCompatible({
    kind: "special",
    paymentTerms: "cash",
    settlementMethod: "cash",
  }), false);
});
