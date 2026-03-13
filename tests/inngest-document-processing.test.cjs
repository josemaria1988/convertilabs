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

test("inngest config treats INNGEST_DEV=1 as configured without cloud keys", async () => {
  await withEnv(
    {
      INNGEST_DEV: "1",
      INNGEST_EVENT_KEY: null,
      INNGEST_SIGNING_KEY: null,
      INNGEST_BASE_URL: null,
    },
    async () => {
      const env = loadFresh("@/lib/env");
      const status = env.getInngestConfigStatus();

      assert.equal(status.configured, true);
      assert.equal(status.isDev, true);
      assert.equal(status.eventKeyConfigured, false);
      assert.equal(status.signingKeyConfigured, false);
    },
  );
});

test("openai background adapter submits stored background responses and retrieves terminal payloads", async () => {
  await withEnv(
    {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_DOCUMENT_MODEL: "gpt-4o-mini",
    },
    async () => {
      const openAiModule = loadFresh("@/lib/llm/openai-responses");
      const originalFetch = global.fetch;
      const calls = [];

      global.fetch = async (url, options = {}) => {
        calls.push({ url, options });

        if (String(url).endsWith("/v1/responses") && options.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              id: "resp-bg-1",
              status: "queued",
            }),
          };
        }

        if (String(url).endsWith("/v1/responses/resp-bg-1") && options.method === "GET") {
          return {
            ok: true,
            json: async () => ({
              id: "resp-bg-1",
              status: "completed",
              output_text: JSON.stringify({
                hello: "world",
              }),
              usage: {
                input_tokens: 10,
                output_tokens: 5,
                total_tokens: 15,
              },
            }),
          };
        }

        throw new Error(`Unexpected fetch call: ${String(url)}`);
      };

      try {
        const created = await openAiModule.createBackgroundStructuredOpenAIResponse({
          schemaName: "test_schema",
          schema: {
            type: "object",
            properties: {
              hello: { type: "string" },
            },
            required: ["hello"],
            additionalProperties: false,
          },
          systemPrompt: "system",
          userPrompt: "user",
        });
        const retrieved = await openAiModule.retrieveOpenAIResponse("resp-bg-1");
        const extracted = openAiModule.extractStructuredOutputFromOpenAIResponse(
          retrieved.rawResponse,
        );

        assert.equal(created.responseId, "resp-bg-1");
        assert.equal(created.status, "queued");
        assert.equal(retrieved.status, "completed");
        assert.deepEqual(extracted.output, { hello: "world" });
        assert.equal(openAiModule.isOpenAIBackgroundResponsePending("queued"), true);
        assert.equal(openAiModule.isOpenAIBackgroundResponsePending("completed"), false);

        const requestBody = JSON.parse(calls[0].options.body);
        assert.equal(requestBody.background, true);
        assert.equal(requestBody.store, true);
      } finally {
        global.fetch = originalFetch;
      }
    },
  );
});

test("enqueueDocumentProcessing creates a queued run and sends the inngest event", async () => {
  await withEnv(
    {
      OPENAI_API_KEY: "test-openai-key",
      INNGEST_DEV: "1",
    },
    async () => {
      const supabaseModule = require("@/lib/supabase/server");
      const snapshotsModule = require("@/modules/organizations/rule-snapshots");
      const inngestClientModule = require("@/lib/inngest/client");
      const processingModule = require("@/modules/documents/processing");
      const originalGetClient = supabaseModule.getSupabaseServiceRoleClient;
      const originalMaterialize = snapshotsModule.materializeOrganizationRuleSnapshot;
      const originalSend = inngestClientModule.inngest.send;
      const sentEvents = [];
      const updates = [];
      const inserts = [];

      function createQueryBuilder(table) {
        const state = {
          insertPayload: null,
          updatePayload: null,
        };

        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          neq() {
            return builder;
          },
          order() {
            return builder;
          },
          limit() {
            return builder;
          },
          maybeSingle: async () => {
            if (table === "documents") {
              return {
                data: {
                  id: "doc-1",
                  organization_id: "org-1",
                  storage_bucket: "documents-private",
                  storage_path: "orgs/org-1/doc-1/test.pdf",
                  original_filename: "test.pdf",
                  mime_type: "application/pdf",
                  status: "uploaded",
                  metadata: {},
                  current_draft_id: null,
                  current_processing_run_id: null,
                  last_rule_snapshot_id: null,
                  last_processed_at: null,
                  created_at: "2026-03-13T00:00:00.000Z",
                  updated_at: "2026-03-13T00:00:00.000Z",
                },
                error: null,
              };
            }

            if (table === "document_processing_runs") {
              return {
                data: {
                  run_number: 0,
                },
                error: null,
              };
            }

            return { data: null, error: null };
          },
          insert(payload) {
            state.insertPayload = payload;
            inserts.push({ table, payload });
            return builder;
          },
          update(payload) {
            state.updatePayload = payload;
            updates.push({ table, payload });
            return builder;
          },
          single: async () => {
            if (table === "document_processing_runs") {
              return {
                data: {
                  id: "run-1",
                },
                error: null,
              };
            }

            return { data: null, error: null };
          },
        };

        return builder;
      }

      supabaseModule.getSupabaseServiceRoleClient = () => ({
        from(table) {
          return createQueryBuilder(table);
        },
      });
      snapshotsModule.materializeOrganizationRuleSnapshot = async () => ({
        profileVersion: {
          id: "profile-1",
          version_number: 1,
          effective_from: "2026-03-01",
          country_code: "UY",
          legal_entity_type: "SAS",
          tax_regime_code: "GENERAL",
          vat_regime: "GENERAL",
          dgi_group: "CEDE",
          cfe_status: "ELECTRONIC_ISSUER",
          tax_id: "21433455019",
        },
        ruleSnapshot: {
          id: "snapshot-1",
          version_number: 1,
          effective_from: "2026-03-01",
          prompt_summary: "snapshot",
          deterministic_rule_refs_json: [],
        },
      });
      inngestClientModule.inngest.send = async (event) => {
        sentEvents.push(event);
        return {
          ids: ["evt-1"],
        };
      };

      try {
        const result = await processingModule.enqueueDocumentProcessing({
          documentId: "doc-1",
          requestedBy: "user-1",
          triggeredBy: "upload",
        });

        assert.equal(result.ok, true);
        assert.equal(result.runId, "run-1");
        assert.equal(sentEvents.length, 1);
        assert.equal(sentEvents[0].name, "documents/process.requested");
        assert.equal(sentEvents[0].data.documentId, "doc-1");
        assert.equal(inserts.length, 1);
        assert.equal(updates.length, 1);
      } finally {
        supabaseModule.getSupabaseServiceRoleClient = originalGetClient;
        snapshotsModule.materializeOrganizationRuleSnapshot = originalMaterialize;
        inngestClientModule.inngest.send = originalSend;
      }
    },
  );
});
