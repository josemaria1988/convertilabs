/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function credentials() {
  return {
    DesarrolladorCodigo: "dev-code",
    DesarrolladorClave: "dev-secret",
    EmpresaCodigo: "empresa",
    EmpresaClave: "empresa-secret",
    UsuarioCodigo: 42,
    UsuarioClave: "",
    RolCodigo: 7,
  };
}

function createJsonResponse(body, overrides = {}) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    ...overrides,
  };
}

test("Zeta REST client posts QueryIn payloads to the official endpoint URL", async () => {
  const {
    createZetaRestClient,
    queryZetaEndpoint,
  } = require("@/modules/integrations/zeta/client/rest-client");
  const calls = [];
  const client = createZetaRestClient({
    baseUrl: "https://api.zeta.example/",
    credentials: credentials(),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });

      return createJsonResponse({
        QueryOut: {
          Succeed: true,
          Response: [
            {
              Codigo: 7,
              Nombre: "Contabilidad",
            },
          ],
          IsLastPage: true,
          Error: null,
        },
      });
    },
  });

  const result = await queryZetaEndpoint(client, "userRolesQuery", {
    page: 1,
    filters: {
      CodigoDesde: 7,
      CodigoHasta: 7,
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.zeta.example/APIs/RESTUsuariosEmpresaV1Query");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Accept, "application/json");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");

  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.QueryIn.Connection.DesarrolladorCodigo, "dev-code");
  assert.equal(body.QueryIn.Connection.EmpresaCodigo, "empresa");
  assert.equal(body.QueryIn.Connection.UsuarioCodigo, 42);
  assert.equal(body.QueryIn.Connection.RolCodigo, 7);
  assert.equal(body.QueryIn.Data.Page, 1);
  assert.equal(body.QueryIn.Data.Filters.CodigoDesde, 7);
  assert.equal(result.rows.length, 1);
  assert.equal(result.isLastPage, true);
});

test("Zeta REST client normalizes API errors without leaking request credentials", async () => {
  const {
    createZetaRestClient,
    queryZetaEndpoint,
  } = require("@/modules/integrations/zeta/client/rest-client");
  const client = createZetaRestClient({
    baseUrl: "https://api.zeta.example",
    credentials: credentials(),
    fetchImpl: async () => createJsonResponse({
      QueryOut: {
        Succeed: false,
        Response: [],
        Error: {
          Code: "AUTH",
          Message: "Credenciales invalidas",
        },
      },
    }),
  });

  await assert.rejects(
    () => queryZetaEndpoint(client, "userRolesQuery", { page: 1, filters: {} }),
    (error) => {
      assert.equal(error.code, "AUTH");
      assert.match(error.message, /Credenciales invalidas/);
      assert.doesNotMatch(error.stack || "", /dev-secret|empresa-secret/);

      return true;
    },
  );
});

test("Zeta REST client supports non-Query wrappers such as CFEsRecibidosIn", async () => {
  const {
    callZetaEndpoint,
    createZetaRestClient,
  } = require("@/modules/integrations/zeta/client/rest-client");
  let parsedBody = null;
  const client = createZetaRestClient({
    baseUrl: "https://api.zeta.example",
    credentials: credentials(),
    fetchImpl: async (_url, init) => {
      parsedBody = JSON.parse(init.body);

      return createJsonResponse({
        CFEsRecibidosOut: {
          Succeed: true,
          Response: {
            ListaCFEs: [],
            Succeed: true,
            Mensaje: "",
          },
          Error: null,
        },
      });
    },
  });

  const output = await callZetaEndpoint(client, "receivedCfesQuery", {
    Data: {
      FechaDesde: "2026-04-01",
      FechaHasta: "2026-04-30",
      Pagina: 1,
    },
  });

  assert.equal(parsedBody.CFEsRecibidosIn.Data.Pagina, 1);
  assert.deepEqual(output.Response.ListaCFEs, []);
});

test("Zeta REST client posts Facturas de Clientes with the QueryVentas wrapper", async () => {
  const {
    createZetaRestClient,
    queryZetaEndpoint,
  } = require("@/modules/integrations/zeta/client/rest-client");
  let parsedBody = null;
  const client = createZetaRestClient({
    baseUrl: "https://api.zeta.example",
    credentials: credentials(),
    fetchImpl: async (url, init) => {
      parsedBody = JSON.parse(init.body);
      assert.equal(url, "https://api.zeta.example/APIs/RESTFacturaClienteV4QueryVentas");

      return createJsonResponse({
        QueryVentasOut: {
          Succeed: true,
          Response: [
            {
              RegistroId: 123,
              Serie: "A",
              Numero: 45,
            },
          ],
          IsLastPage: true,
          Error: null,
        },
      });
    },
  });

  const result = await queryZetaEndpoint(client, "salesInvoicesQuery", {
    page: 2,
    filters: {
      Mes: 3,
      Anio: 2026,
    },
  });

  assert.equal(parsedBody.QueryVentasIn.Data.Page, 2);
  assert.equal(parsedBody.QueryVentasIn.Data.Filters.Mes, 3);
  assert.equal(parsedBody.QueryVentasIn.Data.Filters.Anio, 2026);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].RegistroId, 123);
});

test("Zeta runtime derives base URL from legacy endpoint env variables", () => {
  const {
    loadZetaRuntimeConfig,
  } = require("@/modules/integrations/zeta/client/auth");
  const runtime = loadZetaRuntimeConfig({
    env: {
      ZETASOFTWARE_API_STOCK: "https://api.zeta.example/APIs/RESTArticuloStockV1Query",
      ZETASOFTWARE_DESARROLLADOR_CODIGO: "dev-code",
      ZETASOFTWARE_DESARROLLADOR_CLAVE: "dev-secret",
      ZETASOFTWARE_EMPRESA_CODIGO: "empresa",
      ZETASOFTWARE_EMPRESA_CLAVE: "empresa-secret",
      ZETASOFTWARE_USUARIOCODIGO: "42",
      ZETASOFTWARE_ROLCODIGO: "7",
    },
  });

  assert.equal(runtime.baseUrl, "https://api.zeta.example");
  assert.equal(runtime.credentials.UsuarioCodigo, 42);
  assert.equal(runtime.credentials.RolCodigo, 7);
});

test("Zeta runtime can read organization-specific env profiles", () => {
  const {
    loadZetaRuntimeConfig,
  } = require("@/modules/integrations/zeta/client/auth");
  const runtime = loadZetaRuntimeConfig({
    envProfile: "rontil",
    env: {
      ZETASOFTWARE_BASE_URL: "https://fallback.example",
      ZETASOFTWARE_RONTIL_BASE_URL: "https://api.rontil.example",
      ZETASOFTWARE_DESARROLLADOR_CODIGO: "dev-code",
      ZETASOFTWARE_DESARROLLADOR_CLAVE: "dev-secret",
      ZETASOFTWARE_RONTIL_EMPRESA_CODIGO: "RONTIL",
      ZETASOFTWARE_RONTIL_EMPRESA_CLAVE: "empresa-secret",
      ZETASOFTWARE_RONTIL_USUARIOCODIGO: "99",
      ZETASOFTWARE_RONTIL_ROLCODIGO: "17",
    },
  });

  assert.equal(runtime.baseUrl, "https://api.rontil.example");
  assert.equal(runtime.credentials.DesarrolladorCodigo, "dev-code");
  assert.equal(runtime.credentials.EmpresaCodigo, "RONTIL");
  assert.equal(runtime.credentials.UsuarioCodigo, 99);
  assert.equal(runtime.credentials.RolCodigo, 17);
  assert.equal(runtime.metadata.envProfile, "RONTIL");
});
