/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function createSupabaseStub(resolver) {
  function createBuilder(table) {
    const state = {
      table,
      selectClause: null,
      filters: [],
      orderBy: null,
      limitCount: null,
      mutation: null,
      payload: null,
    };

    const execute = (mode) => Promise.resolve(resolver({
      ...state,
      mode,
    }));

    const builder = {
      select(selectClause) {
        state.selectClause = selectClause;
        return builder;
      },
      eq(column, value) {
        state.filters.push({ type: "eq", column, value });
        return builder;
      },
      order(column, options) {
        state.orderBy = { column, options };
        return builder;
      },
      limit(value) {
        state.limitCount = value;
        return builder;
      },
      maybeSingle() {
        return execute("maybeSingle");
      },
      single() {
        return execute("single");
      },
      insert(payload) {
        state.mutation = "insert";
        state.payload = payload;
        return builder;
      },
      update(payload) {
        state.mutation = "update";
        state.payload = payload;
        return builder;
      },
      then(onFulfilled, onRejected) {
        return execute("execute").then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  return {
    from(table) {
      return createBuilder(table);
    },
  };
}

test("spreadsheet run loader returns null when history table is missing", async () => {
  const { loadSpreadsheetImportRun } = require("@/modules/spreadsheets");
  const supabase = createSupabaseStub((query) => {
    assert.equal(query.table, "organization_spreadsheet_import_runs");
    return {
      data: null,
      error: {
        message: "relation \"public.organization_spreadsheet_import_runs\" does not exist",
      },
    };
  });

  const run = await loadSpreadsheetImportRun(supabase, "org-1", "run-1");

  assert.equal(run, null);
});

test("spreadsheet run listing returns empty when history table is missing", async () => {
  const { listOrganizationSpreadsheetImportRuns } = require("@/modules/spreadsheets");
  const supabase = createSupabaseStub((query) => {
    assert.equal(query.table, "organization_spreadsheet_import_runs");
    return {
      data: null,
      error: {
        message: "Could not find the table 'public.organization_spreadsheet_import_runs' in the schema cache",
      },
    };
  });

  const runs = await listOrganizationSpreadsheetImportRuns(supabase, "org-1", 10);

  assert.deepEqual(runs, []);
});

test("direct chart spreadsheet import persists accounts without history table support", async () => {
  const { importChartOfAccountsSpreadsheetDirect } = require("@/modules/spreadsheets");
  const insertedPayloads = [];
  const supabase = createSupabaseStub((query) => {
    if (query.table === "chart_of_accounts" && query.mutation === "insert") {
      insertedPayloads.push(query.payload);
      return {
        data: null,
        error: null,
      };
    }

    if (query.table === "chart_of_accounts") {
      return {
        data: [],
        error: null,
      };
    }

    throw new Error(`Unexpected query: ${query.table}/${query.mode}/${query.mutation ?? "read"}`);
  });
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const csv = [
      "codigo,nombre,tipo,saldo normal,postable",
      "6101,Gastos administrativos,expense,debit,si",
    ].join("\n");

    const result = await importChartOfAccountsSpreadsheetDirect({
      supabase,
      organizationId: "org-1",
      actorId: "user-1",
      fileName: "plan.csv",
      mimeType: "text/csv",
      bytes: Buffer.from(csv, "utf8"),
    });

    assert.equal(result.interpretation.importType, "chart_of_accounts_import");
    assert.equal(result.chartPreview.readyCount, 1);
    assert.equal(result.persisted.insertedCount, 1);
    assert.equal(insertedPayloads.length, 1);
    assert.equal(insertedPayloads[0][0].code, "6101");
    assert.equal(insertedPayloads[0][0].account_type, "expense");
  } finally {
    if (originalOpenAIKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAIKey;
    }
  }
});
