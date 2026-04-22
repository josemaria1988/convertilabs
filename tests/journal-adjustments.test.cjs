/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  evaluateDocumentBackedJournalAdjustment,
} = require("@/modules/accounting/journal-adjustments");

function buildDetail(overrides = {}) {
  const entry = {
    sourceDocumentId: "doc-1",
    providerManaged: false,
    isActiveLeaf: true,
    status: "posted",
    fiscalPeriodStatus: "open",
    ...overrides.entry,
  };
  const lines = overrides.lines ?? [
    {
      accountId: "acct-expense",
      accountIsPostable: true,
      accountIsImputable: true,
      debit: 100,
      credit: 0,
    },
    {
      accountId: "acct-payable",
      accountIsPostable: true,
      accountIsImputable: true,
      debit: 0,
      credit: 100,
    },
  ];

  return {
    entry,
    lines,
  };
}

test("journal adjustment guard accepts a balanced document-backed adjustment", () => {
  const result = evaluateDocumentBackedJournalAdjustment({
    detail: buildDetail(),
    reason: "Remapear cuenta de gasto",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.blockers, []);
});

test("journal adjustment guard blocks closed periods and unbalanced drafts", () => {
  const result = evaluateDocumentBackedJournalAdjustment({
    detail: buildDetail({
      entry: {
        fiscalPeriodStatus: "tax_locked",
      },
      lines: [
        {
          accountId: "acct-expense",
          accountIsPostable: true,
          accountIsImputable: true,
          debit: 100,
          credit: 0,
        },
        {
          accountId: "acct-payable",
          accountIsPostable: true,
          accountIsImputable: true,
          debit: 0,
          credit: 90,
        },
      ],
    }),
    reason: "Corregir cuenta",
  });

  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((blocker) => blocker.code === "period_locked"));
  assert.ok(result.blockers.some((blocker) => blocker.code === "unbalanced"));
});

test("journal adjustment guard keeps provider-managed and detached entries read-only", () => {
  const result = evaluateDocumentBackedJournalAdjustment({
    detail: buildDetail({
      entry: {
        sourceDocumentId: null,
        providerManaged: true,
      },
    }),
    reason: "Corregir cuenta",
  });

  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((blocker) => blocker.code === "provider_managed"));
  assert.ok(result.blockers.some((blocker) => blocker.code === "missing_document"));
});

test("journal adjustment guard requires reason and postable accounts", () => {
  const result = evaluateDocumentBackedJournalAdjustment({
    detail: buildDetail({
      lines: [
        {
          accountId: "acct-summary",
          accountIsPostable: false,
          accountIsImputable: true,
          debit: 100,
          credit: 0,
        },
        {
          accountId: "acct-payable",
          accountIsPostable: true,
          accountIsImputable: true,
          debit: 0,
          credit: 100,
        },
      ],
    }),
    reason: "",
  });

  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((blocker) => blocker.code === "missing_reason"));
  assert.ok(result.blockers.some((blocker) => blocker.code === "non_postable_account"));
});
