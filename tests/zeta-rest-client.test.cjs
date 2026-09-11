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

function dailySyncFixture(reserveRequest = async () => {}) {
  const { createDailyZetaRequestPolicy } = require("@/modules/integrations/zeta/client/read-policy");
  return {
    organizationId: "org-1",
    requestPolicy: createDailyZetaRequestPolicy({
      organizationId: "org-1", reserveRequest, sleep: async () => {},
    }),
  };
}

function humanExportFixture() {
  const { createHumanExportZetaRequestPolicy } = require("@/modules/integrations/zeta/client/read-policy");
  return { organizationId: "org-1", requestPolicy: createHumanExportZetaRequestPolicy("org-1") };
}

function purchaseMovement() {
  return {
    CodigoComprobante: 28, Serie: "A", Numero: 123, Fecha: "20260909",
    CodigoProveedor: "PR0001", CodigoMoneda: 1, CodigoLocal: 1, CodigoUsuario: 4, CodigoCaja: 1,
    Lineas: [
      { CodigoArticulo: "005128", Cantidad: 1, PrecioUnitario: 100, CodigoIVA: 0, CodigoLocalLinea: 1 },
      { CodigoArticulo: "005110", Cantidad: 2, PrecioUnitario: 50, CodigoIVA: 0, CodigoLocalLinea: 1 },
    ],
    FormasPago: [
      { CodigoFormaPago: 1, CodigoMonedaPago: 1, MontoMonedaPago: 100, MontoMonedaMovimiento: 100 },
      { CodigoFormaPago: 10, CodigoMonedaPago: 1, MontoMonedaPago: 100, MontoMonedaMovimiento: 100 },
    ],
  };
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test("FacturaProveedorAgregar serializes one internal movement as an object without mutating the reviewed payload", async () => {
  const { createZetaRestClient, callZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
  const { createHash } = require("node:crypto");
  const input = deepFreeze({ Data: { Movimiento: [purchaseMovement()] } });
  const original = JSON.stringify(input);
  const fingerprint = createHash("sha256").update(original).digest("hex");
  const calls = [];
  const client = createZetaRestClient({
    ...humanExportFixture(), baseUrl: "https://api.zeta.example", credentials: credentials(),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return createJsonResponse({ AgregarOut: { Succeed: true, Response: { RegistroId: 123 } } });
    },
  });

  await callZetaEndpoint(client, "facturaProveedorAgregar", input);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.zeta.example/APIs/RESTFacturaProveedorV1Agregar");
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body, { AgregarIn: { Connection: credentials(), Data: { Movimiento: input.Data.Movimiento[0] } } });
  assert.equal(Array.isArray(body.AgregarIn.Data.Movimiento), false);
  assert.equal(Array.isArray(body.AgregarIn.Data.Movimiento.Lineas), true);
  assert.equal(Array.isArray(body.AgregarIn.Data.Movimiento.FormasPago), true);
  assert.equal(body.AgregarIn.Data.Movimiento.Lineas.length, 2);
  assert.equal(body.AgregarIn.Data.Movimiento.FormasPago.length, 2);
  assert.equal(JSON.stringify(input), original);
  assert.equal(createHash("sha256").update(JSON.stringify(input)).digest("hex"), fingerprint);
});

test("FacturaProveedorAgregar preserves omitted or empty payment lists", async () => {
  const { createZetaRestClient, callZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
  for (const omit of [true, false]) {
    const movement = purchaseMovement();
    if (omit) delete movement.FormasPago;
    else movement.FormasPago = [];
    const client = createZetaRestClient({
      ...humanExportFixture(), baseUrl: "https://api.zeta.example", credentials: credentials(),
      fetchImpl: async (_url, init) => {
        const sent = JSON.parse(init.body).AgregarIn.Data.Movimiento;
        assert.deepEqual(sent, movement);
        assert.equal(Object.hasOwn(sent, "FormasPago"), !omit);
        return createJsonResponse({ AgregarOut: { Succeed: true, Response: {} } });
      },
    });
    await callZetaEndpoint(client, "facturaProveedorAgregar", { Data: { Movimiento: [movement] } });
  }
});

test("FacturaProveedorAgregar rejects empty, multiple or malformed internal movements before fetch", async () => {
  const { createZetaRestClient, callZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
  const movement = purchaseMovement();
  const invalidInputs = [
    null, [], {}, { Data: null }, { Data: [] }, { Data: "invalid" }, { Data: {} },
    ...[null, false, "invalid", {}, movement, [], [movement, movement], [null], [[]], [{}]]
      .map((Movimiento) => ({ Data: { Movimiento } })),
    ...[null, {}, [], [null], [false], [[]], Array(1)]
      .map((Lineas) => ({ Data: { Movimiento: [{ ...movement, Lineas }] } })),
    ...[null, {}, [null], [false], [[]], Array(1)]
      .map((FormasPago) => ({ Data: { Movimiento: [{ ...movement, FormasPago }] } })),
  ];
  let calls = 0;
  const client = createZetaRestClient({
    ...humanExportFixture(), baseUrl: "https://api.zeta.example", credentials: credentials(),
    fetchImpl: async () => { calls++; throw new Error("Invalid payload must not reach HTTP"); },
  });
  for (const input of invalidInputs) {
    await assert.rejects(callZetaEndpoint(client, "facturaProveedorAgregar", input), (error) => {
      assert.equal(error.code, "zeta_purchase_movement_invalid");
      assert.equal(error.endpointName, "RESTFacturaProveedorV1Agregar");
      return true;
    });
  }
  assert.equal(calls, 0);
});

test("FacturaProveedorAgregar serialization does not bypass read policy", async () => {
  const { createZetaRestClient, callZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
  let calls = 0, reservations = 0;
  const client = createZetaRestClient({
    ...dailySyncFixture(async () => { reservations++; }), baseUrl: "https://api.zeta.example", credentials: credentials(),
    fetchImpl: async () => { calls++; throw new Error("Daily sync must not write"); },
  });
  await assert.rejects(callZetaEndpoint(client, "facturaProveedorAgregar", { Data: { Movimiento: [purchaseMovement()] } }),
    (error) => error.code === "zeta_daily_write_blocked");
  assert.equal(calls, 0);
  assert.equal(reservations, 0);
});

test("other REST endpoints retain their input shape without movement adaptation", async () => {
  const { createZetaRestClient, callZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
  const input = { Data: { Movimiento: [purchaseMovement(), purchaseMovement()] } };
  const client = createZetaRestClient({
    ...humanExportFixture(), baseUrl: "https://api.zeta.example", credentials: credentials(),
    fetchImpl: async (_url, init) => {
      assert.deepEqual(JSON.parse(init.body).QueryComprasIn.Data, input.Data);
      return createJsonResponse({ QueryComprasOut: { Succeed: true, Response: [] } });
    },
  });
  await callZetaEndpoint(client, "facturaProveedorQueryCompras", input);
});

test("Zeta REST client posts QueryIn payloads to the official endpoint URL", async () => {
  const {
    createZetaRestClient,
    queryZetaEndpoint,
  } = require("@/modules/integrations/zeta/client/rest-client");
  const calls = [];
  const reservedEndpoints = [];
  const client = createZetaRestClient({
    ...dailySyncFixture(async (endpoint) => { reservedEndpoints.push(endpoint); }),
    baseUrl: "https://api.zeta.example/",
    credentials: credentials(),
    fetchImpl: async (url, init) => {
      assert.deepEqual(reservedEndpoints, ["RESTUsuariosEmpresaV1Query"]);
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
    ...dailySyncFixture(),
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

test("Zeta HTTP errors retain sanitized JSON diagnostics and status without retrying", async () => {
  const { createZetaRestClient, queryZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
  const { normalizeZetaException } = require("@/modules/integrations/zeta/client/errors");
  let calls = 0;
  const client = createZetaRestClient({
    ...dailySyncFixture(), baseUrl: "https://api.zeta.example", credentials: credentials(),
    fetchImpl: async () => {
      calls++;
      return new Response(JSON.stringify({
        error: { Message: "Cannot convert field CodigoComprobante", token: "unrelated-sensitive-value" },
        Connection: credentials(),
        echoed: "dev-secret empresa-secret",
      }), { status: 400, headers: { "content-type": "application/json" } });
    },
  });
  await assert.rejects(queryZetaEndpoint(client, "userRolesQuery"), (error) => {
    const normalized = normalizeZetaException(error);
    assert.equal(normalized.code, "zeta_http_error");
    assert.equal(normalized.status, 400);
    assert.equal(normalized.endpointName, "RESTUsuariosEmpresaV1Query");
    assert.equal(normalized.details.contentType, "application/json");
    assert.equal(normalized.details.bodyReadFailed, false);
    assert.equal(normalized.details.bodyTruncated, false);
    assert.match(normalized.details.body, /Cannot convert field CodigoComprobante/);
    assert.doesNotMatch(JSON.stringify(normalized), /dev-secret|empresa-secret|unrelated-sensitive-value/);
    assert.equal(JSON.parse(normalized.details.body).Connection, "[REDACTED]");
    return true;
  });
  assert.equal(calls, 1);
});

test("Zeta HTTP diagnostics cap a streamed HTML response and redact echoed secrets", async () => {
  const { createZetaRestClient, queryZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
  let cancelled = false;
  let reads = 0;
  const prefix = '<html>Bad field. Password="unknown-password" Bearer unknown-token dev-secret empresa-secret ';
  const body = new ReadableStream({
    pull(controller) {
      reads++;
      controller.enqueue(new TextEncoder().encode(prefix + "x".repeat(20000)));
    },
    cancel() { cancelled = true; },
  });
  const client = createZetaRestClient({
    ...dailySyncFixture(), baseUrl: "https://api.zeta.example", credentials: credentials(),
    fetchImpl: async () => new Response(body, { status: 502, headers: { "content-type": "text/html" } }),
  });
  await assert.rejects(queryZetaEndpoint(client, "userRolesQuery"), (error) => {
    assert.equal(error.status, 502);
    assert.equal(error.details.contentType, "text/html");
    assert.equal(error.details.bodyTruncated, true);
    assert.equal(error.details.body.length, 8192);
    assert.match(error.details.body, /Bad field/);
    assert.doesNotMatch(error.details.body, /unknown-password|unknown-token|dev-secret|empresa-secret/);
    return true;
  });
  assert.equal(cancelled, true);
  assert.ok(reads <= 2);
});

test("Zeta HTTP diagnostics preserve HTTP failure when its body cannot be read", async () => {
  const { createZetaRestClient, queryZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
  const client = createZetaRestClient({
    ...dailySyncFixture(), baseUrl: "https://api.zeta.example", credentials: credentials(),
    fetchImpl: async () => createJsonResponse(null, {
      ok: false, status: 400, statusText: "dev-secret",
      text: async () => { throw new Error("empresa-secret"); },
    }),
  });
  await assert.rejects(queryZetaEndpoint(client, "userRolesQuery"), (error) => {
    assert.equal(error.code, "zeta_http_error");
    assert.equal(error.status, 400);
    assert.equal(error.details.body, null);
    assert.equal(error.details.bodyReadFailed, true);
    assert.doesNotMatch(JSON.stringify(error), /dev-secret|empresa-secret/);
    return true;
  });
});

test("Zeta HTTP diagnostics support injected JSON-only responses", async () => {
  const { createZetaRestClient, queryZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
  const client = createZetaRestClient({
    ...dailySyncFixture(), baseUrl: "https://api.zeta.example", credentials: credentials(),
    fetchImpl: async () => createJsonResponse({ Message: "Unknown field", EmpresaClave: "another-secret" }, {
      ok: false, status: 400, statusText: "Bad Request",
    }),
  });
  await assert.rejects(queryZetaEndpoint(client, "userRolesQuery"), (error) => {
    assert.match(error.details.body, /Unknown field/);
    assert.doesNotMatch(error.details.body, /another-secret/);
    return true;
  });
});

test("Zeta REST client supports non-Query wrappers such as CFEsRecibidosIn", async () => {
  const {
    callZetaEndpoint,
    createZetaRestClient,
  } = require("@/modules/integrations/zeta/client/rest-client");
  let parsedBody = null;
  const client = createZetaRestClient({
    ...dailySyncFixture(),
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
    ...dailySyncFixture(),
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

test("Zeta REST never reaches HTTP without a policy matching the client organization, even with mocked fetch", async () => {
  const { createZetaRestClient, queryZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
  let httpCalls = 0;
  let reservations = 0;
  const permitted = dailySyncFixture(async () => { reservations++; });
  for (const access of [
    {},
    { organizationId: "org-1" },
    { requestPolicy: permitted.requestPolicy },
    { organizationId: "org-2", requestPolicy: permitted.requestPolicy },
  ]) {
    const client = createZetaRestClient({
      ...access, baseUrl: "https://api.zeta.example", credentials: credentials(),
      fetchImpl: async () => { httpCalls++; throw new Error("HTTP must not run"); },
    });
    await assert.rejects(queryZetaEndpoint(client, "userRolesQuery"), (error) => {
      assert.equal(error.code, "zeta_live_read_disabled");
      return true;
    });
  }
  assert.equal(httpCalls, 0);
  assert.equal(reservations, 0);
});

test("Zeta REST sends no HTTP when the persisted daily request reservation fails", async () => {
  const { createZetaRestClient, queryZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
  let httpCalls = 0;
  const budgetError = Object.assign(new Error("Daily request budget exhausted"), { code: "zeta_daily_budget_exhausted" });
  const client = createZetaRestClient({
    ...dailySyncFixture(async () => { throw budgetError; }),
    baseUrl: "https://api.zeta.example", credentials: credentials(),
    fetchImpl: async () => { httpCalls++; throw new Error("HTTP must not run"); },
  });
  await assert.rejects(queryZetaEndpoint(client, "userRolesQuery"), (error) => error === budgetError);
  assert.equal(httpCalls, 0);
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
  assert.equal(runtime.credentials.UsuarioClave, "");
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
  assert.equal(runtime.credentials.UsuarioClave, "");
  assert.equal(runtime.credentials.RolCodigo, 17);
  assert.equal(runtime.metadata.envProfile, "RONTIL");
});
