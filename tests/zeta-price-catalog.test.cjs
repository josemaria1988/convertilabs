/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { createZetaRestClient, queryZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
const { createDailyZetaRequestPolicy } = require("@/modules/integrations/zeta/client/read-policy");

test("daily price catalogs use their distinct REST wrappers and preserve catalog codes without inventing article prices", async () => {
  const requests = [];
  const reservations = [];
  const client = createZetaRestClient({
    organizationId: "org-catalog",
    baseUrl: "https://zeta.example/",
    credentials: { DesarrolladorCodigo: "fixture", DesarrolladorClave: "fixture", EmpresaCodigo: "fixture", EmpresaClave: "fixture", UsuarioCodigo: 1, UsuarioClave: "", RolCodigo: 1 },
    requestPolicy: createDailyZetaRequestPolicy({ organizationId: "org-catalog", sleep: async () => {}, reserveRequest: async (endpoint) => reservations.push(endpoint) }),
    fetchImpl: async (url, init) => {
      const request = JSON.parse(init.body); requests.push(request);
      const lists = String(url).endsWith("RESTListasV1QueryPrecios");
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ [lists ? "QueryPreciosOut" : "QueryOut"]: {
        Succeed: true, IsLastPage: true, Response: lists ? [{ PrecioVentaCodigo: "001", PrecioVentaNombre: "Lista" }] : [{ Codigo: "LP", Nombre: "Base" }],
      } }) };
    },
  });
  const bases = await queryZetaEndpoint(client, "priceBasesQuery", { page: 1 });
  const lists = await queryZetaEndpoint(client, "priceListsQuery", { page: 1 });
  assert.equal(bases.rows[0].Codigo, "LP");
  assert.equal(lists.rows[0].PrecioVentaCodigo, "001");
  assert.ok(requests[0].QueryIn);
  assert.ok(requests[1].QueryPreciosIn);
  assert.deepEqual(reservations, ["RESTPreciosBaseV1Query", "RESTListasV1QueryPrecios"]);
  assert.equal(Object.hasOwn(lists.rows[0], "Precio"), false);
});
