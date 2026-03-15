/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildDgiReconciliationBucketComparisons,
} = require("@/modules/tax/dgi-summary-normalizer");

test("DGI reconciliation bucket matcher classifies missing, extra and mismatched amounts", () => {
  const comparisons = buildDgiReconciliationBucketComparisons({
    baseline: {
      sales_basic: {
        netAmountUyu: 1000,
        taxAmountUyu: 220,
      },
      purchase_basic: {
        netAmountUyu: 500,
        taxAmountUyu: 110,
      },
    },
    system: {
      sales_basic: {
        netAmountUyu: 900,
        taxAmountUyu: 198,
      },
      import_vat: {
        netAmountUyu: 0,
        taxAmountUyu: 45,
      },
    },
  });

  const salesBucket = comparisons.find((bucket) => bucket.bucketCode === "sales_basic");
  const purchaseBucket = comparisons.find((bucket) => bucket.bucketCode === "purchase_basic");
  const importBucket = comparisons.find((bucket) => bucket.bucketCode === "import_vat");

  assert.equal(salesBucket?.differenceStatus, "amount_mismatch");
  assert.equal(purchaseBucket?.differenceStatus, "missing_in_system");
  assert.equal(importBucket?.differenceStatus, "extra_in_system");
});
