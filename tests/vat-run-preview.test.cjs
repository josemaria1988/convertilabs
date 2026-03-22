/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const server = require("@/lib/supabase/server");
const {
  buildVatRunPreview,
} = require("@/modules/tax/vat-run-preview");

function createSupabaseStub(resolver) {
  function createBuilder(table) {
    const state = {
      table,
      selectClause: null,
      filters: [],
      orderBy: null,
      limitCount: null,
    };

    const builder = {
      select(selectClause) {
        state.selectClause = selectClause;
        return builder;
      },
      eq(column, value) {
        state.filters.push({ type: "eq", column, value });
        return builder;
      },
      in(column, value) {
        state.filters.push({ type: "in", column, value });
        return builder;
      },
      gte(column, value) {
        state.filters.push({ type: "gte", column, value });
        return builder;
      },
      lte(column, value) {
        state.filters.push({ type: "lte", column, value });
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
        return Promise.resolve(resolver({
          ...state,
          mode: "maybeSingle",
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

test("vat preview includes provisional and final documents without mutating official runs", async () => {
  const supabase = createSupabaseStub((query) => {
    if (query.table === "documents" && query.mode === "execute") {
      return {
        data: [
          {
            id: "doc-provisional",
            direction: "purchase",
            status: "classified",
            posting_status: "posted_provisional",
            current_draft_id: "draft-provisional",
            document_date: "2026-03-10",
          },
          {
            id: "doc-final",
            direction: "sale",
            status: "classified",
            posting_status: "posted_final",
            current_draft_id: "draft-final",
            document_date: "2026-03-11",
          },
          {
            id: "doc-draft",
            direction: "purchase",
            status: "needs_review",
            posting_status: "draft",
            current_draft_id: "draft-open",
            document_date: "2026-03-12",
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
            tax_treatment_json: {
              ready: true,
              vat_bucket: "input_creditable",
              taxable_amount_uyu: 100,
              tax_amount_uyu: 22,
              warnings: [],
            },
          },
          {
            id: "draft-final",
            document_id: "doc-final",
            document_role: "sale",
            status: "confirmed",
            tax_treatment_json: {
              ready: true,
              vat_bucket: "output_vat",
              taxable_amount_uyu: 200,
              tax_amount_uyu: 44,
              warnings: ["cuenta provisional"],
            },
          },
          {
            id: "draft-open",
            document_id: "doc-draft",
            document_role: "purchase",
            status: "open",
            tax_treatment_json: {
              ready: true,
              vat_bucket: "input_creditable",
              taxable_amount_uyu: 50,
              tax_amount_uyu: 11,
              warnings: [],
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

    if (query.table === "tax_periods" && query.mode === "maybeSingle") {
      return {
        data: {
          id: "period-1",
        },
        error: null,
      };
    }

    if (query.table === "vat_runs" && query.mode === "maybeSingle") {
      return {
        data: {
          id: "run-1",
          status: "draft",
          output_vat: 40,
          input_vat_creditable: 20,
          input_vat_non_deductible: 0,
          net_vat_payable: 20,
        },
        error: null,
      };
    }

    throw new Error(`Unexpected query: ${query.table}/${query.mode}`);
  });

  const originalFactory = server.getSupabaseServiceRoleClient;
  server.getSupabaseServiceRoleClient = () => supabase;

  try {
    const preview = await buildVatRunPreview({
      organizationId: "org-1",
      year: 2026,
      month: 3,
    });

    assert.equal(preview.includedDocuments.length, 2);
    assert.equal(preview.excludedDocuments.length, 1);
    assert.equal(preview.totals.outputVat, 44);
    assert.equal(preview.totals.inputVatCreditable, 22);
    assert.equal(preview.officialRunComparison.deltaNetVatPayable, 2);
    assert.match(preview.warnings.join(" "), /cuenta provisional/i);
  } finally {
    server.getSupabaseServiceRoleClient = originalFactory;
  }
});

test("vat preview uses the real last day of the month when loading excluded documents", async () => {
  const supabase = createSupabaseStub((query) => {
    if (query.table === "documents" && query.mode === "execute") {
      const periodStart = query.filters.find((filter) =>
        filter.type === "gte" && filter.column === "document_date");
      const periodEnd = query.filters.find((filter) =>
        filter.type === "lte" && filter.column === "document_date");

      assert.equal(periodStart?.value, "2026-02-01");
      assert.equal(periodEnd?.value, "2026-02-28");

      return {
        data: [],
        error: null,
      };
    }

    if (query.table === "document_invoice_identities" && query.mode === "execute") {
      return {
        data: [],
        error: null,
      };
    }

    if (query.table === "tax_periods" && query.mode === "maybeSingle") {
      return {
        data: null,
        error: null,
      };
    }

    throw new Error(`Unexpected query: ${query.table}/${query.mode}`);
  });

  const originalFactory = server.getSupabaseServiceRoleClient;
  server.getSupabaseServiceRoleClient = () => supabase;

  try {
    const preview = await buildVatRunPreview({
      organizationId: "org-1",
      year: 2026,
      month: 2,
    });

    assert.equal(preview.period, "2026-02");
    assert.deepEqual(preview.excludedDocuments, []);
  } finally {
    server.getSupabaseServiceRoleClient = originalFactory;
  }
});
