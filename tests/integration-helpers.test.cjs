/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function createSupabaseStub(resolver) {
  function createBuilder(table) {
    const state = {
      table,
      mutation: null,
      payload: null,
      options: null,
      filters: [],
      selectClause: null,
      limitCount: null,
    };

    const execute = (mode) => Promise.resolve(resolver({
      ...state,
      mode,
    }));

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
    };

    return builder;
  }

  return {
    from(table) {
      return createBuilder(table);
    },
  };
}

test("integration credentials fingerprint is stable and never exposes the secret", () => {
  const {
    fingerprintIntegrationCredentials,
    maskIntegrationCredentials,
  } = require("@/modules/integrations/credentials");
  const first = fingerprintIntegrationCredentials({
    EmpresaClave: "super-secret-value",
    EmpresaCodigo: "42",
    nested: { token: "abc123", label: "Rontil" },
  });
  const second = fingerprintIntegrationCredentials({
    nested: { label: "Rontil", token: "abc123" },
    EmpresaCodigo: "42",
    EmpresaClave: "super-secret-value",
  });
  const masked = maskIntegrationCredentials({
    EmpresaClave: "super-secret-value",
    EmpresaCodigo: "42",
    nested: { token: "abc123", label: "Rontil" },
  });

  assert.equal(first, second);
  assert.match(first, /^sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /super-secret-value/);
  assert.deepEqual(masked, {
    EmpresaClave: "su********ue",
    EmpresaCodigo: "42",
    nested: {
      token: "ab********23",
      label: "Rontil",
    },
  });
});

test("integration credentials encryption round-trips with an explicit test key", () => {
  const {
    decryptIntegrationCredentials,
    encryptIntegrationCredentials,
  } = require("@/modules/integrations/credentials");
  const credentials = {
    EmpresaCodigo: "42",
    EmpresaClave: "super-secret-value",
  };
  const encrypted = encryptIntegrationCredentials(credentials, "unit-test-key");
  const decrypted = decryptIntegrationCredentials(encrypted, "unit-test-key");

  assert.match(encrypted, /^v1:/);
  assert.doesNotMatch(encrypted, /super-secret-value/);
  assert.deepEqual(decrypted, credentials);
});

test("integration test run keys are deterministic when date and suffix are provided", () => {
  const {
    buildIntegrationTestRunKey,
    isValidIntegrationTestRunKey,
  } = require("@/modules/integrations/test-run-key");
  const key = buildIntegrationTestRunKey({
    provider: "zetasoftware",
    now: new Date("2026-04-19T13:45:00Z"),
    suffix: "abc123",
  });

  assert.equal(key, "CVTLAB-ZETA-TST-20260419-1345-ABC123");
  assert.equal(isValidIntegrationTestRunKey(key, "zeta-software"), true);
  assert.equal(isValidIntegrationTestRunKey("CVTLAB-ZETA-PRD-20260419-1345-ABC123", "zeta"), false);
});

test("integration raw record repository upserts deterministic hashes and monetary envelope", async () => {
  const {
    fingerprintIntegrationPayload,
    upsertIntegrationRawRecord,
  } = require("@/modules/integrations/repository");
  const payload = {
    total: 123,
    serie: "A",
  };
  const expectedHash = fingerprintIntegrationPayload(payload);
  const supabase = createSupabaseStub((query) => {
    assert.equal(query.table, "integration_raw_records");
    assert.equal(query.mutation, "upsert");
    assert.equal(query.options.onConflict, "organization_id,provider,entity_type,external_key");
    assert.equal(query.payload.payload_hash, expectedHash);
    assert.equal(query.payload.source_total_amount, 123);
    assert.equal(query.payload.source_exchange_rate_kind, "provider");
    assert.deepEqual(query.payload.source_monetary_json, { iva: 23 });

    return {
      data: {
        id: "raw-1",
        ...query.payload,
      },
      error: null,
    };
  });

  const row = await upsertIntegrationRawRecord(supabase, {
    organizationId: "org-1",
    provider: "zetasoftware",
    stream: "cfe",
    entityType: "document",
    externalKey: "A-123",
    payload,
    sourceTotalAmount: 123,
    sourceExchangeRateKind: "provider",
    sourceMonetary: { iva: 23 },
  });

  assert.equal(row.id, "raw-1");
  assert.equal(row.payload_hash, expectedHash);
});
