/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { createZetaRestClient } = require("@/modules/integrations/zeta/client/rest-client");
const { createHumanExportZetaRequestPolicy } = require("@/modules/integrations/zeta/client/read-policy");
const { reconcilePurchaseExpenseInvoiceExport } = require("@/modules/integrations/zeta/reconcile/reconcile-purchase-expense-invoice");

function fixture(patch = {}) {
  const row = { RegistroId: 43109, ProveedorCodigo: "PR00155", ComprobanteCodigo: 28,
    Serie: "A", Numero: 200, MonedaCodigo: 1, Subtotal: 565.57, IVA: 124.43, Total: 690, ...patch };
  const calls = [];
  const client = createZetaRestClient({ organizationId: "org-1",
    requestPolicy: createHumanExportZetaRequestPolicy("org-1"), baseUrl: "https://zeta.example",
    credentials: { DesarrolladorCodigo: "test", DesarrolladorClave: "test", EmpresaCodigo: "test",
      EmpresaClave: "test", UsuarioCodigo: 0, UsuarioClave: "", RolCodigo: 1 },
    fetchImpl: async (url) => {
      calls.push(url);
      assert.ok(url.endsWith("RESTFacturaProveedorV1QueryCompras"));
      return { ok: true, status: 200, statusText: "OK",
        json: async () => ({ QueryComprasOut: { Succeed: true, IsLastPage: true, Response: [row] } }) };
    },
  });
  const input = { client, movimiento: { CodigoComprobante: 28, Serie: "A", Numero: 200, Fecha: "20260911",
    CodigoMoneda: 1, CodigoProveedor: "PR00155", CodigoLocal: 1, CodigoUsuario: 4, CodigoCaja: 1,
    Lineas: [{ CodigoArticulo: "5110", Cantidad: 1, PrecioUnitario: 690, CodigoIVA: 2 }] },
    expectedNetAmount: 565.57, expectedTaxAmount: 124.43, expectedTotal: 690 };
  return { row, calls, input };
}

test("conciliacion de precio incluido exige neto IVA y total del Query ya realizado", async () => {
  const { input, calls, row } = fixture();
  const result = await reconcilePurchaseExpenseInvoiceExport(input);
  assert.equal(result.status, "found_in_zeta");
  assert.equal(result.registroId, 43109);
  assert.deepEqual(result.queryComprasRaw.Response, [row]);
  assert.equal(calls.length, 1);
});

test("mismo total con neto o IVA incorrectos no concilia ni consulta asientos", async () => {
  for (const patch of [{ Subtotal: 690, IVA: 0 }, { Subtotal: 565.57, IVA: 124.4 },
    { Subtotal: -565.57 }, { Total: 690.02 }]) {
    const { input, calls, row } = fixture(patch);
    const result = await reconcilePurchaseExpenseInvoiceExport({ ...input, ejercicio: 2026 });
    assert.equal(result.status, "amount_mismatch");
    assert.equal(result.registroId, 43109);
    assert.deepEqual(result.queryComprasRaw.Response, [row]);
    assert.match(result.warnings[0], /no se reenvia/);
    assert.equal(calls.length, 1);
  }
});

test("importes fuente ausentes o invalidos no se convierten a cero ni se reparan con otro campo", async () => {
  for (const field of ["Subtotal", "IVA", "Total"]) {
    for (const value of [undefined, null, "", " ", "565.57garbage", {}, [], false, NaN]) {
      const { input, calls } = fixture({ [field]: value });
      const result = await reconcilePurchaseExpenseInvoiceExport(input);
      assert.notEqual(result.status, "found_in_zeta");
      assert.equal(result.registroId, 43109);
      assert.equal(calls.length, 1);
    }
  }
  const { input } = fixture({ Subtotal: null, SubtotalSigno: 565.57 });
  assert.equal((await reconcilePurchaseExpenseInvoiceExport(input)).status, "amount_mismatch");
});

test("conciliacion admite importes decimales estrictos y equivalentes Signo sin cambiar signo", async () => {
  for (const signed of [false, true]) {
    const { input, row } = fixture();
    row.Subtotal = "565,57"; row.IVA = "124.43"; row.Total = "690.00";
    if (signed) {
      row.SubtotalSigno = row.Subtotal; row.IVASigno = row.IVA; row.TotalSigno = row.Total;
      delete row.Subtotal; delete row.IVA; delete row.Total;
    }
    assert.equal((await reconcilePurchaseExpenseInvoiceExport(input)).status, "found_in_zeta");
  }
  const { input, row } = fixture();
  delete row.Subtotal; row.SubtotalSigno = -565.57;
  assert.equal((await reconcilePurchaseExpenseInvoiceExport(input)).status, "amount_mismatch");
});

test("la tolerancia de conciliacion es un centavo y tambien exige suma neto mas IVA", async () => {
  const close = fixture({ Subtotal: 565.58, IVA: 124.42 });
  assert.equal((await reconcilePurchaseExpenseInvoiceExport(close.input)).status, "found_in_zeta");
  const inconsistent = fixture({ Subtotal: 565.58, IVA: 124.44 });
  assert.equal((await reconcilePurchaseExpenseInvoiceExport(inconsistent.input)).status, "amount_mismatch");
});

test("expectativas incompletas o inconsistentes bloquean antes de HTTP", async () => {
  for (const patch of [{ expectedNetAmount: undefined }, { expectedTaxAmount: null },
    { expectedTaxAmount: NaN }, { expectedTotal: null }, { expectedTotal: 800 }]) {
    const { input, calls } = fixture();
    await assert.rejects(reconcilePurchaseExpenseInvoiceExport({ ...input, ...patch }), /esperados validos/);
    assert.equal(calls.length, 0);
  }
});

test("sin expectativas de neto e IVA se conserva la conciliacion historica", async () => {
  const { input, row, calls } = fixture();
  delete input.expectedNetAmount; delete input.expectedTaxAmount;
  delete row.Subtotal; delete row.IVA;
  assert.equal((await reconcilePurchaseExpenseInvoiceExport(input)).status, "found_in_zeta");
  assert.equal(calls.length, 1);
});
