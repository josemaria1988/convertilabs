/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  describeVatPeriodOperationalStatus,
} = require("@/modules/tax/vat-period-universe");

test("vat period status is honest when a run exists but the base is incomplete", () => {
  const status = describeVatPeriodOperationalStatus({
    runStatus: "draft",
    reviewFlagsCount: 0,
    universe: {
      period: "2026-02",
      documents: [],
      documentsInPeriod: 12,
      eligibleForVatPreviewCount: 10,
      excludedFromVatPreviewCount: 2,
      eligibleForVatRunCount: 7,
      excludedFromVatRunCount: 5,
      excludedFromVatPreview: [],
      excludedFromVatRun: [],
    },
  });

  assert.equal(status.code, "corrida_con_base_incompleta");
  assert.equal(status.label, "Corrida con base incompleta");
});

test("vat period status is confirmed only for finalized or locked runs", () => {
  const finalized = describeVatPeriodOperationalStatus({
    runStatus: "finalized",
    reviewFlagsCount: 0,
    universe: {
      period: "2026-02",
      documents: [],
      documentsInPeriod: 3,
      eligibleForVatPreviewCount: 3,
      excludedFromVatPreviewCount: 0,
      eligibleForVatRunCount: 3,
      excludedFromVatRunCount: 0,
      excludedFromVatPreview: [],
      excludedFromVatRun: [],
    },
  });

  assert.equal(finalized.code, "confirmada");
  assert.equal(finalized.label, "Confirmada");
});
