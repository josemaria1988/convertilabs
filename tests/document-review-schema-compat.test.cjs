/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function loadFresh(request) {
  const resolved = require.resolve(request);
  delete require.cache[resolved];
  return require(request);
}

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
      order(column, options) {
        state.orderBy = { column, options };
        return builder;
      },
      limit(value) {
        state.limitCount = value;
        return Promise.resolve(resolver({
          ...state,
          mode: "execute",
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
    storage: {
      from() {
        return {
          createSignedUrl: async () => ({
            data: {
              signedUrl: "https://example.test/preview",
            },
            error: null,
          }),
        };
      },
    },
  };
}

test("workspace documents ignore missing confidence tables on older schemas", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const supabase = createSupabaseStub((query) => {
    if (query.table === "documents") {
      return {
        data: [
          {
            id: "doc-1",
            direction: "purchase",
            document_type: "invoice",
            status: "queued",
            storage_bucket: "documents",
            storage_path: "org-1/doc-1.pdf",
            original_filename: "factura.pdf",
            mime_type: "application/pdf",
            created_at: "2026-03-14T12:00:00.000Z",
            document_date: "2026-03-14",
            current_draft_id: null,
          },
        ],
        error: null,
      };
    }

    if (query.table === "document_invoice_identities") {
      return {
        data: null,
        error: {
          message: "relation \"public.document_invoice_identities\" does not exist",
        },
      };
    }

    if (query.table === "ai_decision_logs") {
      return {
        data: null,
        error: {
          message: "Could not find the table 'public.ai_decision_logs' in the schema cache",
        },
      };
    }

    throw new Error(`Unexpected query: ${query.table}`);
  });

  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;

  try {
    const reviewModule = loadFresh("@/modules/documents/review");
    const documents = await reviewModule.listOrganizationWorkspaceDocuments({
      organizationId: "org-1",
      organizationSlug: "demo",
    });

    assert.equal(documents.length, 1);
    assert.equal(documents[0].duplicateStatus, null);
    assert.equal(documents[0].certaintyLevel, null);
    assert.equal(documents[0].decisionSource, null);
  } finally {
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});
