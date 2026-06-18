/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function valeTerm(overrides = {}) {
  return {
    id: "term-1",
    currencyCode: "USD",
    principalAmountMinor: 500000n,
    expectedInterestAmountMinor: 18000n,
    expectedFeesAmountMinor: 0n,
    expectedPartialPrincipalPaymentMinor: 0n,
    dueDate: "2026-06-25",
    plannedAction: "undecided",
    renewalConfirmed: false,
    ...overrides,
  };
}

test("treasury calculates closing a vale as capital plus interest and fees", () => {
  const { calculateValeTermCashImpact, calculateCashPosition } = require("@/modules/treasury");
  const impact = calculateValeTermCashImpact(valeTerm({ plannedAction: "close" }));

  assert.equal(impact.plannedOutflowMinor, 518000n);
  assert.equal(impact.conservativeOutflowMinor, 518000n);

  const cash = calculateCashPosition({
    currencyCode: "USD",
    bankBalanceMinor: 750000n,
    plannedObligationsMinor: impact.plannedOutflowMinor,
    conservativeObligationsMinor: impact.conservativeOutflowMinor,
    unavoidablePaymentsMinor: 0n,
    minBufferMinor: 100000n,
  });

  assert.equal(cash.plannedAvailableCashMinor, 132000n);
  assert.equal(cash.conservativeAvailableCashMinor, 132000n);
  assert.equal(cash.status, "GREEN");
});

test("treasury uses only interest, fees and amortization for confirmed renewals", () => {
  const { calculateValeTermCashImpact } = require("@/modules/treasury");
  const impact = calculateValeTermCashImpact(valeTerm({
    plannedAction: "renew",
    renewalConfirmed: true,
    expectedPartialPrincipalPaymentMinor: 100000n,
  }));

  assert.equal(impact.plannedOutflowMinor, 118000n);
  assert.equal(impact.conservativeOutflowMinor, 118000n);
  assert.equal(impact.closeOutflowMinor, 518000n);
});

test("treasury assumes closing in conservative mode when renewal is not confirmed", () => {
  const { calculateValeTermCashImpact } = require("@/modules/treasury");
  const impact = calculateValeTermCashImpact(valeTerm({
    plannedAction: "renew",
    renewalConfirmed: false,
  }));

  assert.equal(impact.plannedOutflowMinor, 18000n);
  assert.equal(impact.conservativeOutflowMinor, 518000n);
});

test("treasury withdrawal simulator rejects negative conservative cash", () => {
  const { simulateWithdrawal } = require("@/modules/treasury");
  const result = simulateWithdrawal({
    conservativeAvailableCashMinor: 132000n,
    withdrawalAmountMinor: 200000n,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.risk, "HIGH");
  assert.equal(result.afterWithdrawalMinor, -68000n);
});

test("treasury projection does not add receivables to current cash and separates scenarios", () => {
  const { buildCashProjection } = require("@/modules/treasury");
  const projection = buildCashProjection({
    today: "2026-06-18",
    horizonDays: 45,
    startingBalances: [{ currencyCode: "USD", amountMinor: 750000n }],
    valeTerms: [
      valeTerm({
        plannedAction: "renew",
        renewalConfirmed: false,
      }),
    ],
    receivables: [
      {
        id: "receivable-1",
        label: "Cliente confirmado",
        currencyCode: "USD",
        amountMinor: 300000n,
        expectedDate: "2026-06-28",
        status: "pending",
        confidence: "confirmed",
      },
      {
        id: "receivable-2",
        label: "Cliente probable",
        currencyCode: "USD",
        amountMinor: 100000n,
        expectedDate: "2026-06-29",
        status: "pending",
        confidence: "probable",
      },
    ],
    payables: [],
  });

  const conservativeInitial = projection.find((event) =>
    event.scenario === "conservative" && event.sourceType === "initial_balance");
  const conservativeVale = projection.find((event) =>
    event.scenario === "conservative" && event.sourceType === "vale");
  const plannedReceivables = projection.filter((event) =>
    event.scenario === "planned" && event.sourceType === "receivable");
  const conservativeReceivables = projection.filter((event) =>
    event.scenario === "conservative" && event.sourceType === "receivable");

  assert.equal(conservativeInitial.projectedBalanceMinor, 750000n);
  assert.equal(conservativeVale.outflowMinor, 518000n);
  assert.equal(plannedReceivables.length, 2);
  assert.equal(conservativeReceivables.length, 0);
});

test("treasury alerts unconfirmed renewal and overdue receivables", () => {
  const { evaluateTreasuryAlerts } = require("@/modules/treasury");
  const alerts = evaluateTreasuryAlerts({
    today: "2026-06-23",
    valeTerms: [valeTerm({ plannedAction: "renew", renewalConfirmed: false })],
    conservativeAvailableByCurrency: new Map([["USD", 132000n]]),
    minBufferByCurrency: new Map([["USD", 100000n]]),
    receivables: [
      {
        id: "receivable-1",
        label: "Cliente A",
        currencyCode: "USD",
        amountMinor: 50000n,
        expectedDate: "2026-06-20",
        status: "pending",
        confidence: "confirmed",
      },
    ],
  });

  assert.ok(alerts.some((alert) => alert.key === "renewal-unconfirmed:term-1"));
  assert.ok(alerts.some((alert) => alert.key === "vale-72h:term-1"));
  assert.ok(alerts.some((alert) => alert.key === "receivable-overdue:receivable-1"));
});
