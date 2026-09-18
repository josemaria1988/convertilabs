/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { applyPurchaseBalanceMonths, planPurchaseBalanceMonths } = require("@/modules/integrations/zeta/sync/purchase-balances");
const { createDailyZetaRequestPolicy } = require("@/modules/integrations/zeta/client/read-policy");

const at = "2026-09-18T21:01:00.000Z";
const invoice = (overrides = {}) => ({ RegistroId: 123, Fecha: "2026-07-03", ProveedorCodigo: "00001", MonedaCodigo: 2, ComprobanteCodigo: 28, Serie: "A", Numero: 42, Lines: [{ LineaTotal: 100 }], ...overrides });
const header = (overrides = {}) => ({ FacturaId: 123, FacturaDia: 3, FacturaMes: 7, FacturaAnio: 2026, ProveedorCodigo: "00001", MonedaCodigo: 2, ComprobanteCodigo: 28, FacturaSerie: "A", FacturaNumero: 42, FacturaTotal: "100.00", FacturaSaldo: "0.00", ...overrides });
const snapshot = (rawRows, overrides = {}) => ({ month: "2026-07", dataAsOf: at, rawRows, ...overrides });

test("Supplier balance plan revisits historical invoice months including already settled invoices without supplier fanout", () => {
  assert.deepEqual(planPurchaseBalanceMonths([invoice(), invoice({ RegistroId: 124 }), invoice({ Fecha: "2026-02-01" })], "2026-09-01", "2026-09-18"), ["2026-02", "2026-07", "2026-09"]);
  assert.deepEqual(planPurchaseBalanceMonths([], "2026-07-01", "2026-09-18"), ["2026-07", "2026-08", "2026-09"]);
  assert.throws(() => planPurchaseBalanceMonths([invoice({ Fecha: "2026-02-30" })], "2026-09-01", "2026-09-18"));
});

test("A payment posted today to an old invoice refreshes its explicit zero balance and preserves original amounts and currency", () => {
  const original = invoice({ _balance: { schemaVersion: 1, dataAsOf: "2026-09-17T21:00:00Z", raw: header({ FacturaSaldo: 100 }) } });
  const result = applyPurchaseBalanceMonths([original], [snapshot([header()])], "2026-09-18");
  assert.equal(result.rows[0]._balance.raw.FacturaSaldo, "0.00");
  assert.equal(result.rows[0]._balance.raw.MonedaCodigo, 2);
  assert.equal(result.rows[0]._balance.raw.ProveedorCodigo, "00001");
  assert.equal(result.rows[0]._balance.dataAsOf, at);
  assert.deepEqual(result.rows[0].Lines, original.Lines);
  assert.equal(original._balance.raw.FacturaSaldo, 100, "source snapshot stays immutable");
  assert.equal(result.coverage.paymentMethodsIncluded, false);
  assert.equal(result.coverage.paymentDatesIncluded, false);
  assert.equal(result.coverage.receiptApplicationsIncluded, false);
});

test("Missing supplier headers invalidate old balance evidence without manufacturing a zero or a payment", () => {
  const original = invoice({ _balance: { raw: header() } });
  const result = applyPurchaseBalanceMonths([original], [snapshot([])], "2026-09-18");
  assert.equal(Object.hasOwn(result.rows[0], "_balance"), false);
  assert.equal(result.coverage.missingHeaders, 1);
  assert.equal(result.coverage.absentMeansPaid, false);
  assert.equal(original._balance.raw.FacturaSaldo, "0.00");
});

test("Partial settlements, credit-note signs, and reversed payments preserve supplied balances without invented cash movements", () => {
  for (const amounts of [{ FacturaTotal: "100.00", FacturaSaldo: "50.00" }, { FacturaTotal: -100, FacturaSaldo: -25 }, { FacturaTotal: 100, FacturaSaldo: 100 }]) {
    const result = applyPurchaseBalanceMonths([invoice()], [snapshot([header(amounts)])], "2026-09-18");
    assert.equal(result.rows[0]._balance.raw.FacturaSaldo, amounts.FacturaSaldo);
    assert.equal(Object.hasOwn(result.rows[0]._balance, "paymentDate"), false);
  }
});

test("Supplier balances fail closed on missing amount, wrong fiscal identity, currency or conflicting source ID", () => {
  for (const overrides of [{ FacturaTotal: null }, { FacturaSaldo: null }, { ProveedorCodigo: "1" }, { MonedaCodigo: 1 }, { FacturaSerie: "B" }, { FacturaNumero: 43 }, { FacturaDia: 4 }, { ComprobanteCodigo: 23 }]) {
    assert.throws(() => applyPurchaseBalanceMonths([invoice()], [snapshot([header(overrides)])], "2026-09-18"));
  }
  assert.throws(() => applyPurchaseBalanceMonths([invoice()], [snapshot([header(), header({ FacturaSaldo: 2 })])], "2026-09-18"), /datos diferentes/);
  assert.throws(() => applyPurchaseBalanceMonths([invoice()], [snapshot([header({ FacturaMes: 8 })])], "2026-09-18"), /fuera del mes/);
  assert.throws(() => applyPurchaseBalanceMonths([invoice()], [snapshot([header()]), snapshot([header()])], "2026-09-18"), /repetida/);
  assert.equal(applyPurchaseBalanceMonths([invoice()], [snapshot([header(), header()])], "2026-09-18").coverage.refreshedInvoices, 1);
});

test("Balance month requests share daily reservation and cannot repeat beyond their planned bounded count", async () => {
  let reserved = 0;
  const policy = createDailyZetaRequestPolicy({ organizationId: "org-1", purchaseBalanceMonthBatches: 2, reserveRequest: async () => { reserved++; }, sleep: async () => {} });
  await policy.authorize("facturaProveedorCompras"); await policy.authorize("facturaProveedorCompras");
  await assert.rejects(() => policy.authorize("facturaProveedorCompras"), /todos los meses/);
  assert.equal(reserved, 2);
  for (const purchaseBalanceMonthBatches of [0, 201, "1", 1.5]) assert.throws(() => createDailyZetaRequestPolicy({ organizationId: "org-1", purchaseBalanceMonthBatches, reserveRequest: async () => {} }));
});
