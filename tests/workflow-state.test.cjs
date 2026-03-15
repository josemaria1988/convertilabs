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
  assert.equal(state.classificationStatus, "completed");
  assert.equal(state.canCreateLearningRule, true);
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
  assert.equal(state.classificationStatus, "stale");
  assert.match(state.nextRecommendedAction, /Remapear manualmente/i);
});
