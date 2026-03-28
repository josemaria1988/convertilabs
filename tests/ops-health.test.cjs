/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildLivenessPayload,
  buildReadinessPayload,
  getReadinessHttpStatus,
  summarizeReadinessStatus,
} = require("@/modules/ops/health");

test("liveness payload stays cheap and points to the readiness endpoint", () => {
  const payload = buildLivenessPayload({
    timestamp: "2026-03-27T00:00:00.000Z",
    build: {
      version: "0.1.0",
      commitSha: "abc123",
      buildTimestamp: null,
    },
    supabase: {
      publicClientConfigured: true,
      publishableKeyConfigured: true,
      databaseConfigured: true,
      directDatabaseConfigured: true,
      serviceRoleConfigured: true,
      jwtSecretConfigured: true,
    },
    openai: {
      configured: false,
      defaultModel: "gpt-4o",
      documentModel: "gpt-4o",
      rulesModel: "gpt-4o",
      accountingModel: "gpt-4o",
      documentModelConfigured: false,
      rulesModelConfigured: false,
      accountingModelConfigured: false,
      useMiniByDefault: false,
    },
    inngest: {
      configured: true,
      isDev: false,
      eventKeyConfigured: true,
      signingKeyConfigured: true,
      baseUrlConfigured: true,
    },
  });

  assert.equal(payload.mode, "liveness");
  assert.equal(payload.kind, "config");
  assert.equal(payload.status, "ok");
  assert.equal(payload.links.ready, "/api/ready");
  assert.equal(payload.services.openai.verification, "not_performed");
});

test("readiness becomes degraded when database is up but async automation deps are only configured partially", () => {
  const payload = buildReadinessPayload({
    timestamp: "2026-03-27T00:00:00.000Z",
    build: {
      version: "0.1.0",
      commitSha: "abc123",
      buildTimestamp: null,
    },
    supabase: {
      publicClientConfigured: true,
      publishableKeyConfigured: true,
      databaseConfigured: true,
      directDatabaseConfigured: true,
      serviceRoleConfigured: true,
      jwtSecretConfigured: true,
    },
    openai: {
      configured: false,
      defaultModel: "gpt-4o",
      documentModel: "gpt-4o",
      rulesModel: "gpt-4o",
      accountingModel: "gpt-4o",
      documentModelConfigured: false,
      rulesModelConfigured: false,
      accountingModelConfigured: false,
      useMiniByDefault: false,
    },
    inngest: {
      configured: true,
      isDev: false,
      eventKeyConfigured: true,
      signingKeyConfigured: true,
      baseUrlConfigured: true,
    },
    database: {
      status: "ok",
      required: true,
      checkedAt: "2026-03-27T00:00:00.000Z",
      latencyMs: 12,
      detail: "ok",
    },
  });

  assert.equal(payload.status, "degraded");
  assert.equal(payload.ready, true);
  assert.deepEqual(payload.summary.failed, []);
  assert.deepEqual(payload.summary.degraded, ["openai_not_configured"]);
  assert.equal(getReadinessHttpStatus(payload), 200);
});

test("readiness fails when the database probe is not healthy", () => {
  const summary = summarizeReadinessStatus({
    database: {
      status: "failed",
      required: true,
      checkedAt: "2026-03-27T00:00:00.000Z",
      latencyMs: null,
      detail: "connection refused",
    },
    openaiConfigured: true,
    inngestConfigured: true,
  });

  assert.equal(summary.status, "failed");
  assert.equal(summary.ready, false);
  assert.deepEqual(summary.failed, ["database_unavailable"]);
});
