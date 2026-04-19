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
