/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { runDailyZetaSync, fetchDailyZetaReport, groupZetaPurchaseDetailRows } = require("@/modules/integrations/zeta/sync/daily-sync");
const { createDailyZetaRequestPolicy, createHumanExportZetaRequestPolicy } = require("@/modules/integrations/zeta/client/read-policy");
const { createZetaRestClient, callZetaEndpoint, queryZetaEndpoint } = require("@/modules/integrations/zeta/client/rest-client");
const { reportHash } = require("@/modules/integrations/zeta/cache/report-contracts");

const runtime = {
  baseUrl: "https://zeta.example", credentials: { DesarrolladorCodigo: "test", DesarrolladorClave: "test", EmpresaCodigo: "test", EmpresaClave: "test", UsuarioCodigo: 1, UsuarioClave: "", RolCodigo: 1 },
  metadata: { credentialSource: "overrides", envProfile: null, hasUsuarioClave: false },
};
function dailyFixture(options = {}) {
  const http = [], staged = [], rpcCalls = [];
  let requests = 0, claimed = false, lostPublish = false;
  const supabase = { async rpc(name, params) {
    rpcCalls.push({ name, params });
    if (name === "claim_zeta_daily_sync") {
      if (options.notDue || claimed) return { data: { claimed: false, reason: options.notDue ? "not_due" : "already_attempted", scheduledDay: "2026-09-09" }, error: null };
      claimed = true;
      return { data: { claimed: true, runId: "daily-run", leaseToken: "token", scheduledDay: "2026-09-09" }, error: null };
    }
    if (name === "reserve_zeta_daily_request") {
      if (requests >= (options.budget ?? 100)) return { data: null, error: { message: "daily request budget exhausted" } };
      return { data: { requestNumber: ++requests, maxRequests: 100 }, error: null };
    }
    if (name === "publish_zeta_daily_sync" && options.losePublishAck && !lostPublish) {
      lostPublish = true;
      return { data: null, error: { message: "acknowledgement lost" } };
    }
    return { data: { status: name === "publish_zeta_daily_sync" ? "completed" : "failed" }, error: null };
  } };
  const fetchImpl = async (url, init) => {
    assert.equal(requests, http.length + 1, "reserve before every HTTP");
    http.push({ url, body: JSON.parse(init.body) });
    const wrapper = url.includes("QueryVentas") ? "QueryVentasOut" : url.includes("ComprasDetalladas") ? "ComprasDetalladasOut" : url.includes("ObtenerPrecioBase") ? "ObtenerPrecioBaseOut" : "QueryOut";
    if (options.response) {
      const response = options.response(url, JSON.parse(init.body));
      if (response) return { ok: true, status: 200, statusText: "OK", json: async () => ({ [wrapper]: response }) };
    }
    return { ok: true, status: 200, statusText: "OK", json: async () => ({ [wrapper]: { Succeed: true, IsLastPage: true, Response: wrapper === "ObtenerPrecioBaseOut" ? { Succeed: true, ListaPrecios: [] } : wrapper === "ComprasDetalladasOut" ? { Succeed: true, ComprasDetalladas: [] } : [] } }) };
  };
  const deps = {
    runtime, fetchImpl, sleep: async () => {}, now: () => Date.parse("2026-09-09T21:00:00Z"),
    loadInvoiceBase: async () => null,
    stageSnapshot: async ({ snapshot }) => { staged.push(snapshot); return { ...snapshot, rows: undefined, rowCount: snapshot.rows.length, complete: true }; },
    runMasters: async (input) => {
      const client = createZetaRestClient({ ...runtime, organizationId: input.organizationId, requestPolicy: input.requestPolicy, fetchImpl });
      await queryZetaEndpoint(client, "contactsQuery");
      return { runId: "masters-run", recordsFailed: 0, warnings: [] };
    },
  };
  return { supabase, deps, http, staged, rpcCalls };
}
const identity = { organizationId: "org-1", actorProfileId: "actor-1" };

test("Daily Zeta sync claims once and publishes sales purchases articles stock plus reviewed masters under one request budget", async () => {
  const f = dailyFixture();
  const result = await runDailyZetaSync({ ...identity, supabase: f.supabase }, f.deps);
  assert.equal(result.status, "completed");
  assert.equal(result.requestsUsed, 5);
  assert.deepEqual(result.salesCoverage, { mode: "incremental", from: "2026-09-09", to: "2026-09-09", historicalEditsOutsideDeltaCovered: false });
  assert.deepEqual(f.staged.map((x) => x.report), ["sales", "purchases", "articles", "stock"]);
  assert.equal(result.pricesCoverage.allArticlesCovered, false);
  assert.deepEqual(result.pricesCoverage.pairs, []);
  assert.equal(f.rpcCalls.at(-1).name, "publish_zeta_daily_sync");
  assert.equal((await runDailyZetaSync({ ...identity, supabase: f.supabase }, f.deps)).status, "skipped");
  assert.equal(f.http.length, 5);
});

test("Daily Zeta sync before due time makes no HTTP calls and never loads or stages reports", async () => {
  const f = dailyFixture({ notDue: true });
  const result = await runDailyZetaSync({ ...identity, supabase: f.supabase }, f.deps);
  assert.equal(result.status, "skipped");
  assert.equal(f.http.length, 0);
  assert.equal(f.staged.length, 0);
  assert.equal(f.rpcCalls.length, 1);
});

test("Daily sales fetch starts at the previous covered day and retains older invoices only in Supabase", async () => {
  const f = dailyFixture();
  const rows = [{ RegistroId: 1, Fecha: "2026-09-01", ClienteCodigo: "00001" }];
  const filters = { FechaDesde: "2026-09-01", FechaHasta: "2026-09-08" };
  const columns = Object.keys(rows[0]);
  const previous = { runId: "previous", rows, manifest: {
    report: "sales", filters, endpoint: "RESTFacturaClienteV4QueryVentas", startedAt: "2026-09-08T21:00:00Z", completedAt: "2026-09-08T21:00:01Z",
    pages: 1, columns, cachePages: 1, rowCount: 1, complete: true, snapshotKey: reportHash({ report: "sales", filters }).slice(0, 32), sha256: reportHash({ rows, columns }),
  } };
  f.deps.loadInvoiceBase = async (input) => input.report === "sales" ? previous : null;
  await runDailyZetaSync({ ...identity, supabase: f.supabase }, f.deps);
  assert.deepEqual(f.http[0].body.QueryVentasIn.Data, { Page: 1, Filters: { FechaDesde: "2026-09-08", FechaHasta: "2026-09-09", Mes: 9, Anio: 2026 } });
  const sales = f.staged.find((x) => x.report === "sales");
  assert.deepEqual(sales.rows, rows);
  assert.deepEqual(sales.filters, { FechaDesde: "2026-09-01", FechaHasta: "2026-09-09" });
  assert.equal(sales.incremental.fetchedRowCount, 0);
});

test("Daily purchase source makes one monthly detail request with Moneda omitted and never queries each supplier", async () => {
  const f = dailyFixture();
  await runDailyZetaSync({ ...identity, supabase: f.supabase }, f.deps);
  const purchases = f.http.filter((x) => x.url.includes("Compras"));
  assert.equal(purchases.length, 1);
  assert.ok(purchases[0].url.endsWith("RESTFacturaProveedorV1ComprasDetalladas"));
  assert.deepEqual(purchases[0].body.ComprasDetalladasIn.Data, { Mes: 9, Anio: 2026 });
  assert.deepEqual(f.staged.find((x) => x.report === "purchases").filters, { FechaDesde: "2026-09-01", FechaHasta: "2026-09-09" });
});

test("Purchase detail rows group by stable invoice id while preserving raw lines and never inventing header totals", () => {
  const line = { FacturaId: 7, FacturaFecha: "09/09/2026", FacturaDia: 9, FacturaMes: 9, FacturaAnio: 2026,
    FacturaSerie: "A", FacturaNumero: 123, ProveedorCodigo: "000001", MonedaCodigo: 1, ArticuloCodigo: "00002", LineaCantidad: 2, LineaTotal: 122 };
  const rows = groupZetaPurchaseDetailRows([line, { ...line }], "2026-09", "2026-09-09");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].RegistroId, 7);
  assert.equal(rows[0].Fecha, "2026-09-09");
  assert.equal(rows[0].ProveedorCodigo, "000001");
  assert.equal(rows[0].Lines.length, 2, "identical legitimate source lines are not deduplicated without a line ID");
  assert.equal(Object.hasOwn(rows[0], "Total"), false);
  assert.equal(Object.hasOwn(rows[0], "Saldo"), false);
  assert.equal(rows[0]._source.invoiceTotals, "not_supplied_by_source");
  assert.throws(() => groupZetaPurchaseDetailRows([line, { ...line, ProveedorCodigo: "000002" }], "2026-09", "2026-09-09"), /encabezados incompatibles/);
});

test("Daily bulk detail policy permits only one request per endpoint even if a caller repeats it", async () => {
  let reserves = 0;
  const policy = createDailyZetaRequestPolicy({ organizationId: "org-1", reserveRequest: async () => { reserves++; }, sleep: async () => {} });
  await policy.authorize("facturaProveedorComprasDetalladas");
  await assert.rejects(() => policy.authorize("facturaProveedorComprasDetalladas"), /ya se consulto/);
  assert.equal(reserves, 1);
});

test("Daily Zeta budget exhaustion stops HTTP immediately and never publishes a partial snapshot", async () => {
  const f = dailyFixture({ budget: 2 });
  await assert.rejects(() => runDailyZetaSync({ ...identity, supabase: f.supabase }, f.deps), /budget exhausted/);
  assert.equal(f.http.length, 2);
  assert.equal(f.rpcCalls.some((x) => x.name === "publish_zeta_daily_sync"), false);
  assert.equal(f.rpcCalls.at(-1).name, "fail_zeta_daily_sync");
});

test("Daily Zeta explicitly requested empty price is retained as an empty complete result preserving exact codes", async () => {
  const f = dailyFixture();
  const result = await runDailyZetaSync({ ...identity, supabase: f.supabase, pricePairs: [{ articleCode: "000001", priceBaseCode: "LP" }] }, f.deps);
  assert.equal(result.status, "completed");
  const price = f.staged.find((x) => x.report === "base-prices");
  assert.deepEqual(price.rows, []);
  assert.deepEqual(price.filters, { ArticuloCodigo: "000001", PrecioBaseCodigo: "LP" });
  assert.equal(f.http.filter((x) => x.url.includes("ObtenerPrecioBase")).length, 1);
});

test("Daily Zeta retries only idempotent publication after an uncertain acknowledgement, without more API calls", async () => {
  const f = dailyFixture({ losePublishAck: true });
  const result = await runDailyZetaSync({ ...identity, supabase: f.supabase }, f.deps);
  assert.equal(result.status, "completed");
  assert.equal(f.http.length, 5);
  assert.equal(f.rpcCalls.filter((x) => x.name === "publish_zeta_daily_sync").length, 2);
  assert.equal(f.rpcCalls.some((x) => x.name === "fail_zeta_daily_sync"), false);
});

test("Daily Zeta master errors preserve previous reports instead of publishing a partially refreshed batch", async () => {
  const f = dailyFixture();
  f.deps.runMasters = async () => ({ runId: "masters-failed", recordsFailed: 1, warnings: ["incomplete"] });
  await assert.rejects(() => runDailyZetaSync({ ...identity, supabase: f.supabase }, f.deps), /maestros tuvo errores/);
  assert.equal(f.http.length, 4);
  assert.equal(f.rpcCalls.some((x) => x.name === "publish_zeta_daily_sync"), false);
});

test("Daily policy rejects writes and mismatched organizations before HTTP; human export cannot request reports", async () => {
  let calls = 0, reserves = 0;
  const policy = createDailyZetaRequestPolicy({ organizationId: "org-1", reserveRequest: async () => { reserves++; }, sleep: async () => {} });
  const client = createZetaRestClient({ ...runtime, organizationId: "org-1", requestPolicy: policy, fetchImpl: async () => { calls++; throw new Error("unexpected"); } });
  await assert.rejects(() => callZetaEndpoint(client, "facturaProveedorAgregar"), /no puede escribir/);
  const human = { ...client, requestPolicy: createHumanExportZetaRequestPolicy("org-1") };
  await assert.rejects(() => callZetaEndpoint(human, "stockActualQuery"), /solo permite/);
  await assert.rejects(() => callZetaEndpoint({ ...human, organizationId: "org-2" }, "asientoLista"), /copia de Supabase/);
  assert.equal(calls, 0);
  assert.equal(reserves, 0);
});

test("Daily report rejects repeated pages instead of silently truncating or publishing duplicates", async () => {
  let calls = 0;
  const client = createZetaRestClient({ ...runtime, organizationId: "org-1", requestPolicy: createDailyZetaRequestPolicy({ organizationId: "org-1", reserveRequest: async () => {}, sleep: async () => {} }),
    fetchImpl: async () => { calls++; return { ok: true, status: 200, statusText: "OK", json: async () => ({ QueryOut: { Succeed: true, IsLastPage: false, Response: [{ Codigo: "0001" }] } }) }; },
  });
  await assert.rejects(() => fetchDailyZetaReport({ client, report: "articles", filters: {}, maxPages: 5 }), /repitio/);
  assert.equal(calls, 2);
});

test("Daily policy spaces each reserved request and a failed reservation cannot be retried implicitly", async () => {
  const waits = []; let clock = 0, reserves = 0;
  const policy = createDailyZetaRequestPolicy({ organizationId: "org-1", minIntervalMs: 2000, now: () => clock,
    sleep: async (ms) => { waits.push(ms); clock += ms; }, reserveRequest: async () => { reserves++; if (reserves === 2) throw new Error("lease lost"); },
  });
  await policy.authorize("contactsQuery");
  await assert.rejects(() => policy.authorize("contactsQuery"), /lease lost/);
  await assert.rejects(() => policy.authorize("contactsQuery"), /lease lost/);
  assert.equal(reserves, 2);
  assert.deepEqual(waits, [2000]);
});

function salePriceFixture(overrides = {}) {
  const articles = [{ Codigo: "000104", Nombre: "Abrazadera", PorcentajeUtilidadCosto: 0 }];
  const baseRows = [{ CodigoArticulo: "000104", CodigoPrecio: "LP", CodigoMoneda: 2, PrecioSinIVA: "10", PrecioConIVA: "12.2" }];
  const rules = [{ Codigo: 1, Nombre: "Publico", PrecioBaseCodigo: "LP", Porcentaje: 0, SumarUtilidadArticulo: "N", VigenciaHasta: "0000-00-00" }];
  const data = { articles, baseRows, rules, ...overrides };
  return dailyFixture({ ...overrides, response(url, body) {
    if (url.endsWith("RESTArticulosV3Query")) return { Succeed: true, IsLastPage: true, Response: data.articles };
    if (url.endsWith("RESTPreciosVentaV1Query")) return { Succeed: true, IsLastPage: true, Response: data.rules };
    if (url.endsWith("RESTPreciosArticulosV2ObtenerPrecioBase")) {
      assert.equal(body.ObtenerPrecioBaseIn.Data.ArticuloCodigo, "", "bulk query explicitly uses the documented empty article");
      return { Succeed: true, Response: { Succeed: true, ListaPrecios: data.baseRows } };
    }
  } });
}

test("Daily sale-price sync shares one bulk base between lists and explicit pairs, publishes generic prices and preserves rule evidence", async () => {
  const rule = { Codigo: 1, Nombre: "Publico", PrecioBaseCodigo: "LP", Porcentaje: 0, SumarUtilidadArticulo: "N", VigenciaHasta: "0000-00-00" };
  const f = salePriceFixture({ rules: [rule, { ...rule, Codigo: 2, Porcentaje: 20 }] });
  const result = await runDailyZetaSync({ ...identity, supabase: f.supabase, salesPriceLists: [1, 2], pricePairs: [{ articleCode: "000104", priceBaseCode: "LP" }] }, f.deps);
  assert.equal(result.requestsUsed, 7, "four reports, one rules query, one bulk base, one fixture master");
  assert.equal(f.http.filter((x) => x.url.includes("ObtenerPrecioBase")).length, 1);
  assert.equal(f.http.some((x) => x.url.includes("ObtenerPrecioVenta")), false, "never query every article separately");
  assert.deepEqual(f.staged.find((x) => x.report === "base-prices").filters, { PrecioBaseCodigo: "LP" });
  const sales = f.staged.filter((x) => x.report === "sales-prices");
  assert.deepEqual(sales.map((x) => x.filters.PrecioVentaCodigo), [1, 2]);
  assert.equal(sales[1].rows[0].PrecioSinIVA, "12.00000");
  assert.equal(sales[1].rows[0].CodigoMoneda, 2);
  assert.equal(result.pricesCoverage.allArticlesCovered, true);
  assert.equal(result.pricesCoverage.customerOrPaymentTermsApplied, false);
  assert.deepEqual(result.pricesCoverage.salesPriceRules.rows[0], rule);
  assert.equal(f.rpcCalls.at(-1).name, "publish_zeta_daily_sync");
});

test("Daily empty bulk base yields an empty complete sale-price snapshot without invented zeros", async () => {
  const f = salePriceFixture({ baseRows: [] });
  await runDailyZetaSync({ ...identity, supabase: f.supabase, salesPriceLists: [1] }, f.deps);
  assert.deepEqual(f.staged.find((x) => x.report === "sales-prices").rows, []);
});

test("Daily requested absent rule, unknown price article or duplicate price prevents publication without a retry", async () => {
  for (const overrides of [
    { rules: [] },
    { articles: [] },
    { baseRows: Array(2).fill({ CodigoArticulo: "000104", CodigoPrecio: "LP", CodigoMoneda: 2, PrecioSinIVA: "10", PrecioConIVA: "12.2" }) },
  ]) {
    const f = salePriceFixture(overrides);
    await assert.rejects(() => runDailyZetaSync({ ...identity, supabase: f.supabase, salesPriceLists: [1] }, f.deps), /falta la regla|no existe|repetido/);
    assert.equal(f.rpcCalls.some((x) => x.name === "publish_zeta_daily_sync"), false);
    assert.equal(f.rpcCalls.at(-1).name, "fail_zeta_daily_sync");
    assert.ok(f.http.filter((x) => x.url.includes("ObtenerPrecioBase")).length <= 1);
  }
});

test("Daily sale-price configuration and existing due gate reject invalid or premature work before API requests", async () => {
  const f = salePriceFixture({ notDue: true });
  assert.equal((await runDailyZetaSync({ ...identity, supabase: f.supabase, salesPriceLists: [1] }, f.deps)).status, "skipped");
  assert.equal(f.http.length, 0);
  for (const lists of [[1, 1], [0], ["1"]]) {
    const invalid = salePriceFixture();
    await assert.rejects(() => runDailyZetaSync({ ...identity, supabase: invalid.supabase, salesPriceLists: lists }, invalid.deps));
    assert.equal(invalid.rpcCalls.length, 0);
  }
});

test("Daily price rules paginate under the shared budget and reject incomplete or repeated pages", async () => {
  const rule = { Codigo: 1, Nombre: "Publico", PrecioBaseCodigo: "LP", Porcentaje: 0, SumarUtilidadArticulo: "N", VigenciaHasta: "0000-00-00" };
  function fixture(repeat = false) {
    return dailyFixture({ response(url, body) {
      if (!url.endsWith("RESTPreciosVentaV1Query")) return;
      const page = body.QueryIn.Data.Page;
      return { Succeed: true, IsLastPage: !repeat && page === 2, Response: [{ ...rule, Codigo: repeat ? 1 : page }] };
    } });
  }
  const f = fixture();
  const result = await runDailyZetaSync({ ...identity, supabase: f.supabase, salesPriceLists: [1, 2] }, f.deps);
  assert.equal(result.requestsUsed, 8);
  assert.equal(result.pricesCoverage.salesPriceRules.pages, 2);
  const incomplete = fixture();
  await assert.rejects(() => runDailyZetaSync({ ...identity, supabase: incomplete.supabase, maxPages: 1, salesPriceLists: [1] }, incomplete.deps), /limite de paginas/);
  assert.equal(incomplete.http.length, 5);
  assert.equal(incomplete.rpcCalls.some((x) => x.name === "publish_zeta_daily_sync"), false);
  const repeated = fixture(true);
  await assert.rejects(() => runDailyZetaSync({ ...identity, supabase: repeated.supabase, salesPriceLists: [1] }, repeated.deps), /repitio una pagina/);
  assert.equal(repeated.http.length, 6);
});
