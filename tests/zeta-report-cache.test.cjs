/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { stageZetaReportSnapshot, loadZetaCacheStatus, loadZetaInvoiceCacheBase, mergeZetaInvoiceDelta } = require("@/modules/integrations/zeta/cache/report-cache");
const { exportZetaReport, serializeZetaReportCsv } = require("@/modules/local-companion/zeta-reports");

const org = "10000000-0000-0000-0000-000000000001";
const actorProfileId = "20000000-0000-0000-0000-000000000001";
const runId = "30000000-0000-0000-0000-000000000001";
const identity = { slug: "demo", actorProfileId };

function fixture() {
  const state = { queries: [], writes: 0, runs: [], pages: [], failInsert: false };
  const supabase = { from(table) {
    const filters = []; let operation = "select"; let payload; let maximum = 1000; let single = false;
    let ordering = null;
    const execute = () => {
      state.queries.push({ table, operation, filters });
      if (operation === "insert") {
        state.writes++;
        if (state.failInsert) return { data: null, error: { message: "offline" } };
        assert.equal(table, "integration_raw_records"); state.pages.push(payload); return { data: null, error: null };
      }
      if (table === "organizations") return { data: { id: org, slug: "demo", name: "Demo" }, error: null };
      if (table === "organization_members") return { data: { role: "owner" }, error: null };
      const source = table === "integration_sync_runs" ? state.runs : table === "integration_raw_records" ? state.pages : null;
      if (!source) throw new Error(`Unexpected table ${table}`);
      let values = source.filter((row) => filters.every(([key, expected]) => {
        const path = key.split("->>"); return (path.length > 1 ? row[path[0]]?.[path[1]] : row[key]) === expected;
      }));
      if (ordering) values = values.slice().sort((a, b) => String(a[ordering.key]).localeCompare(String(b[ordering.key])) * (ordering.ascending ? 1 : -1));
      values = values.slice(0, maximum);
      return { data: single ? values[0] ?? null : values, error: null };
    };
    const q = {
      select() { return q; }, eq(k, v) { filters.push([k, v]); return q; },
      order(key, options) { ordering = { key, ...options }; return q; }, limit(n) { maximum = n; return q; },
      maybeSingle() { single = true; return Promise.resolve(execute()); },
      insert(value) { operation = "insert"; payload = value; return q; },
      then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
    }; return q;
  } };
  async function snapshot(report, rows, filters = {}, id = runId, completedAt = "2026-09-09T21:03:00Z") {
    const manifest = await stageZetaReportSnapshot({ supabase, organizationId: org, runId: id,
      snapshot: { report, filters, endpoint: "RESTFixtureQuery", startedAt: "2026-09-09T21:00:00Z", completedAt,
        pages: Math.max(1, Math.ceil(rows.length / 500)), columns: [...new Set(rows.flatMap(Object.keys))], rows } });
    let run = state.runs.find((r) => r.id === id);
    if (!run) {
      run = { id, organization_id: org, provider: "zetasoftware", stream: "zeta.daily_cache", test_mode: false,
        status: "completed", started_at: "2026-09-09T21:00:00Z", finished_at: completedAt, created_at: completedAt,
        summary_json: { schemaVersion: 1, reports: [] }, metadata_json: { leaseToken: "must-not-leak", scheduledDay: "2026-09-09", requestsUsed: 1 } };
      state.runs.push(run);
    }
    run.summary_json.reports.push(manifest);
    return manifest;
  }
  return { supabase, state, snapshot };
}

test("Zeta reports read complete Supabase snapshots, filter dates locally and never touch the network", async () => {
  const f = fixture();
  await f.snapshot("sales", [{ RegistroId: "0001", Fecha: "2026-09-01", TotalSigno: 10 }, { RegistroId: "0002", Fecha: "2026-09-08", TotalSigno: 20 }], { FechaDesde: "2026-01-01", FechaHasta: "2026-09-09" });
  const beforeWrites = f.state.writes; const originalFetch = global.fetch;
  global.fetch = async () => assert.fail("reports must never call Zeta or any other endpoint");
  try {
    const report = await exportZetaReport({ ...identity, report: "sales", filters: { FechaDesde: "2026-09-07", FechaHasta: "2026-09-09" } }, f);
    assert.equal(report.metadata.source, "supabase"); assert.equal(report.metadata.originalSource, "zetasoftware");
    assert.equal(report.metadata.dataAsOf, "2026-09-09T21:03:00Z"); assert.equal(report.rows.length, 1);
    assert.equal(report.rows[0].RegistroId, "0002"); assert.equal(f.state.writes, beforeWrites);
    for (const q of f.state.queries.filter((q) => q.operation === "select" && q.table.startsWith("integration_"))) {
      assert.ok(q.filters.some(([k, v]) => k === "organization_id" && v === org));
      assert.ok(q.filters.some(([k, v]) => k === "test_mode" && v === false));
    }
  } finally { global.fetch = originalFetch; }
});

test("Zeta reports preserve prior completed snapshots while the next daily run is partial or failed", async () => {
  const f = fixture(); await f.snapshot("stock", [{ ArticuloCodigo: "000001", StockActual: 12 }]);
  const other = "30000000-0000-0000-0000-000000000002";
  await f.snapshot("stock", [{ ArticuloCodigo: "000001", StockActual: 99 }], {}, other, "2026-09-10T21:03:00Z");
  const newer = f.state.runs.find((r) => r.id === other);
  for (const status of ["running", "failed"]) {
    newer.status = status;
    const report = await exportZetaReport({ ...identity, report: "stock", filters: {} }, f);
    assert.equal(report.rows[0].StockActual, 12); assert.equal(report.metadata.snapshotRunId, runId);
  }
});

test("Zeta cache distinguishes unavailable coverage from a confirmed empty result and a missing price", async () => {
  const f = fixture();
  await assert.rejects(exportZetaReport({ ...identity, report: "stock", filters: {} }, f), (e) => e.code === "zeta_cache_coverage_missing");
  await f.snapshot("sales", [], { FechaDesde: "2026-09-01", FechaHasta: "2026-09-09" });
  await assert.rejects(exportZetaReport({ ...identity, report: "sales", filters: { FechaDesde: "2025-01-01", FechaHasta: "2026-09-09" } }, f), (e) => e.code === "zeta_cache_coverage_missing");
  const empty = await exportZetaReport({ ...identity, report: "sales", filters: { FechaDesde: "2026-09-01", FechaHasta: "2026-09-09" } }, f);
  assert.equal(empty.metadata.complete, true); assert.deepEqual(empty.rows, []);
  const priceFilters = { ArticuloCodigo: "000001", PrecioBaseCodigo: "LP" };
  await f.snapshot("base-prices", [], priceFilters);
  const noPrice = await exportZetaReport({ ...identity, report: "base-prices", filters: priceFilters }, f);
  assert.equal(noPrice.metadata.priceStatus, "no_price_at_source"); assert.equal(noPrice.metadata.price, null);
  await assert.rejects(exportZetaReport({ ...identity, report: "base-prices", filters: { ...priceFilters, ArticuloCodigo: "000002" } }, f), (e) => e.code === "zeta_cache_coverage_missing");
});

test("complete base price snapshots filter exact article codes and mark only the filtered absence as no price", async () => {
  const f = fixture();
  const rows = [{ CodigoArticulo: "000275", CodigoPrecio: "LP", Precio: "150.50000" }, { CodigoArticulo: "275", CodigoPrecio: "LP", Precio: "20.00000" }];
  await f.snapshot("base-prices", rows, { PrecioBaseCodigo: "LP" });
  const bulk = await exportZetaReport({ ...identity, report: "base-prices", filters: { PrecioBaseCodigo: "LP" } }, f);
  assert.equal(bulk.rows.length, 2);
  const exact = await exportZetaReport({ ...identity, report: "base-prices", filters: { PrecioBaseCodigo: "LP", ArticuloCodigo: "000275" } }, f);
  assert.deepEqual(exact.rows, [rows[0]]); assert.equal(exact.metadata.priceStatus, "available");
  const absent = await exportZetaReport({ ...identity, report: "base-prices", filters: { PrecioBaseCodigo: "LP", ArticuloCodigo: "000747" } }, f);
  assert.deepEqual(absent.rows, []); assert.equal(absent.metadata.priceStatus, "no_price_at_source"); assert.equal(absent.metadata.price, null);
  await assert.rejects(exportZetaReport({ ...identity, report: "base-prices", filters: { PrecioBaseCodigo: "000", ArticuloCodigo: "000275" } }, f), (e) => e.code === "zeta_cache_coverage_missing");
});

test("base price registration dates require exact source coverage even for complete article bases", async () => {
  const f = fixture();
  const filters = { PrecioBaseCodigo: "LP", FechaRegistroDesde: "2026-09-01", FechaRegistroHasta: "2026-09-09" };
  await f.snapshot("base-prices", [{ CodigoArticulo: "000275", CodigoPrecio: "LP", Precio: 20 }], filters);
  const exact = await exportZetaReport({ ...identity, report: "base-prices", filters: { ...filters, ArticuloCodigo: "000275" } }, f);
  assert.equal(exact.rows.length, 1);
  for (const request of [{ PrecioBaseCodigo: "LP" }, { ...filters, FechaRegistroDesde: "2026-09-02" }, { ...filters, FechaRegistroHasta: "2026-09-10" }]) {
    await assert.rejects(exportZetaReport({ ...identity, report: "base-prices", filters: request }, f), (e) => e.code === "zeta_cache_coverage_missing");
  }
  const complete = fixture(); await complete.snapshot("base-prices", [], { PrecioBaseCodigo: "LP" });
  await assert.rejects(exportZetaReport({ ...identity, report: "base-prices", filters }, complete), (e) => e.code === "zeta_cache_coverage_missing");
});

test("sales price reports preserve currencies and decimal strings without API requests or source writes", async () => {
  const f = fixture();
  const row = { CodigoArticulo: "01483", CodigoMoneda: 1, CodigoPrecioVenta: 1, PrecioSinIVA: "123.45000", PrecioConIVA: "150.60900", CodigoPrecioBase: "LP" };
  await f.snapshot("sales-prices", [row, { ...row, CodigoMoneda: 2, PrecioSinIVA: "3.00000", PrecioConIVA: "3.66000" },
    { ...row, CodigoArticulo: "1483", PrecioSinIVA: "0.00000", PrecioConIVA: "0.00000" }], { PrecioVentaCodigo: 1 });
  const writes = f.state.writes; const originalFetch = global.fetch;
  global.fetch = async () => assert.fail("price reports must not access Zeta");
  try {
    const currencies = await exportZetaReport({ ...identity, report: "sales-prices", filters: { ArticuloCodigo: "01483" } }, f);
    assert.equal(currencies.rows.length, 2); assert.equal(currencies.metadata.filters.PrecioVentaCodigo, 1);
    assert.equal(currencies.metadata.pricingScope, "generic_list_without_customer_conditions");
    assert.equal(currencies.metadata.source, "supabase"); assert.equal(currencies.metadata.dataAsOf, "2026-09-09T21:03:00Z");
    const currency = await exportZetaReport({ ...identity, report: "sales-prices", filters: { ArticuloCodigo: "01483", PrecioVentaCodigo: 1, MonedaCodigo: 2 } }, f);
    assert.equal(currency.rows.length, 1); assert.equal(currency.rows[0].PrecioConIVA, "3.66000");
    assert.equal(typeof currency.rows[0].PrecioConIVA, "string"); assert.equal(currency.rows[0].CodigoMoneda, 2);
    const zero = await exportZetaReport({ ...identity, report: "sales-prices", filters: { ArticuloCodigo: "1483", PrecioVentaCodigo: 1 } }, f);
    assert.equal(zero.metadata.priceStatus, "available"); assert.equal(zero.rows[0].PrecioSinIVA, "0.00000");
    const missing = await exportZetaReport({ ...identity, report: "sales-prices", filters: { ArticuloCodigo: "000747", PrecioVentaCodigo: 1 } }, f);
    assert.equal(missing.metadata.priceStatus, "no_price_at_source"); assert.equal(missing.metadata.price, null); assert.deepEqual(missing.rows, []);
    assert.equal(f.state.writes, writes);
  } finally { global.fetch = originalFetch; }
});

test("multiple sales price lists require an explicit selection and never silently choose a list", async () => {
  const f = fixture();
  await f.snapshot("sales-prices", [], { PrecioVentaCodigo: 1 });
  await f.snapshot("sales-prices", [], { PrecioVentaCodigo: 2 });
  await assert.rejects(exportZetaReport({ ...identity, report: "sales-prices", filters: { ArticuloCodigo: "000275" } }, f), (e) => e.code === "zeta_cache_price_list_required");
  const selected = await exportZetaReport({ ...identity, report: "sales-prices", filters: { PrecioVentaCodigo: 2 } }, f);
  assert.equal(selected.metadata.sourceFilters.PrecioVentaCodigo, 2); assert.equal(selected.metadata.priceStatus, "no_price_at_source");
  await assert.rejects(exportZetaReport({ ...identity, report: "sales-prices", filters: { PrecioVentaCodigo: 3 } }, f), (e) => e.code === "zeta_cache_coverage_missing");
  await assert.rejects(f.snapshot("sales-prices", [], {}), (e) => e.code === "zeta_cache_invalid_manifest");
});

test("older exact price pairs stay readable without claiming sales price or full-base coverage", async () => {
  const f = fixture(); const filters = { PrecioBaseCodigo: "LP", ArticuloCodigo: "000275" };
  await f.snapshot("base-prices", [{ Precio: 100 }], filters);
  const report = await exportZetaReport({ ...identity, report: "base-prices", filters }, f);
  assert.equal(report.rows[0].Precio, 100); assert.equal(report.metadata.priceStatus, "available");
  await assert.rejects(exportZetaReport({ ...identity, report: "base-prices", filters: { PrecioBaseCodigo: "LP" } }, f), (e) => e.code === "zeta_cache_coverage_missing");
  await assert.rejects(exportZetaReport({ ...identity, report: "sales-prices", filters: { PrecioVentaCodigo: 1 } }, f), (e) => e.code === "zeta_cache_coverage_missing");
});

test("Zeta cache refuses missing pages, tampering, incomplete manifests and wrong tenant pages", async () => {
  for (const mutate of [
    (f) => { f.state.pages.length = 0; },
    (f) => { f.state.pages[0].payload_json.rows[0].StockActual = 999; },
    (f) => { f.state.pages[0].organization_id = actorProfileId; },
    (f) => { f.state.runs[0].summary_json.reports[0].complete = false; },
  ]) {
    const f = fixture(); await f.snapshot("stock", [{ ArticuloCodigo: "000001", StockActual: 12 }]); mutate(f);
    await assert.rejects(exportZetaReport({ ...identity, report: "stock", filters: {} }, f), (e) => /^zeta_cache_(incomplete|corrupt)$/.test(e.code));
  }
});

test("Zeta snapshot hashing survives JSONB object-key reordering and preserves nested articles and CSV codes", async () => {
  const f = fixture(); await f.snapshot("articles", [{ Codigo: "000001", Nombre: "Articulo", Detalle: { segunda: 2, primera: 1 } }]);
  const row = f.state.pages[0].payload_json.rows[0];
  f.state.pages[0].payload_json.rows[0] = { Detalle: { primera: 1, segunda: 2 }, Nombre: row.Nombre, Codigo: row.Codigo };
  const report = await exportZetaReport({ ...identity, report: "articles", filters: {} }, f);
  assert.equal(report.rows[0].Codigo, "000001"); assert.deepEqual(report.rows[0].Detalle, { primera: 1, segunda: 2 });
  assert.ok(serializeZetaReportCsv(report).includes("'000001"));
});

test("Zeta snapshot staging never publishes and cache status omits lease credentials", async () => {
  const f = fixture(); await f.snapshot("purchases", [{ Fecha: "2026-09-09", ProveedorCodigo: "0002", Total: 100 }], { FechaDesde: "2026-01-01", FechaHasta: "2026-09-09" });
  assert.ok(!f.state.queries.some((q) => q.operation !== "select" && q.table === "integration_sync_runs"));
  const status = await loadZetaCacheStatus({ supabase: f.supabase, organizationId: org, now: new Date("2026-09-11T00:00:00Z") });
  assert.equal(status.apiRequests, 0); assert.equal(status.reports[0].stale, true);
  assert.deepEqual(status.pricesCoverage, { mode: "not_available", allArticlesCovered: false });
  assert.ok(!JSON.stringify(status).includes("must-not-leak"));
});

test("Zeta cache skips pruned run pages while showing configured price coverage", async () => {
  const f = fixture(); await f.snapshot("stock", [{ ArticuloCodigo: "000001", StockActual: 12 }]);
  f.state.runs[0].summary_json.pricesCoverage = { mode: "explicit_pairs", pairs: [], allArticlesCovered: false };
  const status = await loadZetaCacheStatus({ supabase: f.supabase, organizationId: org });
  assert.deepEqual(status.pricesCoverage, { mode: "explicit_pairs", pairs: [], allArticlesCovered: false });
  f.state.runs[0].metadata_json.cachePrunedAt = "2026-09-12T21:03:00Z";
  await assert.rejects(exportZetaReport({ ...identity, report: "stock", filters: {} }, f), (e) => e.code === "zeta_cache_coverage_missing");
});

function delta(rows, from = "2026-09-09", to = "2026-09-10") {
  return { report: "sales", endpoint: "RESTFixtureQuery", filters: { FechaDesde: from, FechaHasta: to },
    startedAt: "2026-09-10T21:00:00Z", completedAt: "2026-09-10T21:02:00Z", pages: 1,
    columns: [...new Set(rows.flatMap(Object.keys))], rows };
}

test("incremental invoice snapshots preserve history and upsert only fetched IDs with explicit delta coverage", async () => {
  const f = fixture();
  await f.snapshot("sales", [{ RegistroId: "000001", Fecha: "2026-09-08", TotalSigno: 10 },
    { RegistroId: 2, Fecha: "2026-09-09", TotalSigno: 20 }], { FechaDesde: "2026-09-08", FechaHasta: "2026-09-09" });
  const previous = await loadZetaInvoiceCacheBase({ supabase: f.supabase, organizationId: org, report: "sales" });
  const result = mergeZetaInvoiceDelta({ previous, delta: delta([
    { RegistroId: "2", Fecha: "2026-09-09", TotalSigno: 25 },
    { RegistroId: 3, Fecha: "2026-09-10", TotalSigno: 30 },
  ]) });
  assert.equal(result.rows.length, 3); assert.equal(result.rows[0].RegistroId, "000001");
  assert.equal(result.rows[1].TotalSigno, 25); assert.equal(previous.rows[1].TotalSigno, 20);
  assert.deepEqual(result.filters, { FechaDesde: "2026-09-08", FechaHasta: "2026-09-10" });
  assert.equal(result.incremental.deltaFetchedFrom, "2026-09-09"); assert.equal(result.incremental.deltaFetchedTo, "2026-09-10");
  assert.equal(result.incremental.insertedRows, 1); assert.equal(result.incremental.updatedRows, 1);
  assert.equal(result.incremental.fetchedRowCount, 2); assert.equal(result.incremental.historicalEditsOutsideDeltaCovered, false);
  const manifest = await stageZetaReportSnapshot({ supabase: f.supabase, organizationId: org,
    runId: "30000000-0000-0000-0000-000000000002", snapshot: result });
  assert.deepEqual(manifest.incremental, result.incremental);
});

test("an empty complete invoice window removes only absent rows inside that window and preserves older history", async () => {
  const f = fixture(); await f.snapshot("sales", [{ RegistroId: 1, Fecha: "2026-09-08", TotalSigno: 10 },
    { RegistroId: 2, Fecha: "2026-09-09", TotalSigno: 20 }], { FechaDesde: "2026-09-08", FechaHasta: "2026-09-09" });
  const previous = await loadZetaInvoiceCacheBase({ supabase: f.supabase, organizationId: org, report: "sales" });
  const result = mergeZetaInvoiceDelta({ previous, delta: delta([]) });
  assert.equal(result.rows.length, 1); assert.equal(result.rows[0].TotalSigno, 10);
  assert.equal(result.filters.FechaHasta, "2026-09-10"); assert.equal(result.incremental.fetchedRowCount, 0);
  assert.equal(result.incremental.removedRows, 1); assert.equal(previous.rows.length, 2);
});

test("the first invoice copy keeps only explicit initial coverage and collapses exact duplicate source rows", async () => {
  const f = fixture(); assert.equal(await loadZetaInvoiceCacheBase({ supabase: f.supabase, organizationId: org, report: "sales" }), null);
  const row = { RegistroId: "000001", Fecha: "2026-09-10", TotalSigno: 10 };
  const result = mergeZetaInvoiceDelta({ previous: null, delta: delta([row, { ...row }], "2026-09-10", "2026-09-10") });
  assert.equal(result.rows.length, 1); assert.equal(result.filters.FechaDesde, "2026-09-10");
  assert.equal(result.incremental.previousRunId, null); assert.equal(result.incremental.fetchedRowCount, 2);
});

test("incremental invoice ingestion rejects missing IDs, conflicting duplicates and ignored ERP date filters", () => {
  for (const rows of [
    [{ Fecha: "2026-09-10", TotalSigno: 10 }],
    [{ RegistroId: 0, Fecha: "2026-09-10" }],
    [{ RegistroId: 1, Fecha: "2026-09-10", TotalSigno: 10 }, { RegistroId: 1, Fecha: "2026-09-10", TotalSigno: 11 }],
    [{ RegistroId: 1, Fecha: "2026-08-01" }],
    [{ RegistroId: 1, Fecha: "2026-02-30" }],
  ]) assert.throws(() => mergeZetaInvoiceDelta({ previous: null, delta: delta(rows) }), (e) => /^zeta_invoice_/.test(e.code));
});

test("incremental invoices refuse coverage gaps, mixed endpoints and untrusted old data", async () => {
  const f = fixture(); await f.snapshot("sales", [{ RegistroId: 1, Fecha: "2026-09-09" }], { FechaDesde: "2026-09-08", FechaHasta: "2026-09-09" });
  const previous = await loadZetaInvoiceCacheBase({ supabase: f.supabase, organizationId: org, report: "sales" });
  assert.throws(() => mergeZetaInvoiceDelta({ previous, delta: delta([], "2026-09-11", "2026-09-11") }), (e) => e.code === "zeta_invoice_coverage_gap");
  assert.throws(() => mergeZetaInvoiceDelta({ previous, delta: { ...delta([]), endpoint: "RESTDifferentQuery" } }), (e) => e.code === "zeta_invoice_source_changed");
  previous.rows[0].Fecha = "2026-09-08";
  assert.throws(() => mergeZetaInvoiceDelta({ previous, delta: delta([]) }), (e) => e.code === "zeta_cache_corrupt");
});

test("incremental invoice replacement handles changed dates by source ID and contiguous month boundaries", async () => {
  const f = fixture(); await f.snapshot("purchases", [{ RegistroId: 1, Fecha: "2026-08-15", Total: 10 },
    { RegistroId: 2, Fecha: "2026-08-31", Total: 20 }], { FechaDesde: "2026-08-01", FechaHasta: "2026-08-31" });
  const previous = await loadZetaInvoiceCacheBase({ supabase: f.supabase, organizationId: org, report: "purchases" });
  const request = { ...delta([{ RegistroId: 2, Fecha: "2026-09-01", Total: 25 }], "2026-09-01", "2026-09-10"), report: "purchases" };
  const result = mergeZetaInvoiceDelta({ previous, delta: request });
  assert.equal(result.rows.length, 2); assert.equal(result.rows[0].Fecha, "2026-08-15");
  assert.equal(result.rows[1].Fecha, "2026-09-01"); assert.equal(result.rows[1].Total, 25);
  assert.equal(result.filters.FechaDesde, "2026-08-01"); assert.equal(result.incremental.updatedRows, 1);
});
