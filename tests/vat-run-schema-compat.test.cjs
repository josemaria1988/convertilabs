/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  loadVatRunExportDataset,
} = require("@/modules/exports/repository");
const {
  loadOrganizationVatRuns,
  rebuildMonthlyVatRunFromConfirmations,
} = require("@/modules/tax/vat-runs");
const {
  isMissingVatRunImportColumnError,
  omitVatRunImportColumns,
} = require("@/modules/tax/vat-run-schema-compat");

function createSupabaseStub(resolver) {
  function createBuilder(table) {
    const state = {
      table,
      selectClause: null,
      filters: [],
      orderBy: null,
      limitCount: null,
      mutation: null,
      payload: undefined,
      mutationOptions: undefined,
    };

    const builder = {
      select(selectClause) {
        state.selectClause = selectClause;
        return builder;
      },
      eq(column, value) {
        state.filters.push({
          type: "eq",
          column,
          value,
        });
        return builder;
      },
      in(column, value) {
        state.filters.push({
          type: "in",
          column,
          value,
        });
        return builder;
      },
      gte(column, value) {
        state.filters.push({
          type: "gte",
          column,
          value,
        });
        return builder;
      },
      lte(column, value) {
        state.filters.push({
          type: "lte",
          column,
          value,
        });
        return builder;
      },
      not(column, operator, value) {
        state.filters.push({
          type: "not",
          column,
          operator,
          value,
        });
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
      upsert(payload, mutationOptions) {
        state.mutation = "upsert";
        state.payload = payload;
        state.mutationOptions = mutationOptions;
        return builder;
      },
      update(payload) {
        state.mutation = "update";
        state.payload = payload;
        return builder;
      },
      insert(payload) {
        state.mutation = "insert";
        state.payload = payload;
        return builder;
      },
      maybeSingle() {
        return Promise.resolve(resolver({
          ...state,
          mode: "maybeSingle",
        }));
      },
      single() {
        return Promise.resolve(resolver({
          ...state,
          mode: "single",
        }));
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(resolver({
          ...state,
          mode: "execute",
        })).then(onFulfilled, onRejected);
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

test("vat run schema compat detects missing columns and strips import fields", () => {
  assert.equal(
    isMissingVatRunImportColumnError({
      message: "column vat_runs.import_vat does not exist",
    }),
    true,
  );
  assert.equal(
    isMissingVatRunImportColumnError({
      message: "some other database error",
    }),
    false,
  );
  assert.deepEqual(
    omitVatRunImportColumns({
      organization_id: "org-1",
      import_vat: 150,
      import_vat_advance: 50,
      net_vat_payable: 0,
    }),
    {
      organization_id: "org-1",
      net_vat_payable: 0,
    },
  );
});

test("loadOrganizationVatRuns falls back when vat import columns are missing", async () => {
  const selectCalls = [];
  const supabase = createSupabaseStub((query) => {
    if (query.table === "vat_runs" && query.mode === "execute") {
      selectCalls.push(query.selectClause);

      if (query.selectClause.includes("import_vat")) {
        return {
          data: null,
          error: {
            message: "column vat_runs.import_vat does not exist",
          },
        };
      }

      return {
        data: [
          {
            id: "run-1",
            period_id: "period-1",
            status: "draft",
            output_vat: 44,
            input_vat_creditable: 22,
            input_vat_non_deductible: 0,
            net_vat_payable: -156,
            result_json: {
              totals: {
                import_vat: 150,
                import_vat_advance: 50,
              },
            },
            input_snapshot_json: {
              documents: [],
            },
            created_at: "2026-03-14T10:00:00.000Z",
            period: {
              period_year: 2026,
              period_month: 3,
              start_date: "2026-03-01",
              end_date: "2026-03-31",
            },
          },
        ],
        error: null,
      };
    }

    throw new Error(`Unexpected query: ${query.table}/${query.mode}`);
  });

  const runs = await loadOrganizationVatRuns(supabase, "org-1");

  assert.equal(selectCalls.length, 2);
  assert.equal(runs[0].periodLabel, "2026-03");
  assert.equal(runs[0].importVat, 150);
  assert.equal(runs[0].importVatAdvance, 50);
});

test("loadVatRunExportDataset falls back to result_json totals on old schemas", async () => {
  const selectCalls = [];
  const supabase = createSupabaseStub((query) => {
    if (query.table === "vat_runs" && query.mode === "maybeSingle") {
      selectCalls.push(query.selectClause);

      if (query.selectClause.includes("import_vat")) {
        return {
          data: null,
          error: {
            message: "Could not find the 'import_vat' column of 'vat_runs' in the schema cache",
          },
        };
      }

      return {
        data: {
          id: "run-1",
          organization_id: "org-1",
          status: "draft",
          output_vat: 44,
          input_vat_creditable: 22,
          input_vat_non_deductible: 0,
          net_vat_payable: -156,
          result_json: {
            totals: {
              import_vat: 150,
              import_vat_advance: 50,
            },
          },
          input_snapshot_json: {
            documents: [],
          },
          period: {
            period_year: 2026,
            period_month: 3,
          },
        },
        error: null,
      };
    }

    if (query.table === "organizations" && query.mode === "maybeSingle") {
      return {
        data: {
          id: "org-1",
          name: "Org Demo",
        },
        error: null,
      };
    }

    if (
      query.table === "organization_dgi_form_mappings"
      || query.table === "organization_import_operations"
      || query.table === "organization_import_operation_taxes"
      || query.table === "organization_spreadsheet_import_runs"
    ) {
      return {
        data: [],
        error: null,
      };
    }

    throw new Error(`Unexpected query: ${query.table}/${query.mode}`);
  });

  const dataset = await loadVatRunExportDataset(supabase, "org-1", "run-1");

  assert.equal(selectCalls.length, 2);
  assert.equal(dataset.periodLabel, "2026-03");
  assert.equal(dataset.totals.importVat, 150);
  assert.equal(dataset.totals.importVatAdvance, 50);
});

test("rebuildMonthlyVatRunFromConfirmations retries updates without import columns", async () => {
  const updatePayloads = [];
  const supabase = createSupabaseStub((query) => {
    if (query.table === "tax_periods" && query.mutation === "upsert" && query.mode === "single") {
      return {
        data: {
          id: "period-1",
          period_year: 2026,
          period_month: 3,
          start_date: "2026-03-01",
          end_date: "2026-03-31",
          status: "open",
        },
        error: null,
      };
    }

    if (query.table === "vat_runs" && query.mode === "maybeSingle") {
      return {
        data: {
          id: "run-1",
          period_id: "period-1",
          version_no: 1,
          status: "draft",
          result_json: {},
        },
        error: null,
      };
    }

    if (
      query.table === "document_confirmations"
      || query.table === "organization_import_operations"
    ) {
      return {
        data: [],
        error: null,
      };
    }

    if (query.table === "documents" && query.mode === "execute") {
      return {
        data: null,
        error: {
          message: "column documents.posting_status does not exist",
        },
      };
    }

    if (query.table === "vat_runs" && query.mutation === "update" && query.mode === "execute") {
      updatePayloads.push(query.payload);

      if (Object.hasOwn(query.payload, "import_vat")) {
        return {
          data: null,
          error: {
            message: "column vat_runs.import_vat does not exist",
          },
        };
      }

      return {
        data: null,
        error: null,
      };
    }

    if (query.table === "tax_periods" && query.mutation === "update" && query.mode === "execute") {
      return {
        data: null,
        error: null,
      };
    }

    throw new Error(`Unexpected query: ${query.table}/${query.mode}/${query.mutation ?? "read"}`);
  });

  const runId = await rebuildMonthlyVatRunFromConfirmations(
    supabase,
    "org-1",
    "2026-03",
    "user-1",
  );

  assert.equal(runId, "run-1");
  assert.equal(updatePayloads.length, 2);
  assert.equal(Object.hasOwn(updatePayloads[0], "import_vat"), true);
  assert.equal(Object.hasOwn(updatePayloads[1], "import_vat"), false);
  assert.equal(Object.hasOwn(updatePayloads[1], "import_vat_advance"), false);
});

test("rebuildMonthlyVatRunFromConfirmations uses declarative VAT run eligibility and persists exclusions", async () => {
  const insertPayloads = [];
  const supabase = createSupabaseStub((query) => {
    if (query.table === "tax_periods" && query.mutation === "upsert" && query.mode === "single") {
      return {
        data: {
          id: "period-1",
          period_year: 2026,
          period_month: 3,
          start_date: "2026-03-01",
          end_date: "2026-03-31",
          status: "open",
        },
        error: null,
      };
    }

    if (query.table === "vat_runs" && query.mode === "maybeSingle") {
      return {
        data: null,
        error: null,
      };
    }

    if (query.table === "documents" && query.mode === "execute") {
      return {
        data: [
          {
            id: "doc-provisional",
            current_draft_id: "draft-provisional",
            direction: "purchase",
            status: "classified",
            posting_status: "posted_provisional",
            document_date: "2026-03-10",
          },
          {
            id: "doc-vat-ready",
            current_draft_id: "draft-vat-ready",
            direction: "purchase",
            status: "classified",
            posting_status: "vat_ready",
            document_date: "2026-03-11",
          },
        ],
        error: null,
      };
    }

    if (query.table === "document_drafts" && query.mode === "execute") {
      return {
        data: [
          {
            id: "draft-provisional",
            document_id: "doc-provisional",
            document_role: "purchase",
            status: "confirmed",
            fields_json: {
              facts: {
                subtotal: 100,
                tax_amount: 22,
              },
            },
            tax_treatment_json: {
              ready: true,
              vat_bucket: "input_creditable",
              taxable_amount_uyu: 100,
              tax_amount_uyu: 22,
              warnings: [],
              blockingReasons: [],
            },
          },
          {
            id: "draft-vat-ready",
            document_id: "doc-vat-ready",
            document_role: "purchase",
            status: "confirmed",
            fields_json: {
              facts: {
                subtotal: 50,
                tax_amount: 11,
              },
            },
            tax_treatment_json: {
              ready: true,
              vat_bucket: "input_creditable",
              taxable_amount_uyu: 50,
              tax_amount_uyu: 11,
              warnings: [],
              blockingReasons: [],
            },
          },
        ],
        error: null,
      };
    }

    if (query.table === "document_invoice_identities" && query.mode === "execute") {
      return {
        data: [],
        error: null,
      };
    }

    if (
      query.table === "organization_import_operations"
      || query.table === "organization_import_operation_taxes"
    ) {
      return {
        data: [],
        error: null,
      };
    }

    if (query.table === "vat_runs" && query.mutation === "insert" && query.mode === "single") {
      insertPayloads.push(query.payload);

      return {
        data: {
          id: "run-2",
        },
        error: null,
      };
    }

    if (query.table === "tax_periods" && query.mutation === "update" && query.mode === "execute") {
      return {
        data: null,
        error: null,
      };
    }

    throw new Error(`Unexpected query: ${query.table}/${query.mode}/${query.mutation ?? "read"}`);
  });

  const runId = await rebuildMonthlyVatRunFromConfirmations(
    supabase,
    "org-1",
    "2026-03",
    "user-1",
  );

  assert.equal(runId, "run-2");
  assert.equal(insertPayloads.length, 1);
  assert.equal(insertPayloads[0].input_snapshot_json.documents.length, 1);
  assert.equal(insertPayloads[0].input_snapshot_json.documents[0].documentId, "doc-provisional");
  assert.equal(insertPayloads[0].input_snapshot_json.excluded_from_run.length, 1);
  assert.equal(
    insertPayloads[0].input_snapshot_json.excluded_from_run[0].reasonCode,
    "insufficient_posting_for_run",
  );
  assert.match(
    insertPayloads[0].input_snapshot_json.excluded_from_run[0].reason,
    /corrida oficial de IVA/i,
  );
  assert.equal(insertPayloads[0].result_json.documents_included_count, 1);
  assert.equal(insertPayloads[0].result_json.excluded_from_run_count, 1);
  assert.deepEqual(insertPayloads[0].result_json.eligibility_summary, {
    documentsInPeriod: 2,
    eligibleForVatPreview: 2,
    excludedFromVatPreview: 0,
    eligibleForVatRun: 1,
    excludedFromVatRun: 1,
  });
});
