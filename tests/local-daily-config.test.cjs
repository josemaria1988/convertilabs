/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("./testkit.cjs");
const { validateSyncConfig, parseCommand, reportFilters } = require("../scripts/local-companion/cli.cjs");

test("daily config preserves exact price codes and rejects requests outside its declared limits", () => {
  const config = validateSyncConfig({ pricePairs: [{ articleCode: "000001", priceBaseCode: "LP" }] });
  assert.equal(config.pricePairs[0].articleCode, "000001");
  assert.equal(config.maxRequests, 100);
  assert.equal(config.minIntervalMs, 2000);
  for (const invalid of [null, [], { force: true }, { maxRequests: 0 }, { maxRequests: 1001 }, { minIntervalMs: 0 },
    { salesFrom: "2026-02-30" }, { pricePairs: [{ articleCode: 1, priceBaseCode: "LP" }] },
    { pricePairs: [{ articleCode: "01", priceBaseCode: " LP" }] }]) assert.throws(() => validateSyncConfig(invalid));
  assert.equal(parseCommand(["sync-zeta", "--dry-run"]).values["dry-run"], true);
  assert.throws(() => parseCommand(["sync-zeta", "--force"]));
});

test("daily config selects sales price lists explicitly and bounds the request scope", () => {
  assert.deepEqual(validateSyncConfig({}).salesPriceLists, []);
  assert.deepEqual(validateSyncConfig({ salesPriceLists: [1, 20] }).salesPriceLists, [1, 20]);
  assert.equal(validateSyncConfig({ salesPriceLists: [1] }).maxRequests, 100);
  for (const salesPriceLists of ["1", ["1"], [0], [-1], [1.5], [1, 1], [null], [Number.MAX_SAFE_INTEGER + 1], Array.from({ length: 21 }, (_, i) => i + 1)]) {
    assert.throws(() => validateSyncConfig({ salesPriceLists }), /salesPriceLists/);
  }
  assert.equal(validateSyncConfig({ salesPriceLists: Array.from({ length: 20 }, (_, i) => i + 1) }).salesPriceLists.length, 20);
});

test("sales price CLI filters keep article identifiers exact and reject malformed options", () => {
  const parsed = parseCommand(["report", "sales-prices", "--article", "000275", "--price-list", "1", "--currency", "2", "--out", "prices.json"]);
  assert.deepEqual(reportFilters(parsed.values), { ArticuloCodigo: "000275", PrecioVentaCodigo: 1, MonedaCodigo: 2 });
  const storedFilters = { ArticuloCodigo: "01483", PrecioVentaCodigo: 2 };
  assert.deepEqual(reportFilters({ "price-list": "1" }, storedFilters), { ArticuloCodigo: "01483", PrecioVentaCodigo: 1 });
  assert.equal(storedFilters.PrecioVentaCodigo, 2);
  for (const value of ["", "0", "-1", "1.5", " 1", "1e2", "Infinity", "9007199254740992"]) {
    assert.throws(() => reportFilters({ "price-list": value }), /entero positivo/);
    assert.throws(() => reportFilters({ currency: value }), /entero positivo/);
  }
  for (const args of [["report", "sales-prices", "--customer", "CL1"], ["report", "sales-prices", "extra"], ["report", "sales-prices", "--force"], ["report", "sales-prices", "--once"]]) {
    assert.throws(() => parseCommand(args));
  }
  assert.throws(() => reportFilters({}, null), /objeto JSON/);
});
