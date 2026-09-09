/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("./testkit.cjs");
const { validateSyncConfig, parseCommand } = require("../scripts/local-companion/cli.cjs");

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
