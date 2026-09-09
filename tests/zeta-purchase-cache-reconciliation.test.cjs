/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { classifyPurchaseInvoiceAgainstCache, reconcilePurchaseInvoiceAgainstCache } = require("@/modules/integrations/zeta/export/purchase-cache-reconciliation");
const { reportHash } = require("@/modules/integrations/zeta/cache/report-contracts");

const organizationId = "10000000-0000-0000-0000-000000000001";
const runId = "30000000-0000-0000-0000-000000000001";
const movimiento = {
  CodigoProveedor: "000001", CodigoComprobante: 101, Serie: "A", Numero: 123, Fecha: "20260907", CodigoMoneda: 1,
  CodigoLocal: 1, CodigoUsuario: 1, CodigoCaja: 1, Lineas: [],
};
const baseInput = { organizationId, documentCreatedAt: "2026-09-09T20:00:00Z", movimiento, expectedTotal: 122, now: new Date("2026-09-09T22:00:00Z") };
const invoice = (extra = {}) => ({ RegistroId: "000001", ProveedorCodigo: "000001", ComprobanteCodigo: 101,
  Serie: "A", Numero: 123, Fecha: "2026-09-07", MonedaCodigo: 1, Total: 122, ...extra });
function snapshot(rows = []) {
  const filters = { FechaDesde: "2026-09-01", FechaHasta: "2026-09-09" };
  const columns = [...new Set(rows.flatMap(Object.keys))];
  return { organizationId, runId, rows, manifest: { report: "purchases", filters,
    endpoint: "RESTFacturaProveedorV1ComprasDetalladas", snapshotKey: reportHash({ report: "purchases", filters }).slice(0, 32),
    startedAt: "2026-09-09T21:00:00Z", completedAt: "2026-09-09T21:03:00Z", pages: 1, cachePages: 1,
    rowCount: rows.length, columns, complete: true, sha256: reportHash({ columns, rows }),
  } };
}
const classify = (cache, extra = {}) => classifyPurchaseInvoiceAgainstCache({ ...baseInput, snapshot: cache, ...extra });

test("purchase comparison waits for a fresh complete sync started after upload and covering the invoice date", () => {
  for (const [cache, extra, reason] of [
    [null, {}, "cache_not_available"],
    [snapshot(), { documentCreatedAt: "2026-09-09T21:02:00Z" }, "snapshot_before_document"],
    [snapshot(), { now: new Date("2026-09-10T22:00:00Z") }, "cache_stale"],
    [snapshot(), { movimiento: { ...movimiento, Fecha: "20260831" } }, "document_date_not_covered"],
    [{ ...snapshot(), organizationId: runId }, {}, "organization_mismatch"],
  ]) {
    const result = classify(cache, extra);
    assert.equal(result.status, "waiting_for_sync"); assert.equal(result.eligibleForHumanExport, false);
    assert.equal(result.reasons[0], reason); assert.equal(result.apiRequests, 0);
  }
});

test("a new cumulative snapshot cannot prove a historical invoice missing when that month was not refreshed", () => {
  const cache = snapshot();
  cache.manifest.filters.FechaDesde = "2026-08-01";
  cache.manifest.incremental = { fetchedFilters: { FechaDesde: "2026-09-01", FechaHasta: "2026-09-09" } };
  const result = classify(cache, { movimiento: { ...movimiento, Fecha: "20260831" } });
  assert.equal(result.status, "waiting_for_sync"); assert.equal(result.reasons[0], "document_period_not_refreshed");
});

test("purchase absence requires the global monthly endpoint and excludes provider-filtered copies", () => {
  for (const modify of [
    (cache) => { cache.manifest.endpoint = "RESTFacturaProveedorV1QueryCompras"; },
    (cache) => { cache.manifest.filters.ProveedorCodigo = "000002"; },
    (cache) => { cache.manifest.incremental = { fetchedFilters: { ...cache.manifest.filters, MonedaCodigo: 2 } }; },
  ]) {
    const cache = snapshot([]); modify(cache); const result = classify(cache);
    assert.equal(result.status, "waiting_for_sync"); assert.equal(result.eligibleForHumanExport, false);
    assert.equal(result.reasons[0], "cache_scope_not_global_monthly");
  }
});

test("an exact fiscal identity with matching amount and currency is already in ERP using the existing number normalization", () => {
  const result = classify(snapshot([invoice({ Serie: "a-" })]));
  assert.equal(result.status, "already_in_erp"); assert.equal(result.eligibleForHumanExport, false);
  assert.equal(result.matches[0].registroId, "000001"); assert.equal(result.matches[0].total, 122);
  assert.equal(result.snapshot.dataAsOf, "2026-09-09T21:03:00Z"); assert.equal(result.fiscalKey.supplierCode, "000001");
});

test("fiscal matches with amount currency or date differences are blocked and never reported as missing", () => {
  for (const row of [invoice({ Total: 123 }), invoice({ MonedaCodigo: 2 }), invoice({ Fecha: "2026-09-06" }), invoice({ ComprobanteCodigo: 102 })]) {
    const result = classify(snapshot([row]));
    assert.equal(result.status, "differences"); assert.equal(result.eligibleForHumanExport, false);
    assert.equal(result.matches[0].differences.length, 1);
  }
});

test("changing cash or credit document type cannot turn an existing supplier invoice into a missing one", () => {
  const result = classify(snapshot([invoice({ ComprobanteCodigo: 102 })]));
  assert.equal(result.status, "differences"); assert.equal(result.matches[0].differences[0].field, "comprobante");
  assert.equal(result.eligibleForHumanExport, false);
});

test("monthly line totals are compared only with explicit consistent sign currency and complete finite amounts", () => {
  const row = invoice({ FacturaSigno: 1, Lines: [{ FacturaId: "000001", FacturaSigno: 1, MonedaCodigo: 1, LineaSubtotal: 100, LineaIVA: 22, LineaTotal: 122 }] });
  delete row.Total;
  const result = classify(snapshot([row]));
  assert.equal(result.status, "already_in_erp"); assert.equal(result.matches[0].totalSource, "monthly_lines_with_explicit_sign");
  for (const mutate of [
    (r) => { delete r.FacturaSigno; }, (r) => { r.Lines[0].LineaTotal = "122abc"; },
    (r) => { r.Lines[0].MonedaCodigo = 2; }, (r) => { r.Lines[0].LineaSubtotal = 99; },
    (r) => { r.Lines[0].FacturaSigno = -1; }, (r) => { r.Lines[0].FacturaId = "other"; },
  ]) {
    const uncertain = structuredClone(row); mutate(uncertain);
    const compared = classify(snapshot([uncertain]));
    assert.equal(compared.status, "ambiguous"); assert.equal(compared.eligibleForHumanExport, false);
    assert.equal(compared.matches[0].total, null);
  }
  const credit = structuredClone(row); credit.FacturaSigno = -1; credit.Lines[0].FacturaSigno = -1;
  assert.equal(classify(snapshot([credit]), { expectedTotal: -122 }).status, "already_in_erp");
});

test("multiple fiscal matches and incomplete or zero-padded possible identities require review", () => {
  for (const rows of [
    [invoice(), invoice({ RegistroId: 2 })],
    [invoice({ ProveedorCodigo: null })],
    [invoice({ Numero: "00123" })],
    [invoice({ RegistroId: 0 })],
  ]) assert.equal(classify(snapshot(rows)).status, "ambiguous");
  const row = invoice(); assert.equal(classify(snapshot([row, { ...row }])).status, "already_in_erp");
});

test("only absence from the refreshed complete month enables human export and exact supplier zeros are preserved", () => {
  const result = classify(snapshot([invoice({ ProveedorCodigo: "1" }), invoice({ Numero: 124 })]));
  assert.equal(result.status, "missing_from_erp"); assert.equal(result.eligibleForHumanExport, true);
  assert.equal(result.fiscalKey.supplierCode, "000001"); assert.equal(result.matches.length, 0);
  assert.equal(classify(snapshot(), { expectedTotal: null }).status, "ambiguous");
});

test("the scoped cache reconciliation helper reads Supabase only and never falls back to Zeta", async () => {
  const cache = snapshot([]); const filtersSeen = []; let queries = 0;
  const supabase = { from(table) {
    const filters = []; const query = { select() { return query; }, eq(k, v) { filters.push([k, v]); return query; }, order() { return query; }, limit() { return query; },
      then(resolve, reject) {
        queries++; filtersSeen.push({ table, filters });
        const data = table === "integration_sync_runs" ? [{ id: runId, status: "completed", metadata_json: {}, summary_json: { schemaVersion: 1, reports: [cache.manifest] } }]
          : [{ external_key: `${runId}:${cache.manifest.snapshotKey}:000001`, payload_json: { rows: [] }, payload_hash: reportHash({ rows: [] }), metadata_json: { page: 1 } }];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      } }; return query;
  } };
  const originalFetch = global.fetch; global.fetch = async () => assert.fail("must never request ERP");
  try {
    const result = await reconcilePurchaseInvoiceAgainstCache({ ...baseInput, supabase });
    assert.equal(result.status, "missing_from_erp"); assert.equal(queries, 2);
    assert.ok(filtersSeen.every((q) => q.filters.some(([k, v]) => k === "organization_id" && v === organizationId)));
    const failed = await reconcilePurchaseInvoiceAgainstCache({ ...baseInput, supabase: { from() { throw new Error("offline"); } } });
    assert.equal(failed.status, "waiting_for_sync"); assert.equal(failed.eligibleForHumanExport, false);
  } finally { global.fetch = originalFetch; }
});
