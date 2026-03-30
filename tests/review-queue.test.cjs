/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildDocumentReviewChips,
  groupDocumentsByReviewBucket,
  summarizeDocumentReviewSecondaryBuckets,
} = require("@/modules/documents/review-queue");

function makeItem(overrides = {}) {
  return {
    canonicalState: "needs_review",
    operationalFlags: [],
    classificationStatus: "not_started",
    manualInterventionBy: null,
    canClassify: false,
    ...overrides,
  };
}

test("review queue separates factual review from accounting assignment", () => {
  const grouped = groupDocumentsByReviewBucket([
    makeItem(),
    makeItem({
      classificationStatus: "failed",
      canClassify: true,
    }),
    makeItem({
      canonicalState: "blocked_missing_fx",
      classificationStatus: "completed",
      canClassify: false,
    }),
    makeItem({
      canonicalState: "ready_provisional",
      classificationStatus: "completed",
      canClassify: false,
    }),
    makeItem({
      canonicalState: "ready_final",
      classificationStatus: "completed",
      canClassify: false,
    }),
  ]);

  assert.deepEqual(
    grouped.map((bucket) => [bucket.key, bucket.items.length]),
    [
      ["factual_review", 1],
      ["assignment", 1],
      ["blocked", 1],
      ["ready_provisional", 1],
      ["ready_final", 1],
    ],
  );
});

test("review queue keeps processing and done as secondary counters", () => {
  const secondary = summarizeDocumentReviewSecondaryBuckets([
    makeItem({ canonicalState: "processing" }),
    makeItem({ canonicalState: "posted_final", classificationStatus: "completed" }),
    makeItem({ canonicalState: "locked", classificationStatus: "completed" }),
  ]);

  assert.deepEqual(
    secondary.map((bucket) => [bucket.key, bucket.count]),
    [
      ["processing", 1],
      ["done", 2],
    ],
  );
});

test("review queue manual chip does not imply pending work", () => {
  const chips = buildDocumentReviewChips(makeItem({
    classificationStatus: "completed",
    manualInterventionBy: "Jose Maria Sosa Izaguirre",
  }));

  assert.deepEqual(chips, ["Decision contable", "Intervencion manual"]);
});
