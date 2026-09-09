/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function createSupabaseStub(resolver) {
  function createBuilder(table) {
    const state = {
      table,
      mutation: null,
      payload: null,
      options: null,
      selectClause: null,
      filters: [],
      limitCount: null,
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
        state.filters.push({ column, value });
        return builder;
      },
      limit(value) {
        state.limitCount = value;
        return builder;
      },
      order() {
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
      upsert(payload, options) {
        state.mutation = "upsert";
        state.payload = payload;
        state.options = options;
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

function zetaConnectionRow(overrides = {}) {
  return {
    id: "conn-1",
    organization_id: "org-1",
    provider: "zetasoftware",
    mode: "read_only",
    status: "connected",
    test_mode: true,
    config_json: {
      credential_source: "db_encrypted",
      mock_enabled: true,
      health_mode: "mock",
    },
    encrypted_credentials: "encrypted",
    credentials_fingerprint: "1234567890abcdef",
    credentials_last_rotated_at: "2026-04-19T12:00:00.000Z",
    last_connection_test_at: null,
    last_connection_test_ok: null,
    last_error: null,
    created_at: "2026-04-19T12:00:00.000Z",
    updated_at: "2026-04-19T12:00:00.000Z",
    ...overrides,
  };
}

function withEnv(values, fn) {
  const previous = {};

  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(values)) {
        if (previous[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous[key];
        }
      }
    });
}

test("Zeta connection save encrypts credentials and records audit without exposing secrets", async () => {
  const { saveZetaConnection } = require("@/modules/integrations/zeta/services/connection-service");
  const queries = [];
  let savedConnection = null;
  const supabase = createSupabaseStub((query) => {
    queries.push(query);

    if (query.table === "organization_integration_connections" && query.mode === "maybeSingle") {
      return {
        data: savedConnection,
        error: null,
      };
    }

    if (query.table === "organization_integration_connections" && query.mutation === "upsert") {
      assert.equal(query.options.onConflict, "organization_id,provider");
      assert.equal(query.payload.provider, "zetasoftware");
      assert.equal(query.payload.config_json.credential_source, "db_encrypted");
      assert.equal(query.payload.config_json.mock_enabled, true);
      assert.match(query.payload.encrypted_credentials, /^[A-Za-z0-9+/=]+$/);
      assert.match(query.payload.credentials_fingerprint, /^[a-f0-9]{16}$/);
      assert.doesNotMatch(query.payload.encrypted_credentials, /secret-zeta/);
      assert.doesNotMatch(JSON.stringify(query.payload.config_json), /secret-zeta|RONTIL|dev-secret/);

      savedConnection = zetaConnectionRow({
        mode: query.payload.mode,
        status: query.payload.status,
        test_mode: query.payload.test_mode,
        encrypted_credentials: query.payload.encrypted_credentials,
        credentials_fingerprint: query.payload.credentials_fingerprint,
        last_connection_test_at: query.payload.last_connection_test_at,
        last_connection_test_ok: query.payload.last_connection_test_ok,
        config_json: query.payload.config_json,
      });

      return {
        data: savedConnection,
        error: null,
      };
    }

    if (query.table === "audit_log") {
      assert.equal(query.payload.action, "zeta_connection_saved");
      assert.match(query.payload.after_json.credentials_preview, /Credenciales configuradas/);
      assert.doesNotMatch(JSON.stringify(query.payload), /secret-zeta/);
      assert.doesNotMatch(JSON.stringify(query.payload), /dev-secret/);

      return {
        data: null,
        error: null,
      };
    }

    throw new Error(`Unexpected query ${query.table}/${query.mode}/${query.mutation ?? "read"}`);
  });

  await withEnv({
    INTEGRATION_CREDENTIALS_ENCRYPTION_KEY: "c".repeat(64),
  }, async () => {
    const connection = await saveZetaConnection(supabase, {
      organizationId: "org-1",
      actorUserId: "user-1",
      companyCode: "RONTIL",
      companySecret: "secret-zeta",
      usuarioCodigo: "42",
      rolCodigo: "7",
      mockEnabled: true,
      isActive: true,
    });

    assert.equal(connection.status, "disconnected");
    assert.equal(connection.mockEnabled, true);
    assert.equal(connection.credentialSource, "db_encrypted");
    assert.equal(queries.filter((query) => query.table === "audit_log").length, 1);
  });
});

test("Zeta connection save preserves mappings but resets implicit write mode and health", async () => {
  const { saveZetaConnection } = require("@/modules/integrations/zeta/services/connection-service");
  let savedConnection = zetaConnectionRow({
    mode: "read_write",
    test_mode: false,
    config_json: {
      credential_source: "db_encrypted",
      mock_enabled: false,
      purchase_expense_export: {
        concepts: { default: "TELEF" },
      },
      keep_me: true,
    },
  });
  const supabase = createSupabaseStub((query) => {
    if (query.table === "organization_integration_connections" && query.mode === "maybeSingle") {
      return { data: savedConnection, error: null };
    }

    if (query.table === "organization_integration_connections" && query.mutation === "upsert") {
      assert.equal(query.payload.mode, "read_only");
      assert.equal(query.payload.status, "disconnected");
      assert.equal(query.payload.last_connection_test_at, null);
      assert.equal(query.payload.last_connection_test_ok, null);
      assert.equal(query.payload.config_json.keep_me, true);
      assert.equal(query.payload.config_json.purchase_expense_export.concepts.default, "TELEF");
      assert.equal(query.payload.encrypted_credentials, undefined);
      savedConnection = {
        ...savedConnection,
        mode: query.payload.mode,
        status: query.payload.status,
        test_mode: query.payload.test_mode,
        last_connection_test_at: query.payload.last_connection_test_at,
        last_connection_test_ok: query.payload.last_connection_test_ok,
        config_json: query.payload.config_json,
      };
      return { data: savedConnection, error: null };
    }

    if (query.table === "audit_log") {
      assert.equal(query.payload.metadata.write_enabled, false);
      return { data: null, error: null };
    }

    throw new Error(`Unexpected query ${query.table}/${query.mode}/${query.mutation ?? "read"}`);
  });

  const result = await saveZetaConnection(supabase, {
    organizationId: "org-1",
    actorUserId: "user-1",
    companyCode: "",
    companySecret: "",
    usuarioCodigo: "",
    rolCodigo: "",
    mockEnabled: false,
    isActive: true,
  });

  assert.equal(result.writeEnabled, false);
  assert.equal(result.mode, "read_only");
});

test("Zeta mock health check marks the connection as connected", async () => {
  const { testZetaConnection } = require("@/modules/integrations/zeta/services/connection-service");
  const supabase = createSupabaseStub((query) => {
    if (query.table === "organization_integration_connections" && query.mode === "maybeSingle") {
      return {
        data: zetaConnectionRow(),
        error: null,
      };
    }

    if (query.table === "organization_integration_connections" && query.mutation === "update") {
      assert.equal(query.payload.status, "connected");
      assert.equal(query.payload.last_connection_test_ok, true);
      assert.equal(query.payload.last_error, null);

      return {
        data: null,
        error: null,
      };
    }

    if (query.table === "audit_log") {
      assert.equal(query.payload.action, "zeta_connection_tested");
      assert.equal(query.payload.after_json.code, "zeta_mock_health_ok");

      return {
        data: null,
        error: null,
      };
    }

    throw new Error(`Unexpected query ${query.table}/${query.mode}/${query.mutation ?? "read"}`);
  });

  const result = await testZetaConnection(supabase, {
    organizationId: "org-1",
    actorUserId: "user-1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "connected");
});

test("real connection status reads the cache without altering credential health or calling HTTP", async () => {
  const { testZetaConnection } = require("@/modules/integrations/zeta/services/connection-service");
  const oldFetch = global.fetch;
  let httpCalls = 0;
  global.fetch = async () => { httpCalls++; throw new Error("Must not call Zeta"); };
  try {
    for (const scenario of ["complete", "pending", "unavailable"]) {
      const queries = [];
      const completed = { id: "daily-1", status: "completed", started_at: "2026-09-08T21:00:00.000Z",
        finished_at: "2026-09-08T21:05:00.000Z", summary_json: { schemaVersion: 1, reports: [] }, metadata_json: {} };
      const supabase = createSupabaseStub((query) => {
        queries.push(query);
        assert.equal(query.mutation, null);
        assert.ok(query.filters.some((filter) => filter.column === "organization_id" && filter.value === "org-1"));
        if (query.table === "organization_integration_connections") return { data: zetaConnectionRow({
          test_mode: false, config_json: { mock_enabled: false },
          last_connection_test_ok: true, last_connection_test_at: "2026-09-01T12:00:00.000Z",
        }), error: null };
        assert.equal(query.table, "integration_sync_runs");
        assert.ok(query.filters.some((filter) => filter.column === "stream" && filter.value === "zeta.daily_cache"));
        if (scenario === "unavailable") return { data: null, error: { code: "08006" } };
        return { data: query.mode === "maybeSingle" ? (scenario === "complete" ? completed : null)
          : scenario === "complete" ? [completed] : [], error: null };
      });
      const result = await testZetaConnection(supabase, { organizationId: "org-1", actorUserId: "user-1" }, {
        healthCheck: async () => { throw new Error("A manual cache read cannot run an injected live probe"); },
      });
      assert.equal(result.code, scenario === "complete" ? "zeta_cache_available" : scenario === "pending" ? "zeta_cache_pending" : "zeta_cache_unavailable");
      assert.equal(result.ok, scenario === "complete");
      assert.match(result.message, /18:00.*America\/Montevideo/);
      assert.equal(result.metadata.api_requests, 0);
      assert.equal(result.metadata.live_connection_tested, false);
      assert.ok(queries.every((query) => !query.mutation));
    }
    assert.equal(httpCalls, 0);
  } finally { global.fetch = oldFetch; }
});

test("direct real health without cache context defers to daily sync even with a fetch implementation", async () => {
  const { runZetaHealthCheck } = require("@/modules/integrations/zeta/services/zeta-health-service");
  let calls = 0;
  const result = await runZetaHealthCheck({
    isConfigured: true, isPaused: false, mockEnabled: false, requestedMode: "real",
    fetchImpl: async () => { calls++; throw new Error("Must not probe Zeta"); },
  });
  assert.equal(result.code, "zeta_daily_sync_required");
  assert.equal(result.metadata.live_connection_tested, false);
  assert.equal(calls, 0);
});
