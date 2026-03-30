/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildDocumentReviewGuidedRoute,
} = require("@/modules/presentation/document-review-guided-route");

function buildWorkflowState(overrides = {}) {
  return {
    queueCode: "pending_assignment",
    canonicalState: "needs_review",
    operationalBucket: "review",
    operationalFlags: [],
    blockingReason: null,
    stepStatuses: {
      factual: "completed",
      context: "pending",
      classification: "completed",
      learning: "pending",
      posting: "blocked",
      vat: "pending",
    },
    nextRecommendedAction: "Resolver clasificacion",
    visibleWarnings: [],
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
    classificationStatus: "completed",
    ...overrides,
  };
}

function buildDecisionSnapshot(overrides = {}) {
  return {
    workflowState: "needs_review",
    resolutionSource: "manual",
    resolutionConfidence: 0.82,
    factualReviewResolved: true,
    accountingContextResolved: false,
    classificationResolved: true,
    previewBalanced: false,
    hasTemporaryAccounts: false,
    fiscalTreatmentResolved: true,
    postingState: "draft",
    canPostProvisional: false,
    canConfirmFinal: false,
    provisionalEligibility: {
      ok: false,
      reasons: [],
      missingConditions: ["Asiento balanceado"],
    },
    finalEligibility: {
      ok: false,
      reasons: [],
      missingConditions: ["Asiento balanceado"],
    },
    vatPreviewEligibility: {
      ok: false,
      reasons: [],
      missingConditions: ["Elegibilidad fiscal para preview"],
    },
    vatRunEligibility: {
      ok: false,
      reasons: [],
      missingConditions: ["Posting suficiente para corrida oficial"],
    },
    blockers: [],
    warnings: [],
    nextBestAction: "Resolver clasificacion",
    checklist: [
      {
        code: "main_account",
        label: "Cuenta principal definida",
        done: false,
        severity: "blocking",
      },
      {
        code: "balanced_preview",
        label: "Asiento balanceado",
        done: false,
        severity: "blocking",
      },
    ],
    ...overrides,
  };
}

test("guided route marks every step as done for a closed review", () => {
  const route = buildDocumentReviewGuidedRoute({
    workflowState: buildWorkflowState({
      canonicalState: "posted_final",
      operationalBucket: "done",
      stepStatuses: {
        factual: "completed",
        context: "completed",
        classification: "completed",
        learning: "pending",
        posting: "completed",
        vat: "ready",
      },
      nextRecommendedAction: "Ver trazabilidad",
      canReopen: true,
    }),
    decisionSnapshot: buildDecisionSnapshot({
      workflowState: "posted_final",
      accountingContextResolved: true,
      previewBalanced: true,
      postingState: "posted_final",
      nextBestAction: "Ver trazabilidad",
      checklist: [
        {
          code: "main_account",
          label: "Cuenta principal definida",
          done: true,
          severity: "blocking",
        },
        {
          code: "balanced_preview",
          label: "Asiento balanceado",
          done: true,
          severity: "blocking",
        },
      ],
    }),
    accountingContextStatus: "provided",
    hasSavedContext: true,
    hasPostingTemplate: true,
    manualAssignmentReady: true,
  });

  assert.equal(route.reviewClosed, true);
  assert.deepEqual(route.reviewSteps.map((step) => step.status), ["done", "done", "done", "done"]);
  assert.equal(route.nextBestActionCopy, "Ver trazabilidad");
  assert.equal(route.readinessStatusLabel, "Cerrado");
  assert.match(route.provisionalReadinessCopy, /solo admite reapertura controlada/i);
  assert.match(route.finalReadinessCopy, /solo admite reapertura controlada/i);
});

test("guided route treats auto-resolved fast lane documents as done before close", () => {
  const route = buildDocumentReviewGuidedRoute({
    workflowState: buildWorkflowState({
      queueCode: "ready_for_final_confirmation",
      canonicalState: "ready_final",
      operationalBucket: "ready_to_post",
      stepStatuses: {
        factual: "completed",
        context: "pending",
        classification: "completed",
        learning: "pending",
        posting: "ready",
        vat: "pending",
      },
      nextRecommendedAction: "Confirmar final",
      canPostProvisional: true,
      canConfirmFinal: true,
      canConfirm: true,
      canRunVatPreview: true,
      permissions: {
        canRunClassification: false,
        canCreateLearningRule: false,
        canPostProvisional: true,
        canConfirmFinal: true,
        canConfirm: true,
        canReopen: false,
        canRunVatPreview: true,
      },
    }),
    decisionSnapshot: buildDecisionSnapshot({
      workflowState: "ready_final",
      accountingContextResolved: true,
      previewBalanced: true,
      postingState: "ready_final",
      canPostProvisional: true,
      canConfirmFinal: true,
      provisionalEligibility: {
        ok: true,
        reasons: [],
        missingConditions: [],
      },
      finalEligibility: {
        ok: true,
        reasons: [],
        missingConditions: [],
      },
      nextBestAction: "Confirmar final",
      checklist: [
        {
          code: "main_account",
          label: "Cuenta principal definida",
          done: true,
          severity: "blocking",
        },
        {
          code: "balanced_preview",
          label: "Asiento balanceado",
          done: true,
          severity: "blocking",
        },
      ],
    }),
    accountingContextStatus: "not_required",
    hasSavedContext: false,
    hasPostingTemplate: true,
    manualAssignmentReady: false,
  });

  assert.equal(route.reviewClosed, false);
  assert.deepEqual(route.reviewSteps.map((step) => step.status), ["done", "done", "done", "current"]);
  assert.equal(route.nextBestActionCopy, "Confirmar final");
  assert.equal(route.readinessStatusLabel, null);
});

test("guided route keeps manual open reviews aligned with workflow progression", () => {
  const route = buildDocumentReviewGuidedRoute({
    workflowState: buildWorkflowState({
      stepStatuses: {
        factual: "completed",
        context: "blocked",
        classification: "completed",
        learning: "pending",
        posting: "blocked",
        vat: "pending",
      },
      nextRecommendedAction: "Completar contexto contable",
    }),
    decisionSnapshot: buildDecisionSnapshot({
      workflowState: "needs_review",
      accountingContextResolved: false,
      classificationResolved: true,
      previewBalanced: false,
      postingState: "draft",
      nextBestAction: "Completar contexto contable",
      checklist: [
        {
          code: "main_account",
          label: "Cuenta principal definida",
          done: false,
          severity: "blocking",
        },
        {
          code: "balanced_preview",
          label: "Asiento balanceado",
          done: false,
          severity: "blocking",
        },
      ],
    }),
    accountingContextStatus: "unknown",
    hasSavedContext: false,
    hasPostingTemplate: true,
    manualAssignmentReady: false,
  });

  assert.equal(route.reviewClosed, false);
  assert.deepEqual(route.reviewSteps.map((step) => step.status), ["done", "current", "pending", "pending"]);
  assert.equal(route.nextBestActionCopy, "Completar contexto contable");
});
