/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  isFiscalPeriodLockedForPosting,
  normalizeFiscalPeriodStatus,
} = require("@/modules/accounting/fiscal-period-status");
const {
  buildCloseCheckResults,
  canTransitionFiscalPeriodStatus,
} = require("@/modules/close/service");

test("fiscal period status normalizes legacy values into canonical states", () => {
  assert.equal(normalizeFiscalPeriodStatus("review"), "ready_to_close");
  assert.equal(normalizeFiscalPeriodStatus("closed"), "hard_closed");
  assert.equal(normalizeFiscalPeriodStatus("locked"), "tax_locked");
});

test("posting guard treats soft closes and explicit locks as blocked for posting", () => {
  assert.equal(
    isFiscalPeriodLockedForPosting({
      status: "soft_closed",
      lockedAt: null,
    }),
    true,
  );
  assert.equal(
    isFiscalPeriodLockedForPosting({
      status: "open",
      lockedAt: "2026-03-20T10:00:00.000Z",
    }),
    true,
  );
  assert.equal(
    isFiscalPeriodLockedForPosting({
      status: "ready_to_close",
      lockedAt: null,
    }),
    false,
  );
});

test("close validator emits blockers and warnings for an unready monthly close snapshot", () => {
  const results = buildCloseCheckResults({
    period: {
      id: "fp-1",
      code: "2026-03",
      label: "Marzo 2026",
      startsOn: "2026-03-01",
      endsOn: "2026-03-31",
      status: "ready_to_close",
      normalizedStatus: "ready_to_close",
    },
    documents: {
      totalCount: 12,
      pendingCount: 2,
      provisionalCount: 1,
      lateCount: 1,
    },
    journal: {
      totalCount: 5,
      unfinalizedCount: 1,
      immutableCount: 4,
      functionalDebit: 1000,
      functionalCredit: 980,
      imbalance: 20,
    },
    tax: {
      vatStatus: "draft",
      dgiStatus: "draft",
    },
    operations: {
      outstandingOpenItemsCount: 3,
    },
  });

  const pendingDocuments = results.find((result) => result.code === "documents_ready_for_close");
  const balanceCheck = results.find((result) => result.code === "trial_balance_balanced");
  const vatCheck = results.find((result) => result.code === "vat_run_closed");
  const openItemsCheck = results.find((result) => result.code === "open_items_supported");

  assert.equal(pendingDocuments?.status, "blocker");
  assert.equal(balanceCheck?.status, "blocker");
  assert.equal(vatCheck?.status, "blocker");
  assert.equal(openItemsCheck?.status, "warning");
});

test("hard close transitions remain disabled until close snapshots exist", () => {
  const hardCloseGuard = canTransitionFiscalPeriodStatus({
    fromStatus: "tax_locked",
    toStatus: "hard_closed",
    supportsHardClose: false,
  });
  const auditFreezeGuard = canTransitionFiscalPeriodStatus({
    fromStatus: "hard_closed",
    toStatus: "audit_frozen",
    supportsHardClose: false,
  });

  assert.equal(hardCloseGuard.ok, false);
  assert.match(hardCloseGuard.reason ?? "", /close snapshots/i);
  assert.equal(auditFreezeGuard.ok, false);
});
