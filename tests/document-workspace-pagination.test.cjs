/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function loadFresh(request) {
  const resolved = require.resolve(request);
  delete require.cache[resolved];
  return require(request);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSupabaseStub(seedTables, options = {}) {
  const tables = Object.fromEntries(
    Object.entries(seedTables).map(([table, rows]) => [table, clone(rows)]),
  );

  function matchesFilters(row, filters) {
    return filters.every((filter) => {
      if (filter.type === "eq") {
        return row[filter.column] === filter.value;
      }

      if (filter.type === "in") {
        return filter.value.includes(row[filter.column]);
      }

      return true;
    });
  }

  function compareValues(left, right, options) {
    const leftIsNull = left === null || left === undefined;
    const rightIsNull = right === null || right === undefined;

    if (leftIsNull && rightIsNull) {
      return 0;
    }

    if (leftIsNull) {
      return options?.nullsFirst ? -1 : 1;
    }

    if (rightIsNull) {
      return options?.nullsFirst ? 1 : -1;
    }

    if (left < right) {
      return -1;
    }

    if (left > right) {
      return 1;
    }

    return 0;
  }

  function execute(state) {
    const sourceRows = tables[state.table] ?? [];
    const matchedRows = sourceRows.filter((row) => matchesFilters(row, state.filters));

    if (state.selectOptions?.head && state.selectOptions?.count === "exact") {
      return {
        data: null,
        count: matchedRows.length,
        error: null,
      };
    }

    let data = matchedRows.map((row) => clone(row));

    for (const orderBy of state.orderBys) {
      const direction = orderBy.options?.ascending === false ? -1 : 1;
      data.sort((left, right) =>
        compareValues(left[orderBy.column], right[orderBy.column], orderBy.options) * direction);
    }

    if (typeof state.rangeFrom === "number" && typeof state.rangeTo === "number") {
      data = data.slice(state.rangeFrom, state.rangeTo + 1);
    } else if (typeof state.limitCount === "number") {
      data = data.slice(0, state.limitCount);
    }

    return {
      data,
      count: matchedRows.length,
      error: null,
    };
  }

  function createBuilder(table) {
    const state = {
      table,
      filters: [],
      orderBys: [],
      limitCount: null,
      rangeFrom: null,
      rangeTo: null,
      selectOptions: null,
    };

    const builder = {
      select(_selectClause, options) {
        state.selectOptions = options ?? null;
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
        state.orderBys.push({ column, options });
        return builder;
      },
      limit(value) {
        state.limitCount = value;
        return Promise.resolve(execute(state));
      },
      range(from, to) {
        state.rangeFrom = from;
        state.rangeTo = to;
        return Promise.resolve(execute(state));
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(execute(state)).then(onFulfilled, onRejected);
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
          createSignedUrl: options.createSignedUrl
            ?? (async () => ({
              data: {
                signedUrl: "https://example.test/preview",
              },
              error: null,
            })),
        };
      },
    },
  };
}

function buildSeed() {
  return {
    documents: [
      {
        id: "doc-1",
        organization_id: "org-1",
        direction: "purchase",
        document_type: "invoice",
        status: "uploaded",
        posting_status: "draft",
        storage_bucket: "documents-private",
        storage_path: "orgs/org-1/doc-1.pdf",
        original_filename: "compra-1.pdf",
        mime_type: "application/pdf",
        created_at: "2026-03-14T10:00:00.000Z",
        document_date: "2026-03-14",
        current_draft_id: null,
        current_processing_run_id: null,
        last_processed_at: null,
        metadata: {},
      },
      {
        id: "doc-2",
        organization_id: "org-1",
        direction: "sale",
        document_type: "invoice",
        status: "uploaded",
        posting_status: "draft",
        storage_bucket: "documents-private",
        storage_path: "orgs/org-1/doc-2.pdf",
        original_filename: "venta-1.pdf",
        mime_type: "application/pdf",
        created_at: "2026-03-15T10:00:00.000Z",
        document_date: "2026-03-15",
        current_draft_id: null,
        current_processing_run_id: null,
        last_processed_at: null,
        metadata: {},
      },
      {
        id: "doc-3",
        organization_id: "org-1",
        direction: "purchase",
        document_type: "invoice",
        status: "uploaded",
        posting_status: "draft",
        storage_bucket: "documents-private",
        storage_path: "orgs/org-1/doc-3.pdf",
        original_filename: "compra-2.pdf",
        mime_type: "application/pdf",
        created_at: "2026-03-17T10:00:00.000Z",
        document_date: "2026-03-17",
        current_draft_id: null,
        current_processing_run_id: null,
        last_processed_at: null,
        metadata: {},
      },
    ],
    document_invoice_identities: [],
    ai_decision_logs: [],
    document_processing_runs: [],
    document_assignment_runs: [],
    document_drafts: [],
    document_draft_autosaves: [],
  };
}

test("paginated workspace documents filter by direction and expose page metadata", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const supabase = createSupabaseStub(buildSeed());

  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;

  try {
    const reviewModule = loadFresh("@/modules/documents/review");
    const result = await reviewModule.listPaginatedOrganizationWorkspaceDocuments({
      organizationId: "org-1",
      organizationSlug: "demo",
      page: 1,
      pageSize: 1,
      directionFilter: "purchase",
      sortOrder: "date_desc",
    });

    assert.equal(result.totalItems, 2);
    assert.equal(result.totalPages, 2);
    assert.equal(result.page, 1);
    assert.equal(result.hasPreviousPage, false);
    assert.equal(result.hasNextPage, true);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, "doc-3");
    assert.equal(result.items[0].role, "purchase");
  } finally {
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});

test("paginated workspace documents sort by document date ascending", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const supabase = createSupabaseStub(buildSeed());

  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;

  try {
    const reviewModule = loadFresh("@/modules/documents/review");
    const result = await reviewModule.listPaginatedOrganizationWorkspaceDocuments({
      organizationId: "org-1",
      organizationSlug: "demo",
      page: 1,
      pageSize: 3,
      directionFilter: "all",
      sortOrder: "date_asc",
    });

    assert.deepEqual(result.items.map((item) => item.id), ["doc-1", "doc-2", "doc-3"]);
  } finally {
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});

test("workspace documents treat missing storage previews as unavailable without logging error", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const originalConsoleError = console.error;
  const consoleErrors = [];
  const supabase = createSupabaseStub(buildSeed(), {
    createSignedUrl: async () => ({
      data: null,
      error: {
        name: "StorageApiError",
        message: "Object not found",
        statusCode: "404",
      },
    }),
  });

  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;
  console.error = (...args) => {
    consoleErrors.push(args);
  };

  try {
    const reviewModule = loadFresh("@/modules/documents/review");
    const result = await reviewModule.listPaginatedOrganizationWorkspaceDocuments({
      organizationId: "org-1",
      organizationSlug: "demo",
      page: 1,
      pageSize: 1,
      directionFilter: "all",
      sortOrder: "date_desc",
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].previewUrl, null);
    assert.equal(consoleErrors.length, 0);
  } finally {
    console.error = originalConsoleError;
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});

test("paginated workspace documents sort by period and keep month buckets together", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const seed = buildSeed();

  seed.documents.push(
    {
      id: "doc-4",
      organization_id: "org-1",
      direction: "purchase",
      document_type: "invoice",
      status: "uploaded",
      posting_status: "draft",
      storage_bucket: "documents-private",
      storage_path: "orgs/org-1/doc-4.pdf",
      original_filename: "compra-febrero.pdf",
      mime_type: "application/pdf",
      created_at: "2026-02-20T10:00:00.000Z",
      document_date: "2026-02-20",
      current_draft_id: null,
      current_processing_run_id: null,
      last_processed_at: null,
      metadata: {},
    },
    {
      id: "doc-5",
      organization_id: "org-1",
      direction: "sale",
      document_type: "invoice",
      status: "uploaded",
      posting_status: "draft",
      storage_bucket: "documents-private",
      storage_path: "orgs/org-1/doc-5.pdf",
      original_filename: "venta-enero.pdf",
      mime_type: "application/pdf",
      created_at: "2026-01-18T10:00:00.000Z",
      document_date: "2026-01-18",
      current_draft_id: null,
      current_processing_run_id: null,
      last_processed_at: null,
      metadata: {},
    },
  );

  const supabase = createSupabaseStub(seed);
  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;

  try {
    const reviewModule = loadFresh("@/modules/documents/review");
    const result = await reviewModule.listPaginatedOrganizationWorkspaceDocuments({
      organizationId: "org-1",
      organizationSlug: "demo",
      page: 1,
      pageSize: 4,
      directionFilter: "all",
      sortOrder: "period_desc",
    });

    assert.equal(result.totalItems, 5);
    assert.equal(result.totalPages, 2);
    assert.deepEqual(result.items.map((item) => item.id), ["doc-3", "doc-2", "doc-1", "doc-4"]);
  } finally {
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});

test("paginated workspace documents sort by confidence after enrichment", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const seed = buildSeed();

  seed.ai_decision_logs = [
    {
      organization_id: "org-1",
      document_id: "doc-1",
      decision_source: "deterministic_rule",
      confidence_score: 50,
      certainty_level: "red",
      created_at: "2026-03-14T11:00:00.000Z",
    },
    {
      organization_id: "org-1",
      document_id: "doc-2",
      decision_source: "deterministic_rule",
      confidence_score: 90,
      certainty_level: "green",
      created_at: "2026-03-15T11:00:00.000Z",
    },
    {
      organization_id: "org-1",
      document_id: "doc-3",
      decision_source: "deterministic_rule",
      confidence_score: 70,
      certainty_level: "yellow",
      created_at: "2026-03-17T11:00:00.000Z",
    },
  ];

  const supabase = createSupabaseStub(seed);
  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;

  try {
    const reviewModule = loadFresh("@/modules/documents/review");
    const result = await reviewModule.listPaginatedOrganizationWorkspaceDocuments({
      organizationId: "org-1",
      organizationSlug: "demo",
      page: 1,
      pageSize: 3,
      directionFilter: "all",
      sortOrder: "confidence_asc",
    });

    assert.deepEqual(result.items.map((item) => item.id), ["doc-1", "doc-3", "doc-2"]);
    assert.deepEqual(
      result.items.map((item) => item.certaintyConfidence),
      [50, 70, 90],
    );
  } finally {
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});
