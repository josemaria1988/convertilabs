/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const policy = require("@/lib/llm/provider-policy");
const api = require("@/lib/llm/openai-responses");

async function withEnv(values, fn) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === null) delete process.env[key]; else process.env[key] = value;
    }
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test("local provider prevents uploads, inference, polling, batches and cleanup reaching the paid API", async () => {
  await withEnv({ CONVERTILABS_PROCESSING_PROVIDER: "codex_local", OPENAI_API_KEY: "test-must-never-be-used" }, async () => {
    const originalFetch = global.fetch;
    let requests = 0;
    global.fetch = async () => { requests++; throw new Error("Unexpected paid network request"); };
    const input = { schemaName: "test", schema: { type: "object", properties: {} }, systemPrompt: "test", userPrompt: "test" };
    try {
      const actions = [
        () => api.uploadOpenAIUserDataFile({ bytes: new Uint8Array([1]), mimeType: "image/png", filename: "test.png" }),
        () => api.createStructuredOpenAIResponse(input),
        () => api.createBackgroundStructuredOpenAIResponse(input),
        () => api.retrieveOpenAIResponse("response-test"),
        () => api.createOpenAIBatchPipelineRun({ inputFileId: "file-test" }),
        () => api.retrieveOpenAIBatchPipelineRun("batch-test"),
        () => api.deleteOpenAIFile("file-test"),
      ];
      for (const action of actions) await assert.rejects(action, (error) => error.code === "paid_ai_disabled");
      assert.equal(requests, 0);
    } finally { global.fetch = originalFetch; }
  });
});

test("local no-paid policy survives asynchronous work without blocking concurrent explicit API work", async () => {
  await withEnv({ CONVERTILABS_PROCESSING_PROVIDER: "openai", CONVERTILABS_DISABLE_PAID_AI: null }, async () => {
    const [local, apiAllowed] = await Promise.all([
      policy.withPaidAIDisabled(async () => { await Promise.resolve(); return policy.isPaidAIAllowed(); }),
      Promise.resolve().then(() => policy.isPaidAIAllowed()),
    ]);
    assert.equal(local, false);
    assert.equal(apiAllowed, true);
    assert.equal(policy.isPaidAIAllowed(), true);
  });
});

test("cloud review checks tenant-scoped document provider and fails closed on read errors", async () => {
  await withEnv({ CONVERTILABS_PROCESSING_PROVIDER: "openai", CONVERTILABS_DISABLE_PAID_AI: null }, async () => {
    function db(result) {
      const filters = [];
      const query = { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
        async maybeSingle() { assert.deepEqual(filters, [["organization_id", "org"], ["id", "doc"]]); return result; } };
      return { from(name) { assert.equal(name, "documents"); return query; } };
    }
    assert.equal(await policy.isPaidAIAllowedForDocument(db({ data: { metadata: { processing_provider: "codex_local" } } }), "org", "doc"), false);
    assert.equal(await policy.isPaidAIAllowedForDocument(db({ data: null, error: { message: "offline" } }), "org", "doc"), false);
    assert.equal(await policy.isPaidAIAllowedForDocument(db({ data: { metadata: {} } }), "org", "doc"), true);
  });
});

test("invalid provider configuration cannot fall back to paid inference", async () => {
  for (const provider of ["codex_typo", "", " \r\n", "codex_local\r\n"]) {
    await withEnv({ CONVERTILABS_PROCESSING_PROVIDER: provider, CONVERTILABS_DISABLE_PAID_AI: null }, async () => {
      assert.throws(() => policy.assertPaidAIAllowed(), (error) => error.code === "paid_ai_disabled");
    });
  }
});

test("paid API disable flag accepts CRLF and spaces even for an explicit API provider", async () => {
  const originalFetch = global.fetch;
  let requests = 0;
  global.fetch = async () => { requests++; throw new Error("Unexpected paid network request"); };
  try {
    for (const disabled of ["true\r\n", " true ", "1\r\n", " 1 "]) {
      await withEnv({ CONVERTILABS_PROCESSING_PROVIDER: "openai\r\n", CONVERTILABS_DISABLE_PAID_AI: disabled }, async () => {
        assert.equal(policy.isPaidAIAllowed(), false);
        await assert.rejects(() => api.retrieveOpenAIResponse("response-test"), (error) => error.code === "paid_ai_disabled");
      });
    }
    assert.equal(requests, 0);
  } finally {
    global.fetch = originalFetch;
  }
});
