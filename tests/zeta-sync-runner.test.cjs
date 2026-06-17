/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function withEnv(patch, fn) {
  const previous = new Map();

  for (const [key, value] of Object.entries(patch)) {
    previous.set(key, process.env[key]);

    if (value === null || value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous.entries()) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

function loadFresh(request) {
  const resolved = require.resolve(request);
  delete require.cache[resolved];
  return require(request);
}

function createSupabaseStub(resolver) {
  const calls = [];

  function createBuilder(table) {
    const state = {
      table,
      mutation: null,
      payload: null,
      options: null,
      filters: [],
      inFilters: [],
      orderCalls: [],
      selectClause: null,
      limitCount: null,
    };

    const snapshot = (mode) => ({
      ...state,
      filters: [...state.filters],
      inFilters: [...state.inFilters],
      orderCalls: [...state.orderCalls],
      mode,
    });
    const execute = (mode) => {
      const query = snapshot(mode);
      calls.push(query);
      return Promise.resolve(resolver(query));
    };

    const builder = {
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
      upsert(payload, options) {
        state.mutation = "upsert";
        state.payload = payload;
        state.options = options;
        return builder;
      },
      select(selectClause) {
        state.selectClause = selectClause;
        return builder;
      },
      eq(column, value) {
        state.filters.push({ column, value });
        return builder;
      },
      in(column, values) {
        state.inFilters.push({ column, values });
        return builder;
      },
      lt(column, value) {
        state.filters.push({ column, value, operator: "lt" });
        return builder;
      },
      order(column, options) {
        state.orderCalls.push({ column, options });
        return builder;
      },
      limit(value) {
        state.limitCount = value;
        return builder;
      },
      single() {
        return execute("single");
      },
      maybeSingle() {
        return execute("maybeSingle");
      },
      then(resolve, reject) {
        return execute("then").then(resolve, reject);
      },
    };

    return builder;
  }

  return {
    calls,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

function hasFilter(query, column, value) {
  return query.filters.some((filter) =>
    filter.column === column && filter.value === value);
}

function connectionRow() {
  return {
    id: "conn-1",
    status: "configured",
    test_mode: true,
    config_json: {
      mock_enabled: true,
    },
  };
}

function queuedRunRow(overrides = {}) {
  return {
    id: "run-1",
    organization_id: "org-1",
    connection_id: "conn-1",
    provider: "zetasoftware",
    stream: "masters",
    run_kind: "manual",
    status: "queued",
    test_mode: true,
    test_run_key: "CVTLAB-ZETA-TST-20260617-1200-ABC123",
    initiated_by_user_id: "user-1",
    input_json: {
      period: null,
      max_pages: 1,
    },
    ...overrides,
  };
}

test("Zeta sync enqueue creates a queued test run and sends the Inngest event", async () => {
  await withEnv({ INNGEST_DEV: "1" }, async () => {
    const sentEvents = [];
    const inserts = [];
    const inngestClientModule = require("@/lib/inngest/client");
    const originalSend = inngestClientModule.inngest.send;
    const { supabase } = createSupabaseStub((query) => {
      if (query.table === "integration_sync_runs" && query.mode === "maybeSingle") {
        return { data: null, error: null };
      }

      if (query.table === "organization_integration_connections" && query.mode === "maybeSingle") {
        return { data: connectionRow(), error: null };
      }

      if (query.table === "integration_sync_runs" && query.mutation === "insert") {
        inserts.push(query.payload);
        return {
          data: {
            id: "run-1",
            ...query.payload,
          },
          error: null,
        };
      }

      return { data: null, error: null };
    });

    inngestClientModule.inngest.send = async (event) => {
      sentEvents.push(event);
      return { ids: ["evt-1"] };
    };

    try {
      const { enqueueZetaSyncRun } = loadFresh("@/modules/integrations/zeta/sync/sync-runner");
      const result = await enqueueZetaSyncRun({
        supabase,
        organizationId: "org-1",
        actorUserId: "user-1",
        stream: "sales_documents",
        period: "2026-06",
        maxPages: 10,
        testRunKey: "CVTLAB-ZETA-TST-20260617-1200-ABC123",
      });

      assert.equal(result.enqueued, true);
      assert.equal(result.status, "queued");
      assert.equal(result.testRunKey, "CVTLAB-ZETA-TST-20260617-1200-ABC123");
      assert.equal(inserts.length, 1);
      assert.equal(inserts[0].status, "queued");
      assert.equal(inserts[0].test_mode, true);
      assert.equal(inserts[0].test_run_key, "CVTLAB-ZETA-TST-20260617-1200-ABC123");
      assert.equal(inserts[0].cleanup_status, undefined);
      assert.equal(sentEvents.length, 1);
      assert.equal(sentEvents[0].name, "integrations/zeta.sync.requested");
      assert.equal(sentEvents[0].data.runId, "run-1");
      assert.equal(sentEvents[0].data.stream, "sales_documents");
    } finally {
      inngestClientModule.inngest.send = originalSend;
    }
  });
});

test("Zeta sync enqueue returns the active run instead of duplicating the same stream", async () => {
  await withEnv({ INNGEST_DEV: "1" }, async () => {
    const sentEvents = [];
    const inserts = [];
    const inngestClientModule = require("@/lib/inngest/client");
    const originalSend = inngestClientModule.inngest.send;
    const { supabase } = createSupabaseStub((query) => {
      if (query.table === "integration_sync_runs" && query.mode === "maybeSingle") {
        return {
          data: queuedRunRow({
            id: "run-active",
            stream: "received_cfes",
            status: "running",
          }),
          error: null,
        };
      }

      if (query.table === "integration_sync_runs" && query.mutation === "insert") {
        inserts.push(query.payload);
      }

      return { data: null, error: null };
    });

    inngestClientModule.inngest.send = async (event) => {
      sentEvents.push(event);
      return { ids: ["evt-1"] };
    };

    try {
      const { enqueueZetaSyncRun } = loadFresh("@/modules/integrations/zeta/sync/sync-runner");
      const result = await enqueueZetaSyncRun({
        supabase,
        organizationId: "org-1",
        actorUserId: "user-1",
        stream: "received_cfes",
        period: "2026-06",
      });

      assert.equal(result.enqueued, false);
      assert.equal(result.runId, "run-active");
      assert.equal(result.status, "running");
      assert.equal(inserts.length, 0);
      assert.equal(sentEvents.length, 0);
    } finally {
      inngestClientModule.inngest.send = originalSend;
    }
  });
});

test("Queued Zeta sync run opens, writes cursor and closes read-only with cleanup not_required", async () => {
  await withEnv({ ZETA_INTEGRATION_MOCK: "1" }, async () => {
    const updates = [];
    const cursorUpserts = [];
    const { supabase } = createSupabaseStub((query) => {
      if (query.table === "integration_sync_runs" && query.mode === "maybeSingle" && hasFilter(query, "id", "run-1")) {
        return { data: queuedRunRow(), error: null };
      }

      if (query.table === "integration_sync_cursors" && query.mode === "maybeSingle") {
        return { data: null, error: null };
      }

      if (query.table === "organization_integration_connections" && query.mode === "maybeSingle") {
        return { data: connectionRow(), error: null };
      }

      if (query.table === "integration_sync_runs" && query.mutation === "update" && query.mode === "single") {
        updates.push(query.payload);
        return {
          data: {
            id: "run-1",
            ...query.payload,
          },
          error: null,
        };
      }

      if (query.table === "integration_sync_cursors" && query.mutation === "upsert") {
        cursorUpserts.push(query.payload);
        return {
          data: {
            id: "cursor-1",
            ...query.payload,
          },
          error: null,
        };
      }

      return { data: null, error: null };
    });
    const { runQueuedZetaSyncRun } = loadFresh("@/modules/integrations/zeta/sync/sync-runner");

    const result = await runQueuedZetaSyncRun({
      supabase,
      organizationId: "org-1",
      runId: "run-1",
    });

    assert.equal(result.runId, "run-1");
    assert.equal(result.recordsSeen, 0);
    assert.equal(result.recordsUpserted, 0);
    assert.equal(result.testRunKey, "CVTLAB-ZETA-TST-20260617-1200-ABC123");
    assert.equal(updates.some((payload) => payload.status === "running"), true);
    const finished = updates.find((payload) => payload.status === "completed");
    assert.ok(finished);
    assert.equal(finished.cleanup_status, "not_required");
    assert.equal(finished.summary_json.test_run_key, "CVTLAB-ZETA-TST-20260617-1200-ABC123");
    assert.equal(cursorUpserts.length, 1);
    assert.equal(cursorUpserts[0].cursor_key, "masters");
    assert.equal(cursorUpserts[0].last_success_run_id, "run-1");
  });
});

test("Queued Zeta sync run closes failed and records audit when the provider call fails", async () => {
  await withEnv({ ZETA_INTEGRATION_MOCK: "1" }, async () => {
    const updates = [];
    const auditActions = [];
    const { supabase } = createSupabaseStub((query) => {
      if (query.table === "integration_sync_runs" && query.mode === "maybeSingle" && hasFilter(query, "id", "run-1")) {
        return { data: queuedRunRow(), error: null };
      }

      if (query.table === "integration_sync_cursors" && query.mode === "maybeSingle") {
        return { data: null, error: null };
      }

      if (query.table === "organization_integration_connections" && query.mode === "maybeSingle") {
        return { data: connectionRow(), error: null };
      }

      if (query.table === "integration_sync_runs" && query.mutation === "update" && query.mode === "single") {
        updates.push(query.payload);
        return {
          data: {
            id: "run-1",
            ...query.payload,
          },
          error: null,
        };
      }

      if (query.table === "audit_log" && query.mutation === "insert") {
        auditActions.push(query.payload.action);
      }

      return { data: null, error: null };
    });
    const { runQueuedZetaSyncRun } = loadFresh("@/modules/integrations/zeta/sync/sync-runner");

    await assert.rejects(
      () => runQueuedZetaSyncRun({
        supabase,
        organizationId: "org-1",
        runId: "run-1",
        fetchImpl: async () => ({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          json: async () => ({}),
        }),
      }),
      /HTTP 503/,
    );

    const failed = updates.find((payload) => payload.status === "failed");
    assert.ok(failed);
    assert.equal(failed.error_code, "zeta_sync_failed");
    assert.equal(failed.records_failed, 1);
    assert.equal(failed.cleanup_status, "not_required");
    assert.equal(auditActions.includes("zeta_sync_failed"), true);
  });
});
