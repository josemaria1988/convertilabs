/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildDocumentMonetarySnapshot,
  resolveFiscalFxPolicy,
} = require("@/modules/accounting/fx-policy");

test("resolveFiscalFxPolicy replaces generic fetch failures with a readable BCU blocker", async () => {
  const result = await resolveFiscalFxPolicy({
    facts: {
      currency_code: "USD",
      document_date: "2026-03-12",
      subtotal: 78.69,
      tax_amount: 17.31,
      total_amount: 96,
    },
    fetchImpl: async () => {
      throw new Error("fetch failed");
    },
  });

  assert.equal(result.source, "document_default");
  assert.equal(result.rate, 0);
  assert.equal(result.blockingReasons.length, 1);
  assert.match(result.blockingReasons[0], /cotizacion bcu/i);
  assert.match(result.blockingReasons[0], /tipo de cambio fiscal/i);
  assert.doesNotMatch(result.blockingReasons[0], /fetch failed/i);
});

test("resolveFiscalFxPolicy preserves explicit BCU-specific validation errors", async () => {
  const previousProxy = process.env.BCU_FX_PROXY_URL;
  process.env.BCU_FX_PROXY_URL = "https://example.com/bcu-proxy";

  try {
    const result = await resolveFiscalFxPolicy({
      facts: {
        currency_code: "USD",
        document_date: "2026-03-12",
        subtotal: 78.69,
        tax_amount: 17.31,
        total_amount: 96,
      },
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          rate: 40.15,
          date_used: "2026-03-12",
          series_code: "2224",
        }),
      }),
    });

    assert.equal(result.blockingReasons.length, 1);
    assert.match(result.blockingReasons[0], /cierre previo al documento/i);
  } finally {
    if (previousProxy === undefined) {
      delete process.env.BCU_FX_PROXY_URL;
    } else {
      process.env.BCU_FX_PROXY_URL = previousProxy;
    }
  }
});

test("buildDocumentMonetarySnapshot does not fake UYU tax amounts when FX is missing", async () => {
  const result = await buildDocumentMonetarySnapshot({
    facts: {
      currency_code: "USD",
      document_date: "2026-03-12",
      subtotal: 78.69,
      tax_amount: 17.31,
      total_amount: 96,
    },
    fetchImpl: async () => {
      throw new Error("fetch failed");
    },
  });

  assert.equal(result.fx.source, "document_default");
  assert.equal(result.fx.rate, 0);
  assert.equal(result.netAmountUyu, 0);
  assert.equal(result.taxAmountUyu, 0);
  assert.equal(result.totalAmountUyu, 0);
});
