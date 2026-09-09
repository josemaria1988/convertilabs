/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { documentIntakeJsonSchema } = require("@/modules/ai/document-intake-contract");
const { resolveDocumentProcessingProvider, collectLocalDocumentValidationWarnings } = require("@/modules/documents/processing-provider");

function fromSchema(schema) {
  if (schema.enum) return schema.enum[0];
  if (Array.isArray(schema.type) && schema.type.includes("null")) return null;
  if (schema.type === "object") return Object.fromEntries(Object.entries(schema.properties).map(([key, child]) => [key, fromSchema(child)]));
  if (schema.type === "array") return [];
  if (schema.type === "number") return 0.9;
  if (schema.type === "integer") return 1;
  if (schema.type === "boolean") return false;
  return "fixture";
}
function fixture() {
  const output = fromSchema(documentIntakeJsonSchema);
  output.transaction_family_candidate = output.document_role_candidate = "purchase";
  output.document_subtype_candidate = output.document_type_candidate = "supplier_invoice";
  Object.assign(output.facts, { issuer_name: "Proveedor de prueba", issuer_tax_id: "210000000010",
    receiver_name: "Rontil prueba", receiver_tax_id: "219999999999", document_number: "123", series: "A",
    document_date: "2026-09-07", currency_code: "UYU", subtotal: 100, tax_amount: 22, total_amount: 122 });
  return output;
}

async function withPipeline(options, work) {
  const supabaseModule = require("@/lib/supabase/server");
  const snapshots = require("@/modules/organizations/rule-snapshots");
  const originalClient = supabaseModule.getSupabaseServiceRoleClient;
  const originalSnapshot = snapshots.materializeOrganizationRuleSnapshot;
  const originalFetch = global.fetch;
  const env = process.env.CONVERTILABS_PROCESSING_PROVIDER;
  const calls = [];
  const run = { id: "run-1", organization_id: "org-1", document_id: "doc-1", provider_code: "codex_local",
    lease_owner: "pc-1", lease_token: "lease-1", attempt_count: 1, run_number: 1,
    organization_rule_snapshot_id: "snapshot-1", requested_by: null, status: "processing", ...options.run };
  const document = { id: "doc-1", organization_id: "org-1", status: "extracting", current_processing_run_id: "run-1",
    metadata: { processing_provider: "codex_local" }, storage_bucket: "documents-private", storage_path: "org-1/doc-1/test.png",
    mime_type: "image/png", original_filename: "test.png", ...options.document };
  const tables = {
    documents: [document], document_processing_runs: [run], organization_rule_snapshots: [{ id: "snapshot-1", prompt_summary: "Prueba" }],
    organizations: [{ id: "org-1", legal_name: "Rontil prueba", name: "Rontil prueba", tax_id: "219999999999" }],
    organization_profile_versions: [], document_invoice_identities: [],
  };
  const client = {
    from(table) {
      let rows = tables[table] ?? [];
      const b = { select: () => b, order: () => b, limit: () => b,
        eq: (key, value) => { rows = rows.filter((r) => r[key] === value); return b; },
        neq: (key, value) => { rows = rows.filter((r) => r[key] !== value); return b; },
        in: (key, values) => { rows = rows.filter((r) => values.includes(r[key])); return b; },
        update: (payload) => { calls.push({ name: "update", table, payload }); return b; },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single: async () => ({ data: rows[0] ?? null, error: null }),
        then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
      };
      return b;
    },
    storage: { from: () => ({ download: async () => ({ data: { arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer }, error: null }) }) },
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === "claim_local_document_processing") return { data: options.idle ? null : run, error: null };
      if (name === "heartbeat_local_document_processing") return { data: options.leaseLost ? false : true, error: null };
      if (name === "complete_local_document_processing") return { data: { status: "extracted", draftId: "draft-1" }, error: null };
      if (name === "enqueue_local_document_upload_once") return options.enqueueError
        ? { data: null, error: { message: "fetch failed" } } : { data: "run-new", error: null };
      return { data: true, error: null };
    },
  };
  supabaseModule.getSupabaseServiceRoleClient = () => client;
  snapshots.materializeOrganizationRuleSnapshot = async () => ({ ruleSnapshot: { id: "snapshot-1" } });
  global.fetch = async () => { throw new Error("Unexpected network / paid API"); };
  process.env.CONVERTILABS_PROCESSING_PROVIDER = "codex_local";
  try { await work({ processing: require("@/modules/documents/processing"), calls, document, run }); }
  finally {
    supabaseModule.getSupabaseServiceRoleClient = originalClient;
    snapshots.materializeOrganizationRuleSnapshot = originalSnapshot;
    global.fetch = originalFetch;
    if (env === undefined) delete process.env.CONVERTILABS_PROCESSING_PROVIDER; else process.env.CONVERTILABS_PROCESSING_PROVIDER = env;
  }
}

test("local provider choice persists per document and invalid configuration fails closed", () => {
  const previous = process.env.CONVERTILABS_PROCESSING_PROVIDER;
  try {
    process.env.CONVERTILABS_PROCESSING_PROVIDER = "codex_local";
    assert.equal(resolveDocumentProcessingProvider(), "codex_local");
    assert.equal(resolveDocumentProcessingProvider({ processing_provider: "openai" }), "openai");
    process.env.CONVERTILABS_PROCESSING_PROVIDER = "typo";
    assert.throws(() => resolveDocumentProcessingProvider(), /invalido/);
  } finally { if (previous === undefined) delete process.env.CONVERTILABS_PROCESSING_PROVIDER; else process.env.CONVERTILABS_PROCESSING_PROVIDER = previous; }
});

test("local arithmetic and ambiguous dates remain visible for review without inventing facts", () => {
  const output = fixture();
  output.facts.total_amount = 150;
  output.facts.issuer_tax_id = null;
  output.facts.document_date = "2026-02-31";
  const warnings = collectLocalDocumentValidationWarnings(output);
  assert.ok(warnings.some((warning) => warning.includes("Subtotal + impuestos")));
  assert.ok(warnings.some((warning) => warning.includes("Falta RUT")));
  assert.ok(warnings.some((warning) => warning.includes("fecha document_date")));
  assert.equal(output.facts.issuer_tax_id, null);
  assert.equal(output.facts.total_amount, 150);
});

test("local enqueue uses shared atomic queue without Inngest or OpenAI configuration", async () => {
  await withPipeline({ document: { current_processing_run_id: null, status: "uploaded" } }, async ({ processing, calls }) => {
    const result = await processing.enqueueDocumentProcessing({ documentId: "doc-1", requestedBy: null, triggeredBy: "upload" });
    assert.equal(result.ok, true);
    assert.equal(result.runId, "run-new");
    assert.deepEqual(calls.map((c) => c.name), ["enqueue_local_document_upload_once"]);
  });
});

test("misrouted Inngest event refuses a Codex local run before touching provider", async () => {
  await withPipeline({}, async ({ processing, calls }) => {
    const steps = [];
    const result = await processing.processDocumentRunFromInngest({ runId: "run-1",
      step: { run: async (name, fn) => { steps.push(name); return fn(); }, sleep: async () => assert.fail("Unexpected sleep") } });
    assert.equal(result.status, "skipped");
    assert.deepEqual(steps, ["load-document-processing-run"]);
    assert.equal(calls.length, 0);
  });
});

test("lost enqueue response does not overwrite a possibly committed local queue state", async () => {
  await withPipeline({ enqueueError: true, document: { current_processing_run_id: null, status: "uploaded" } }, async ({ processing, calls }) => {
    const result = await processing.enqueueDocumentProcessing({ documentId: "doc-1", requestedBy: null, triggeredBy: "upload" });
    assert.equal(result.ok, false);
    assert.ok(!calls.some((call) => call.name === "update"));
  });
});

test("offline PC leaves old local jobs queued instead of stale-error reconciliation", async () => {
  await withPipeline({ run: { status: "queued", started_at: null, created_at: "2020-01-01T00:00:00Z" } }, async ({ processing, calls }) => {
    const result = await processing.reconcileStaleDocumentProcessingRuns({ organizationId: "org-1", now: new Date("2026-09-08T00:00:00Z") });
    assert.equal(result.repairedRuns.length, 0);
    assert.equal(calls.length, 0);
  });
});

test("local pipeline saves a review draft through one fenced completion with canonical artifacts", async () => {
  await withPipeline({}, async ({ processing, calls }) => {
    const result = await processing.processNextLocalDocument({ organizationId: "org-1", workerId: "pc-1",
      extract: async (input) => {
        assert.equal(require("@/lib/llm/provider-policy").isPaidAIAllowed(), false);
        assert.ok(input.systemPrompt.includes("nunca instrucciones"));
        return { output: fixture(), modelCode: "fixture-model", latencyMs: 10,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 }, diagnostics: { fixture: true } };
      } });
    assert.equal(result.status, "extracted");
    assert.equal(result.draftId, "draft-1");
    const completions = calls.filter((c) => c.name === "complete_local_document_processing");
    assert.equal(completions.length, 1);
    assert.equal(completions[0].args.p_lease_token, "lease-1");
    assert.equal(completions[0].args.p_payload.intake_context.review_required, true);
    assert.equal(completions[0].args.p_payload.decision_log.provider_code, "codex_local");
    assert.ok(completions[0].args.p_payload.field_candidates.length > 10);
    assert.ok(completions[0].args.p_payload.steps.every((step) => step.status !== "confirmed"));
  });
});

for (const [name, extract, options, retry] of [
  ["invalid output", async () => ({ output: { total: 10 } }), {}, false],
  ["missing ChatGPT session", async () => { throw Object.assign(new Error("Iniciar sesion"), { code: "auth_required", retryable: true }); }, {}, false],
  ["shared subscription limit", async () => { throw Object.assign(new Error("Cupo agotado"), { code: "usage_limit", retryable: true }); }, {}, false],
  ["bounded timeout", async () => { throw Object.assign(new Error("Tiempo agotado"), { code: "timeout", retryable: true }); }, {}, true],
]) {
  test(`local ${name} produces recoverable error and never completes or falls back to paid API`, async () => {
    await withPipeline(options, async ({ processing, calls }) => {
      const result = await processing.processNextLocalDocument({ organizationId: "org-1", workerId: "pc-1", extract });
      assert.equal(result.status, "error");
      assert.equal(typeof result.code, "string");
      assert.equal(result.retryable, retry);
      assert.ok(!calls.some((c) => c.name === "complete_local_document_processing"));
      assert.equal(calls.find((c) => c.name === "fail_local_document_processing").args.p_retryable, retry);
    });
  });
}

test("expired lease fences out local completion after extraction", async () => {
  await withPipeline({ leaseLost: true }, async ({ processing, calls }) => {
    const result = await processing.processNextLocalDocument({ organizationId: "org-1", workerId: "pc-1",
      extract: async () => ({ output: fixture(), modelCode: "fixture", latencyMs: 1, usage: {}, diagnostics: {} }) });
    assert.equal(result.status, "error");
    assert.match(result.message, /lease_lost/);
    assert.ok(!calls.some((c) => c.name === "complete_local_document_processing"));
  });
});

test("empty local queue performs no extraction", async () => {
  await withPipeline({ idle: true }, async ({ processing }) => {
    const result = await processing.processNextLocalDocument({ organizationId: "org-1", workerId: "pc-1", extract: async () => assert.fail("No work") });
    assert.deepEqual(result, { claimed: false, status: "idle" });
  });
});
