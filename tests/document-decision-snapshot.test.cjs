/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildDocumentDecisionSnapshot,
} = require("@/modules/documents/document-decision-snapshot");
const {
  eligibleForVatPreview,
  eligibleForVatRun,
} = require("@/modules/tax/vat-eligibility");
const {
  formatCanonicalWorkflowStateLabel,
  formatCanonicalResolutionSourceLabel,
  inferBlockingActionHintFromReasons,
} = require("@/modules/presentation/product-language");

function buildDerived(overrides = {}) {
  return {
    accountingContext: {
      status: "not_required",
      manualOverrideAccountId: null,
      manualRoleOverrides: {},
      manualOverrideConceptId: null,
      manualOverrideOperationCategory: null,
      blockingReasons: [],
    },
    appliedRule: {
      scope: "vendor_concept",
      accountId: "acct-1",
    },
    assistantSuggestion: {
      status: "not_requested",
      confidence: null,
      output: null,
    },
    journalSuggestion: {
      isBalanced: true,
      totalDebit: 122,
      hasProvisionalAccounts: false,
    },
    taxTreatment: {
      ready: true,
      warnings: [],
      vatBucket: "input_creditable",
    },
    settlementContext: {
      warnings: [],
    },
    validation: {
      blockers: [],
    },
    ...overrides,
  };
}

function buildWorkflowState(overrides = {}) {
  return {
    queueCode: "ready_for_provisional_posting",
    canonicalState: "ready_provisional",
    operationalBucket: "ready_to_post",
    operationalFlags: [],
    blockingReason: null,
    stepStatuses: {
      factual: "completed",
      context: "completed",
      classification: "completed",
      learning: "pending",
      posting: "ready",
      vat: "pending",
    },
    nextRecommendedAction: "Postear provisional",
    visibleWarnings: [],
    canRunClassification: false,
    canCreateLearningRule: false,
    canPostProvisional: true,
    canConfirmFinal: true,
    canConfirm: true,
    canReopen: false,
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
    classificationStatus: "completed",
    ...overrides,
  };
}

function buildSteps() {
  return [
    { step_code: "identity", status: "draft_saved", stale_reason: null },
    { step_code: "fields", status: "draft_saved", stale_reason: null },
    { step_code: "amounts", status: "draft_saved", stale_reason: null },
    { step_code: "accounting_context", status: "draft_saved", stale_reason: null },
  ];
}

test("decision snapshot keeps preview balanced documents blocked when classification is stale", () => {
  const snapshot = buildDocumentDecisionSnapshot({
    documentStatus: "needs_review",
    postingStatus: "draft",
    draftStatus: "open",
    steps: buildSteps(),
    derived: buildDerived({
      validation: {
        blockers: ["La clasificacion quedo vencida."],
      },
    }),
    workflowState: buildWorkflowState({
      queueCode: "pending_assignment",
      canonicalState: "needs_review",
      operationalBucket: "review",
      canPostProvisional: false,
      canConfirmFinal: false,
      canConfirm: false,
      permissions: {
        canRunClassification: false,
        canCreateLearningRule: false,
        canPostProvisional: false,
        canConfirmFinal: false,
        canConfirm: false,
        canReopen: false,
        canRunVatPreview: false,
      },
      classificationStatus: "stale",
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
      confidence: 0.61,
      providerCode: "openai",
      modelCode: "gpt-5",
      latencyMs: 120,
      createdAt: "2026-03-22T00:00:00Z",
      updatedAt: "2026-03-22T00:00:01Z",
    },
    accountRoleAssignments: [
      {
        roleCode: "expense_account",
        linePurpose: "main",
        accountId: "acct-1",
        isMissing: false,
        isProvisional: false,
      },
    ],
    documentDate: "2026-03-22",
    duplicateStatus: "clear",
  });

  assert.equal(snapshot.previewBalanced, true);
  assert.equal(snapshot.classificationResolved, false);
  assert.equal(snapshot.canPostProvisional, false);
  assert.equal(snapshot.workflowState, "needs_review");
  assert.match(snapshot.provisionalEligibility.missingConditions.join(" "), /Clasificacion resuelta/i);
});

test("decision snapshot marks manual override as manual resolution and unlocks final readiness", () => {
  const snapshot = buildDocumentDecisionSnapshot({
    documentStatus: "draft_ready",
    postingStatus: "vat_ready",
    draftStatus: "ready_for_confirmation",
    steps: buildSteps(),
    derived: buildDerived({
      accountingContext: {
        status: "manual_override",
        manualOverrideAccountId: "acct-1",
        manualRoleOverrides: {
          expense_account: "acct-1",
        },
        manualOverrideConceptId: null,
        manualOverrideOperationCategory: "services",
        blockingReasons: [],
      },
      appliedRule: {
        scope: "document_override",
        accountId: "acct-1",
      },
    }),
    workflowState: buildWorkflowState({
      queueCode: "ready_for_final_confirmation",
      canonicalState: "ready_final",
      canPostProvisional: true,
      canConfirmFinal: true,
      classificationStatus: "completed",
    }),
    latestClassificationRun: null,
    accountRoleAssignments: [
      {
        roleCode: "expense_account",
        linePurpose: "main",
        accountId: "acct-1",
        isMissing: false,
        isProvisional: false,
      },
    ],
    documentDate: "2026-03-22",
    duplicateStatus: "clear",
  });

  assert.equal(snapshot.resolutionSource, "manual");
  assert.equal(snapshot.postingState, "ready_final");
  assert.equal(snapshot.finalEligibility.ok, true);
  assert.equal(snapshot.nextBestAction, "Confirmar final");
});

test("decision snapshot treats role overrides as manual resolution even without legacy primary override", () => {
  const snapshot = buildDocumentDecisionSnapshot({
    documentStatus: "draft_ready",
    postingStatus: "vat_ready",
    draftStatus: "ready_for_confirmation",
    steps: buildSteps(),
    derived: buildDerived({
      accountingContext: {
        status: "manual_override",
        manualOverrideAccountId: null,
        manualRoleOverrides: {
          expense_account: "acct-1",
        },
        manualOverrideConceptId: null,
        manualOverrideOperationCategory: null,
        blockingReasons: [],
      },
      appliedRule: {
        scope: "document_override",
        accountId: "acct-1",
      },
    }),
    workflowState: buildWorkflowState({
      queueCode: "ready_for_provisional_posting",
      canonicalState: "ready_provisional",
      canPostProvisional: true,
      canConfirmFinal: true,
      classificationStatus: "completed",
    }),
    latestClassificationRun: null,
    accountRoleAssignments: [
      {
        roleCode: "expense_account",
        linePurpose: "main",
        accountId: "acct-1",
        isMissing: false,
        isProvisional: false,
      },
    ],
    documentDate: "2026-03-22",
    duplicateStatus: "clear",
  });

  assert.equal(snapshot.resolutionSource, "manual");
  assert.equal(snapshot.classificationResolved, true);
  assert.equal(snapshot.canPostProvisional, true);
});

test("vat eligibility distinguishes preview from official run", () => {
  const previewDecision = eligibleForVatPreview({
    documentId: "doc-1",
    documentDate: "2026-02-10",
    postingStatus: "vat_ready",
    documentStatus: "draft_ready",
    hasCurrentDraft: true,
    classificationResolved: true,
    fiscalTreatmentResolved: true,
    hasVatBucket: true,
    duplicateStatus: "clear",
  });
  const runDecision = eligibleForVatRun({
    documentId: "doc-1",
    documentDate: "2026-02-10",
    postingStatus: "vat_ready",
    documentStatus: "draft_ready",
    hasCurrentDraft: true,
    classificationResolved: true,
    fiscalTreatmentResolved: true,
    hasVatBucket: true,
    duplicateStatus: "clear",
  });

  assert.equal(previewDecision.ok, true);
  assert.equal(runDecision.ok, false);
  assert.match(runDecision.reason, /corrida oficial/i);
});

test("canonical language formats stable workflow and source labels", () => {
  assert.equal(formatCanonicalWorkflowStateLabel("needs_review"), "Necesita revision");
  assert.equal(formatCanonicalResolutionSourceLabel("manual"), "Revision manual");
  assert.equal(formatCanonicalResolutionSourceLabel("unknown"), "Pendiente");
  assert.equal(
    inferBlockingActionHintFromReasons([
      "No pudimos consultar la cotizacion BCU para resolver el tipo de cambio fiscal previo al 2026-03-12.",
    ]),
    "Resolver tipo de cambio fiscal",
  );
});

test("decision snapshot keeps terminal reviews on tracing instead of posting actions", () => {
  const snapshot = buildDocumentDecisionSnapshot({
    documentStatus: "draft_ready",
    postingStatus: "draft",
    draftStatus: "confirmed",
    steps: buildSteps(),
    derived: buildDerived(),
    workflowState: buildWorkflowState({
      queueCode: "posted_final",
      canonicalState: "posted_final",
      operationalBucket: "done",
      stepStatuses: {
        factual: "completed",
        context: "completed",
        classification: "completed",
        learning: "ready",
        posting: "completed",
        vat: "ready",
      },
      nextRecommendedAction: "Ver trazabilidad",
      canPostProvisional: false,
      canConfirmFinal: false,
      canConfirm: false,
      canReopen: true,
      canRunVatPreview: true,
      permissions: {
        canRunClassification: false,
        canCreateLearningRule: true,
        canPostProvisional: false,
        canConfirmFinal: false,
        canConfirm: false,
        canReopen: true,
        canRunVatPreview: true,
      },
      classificationStatus: "completed",
    }),
    latestClassificationRun: null,
    accountRoleAssignments: [
      {
        roleCode: "expense_account",
        linePurpose: "main",
        accountId: "acct-1",
        isMissing: false,
        isProvisional: false,
      },
    ],
    documentDate: "2026-03-22",
    duplicateStatus: "clear",
  });

  const provisionalChecklist = snapshot.checklist.find((item) => item.code === "provisional_ready");
  const finalChecklist = snapshot.checklist.find((item) => item.code === "final_ready");

  assert.equal(snapshot.postingState, "posted_final");
  assert.equal(snapshot.factualReviewResolved, true);
  assert.equal(snapshot.accountingContextResolved, true);
  assert.equal(snapshot.canPostProvisional, false);
  assert.equal(snapshot.canConfirmFinal, false);
  assert.equal(snapshot.nextBestAction, "Ver trazabilidad");
  assert.equal(snapshot.vatPreviewEligibility.ok, true);
  assert.equal(provisionalChecklist?.done, true);
  assert.equal(finalChecklist?.done, true);
});
