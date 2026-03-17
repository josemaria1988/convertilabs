/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  resolveBcuFiscalFxRate,
} = require("@/modules/accounting/bcu-fx-service");

test("BCU fiscal FX starts from the previous calendar day, never the document date itself", async () => {
  const calls = [];
  const result = await resolveBcuFiscalFxRate({
    currencyCode: "USD",
    documentDate: "2026-03-17",
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      calls.push(body);

      return {
        ok: true,
        json: async () => ([
          {
            Fecha: body.FechaDesde,
            CodigoISO: "USD",
            Promedio: "44,25",
            CodigoMoneda: "2224",
          },
        ]),
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].FechaDesde, "16/03/2026");
  assert.equal(calls[0].FechaHasta, "16/03/2026");
  assert.equal(result.dateUsed, "2026-03-16");
  assert.equal(result.rate, 44.25);
  assert.equal(result.seriesCode, "2224");
});

test("BCU fiscal FX walks back to the last available business close when the previous day has no quote", async () => {
  const calls = [];
  const result = await resolveBcuFiscalFxRate({
    currencyCode: "USD",
    documentDate: "2026-03-16",
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      calls.push(body.FechaDesde);

      if (body.FechaDesde === "13/03/2026") {
        return {
          ok: true,
          json: async () => ([
            {
              Fecha: "13/03/2026",
              CodigoISO: "USD",
              Promedio: "44,10",
              CodigoMoneda: "2224",
            },
          ]),
        };
      }

      return {
        ok: true,
        json: async () => ([]),
      };
    },
  });

  assert.deepEqual(calls.slice(0, 3), [
    "15/03/2026",
    "14/03/2026",
    "13/03/2026",
  ]);
  assert.equal(result.dateUsed, "2026-03-13");
  assert.equal(result.rate, 44.1);
});

test("BCU proxy responses are rejected when they return the same date as the document", async () => {
  const previousProxy = process.env.BCU_FX_PROXY_URL;
  process.env.BCU_FX_PROXY_URL = "https://example.com/bcu-proxy";

  try {
    await assert.rejects(
      resolveBcuFiscalFxRate({
        currencyCode: "USD",
        documentDate: "2026-03-17",
        fetchImpl: async (url) => {
          const parsed = new URL(url);
          assert.equal(parsed.searchParams.get("lookup_start_date"), "2026-03-16");
          assert.equal(parsed.searchParams.get("previous_business_day_before"), "2026-03-17");

          return {
            ok: true,
            json: async () => ({
              rate: 44.3,
              date_used: "2026-03-17",
              series_code: "2224",
            }),
          };
        },
      }),
      /cierre previo al documento/i,
    );
  } finally {
    if (previousProxy === undefined) {
      delete process.env.BCU_FX_PROXY_URL;
    } else {
      process.env.BCU_FX_PROXY_URL = previousProxy;
    }
  }
});
