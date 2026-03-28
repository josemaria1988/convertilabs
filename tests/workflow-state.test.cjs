/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  deriveDocumentWorkflowState,
} = require("@/modules/documents/workflow-state");

function buildDerived(overrides = {}) {
  return {
    taxTreatment: {
      ready: true,
      warnings: [],
    },
    journalSuggestion: {
      ready: true,
      hasProvisionalAccounts: false,
    },
    accountingContext: {
      status: "not_required",
      shouldBlockConfirmation: false,
      blockingReasons: [],
    },
    appliedRule: {
      scope: "vendor_concept",
      accountId: "acct-1",
    },
    validation: {
      canPostProvisional: true,
      canConfirmFinal: true,
      blockers: [],
    },
    ...overrides,
  };
}

test("workflow state marks freshly extracted drafts as pending factual review", () => {
  const state = deriveDocumentWorkflowState({
    documentStatus: "extracted",
    postingStatus: "draft",
    draftStatus: "open",
    steps: [],
    derived: buildDerived({
      journalSuggestion: {
        ready: false,
        hasProvisionalAccounts: false,
      },
      validation: {
        canPostProvisional: false,
        canConfirmFinal: false,
        blockers: ["faltan datos"],
      },
    }),
    latestClassificationRun: null,
    learningOptionCount: 0,
  });

  assert.equal(state.queueCode, "pending_factual_review");
  assert.equal(state.canonicalState, "needs_review");
  assert.equal(state.operationalBucket, "review");
  assert.equal(state.nextRecommendedAction, "Completar validacion factual");
});

test("workflow state marks ready classification with learning choice pending", () => {
  const state = deriveDocumentWorkflowState({
    documentStatus: "draft_ready",
    postingStatus: "vat_ready",
    draftStatus: "ready_for_confirmation",
    steps: [
      { step_code: "identity", status: "draft_saved", stale_reason: null },
      { step_code: "fields", status: "draft_saved", stale_reason: null },
      { step_code: "amounts", status: "draft_saved", stale_reason: null },
      { step_code: "operation_context", status: "draft_saved", stale_reason: null },
      { step_code: "accounting_context", status: "draft_saved", stale_reason: null },
    ],
    derived: buildDerived(),
    latestClassificationRun: {
      id: "run-1",
      organizationId: "org-1",
      documentId: "doc-1",
      draftId: "draft-1",
      triggeredByUserId: "user-1",
      status: "completed",
      requestPayload: {},
      responseJson: {},
      selectedAccountId: "acct-1",
      selectedOperationCategory: "services",
      selectedTemplateCode: null,
      selectedTaxProfileCode: null,
      confidence: 0.93,
      providerCode: "openai",
      modelCode: "gpt-5",
      latencyMs: 240,
      createdAt: "2026-03-15T00:00:00Z",
      updatedAt: "2026-03-15T00:00:01Z",
    },
    learningOptionCount: 2,
  });

  assert.equal(state.queueCode, "pending_learning_decision");
  assert.equal(state.canonicalState, "ready_final");
  assert.equal(state.operationalBucket, "ready_to_post");
  assert.equal(state.classificationStatus, "completed");
  assert.equal(state.canCreateLearningRule, true);
});

test("workflow state marks extracted drafts as pending assignment when factual steps are ready", () => {
  const state = deriveDocumentWorkflowState({
    documentStatus: "extracted",
    postingStatus: "draft",
    draftStatus: "open",
    steps: [
      { step_code: "identity", status: "draft_saved", stale_reason: null },
      { step_code: "fields", status: "draft_saved", stale_reason: null },
      { step_code: "amounts", status: "draft_saved", stale_reason: null },
      { step_code: "operation_context", status: "draft_saved", stale_reason: null },
    ],
    derived: buildDerived({
      journalSuggestion: {
        ready: false,
        hasProvisionalAccounts: false,
      },
      validation: {
        canPostProvisional: false,
        canConfirmFinal: false,
        blockers: [],
      },
    }),
    latestClassificationRun: null,
    learningOptionCount: 0,
  });

  assert.equal(state.queueCode, "pending_assignment");
  assert.equal(state.canonicalState, "needs_review");
  assert.equal(state.classificationStatus, "not_started");
  assert.equal(state.stepStatuses.classification, "ready");
  assert.equal(state.canRunClassification, true);
});

test("workflow state marks reopened documents for manual remap", () => {
  const state = deriveDocumentWorkflowState({
    documentStatus: "classified_with_open_revision",
    postingStatus: "posted_provisional",
    draftStatus: "open",
    steps: [
      { step_code: "identity", status: "draft_saved", stale_reason: null },
    ],
    derived: buildDerived({
      validation: {
        canPostProvisional: false,
        canConfirmFinal: false,
        blockers: ["requiere remap"],
      },
    }),
    latestClassificationRun: {
      id: "run-older",
      organizationId: "org-1",
      documentId: "doc-1",
      draftId: "draft-prev",
      triggeredByUserId: "user-1",
      status: "stale",
      requestPayload: {},
      responseJson: {},
      selectedAccountId: "acct-1",
      selectedOperationCategory: "services",
      selectedTemplateCode: null,
      selectedTaxProfileCode: null,
      confidence: 0.8,
      providerCode: "openai",
      modelCode: "gpt-5",
      latencyMs: 240,
      createdAt: "2026-03-14T00:00:00Z",
      updatedAt: "2026-03-15T00:00:00Z",
    },
    learningOptionCount: 1,
  });

  assert.equal(state.queueCode, "reopened_needs_manual_remap");
  assert.equal(state.canonicalState, "posted_provisional_pending_final");
  assert.equal(state.classificationStatus, "stale");
  assert.match(state.nextRecommendedAction, /Remapear manualmente/i);
});

test("workflow state allows rerun when a ready draft has stale classification", () => {
  const state = deriveDocumentWorkflowState({
    documentStatus: "draft_ready",
    postingStatus: "draft",
    draftStatus: "open",
    steps: [
      { step_code: "identity", status: "draft_saved", stale_reason: null },
      { step_code: "fields", status: "draft_saved", stale_reason: null },
      { step_code: "amounts", status: "draft_saved", stale_reason: null },
      { step_code: "operation_context", status: "draft_saved", stale_reason: null },
      { step_code: "accounting_context", status: "draft_saved", stale_reason: null },
    ],
    derived: buildDerived({
      validation: {
        canPostProvisional: true,
        canConfirmFinal: true,
        blockers: [],
      },
    }),
    latestClassificationRun: {
      id: "run-stale",
      organizationId: "org-1",
      documentId: "doc-1",
      draftId: "draft-1",
      triggeredByUserId: "user-1",
      status: "stale",
      requestPayload: {},
      responseJson: {},
      selectedAccountId: "acct-1",
      selectedOperationCategory: "services",
      selectedTemplateCode: null,
      selectedTaxProfileCode: null,
      confidence: 0.7,
      providerCode: "openai",
      modelCode: "gpt-5",
      latencyMs: 180,
      createdAt: "2026-03-17T00:00:00Z",
      updatedAt: "2026-03-17T00:00:01Z",
    },
    learningOptionCount: 1,
  });

  assert.equal(state.queueCode, "pending_assignment");
  assert.equal(state.canonicalState, "needs_review");
  assert.equal(state.classificationStatus, "stale");
  assert.equal(state.stepStatuses.classification, "ready");
  assert.equal(state.canRunClassification, true);
  assert.equal(state.canPostProvisional, false);
  assert.equal(state.canConfirmFinal, false);
});

test("workflow state treats manual classification override as resolved even if the last ai run is stale", () => {
  const state = deriveDocumentWorkflowState({
    documentStatus: "needs_review",
    postingStatus: "draft",
    draftStatus: "open",
    steps: [
      { step_code: "identity", status: "draft_saved", stale_reason: null },
      { step_code: "fields", status: "draft_saved", stale_reason: null },
      { step_code: "amounts", status: "draft_saved", stale_reason: null },
      { step_code: "operation_context", status: "draft_saved", stale_reason: null },
      { step_code: "accounting_context", status: "draft_saved", stale_reason: null },
    ],
    derived: buildDerived({
      accountingContext: {
        status: "manual_override",
        shouldBlockConfirmation: false,
        blockingReasons: [],
        manualOverrideAccountId: "acct-1",
        manualOverrideConceptId: null,
        manualOverrideOperationCategory: "services",
      },
      appliedRule: {
        scope: "document_override",
        accountId: "acct-1",
      },
      validation: {
        canPostProvisional: true,
        canConfirmFinal: true,
        blockers: [],
      },
    }),
    latestClassificationRun: {
      id: "run-stale-manual",
      organizationId: "org-1",
      documentId: "doc-1",
      draftId: "draft-1",
      triggeredByUserId: "user-1",
      status: "stale",
      requestPayload: {},
      responseJson: {},
      selectedAccountId: "acct-1",
      selectedOperationCategory: "services",
      selectedTemplateCode: null,
      selectedTaxProfileCode: null,
      confidence: 0.41,
      providerCode: "openai",
      modelCode: "gpt-5",
      latencyMs: 180,
      createdAt: "2026-03-17T00:00:00Z",
      updatedAt: "2026-03-17T00:00:01Z",
    },
    learningOptionCount: 0,
  });

  assert.equal(state.classificationStatus, "completed");
  assert.equal(state.canPostProvisional, true);
  assert.equal(state.canConfirmFinal, true);
  assert.equal(state.canonicalState, "ready_final");
  assert.equal(state.queueCode, "ready_for_final_confirmation");
});

test("workflow state marks unresolved duplicates as blocked", () => {
  const state = deriveDocumentWorkflowState({
    documentStatus: "draft_ready",
    postingStatus: "draft",
    draftStatus: "open",
    steps: [
      { step_code: "identity", status: "draft_saved", stale_reason: null },
      { step_code: "fields", status: "draft_saved", stale_reason: null },
      { step_code: "amounts", status: "draft_saved", stale_reason: null },
      { step_code: "operation_context", status: "draft_saved", stale_reason: null },
      { step_code: "accounting_context", status: "draft_saved", stale_reason: null },
    ],
    derived: buildDerived(),
    latestClassificationRun: null,
    learningOptionCount: 0,
    duplicateStatus: "suspected_duplicate",
  });

  assert.equal(state.canonicalState, "blocked_duplicate");
  assert.equal(state.operationalBucket, "blocked");
  assert.equal(state.operationalFlags.includes("blocked_duplicate"), true);
});

test("workflow state marks missing fx as blocked", () => {
  const state = deriveDocumentWorkflowState({
    documentStatus: "draft_ready",
    postingStatus: "draft",
    draftStatus: "open",
    steps: [
      { step_code: "identity", status: "draft_saved", stale_reason: null },
      { step_code: "fields", status: "draft_saved", stale_reason: null },
      { step_code: "amounts", status: "draft_saved", stale_reason: null },
      { step_code: "operation_context", status: "draft_saved", stale_reason: null },
      { step_code: "accounting_context", status: "draft_saved", stale_reason: null },
    ],
    derived: buildDerived({
      validation: {
        canPostProvisional: false,
        canConfirmFinal: false,
        blockers: [
          "No pudimos consultar la cotizacion BCU para resolver el tipo de cambio fiscal previo al 2026-03-12.",
        ],
      },
    }),
    latestClassificationRun: null,
    learningOptionCount: 0,
  });

  assert.equal(state.canonicalState, "blocked_missing_fx");
  assert.equal(state.operationalBucket, "blocked");
  assert.equal(state.nextRecommendedAction, "Resolver tipo de cambio fiscal");
});
