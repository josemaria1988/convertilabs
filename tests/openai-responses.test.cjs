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

test("openai model config defaults to gpt-4o and can switch to mini by feature flag", async () => {
  await withEnv(
    {
      OPENAI_PRIMARY_MODEL: null,
      OPENAI_MINI_MODEL: null,
      OPENAI_USE_MINI_BY_DEFAULT: null,
      OPENAI_DOCUMENT_MODEL: null,
      OPENAI_RULES_MODEL: null,
      OPENAI_ACCOUNTING_MODEL: null,
    },
    async () => {
      const env = loadFresh("@/lib/env");
      const defaults = env.getOpenAIModelConfig();

      assert.equal(defaults.openAiDefaultModel, "gpt-4o");
      assert.equal(defaults.openAiDocumentModel, "gpt-4o");
    },
  );

  await withEnv(
    {
      OPENAI_USE_MINI_BY_DEFAULT: "true",
      OPENAI_DOCUMENT_MODEL: null,
      OPENAI_RULES_MODEL: null,
      OPENAI_ACCOUNTING_MODEL: null,
    },
    async () => {
      const env = loadFresh("@/lib/env");
      const config = env.getOpenAIModelConfig();

      assert.equal(config.openAiDefaultModel, "gpt-4o-mini");
      assert.equal(config.openAiAccountingModel, "gpt-4o-mini");
    },
  );
});

test("structured OpenAI pipeline runs keep sync trace, retries transient failures, and support file or batch helpers", async () => {
  await withEnv(
    {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_HTTP_RETRY_DELAY_MS: "0",
      OPENAI_HTTP_MAX_RETRIES: "2",
      OPENAI_USAGE_COST_INPUT_USD_PER_1M: "2.5",
      OPENAI_USAGE_COST_OUTPUT_USD_PER_1M: "10",
      OPENAI_DOCUMENT_MODEL: null,
      OPENAI_PRIMARY_MODEL: "gpt-4o",
    },
    async () => {
      const openAiModule = loadFresh("@/lib/llm/openai-responses");
      const originalFetch = global.fetch;
      const calls = [];
      let responsesPostCount = 0;

      global.fetch = async (url, options = {}) => {
        calls.push({ url, options });

        if (String(url).endsWith("/v1/files")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: "file-1",
            }),
          };
        }

        if (String(url).endsWith("/v1/batches")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: "batch-1",
              status: "validating",
            }),
          };
        }

        if (String(url).endsWith("/v1/responses") && options.method === "POST") {
          responsesPostCount += 1;

          if (responsesPostCount === 1) {
            return {
              ok: false,
              status: 429,
              json: async () => ({
                error: {
                  message: "rate limit",
                },
              }),
            };
          }

          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: "resp-1",
              status: "completed",
              output_text: JSON.stringify({
                hello: "world",
              }),
              usage: {
                input_tokens: 1000,
                output_tokens: 100,
                total_tokens: 1100,
              },
            }),
          };
        }

        throw new Error(`Unexpected fetch call: ${String(url)}`);
      };

      try {
        const syncRun = await openAiModule.createStructuredOpenAIPipelineRun({
          mode: "sync",
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
          metadata: {
            prompt_version: "v2",
          },
        });
        const uploadedFile = await openAiModule.uploadOpenAIBatchFile({
          filename: "batch.jsonl",
          mimeType: "application/jsonl",
          bytes: new Uint8Array([1, 2, 3]),
        });
        const batchRun = await openAiModule.createOpenAIBatchPipelineRun({
          inputFileId: uploadedFile.fileId,
          metadata: {
            job_type: "document_backfill",
          },
        });

        assert.equal(syncRun.mode, "sync");
        assert.equal(syncRun.modelCode, "gpt-4o");
        assert.deepEqual(syncRun.output, { hello: "world" });
        assert.equal(syncRun.responseId, "resp-1");
        assert.equal(syncRun.requestPayload.metadata.prompt_version, "v2");
        assert.equal(syncRun.usage.estimatedCostUsd, 0.0035);
        assert.equal(responsesPostCount, 2);
        assert.equal(uploadedFile.fileId, "file-1");
        assert.equal(batchRun.batchId, "batch-1");
        assert.equal(batchRun.mode, "batch");

        const fileBody = calls.find((call) => String(call.url).endsWith("/v1/files")).options.body;
        assert.equal(fileBody.get("purpose"), "batch");

        const batchBody = JSON.parse(
          calls.find((call) => String(call.url).endsWith("/v1/batches")).options.body,
        );
        assert.equal(batchBody.input_file_id, "file-1");
        assert.equal(batchBody.endpoint, "/v1/responses");
        assert.equal(batchBody.metadata.job_type, "document_backfill");
      } finally {
        global.fetch = originalFetch;
      }
    },
  );
});
