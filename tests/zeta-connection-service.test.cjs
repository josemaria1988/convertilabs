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
        encrypted_credentials: query.payload.encrypted_credentials,
        credentials_fingerprint: query.payload.credentials_fingerprint,
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

    assert.equal(connection.status, "connected");
    assert.equal(connection.mockEnabled, true);
    assert.equal(connection.credentialSource, "db_encrypted");
    assert.equal(queries.filter((query) => query.table === "audit_log").length, 1);
  });
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

test("Zeta real health reports missing runtime configuration before calling the API", async () => {
  const { testZetaConnection } = require("@/modules/integrations/zeta/services/connection-service");
  const supabase = createSupabaseStub((query) => {
    if (query.table === "organization_integration_connections" && query.mode === "maybeSingle") {
      return {
        data: zetaConnectionRow({
          test_mode: false,
          config_json: {
            credential_source: "server_env",
            mock_enabled: false,
            health_mode: "real",
          },
          encrypted_credentials: null,
          credentials_fingerprint: null,
        }),
        error: null,
      };
    }

    if (query.table === "organization_integration_connections" && query.mutation === "update") {
      assert.equal(query.payload.status, "error");
      assert.equal(query.payload.last_connection_test_ok, false);
      assert.match(query.payload.last_error, /Faltan|Falta|UsuarioCodigo/);

      return {
        data: null,
        error: null,
      };
    }

    if (query.table === "audit_log") {
      assert.equal(query.payload.action, "zeta_connection_tested");
      assert.match(query.payload.after_json.code, /zeta_(integrator_credentials|base_url|credentials)_missing/);

      return {
        data: null,
        error: null,
      };
    }

    throw new Error(`Unexpected query ${query.table}/${query.mode}/${query.mutation ?? "read"}`);
  });

  const result = await withEnv({
    ZETASOFTWARE_BASE_URL: undefined,
    ZETASOFTWARE_DESARROLLADOR_CODIGO: undefined,
    ZETASOFTWARE_DESARROLLADOR_CLAVE: undefined,
    ZETASOFTWARE_EMPRESA_CODIGO: undefined,
    ZETASOFTWARE_EMPRESA_CLAVE: undefined,
    ZETASOFTWARE_USUARIOCODIGO: undefined,
    ZETASOFTWARE_USUARIOCLAVE: undefined,
    ZETASOFTWARE_USUARIO_CLAVE: undefined,
    ZETASOFTWARE_ROLCODIGO: undefined,
  }, () => testZetaConnection(supabase, {
    organizationId: "org-1",
    actorUserId: "user-1",
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, "error");
  assert.match(result.code, /zeta_(integrator_credentials|base_url|credentials)_missing/);
});

test("Zeta real health result can mark connection as connected", async () => {
  const { testZetaConnection } = require("@/modules/integrations/zeta/services/connection-service");
  const supabase = createSupabaseStub((query) => {
    if (query.table === "organization_integration_connections" && query.mode === "maybeSingle") {
      return {
        data: zetaConnectionRow({
          test_mode: false,
          config_json: {
            credential_source: "server_env",
            base_url: "https://zeta.example.test",
            mock_enabled: false,
            health_mode: "real",
          },
          encrypted_credentials: null,
          credentials_fingerprint: null,
        }),
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
      assert.equal(query.payload.after_json.code, "zeta_real_health_ok");
      assert.equal(query.payload.metadata.endpoint, "RESTUsuariosEmpresaV1Query");

      return {
        data: null,
        error: null,
      };
    }

    throw new Error(`Unexpected query ${query.table}/${query.mode}/${query.mutation ?? "read"}`);
  });

  const result = await withEnv({
    ZETASOFTWARE_DESARROLLADOR_CODIGO: "dev-code",
    ZETASOFTWARE_DESARROLLADOR_CLAVE: "dev-secret",
    ZETASOFTWARE_EMPRESA_CODIGO: "RONTIL",
    ZETASOFTWARE_EMPRESA_CLAVE: "empresa-secret",
    ZETASOFTWARE_USUARIOCODIGO: "42",
    ZETASOFTWARE_ROLCODIGO: "7",
  }, () => testZetaConnection(
      supabase,
      {
        organizationId: "org-1",
        actorUserId: "user-1",
      },
      {
        healthCheck: async () => ({
        ok: true,
        status: "connected",
        code: "zeta_real_health_ok",
        message: "Conexion Zetasoftware validada con RESTUsuariosEmpresaV1Query.",
        checkedAt: "2026-04-19T12:30:00.000Z",
        metadata: {
          health_mode: "real",
          contract_status: "confirmed_pr_01",
          endpoint: "RESTUsuariosEmpresaV1Query",
        },
        }),
      },
    ));

  assert.equal(result.ok, true);
  assert.equal(result.status, "connected");
});
