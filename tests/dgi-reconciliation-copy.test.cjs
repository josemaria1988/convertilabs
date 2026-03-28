/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  DGI_RECONCILIATION_COMPARISON_LABEL,
  DGI_RECONCILIATION_DESCRIPTION,
  DGI_RECONCILIATION_DISCLAIMER,
  DGI_RECONCILIATION_TITLE,
  formatDgiReconciliationClosedLabel,
} = require("@/modules/tax/dgi-reconciliation-copy");

test("dgi reconciliation copy keeps the base comparison scope explicit", () => {
  assert.equal(DGI_RECONCILIATION_TITLE, "Conciliacion DGI base");
  assert.equal(DGI_RECONCILIATION_COMPARISON_LABEL, "Comparacion base por buckets");
  assert.match(DGI_RECONCILIATION_DESCRIPTION, /baseline|buckets/i);
  assert.match(DGI_RECONCILIATION_DISCLAIMER, /no equivale a filing directo/i);
  assert.equal(formatDgiReconciliationClosedLabel(), "Conciliacion DGI base cerrada");
});
