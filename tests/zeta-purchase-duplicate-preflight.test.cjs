/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

test("Preflight detecta duplicado por proveedor, comprobante, serie, numero, total y moneda", () => {
  const {
    findDuplicateZetaPurchaseInvoice,
  } = require("@/modules/integrations/zeta/export/duplicate-preflight");
  const movimiento = {
    CodigoComprobante: 11,
    Serie: "A",
    Numero: 123456,
    Fecha: "2026-04-20",
    CodigoMoneda: 1,
    CodigoProveedor: "PR0031",
    Lineas: [],
  };
  const result = findDuplicateZetaPurchaseInvoice({
    movimiento,
    expectedTotal: 1220,
    rows: [
      {
        RegistroId: 9001,
        ProveedorCodigo: "PR0031",
        ComprobanteCodigo: 11,
        Serie: "A",
        Numero: 123456,
        MonedaCodigo: 1,
        Total: 1220,
      },
    ],
  });

  assert.equal(result.found, true);
  assert.equal(result.registroId, 9001);
});

test("Preflight no marca duplicado si cambia el total", () => {
  const {
    findDuplicateZetaPurchaseInvoice,
  } = require("@/modules/integrations/zeta/export/duplicate-preflight");
  const result = findDuplicateZetaPurchaseInvoice({
    movimiento: {
      CodigoComprobante: 11,
      Serie: "A",
      Numero: 123456,
      Fecha: "2026-04-20",
      CodigoMoneda: 1,
      CodigoProveedor: "PR0031",
      Lineas: [],
    },
    expectedTotal: 1220,
    rows: [
      {
        RegistroId: 9001,
        ProveedorCodigo: "PR0031",
        ComprobanteCodigo: 11,
        Serie: "A",
        Numero: 123456,
        MonedaCodigo: 1,
        Total: 1300,
      },
    ],
  });

  assert.equal(result.found, false);
});

test("QueryCompras usa wrapper oficial QueryComprasIn", async () => {
  const {
    preflightZetaPurchaseInvoiceDuplicate,
  } = require("@/modules/integrations/zeta/export/duplicate-preflight");
  const {
    createZetaRestClient,
  } = require("@/modules/integrations/zeta/client/rest-client");
  let parsedBody = null;
  const client = createZetaRestClient({
    baseUrl: "https://api.zeta.example",
    credentials: {
      DesarrolladorCodigo: "dev",
      DesarrolladorClave: "secret",
      EmpresaCodigo: "emp",
      EmpresaClave: "secret",
      UsuarioCodigo: 1,
      UsuarioClave: "",
      RolCodigo: 2,
    },
    fetchImpl: async (_url, init) => {
      parsedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          QueryComprasOut: {
            Succeed: true,
            Response: [],
            IsLastPage: true,
            Error: null,
          },
        }),
      };
    },
  });

  await preflightZetaPurchaseInvoiceDuplicate({
    client,
    movimiento: {
      CodigoComprobante: 11,
      Serie: "A",
      Numero: 123456,
      Fecha: "2026-04-20",
      CodigoMoneda: 1,
      CodigoProveedor: "PR0031",
      Lineas: [],
    },
    expectedTotal: 1220,
  });

  assert.equal(parsedBody.QueryComprasIn.Data.Filters.ProveedorCodigo, "PR0031");
  assert.equal(parsedBody.QueryComprasIn.Data.Filters.Mes, 4);
  assert.equal(parsedBody.QueryComprasIn.Data.Filters.Anio, 2026);
});

