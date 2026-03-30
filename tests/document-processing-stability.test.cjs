/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function loadFresh(request) {
  const resolved = require.resolve(request);
  delete require.cache[resolved];
  return require(request);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createMutableSupabaseStub(seedTables) {
  const tables = Object.fromEntries(
    Object.entries(seedTables).map(([table, rows]) => [table, clone(rows)]),
  );

  function matchesFilters(row, filters) {
    return filters.every((filter) => {
      if (filter.type === "eq") {
        return row[filter.column] === filter.value;
      }

      if (filter.type === "in") {
        return filter.value.includes(row[filter.column]);
      }

      return true;
    });
  }

  function execute(state) {
    const sourceRows = tables[state.table] ?? [];
    const matchedRows = sourceRows.filter((row) => matchesFilters(row, state.filters));

    if (state.updatePayload) {
      matchedRows.forEach((row) => {
        Object.assign(row, clone(state.updatePayload));
      });

      return {
        data: matchedRows.map((row) => clone(row)),
        error: null,
      };
    }

    let data = matchedRows.map((row) => clone(row));

    if (state.orderBy) {
      const direction = state.orderBy.options?.ascending === false ? -1 : 1;
      data.sort((left, right) =>
        left[state.orderBy.column] < right[state.orderBy.column]
          ? -1 * direction
          : left[state.orderBy.column] > right[state.orderBy.column]
            ? 1 * direction
            : 0);
    }

    if (typeof state.limitCount === "number") {
      data = data.slice(0, state.limitCount);
    }

    if (state.singleResult) {
      return {
        data: data[0] ?? null,
        error: null,
      };
    }

    return {
      data,
      error: null,
    };
  }

  function createBuilder(table) {
    const state = {
      table,
      filters: [],
      orderBy: null,
      limitCount: null,
      updatePayload: null,
      singleResult: false,
    };

    const builder = {
      select() {
        return builder;
      },
      eq(column, value) {
        state.filters.push({ type: "eq", column, value });
        return builder;
      },
      in(column, value) {
        state.filters.push({ type: "in", column, value });
        return builder;
      },
      order(column, options) {
        state.orderBy = { column, options };
        return builder;
      },
      limit(value) {
        state.limitCount = value;
        return builder;
      },
      update(payload) {
        state.updatePayload = payload;
        return builder;
      },
      maybeSingle() {
        state.singleResult = true;
        return Promise.resolve(execute(state));
      },
      single() {
        state.singleResult = true;
        return Promise.resolve(execute(state));
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(execute(state)).then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  return {
    from(table) {
      return createBuilder(table);
    },
    storage: {
      from() {
        return {
          createSignedUrl: async () => ({
            data: {
              signedUrl: "https://example.test/preview",
            },
            error: null,
          }),
        };
      },
    },
    _tables: tables,
  };
}

function buildWorkspaceSeed(overrides = {}) {
  return {
    documents: [
      {
        id: "doc-1",
        organization_id: "org-1",
        direction: "purchase",
        document_type: "invoice",
        status: "extracting",
        posting_status: "draft",
        storage_bucket: "documents-private",
        storage_path: "orgs/org-1/doc-1.pdf",
        original_filename: "factura.pdf",
        mime_type: "application/pdf",
        created_at: "2026-03-16T10:00:00.000Z",
        document_date: "2026-03-16",
        current_draft_id: null,
        current_processing_run_id: "run-1",
        last_processed_at: "2026-03-16T10:00:10.000Z",
        metadata: {
          processing_error: "fetch failed",
          processing_error_stage: "inngest_enqueue",
        },
        ...overrides.document,
      },
    ],
    document_processing_runs: [
      {
        id: "run-1",
        document_id: "doc-1",
        status: "processing",
        failure_stage: null,
        failure_message: null,
        started_at: "2026-03-16T10:00:20.000Z",
        finished_at: null,
        openai_file_id: null,
        provider_response_id: null,
        provider_status: null,
        attempt_count: 0,
        last_polled_at: null,
        metadata: {},
        created_at: "2026-03-16T10:00:05.000Z",
        ...overrides.run,
      },
    ],
    document_drafts: overrides.drafts ?? [],
    document_invoice_identities: overrides.document_invoice_identities ?? [],
    ai_decision_logs: overrides.ai_decision_logs ?? [],
    document_assignment_runs: overrides.document_assignment_runs ?? [],
    document_draft_autosaves: overrides.document_draft_autosaves ?? [],
    profiles: overrides.profiles ?? [],
  };
}

test("reconcileStaleDocumentProcessingRuns marks provider submission stalls as error", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const supabase = createMutableSupabaseStub(buildWorkspaceSeed());

  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;

  try {
    const processingModule = loadFresh("@/modules/documents/processing");
    const result = await processingModule.reconcileStaleDocumentProcessingRuns({
      organizationId: "org-1",
      now: new Date("2026-03-16T10:03:40.000Z"),
    });

    assert.equal(result.repairedRuns.length, 1);
    assert.equal(result.repairedRuns[0].staleReason, "provider_submission_stalled");
    assert.equal(supabase._tables.documents[0].status, "error");
    assert.equal(supabase._tables.documents[0].metadata.processing_error_stage, "provider_submission_stalled");
    assert.equal(supabase._tables.document_processing_runs[0].status, "error");
    assert.equal(supabase._tables.document_processing_runs[0].failure_stage, "provider_submission_stalled");
  } finally {
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});

test("reconcileStaleDocumentProcessingRuns marks queued runs stalled beyond threshold", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const supabase = createMutableSupabaseStub(buildWorkspaceSeed({
    document: {
      status: "queued",
      metadata: {},
    },
    run: {
      status: "queued",
      started_at: null,
      created_at: "2026-03-16T10:00:00.000Z",
    },
  }));

  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;

  try {
    const processingModule = loadFresh("@/modules/documents/processing");
    const result = await processingModule.reconcileStaleDocumentProcessingRuns({
      organizationId: "org-1",
      now: new Date("2026-03-16T10:06:10.000Z"),
    });

    assert.equal(result.repairedRuns.length, 1);
    assert.equal(result.repairedRuns[0].staleReason, "queue_stalled");
    assert.equal(supabase._tables.documents[0].status, "error");
    assert.equal(supabase._tables.document_processing_runs[0].failure_stage, "queue_stalled");
  } finally {
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});

test("workspace documents expose retry action when extraction was reconciled as stale", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const supabase = createMutableSupabaseStub(buildWorkspaceSeed());

  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;

  try {
    const reviewModule = loadFresh("@/modules/documents/review");
    const documents = await reviewModule.listOrganizationWorkspaceDocuments({
      organizationId: "org-1",
      organizationSlug: "demo",
    });

    assert.equal(documents.length, 1);
    assert.equal(documents[0].nextPrimaryAction, "retry_extraction");
    assert.equal(documents[0].nextPrimaryActionLabel, "Reintentar extraccion");
    assert.equal(documents[0].canRetryExtraction, true);
    assert.equal(documents[0].extractionStatusLabel, "Interrumpida");
  } finally {
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});

test("workspace documents keep opening review as primary action when a draft exists", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const supabase = createMutableSupabaseStub(buildWorkspaceSeed({
    document: {
      status: "extracted",
      current_draft_id: "draft-1",
      metadata: {},
    },
    run: {
      status: "completed",
      provider_status: "completed",
      openai_file_id: "file-1",
      provider_response_id: "resp-1",
      attempt_count: 1,
      last_polled_at: "2026-03-16T10:01:00.000Z",
      finished_at: "2026-03-16T10:01:05.000Z",
    },
    drafts: [
      {
        id: "draft-1",
        fields_json: {
          facts: {
            issuer_name: "Proveedor SA",
            issuer_tax_id: "211111110019",
            issuer_address_raw: null,
            issuer_department: null,
            issuer_city: null,
            issuer_branch_code: null,
            merchant_category_hints: [],
            location_extraction_confidence: null,
            receiver_name: "Cliente",
            receiver_tax_id: "21999999001",
            document_number: "123",
            series: "A",
            currency_code: "UYU",
            document_date: "2026-03-16",
            due_date: null,
            subtotal: 100,
            tax_amount: 22,
            total_amount: 122,
            purchase_category_candidate: "services",
            sale_category_candidate: null,
          },
          amount_breakdown: [],
          line_items: [],
        },
      },
    ],
  }));

  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;

  try {
    const reviewModule = loadFresh("@/modules/documents/review");
    const documents = await reviewModule.listOrganizationWorkspaceDocuments({
      organizationId: "org-1",
      organizationSlug: "demo",
    });

    assert.equal(documents.length, 1);
    assert.equal(documents[0].nextPrimaryAction, "open_review");
    assert.equal(documents[0].nextPrimaryActionLabel, "Abrir revision");
    assert.equal(documents[0].processedHref, "/app/o/demo/documents/doc-1");
  } finally {
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});

test("workspace documents keep terminal classification resolved even if the last run is stale", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const supabase = createMutableSupabaseStub(buildWorkspaceSeed({
    document: {
      status: "confirmed",
      posting_status: "posted_final",
      current_draft_id: "draft-1",
      current_processing_run_id: null,
      metadata: {},
    },
    drafts: [
      {
        id: "draft-1",
        fields_json: {
          facts: {
            issuer_name: "Alsura SRL",
            receiver_name: "Cliente",
            document_number: "6404",
            series: "A",
            tax_amount: 198,
            total_amount: 1100,
          },
        },
      },
    ],
    document_assignment_runs: [
      {
        id: "assign-1",
        document_id: "doc-1",
        organization_id: "org-1",
        status: "stale",
        response_json: {},
        created_at: "2026-03-16T10:02:00.000Z",
      },
    ],
  }));

  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;

  try {
    const reviewModule = loadFresh("@/modules/documents/review");
    const documents = await reviewModule.listOrganizationWorkspaceDocuments({
      organizationId: "org-1",
      organizationSlug: "demo",
    });

    assert.equal(documents.length, 1);
    assert.equal(documents[0].canonicalState, "posted_final");
    assert.equal(documents[0].classificationStatus, "completed");
    assert.equal(documents[0].classificationStatusLabel, "Resuelta");
    assert.equal(documents[0].classificationFailureMessage, null);
  } finally {
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});

test("workspace documents surface manual classification instead of stale when a user intervened", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const supabase = createMutableSupabaseStub(buildWorkspaceSeed({
    document: {
      status: "extracted",
      posting_status: "draft",
      current_draft_id: "draft-1",
      current_processing_run_id: null,
      metadata: {},
    },
    drafts: [
      {
        id: "draft-1",
        fields_json: {
          facts: {
            issuer_name: "Alsura SRL",
            receiver_name: "Cliente",
            document_number: "6404",
            series: "A",
            tax_amount: 198,
            total_amount: 1100,
          },
        },
      },
    ],
    document_assignment_runs: [
      {
        id: "assign-1",
        document_id: "doc-1",
        organization_id: "org-1",
        status: "stale",
        response_json: {},
        created_at: "2026-03-16T10:02:00.000Z",
      },
    ],
    document_draft_autosaves: [
      {
        draft_id: "draft-1",
        payload_patch_json: {
          accountingContext: {
            manualOverrideAccountId: "acct-manual-1",
          },
        },
        saved_by: "user-1",
        saved_at: "2026-03-16T10:03:00.000Z",
        step_code: "accounting_context",
      },
    ],
    profiles: [
      {
        id: "user-1",
        full_name: "Jose Maria Sosa Izaguirre",
        email: "jose@example.com",
      },
    ],
    ai_decision_logs: [
      {
        id: "decision-1",
        organization_id: "org-1",
        document_id: "doc-1",
        decision_source: "manual_override",
        confidence_score: 0.4,
        certainty_level: "yellow",
        created_at: "2026-03-16T10:04:00.000Z",
      },
    ],
  }));

  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;

  try {
    const reviewModule = loadFresh("@/modules/documents/review");
    const documents = await reviewModule.listOrganizationWorkspaceDocuments({
      organizationId: "org-1",
      organizationSlug: "demo",
    });

    assert.equal(documents.length, 1);
    assert.equal(documents[0].classificationStatus, "completed");
    assert.equal(documents[0].classificationStatusLabel, "Manual");
    assert.match(documents[0].classificationFailureMessage, /Jose Maria Sosa Izaguirre/i);
    assert.equal(documents[0].manualInterventionBy, "Jose Maria Sosa Izaguirre");
  } finally {
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});

test("workspace documents show duplicate rejection without retrying extraction", async () => {
  const supabaseServerModule = require("@/lib/supabase/server");
  const originalGetClient = supabaseServerModule.getSupabaseServiceRoleClient;
  const supabase = createMutableSupabaseStub(buildWorkspaceSeed({
    document: {
      status: "duplicate",
      current_draft_id: null,
      current_processing_run_id: "run-1",
      metadata: {
        duplicate_status: "confirmed_duplicate",
        duplicate_reason: "business_identity_match",
        duplicate_of_document_id: "doc-older",
        duplicate_rejection_message:
          "Se rechazo el documento porque ya existe una factura con el mismo proveedor, numero y monto total en la organizacion. Documento existente: doc-older.",
      },
    },
    run: {
      status: "skipped",
      failure_stage: "duplicate_rejected",
      failure_message:
        "Se rechazo el documento porque ya existe una factura con el mismo proveedor, numero y monto total en la organizacion. Documento existente: doc-older.",
      finished_at: "2026-03-16T10:01:05.000Z",
    },
  }));

  supabaseServerModule.getSupabaseServiceRoleClient = () => supabase;

  try {
    const reviewModule = loadFresh("@/modules/documents/review");
    const documents = await reviewModule.listOrganizationWorkspaceDocuments({
      organizationId: "org-1",
      organizationSlug: "demo",
    });

    assert.equal(documents.length, 1);
    assert.equal(documents[0].status, "duplicate");
    assert.equal(documents[0].canonicalState, "blocked_duplicate");
    assert.equal(documents[0].extractionStatusLabel, "Duplicado rechazado");
    assert.equal(documents[0].nextPrimaryAction, null);
    assert.equal(documents[0].canRetryExtraction, false);
  } finally {
    supabaseServerModule.getSupabaseServiceRoleClient = originalGetClient;
  }
});

test("classification action hint explains the next blocking step", () => {
  const reviewModule = loadFresh("@/modules/documents/review");
  const message = reviewModule.buildClassificationActionHint({
    canRunClassification: false,
    canRunClassificationByRole: true,
    documentStatus: "extracted",
    workflowState: {
      queueCode: "pending_factual_review",
      canonicalState: "needs_review",
      operationalBucket: "review",
      operationalFlags: [],
      blockingReason: null,
      stepStatuses: {
        factual: "blocked",
        context: "pending",
        classification: "blocked",
        learning: "pending",
        posting: "blocked",
        vat: "pending",
      },
      nextRecommendedAction: "Completar validacion factual",
      visibleWarnings: ["Falta confirmar la identidad del emisor"],
      canRunClassification: false,
      canCreateLearningRule: false,
      canPostProvisional: false,
      canConfirmFinal: false,
      canConfirm: false,
      canReopen: false,
      canRunVatPreview: false,
      permissions: {
        canRunClassification: false,
        canCreateLearningRule: false,
        canPostProvisional: false,
        canConfirmFinal: false,
        canConfirm: false,
        canReopen: false,
        canRunVatPreview: false,
      },
      classificationStatus: "needs_context",
    },
  });

  assert.match(message, /Completar validacion factual/i);
  assert.match(message, /Falta confirmar la identidad del emisor/i);
});
