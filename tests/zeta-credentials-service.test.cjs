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
    };

    return builder;
  }

  return {
    from(table) {
      return createBuilder(table);
    },
  };
}

const testKeyA = "a".repeat(64);
const testKeyB = "b".repeat(64);

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

function orgCredentials(overrides = {}) {
  return {
    EmpresaCodigo: "RONTIL",
    EmpresaClave: "empresa-secret",
    UsuarioCodigo: "42",
    RolCodigo: "7",
    ...overrides,
  };
}

function integratorEnv(overrides = {}) {
  return {
    ZETASOFTWARE_BASE_URL: "https://zeta.example.test",
    ZETASOFTWARE_DESARROLLADOR_CODIGO: "dev-code",
    ZETASOFTWARE_DESARROLLADOR_CLAVE: "dev-secret",
    ...overrides,
  };
}

test("Zeta credential encryption and decryption are inverse operations", async () => {
  const {
    decryptCredentials,
    encryptCredentials,
  } = require("@/modules/integrations/zeta/services/credentials-service");

  await withEnv({
    INTEGRATION_CREDENTIALS_ENCRYPTION_KEY: testKeyA,
  }, () => {
    const encrypted = encryptCredentials(orgCredentials());
    const decrypted = decryptCredentials(encrypted);

    assert.notEqual(encrypted, JSON.stringify(orgCredentials()));
    assert.deepEqual(decrypted, orgCredentials());
  });
});

test("Zeta credential decryption rejects corrupt payloads", async () => {
  const {
    decryptCredentials,
  } = require("@/modules/integrations/zeta/services/credentials-service");

  await withEnv({
    INTEGRATION_CREDENTIALS_ENCRYPTION_KEY: testKeyA,
  }, () => {
    assert.throws(
      () => decryptCredentials("not-base64"),
      /No se pudieron descifrar/,
    );
  });
});

test("Zeta credential decryption rejects the wrong encryption key", async () => {
  const {
    decryptCredentials,
    encryptCredentials,
  } = require("@/modules/integrations/zeta/services/credentials-service");
  let encrypted;

  await withEnv({
    INTEGRATION_CREDENTIALS_ENCRYPTION_KEY: testKeyA,
  }, () => {
    encrypted = encryptCredentials(orgCredentials());
  });

  await withEnv({
    INTEGRATION_CREDENTIALS_ENCRYPTION_KEY: testKeyB,
  }, () => {
    assert.throws(
      () => decryptCredentials(encrypted),
      /No se pudieron descifrar/,
    );
  });
});

test("Zeta credential fingerprints are deterministic and change with credentials", () => {
  const {
    fingerprintCredentials,
  } = require("@/modules/integrations/zeta/services/credentials-service");

  assert.equal(
    fingerprintCredentials(orgCredentials()),
    fingerprintCredentials(orgCredentials()),
  );
  assert.notEqual(
    fingerprintCredentials(orgCredentials()),
    fingerprintCredentials(orgCredentials({ EmpresaClave: "other-secret" })),
  );
});

test("Zeta org credentials load from flat environment variables", async () => {
  const {
    loadOrgCredsFromEnv,
  } = require("@/modules/integrations/zeta/services/credentials-service");

  await withEnv({
    ZETASOFTWARE_EMPRESA_CODIGO: "ENVCO",
    ZETASOFTWARE_EMPRESA_CLAVE: "env-secret",
    ZETASOFTWARE_USUARIOCODIGO: "9",
    ZETASOFTWARE_ROLCODIGO: "3",
  }, () => {
    assert.deepEqual(loadOrgCredsFromEnv(), {
      EmpresaCodigo: "ENVCO",
      EmpresaClave: "env-secret",
      UsuarioCodigo: "9",
      RolCodigo: "3",
    });
  });
});

test("Zeta org credentials prefer profile env vars and fall back to flat env vars", async () => {
  const {
    loadOrgCredsFromEnv,
  } = require("@/modules/integrations/zeta/services/credentials-service");

  await withEnv({
    ZETASOFTWARE_EMPRESA_CODIGO: "FALLBACK",
    ZETASOFTWARE_EMPRESA_CLAVE: "fallback-secret",
    ZETASOFTWARE_USUARIOCODIGO: "4",
    ZETASOFTWARE_ROLCODIGO: "2",
    ZETASOFTWARE_RONTIL_EMPRESA_CODIGO: "RONTIL",
    ZETASOFTWARE_RONTIL_EMPRESA_CLAVE: "profile-secret",
  }, () => {
    assert.deepEqual(loadOrgCredsFromEnv("RONTIL"), {
      EmpresaCodigo: "RONTIL",
      EmpresaClave: "profile-secret",
      UsuarioCodigo: "4",
      RolCodigo: "2",
    });
  });
});

test("buildZetaConnection decrypts DB credentials and combines integrator env credentials", async () => {
  const {
    buildZetaConnection,
  } = require("@/modules/integrations/zeta/client/auth");
  const {
    encryptCredentials,
  } = require("@/modules/integrations/zeta/services/credentials-service");
  let encrypted;

  await withEnv({
    ...integratorEnv(),
    INTEGRATION_CREDENTIALS_ENCRYPTION_KEY: testKeyA,
  }, () => {
    encrypted = encryptCredentials(orgCredentials());
  });

  await withEnv({
    ...integratorEnv(),
    INTEGRATION_CREDENTIALS_ENCRYPTION_KEY: testKeyA,
  }, async () => {
    const supabase = createSupabaseStub((query) => {
      assert.equal(query.table, "organization_integration_connections");

      return {
        data: {
          id: "conn-1",
          status: "connected",
          test_mode: false,
          config_json: {
            credential_source: "db_encrypted",
            base_url: "https://zeta.example.test",
            mock_enabled: false,
          },
          encrypted_credentials: encrypted,
        },
        error: null,
      };
    });
    const runtime = await buildZetaConnection({
      supabase,
      organizationId: "org-1",
    });

    assert.equal(runtime.baseUrl, "https://zeta.example.test");
    assert.equal(runtime.credentials.DesarrolladorCodigo, "dev-code");
    assert.equal(runtime.credentials.EmpresaCodigo, "RONTIL");
    assert.equal(runtime.credentials.UsuarioCodigo, 42);
    assert.equal(runtime.credentials.UsuarioClave, "");
    assert.equal(runtime.credentials.RolCodigo, 7);
    assert.equal(runtime.metadata.credentialSource, "db_encrypted");
  });
});

test("buildZetaConnection can load org credentials from server env fallback", async () => {
  const {
    buildZetaConnection,
  } = require("@/modules/integrations/zeta/client/auth");

  await withEnv({
    ...integratorEnv(),
    ZETASOFTWARE_EMPRESA_CODIGO: "ENVCO",
    ZETASOFTWARE_EMPRESA_CLAVE: "env-secret",
    ZETASOFTWARE_USUARIOCODIGO: "8",
    ZETASOFTWARE_ROLCODIGO: "4",
  }, async () => {
    const supabase = createSupabaseStub(() => ({
      data: {
        id: "conn-1",
        status: "connected",
        test_mode: false,
        config_json: {
          credential_source: "server_env",
          base_url: "https://zeta.example.test",
          mock_enabled: false,
        },
        encrypted_credentials: null,
      },
      error: null,
    }));
    const runtime = await buildZetaConnection({
      supabase,
      organizationId: "org-1",
    });

    assert.equal(runtime.credentials.EmpresaCodigo, "ENVCO");
    assert.equal(runtime.credentials.UsuarioCodigo, 8);
    assert.equal(runtime.credentials.UsuarioClave, "");
    assert.equal(runtime.metadata.credentialSource, "server_env");
  });
});

test("buildZetaConnection global mock mode does not touch DB or real credentials", async () => {
  const {
    buildZetaConnection,
  } = require("@/modules/integrations/zeta/client/auth");
  const supabase = createSupabaseStub(() => {
    throw new Error("DB should not be touched in global Zeta mock mode.");
  });

  await withEnv({
    ZETA_INTEGRATION_MOCK: "1",
    ZETASOFTWARE_DESARROLLADOR_CLAVE: "must-not-be-read",
    ZETASOFTWARE_EMPRESA_CLAVE: "must-not-be-read",
  }, async () => {
    const runtime = await buildZetaConnection({
      supabase,
      organizationId: "org-1",
    });

    assert.equal(runtime.metadata.credentialSource, "mock");
    assert.equal(runtime.credentials.EmpresaClave, "mock");
  });
});

test("buildZetaConnection errors do not leak Zeta secrets", async () => {
  const {
    buildZetaConnection,
  } = require("@/modules/integrations/zeta/client/auth");

  await withEnv({
    ...integratorEnv({
      ZETASOFTWARE_DESARROLLADOR_CLAVE: "super-dev-secret",
    }),
    INTEGRATION_CREDENTIALS_ENCRYPTION_KEY: testKeyA,
  }, async () => {
    const supabase = createSupabaseStub(() => ({
      data: {
        id: "conn-1",
        status: "connected",
        test_mode: false,
        config_json: {
          credential_source: "db_encrypted",
          base_url: "https://zeta.example.test",
          mock_enabled: false,
        },
        encrypted_credentials: "corrupt",
      },
      error: null,
    }));

    await assert.rejects(
      () => buildZetaConnection({
        supabase,
        organizationId: "org-1",
      }),
      (error) => {
        assert.doesNotMatch(error.message, /super-dev-secret|empresa-secret|corrupt/);
        return true;
      },
    );
  });
});
