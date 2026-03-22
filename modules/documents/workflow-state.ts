import type {
  DerivedDraftArtifacts,
  DocumentAssignmentRunRecord,
  DocumentPostingStatus,
} from "@/modules/accounting";

type DraftStepStatus = {
  step_code: string;
  status: string;
  stale_reason: string | null;
};

export type DocumentWorkflowQueueCode =
  | "pending_factual_review"
  | "pending_assignment"
  | "pending_learning_decision"
  | "ready_for_provisional_posting"
  | "posted_provisional"
  | "ready_for_final_confirmation"
  | "posted_final"
  | "reopened_needs_manual_remap";

export type WorkflowStepStatus =
  | "pending"
  | "ready"
  | "blocked"
  | "completed";

export type DocumentWorkflowState = {
  queueCode: DocumentWorkflowQueueCode;
  stepStatuses: {
    factual: WorkflowStepStatus;
    context: WorkflowStepStatus;
    classification: WorkflowStepStatus;
    learning: WorkflowStepStatus;
    posting: WorkflowStepStatus;
    vat: WorkflowStepStatus;
  };
  nextRecommendedAction: string;
  visibleWarnings: string[];
  canRunClassification: boolean;
  canCreateLearningRule: boolean;
  canPostProvisional: boolean;
  canConfirmFinal: boolean;
  canRunVatPreview: boolean;
  classificationStatus: "not_started" | "completed" | "failed" | "stale" | "needs_context";
};

function isClassificationMaterializedDocumentStatus(documentStatus: string) {
  return [
    "draft_ready",
    "needs_review",
    "classified",
    "classified_with_open_revision",
    "approved",
    "rejected",
    "duplicate",
    "archived",
  ].includes(documentStatus);
}

export function canRunDocumentClassificationAction(input: {
  documentStatus: string;
  postingStatus: DocumentPostingStatus | null;
  draftStatus: string | null;
  hasDraft: boolean;
  latestClassificationRunStatus?: DocumentAssignmentRunRecord["status"] | null;
  classificationStatus?: DocumentWorkflowState["classificationStatus"] | null;
}) {
  if (!input.hasDraft) {
    return false;
  }

  if (
    input.draftStatus === "confirmed"
    || input.postingStatus === "posted_final"
    || input.postingStatus === "locked"
  ) {
    return false;
  }

  if (
    input.latestClassificationRunStatus === "failed"
    || input.latestClassificationRunStatus === "stale"
    || input.classificationStatus === "needs_context"
  ) {
    return true;
  }

  return input.documentStatus === "extracted"
    || input.documentStatus === "classified_with_open_revision";
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value && value.trim()))),
  );
}

function resolveStepStatus(
  steps: DraftStepStatus[],
  requestedStepCodes: string[],
  fallbackBlocked: boolean,
) {
  const requested = steps.filter((step) => requestedStepCodes.includes(step.step_code));

  if (requested.some((step) => step.status === "confirmed")) {
    return "completed" satisfies WorkflowStepStatus;
  }

  if (requested.some((step) => step.status === "blocked" || step.status === "error")) {
    return "blocked" satisfies WorkflowStepStatus;
  }

  if (requested.some((step) => step.status === "draft_saved")) {
    return "ready" satisfies WorkflowStepStatus;
  }

  return fallbackBlocked ? "blocked" : "pending";
}

function hasManualClassificationResolution(input: {
  derived: DerivedDraftArtifacts;
}) {
  return Boolean(
    input.derived.appliedRule.accountId
    && (
      input.derived.accountingContext.manualOverrideAccountId
      || input.derived.accountingContext.manualOverrideConceptId
      || input.derived.accountingContext.manualOverrideOperationCategory
    ),
  );
}

export function deriveDocumentWorkflowState(input: {
  documentStatus: string;
  postingStatus: DocumentPostingStatus | null;
  draftStatus: string;
  steps: DraftStepStatus[];
  derived: DerivedDraftArtifacts;
  latestClassificationRun: DocumentAssignmentRunRecord | null;
  learningOptionCount: number;
}) {
  const factualReady = ["identity", "fields", "amounts"].every((stepCode) =>
    input.steps.some((step) =>
      step.step_code === stepCode
      && ["draft_saved", "confirmed"].includes(step.status)
    ));
  const contextReady = input.steps.some((step) =>
    step.step_code === "accounting_context"
    && ["draft_saved", "confirmed"].includes(step.status)
  ) || input.derived.accountingContext.status === "not_required";
  const manualClassificationResolved = hasManualClassificationResolution({
    derived: input.derived,
  });
  const classificationStatus =
    manualClassificationResolved
      ? "completed"
      : input.latestClassificationRun?.status === "failed"
      ? "failed"
      : input.latestClassificationRun?.status === "stale"
        ? "stale"
        : input.latestClassificationRun?.status === "completed"
          ? "completed"
          : input.documentStatus === "extracted" && input.derived.accountingContext.shouldBlockConfirmation
            ? "needs_context"
            : "not_started";
  const classificationMaterialized = isClassificationMaterializedDocumentStatus(input.documentStatus);
  const classificationUpToDate =
    classificationMaterialized
    && classificationStatus !== "failed"
    && classificationStatus !== "stale"
    && classificationStatus !== "needs_context";
  const canCreateLearningRule =
    classificationUpToDate
    && Boolean(input.derived.appliedRule.accountId)
    && input.derived.appliedRule.scope !== "manual_review"
    && input.learningOptionCount > 0;
  const canRunClassification = canRunDocumentClassificationAction({
    documentStatus: input.documentStatus,
    postingStatus: input.postingStatus,
    draftStatus: input.draftStatus,
    hasDraft: true,
    latestClassificationRunStatus: input.latestClassificationRun?.status ?? null,
    classificationStatus,
  });
  const visibleWarnings = unique([
    ...input.derived.validation.blockers,
    ...input.derived.taxTreatment.warnings,
    ...input.derived.accountingContext.blockingReasons,
    ...input.steps
      .filter((step) => step.status === "blocked")
      .map((step) => step.stale_reason),
  ]);

  let queueCode: DocumentWorkflowQueueCode;

  if (input.documentStatus === "classified_with_open_revision") {
    queueCode = "reopened_needs_manual_remap";
  } else if (input.postingStatus === "posted_final" || input.postingStatus === "locked") {
    queueCode = "posted_final";
  } else if (input.postingStatus === "posted_provisional" && input.derived.validation.canConfirmFinal) {
    queueCode = "ready_for_final_confirmation";
  } else if (input.postingStatus === "posted_provisional") {
    queueCode = "posted_provisional";
  } else if (!factualReady) {
    queueCode = "pending_factual_review";
  } else if (!classificationUpToDate) {
    queueCode = "pending_assignment";
  } else if (input.derived.validation.canPostProvisional && canCreateLearningRule) {
    queueCode = "pending_learning_decision";
  } else if (input.derived.validation.canConfirmFinal) {
    queueCode = "ready_for_final_confirmation";
  } else if (input.derived.validation.canPostProvisional) {
    queueCode = "ready_for_provisional_posting";
  } else {
    queueCode = "pending_assignment";
  }

  const nextRecommendedAction =
    queueCode === "pending_factual_review"
      ? "Completar validacion factual"
      : queueCode === "pending_assignment"
        ? "Ejecutar clasificacion contable"
        : queueCode === "pending_learning_decision"
          ? "Decidir si guardar criterio reusable"
          : queueCode === "ready_for_provisional_posting"
            ? "Postear provisional"
            : queueCode === "ready_for_final_confirmation"
              ? "Confirmar final"
              : queueCode === "reopened_needs_manual_remap"
                ? "Remapear manualmente sin rerun de IA"
                : "Revisar simulacion de IVA";

  return {
    queueCode,
    stepStatuses: {
      factual: resolveStepStatus(input.steps, ["identity", "fields", "amounts"], false),
      context: resolveStepStatus(input.steps, ["operation_context", "accounting_context"], !contextReady),
      classification: classificationUpToDate
        ? "completed"
        : canRunClassification
            ? "ready"
            : classificationStatus === "failed" || classificationStatus === "stale" || classificationStatus === "needs_context"
              ? "blocked"
              : "pending",
      learning: canCreateLearningRule ? "ready" : "pending",
      posting:
        input.postingStatus === "posted_final" || input.postingStatus === "posted_provisional"
          ? "completed"
          : classificationUpToDate
            && (input.derived.validation.canPostProvisional || input.derived.validation.canConfirmFinal)
            ? "ready"
            : "blocked",
      vat:
        input.postingStatus === "posted_provisional" || input.postingStatus === "posted_final"
          ? "ready"
          : "pending",
    },
    nextRecommendedAction,
    visibleWarnings,
    canRunClassification,
    canCreateLearningRule,
    canPostProvisional: classificationUpToDate && input.derived.validation.canPostProvisional,
    canConfirmFinal: classificationUpToDate && input.derived.validation.canConfirmFinal,
    canRunVatPreview:
      (classificationUpToDate && input.derived.validation.canPostProvisional)
      || input.postingStatus === "posted_provisional"
      || input.postingStatus === "posted_final",
    classificationStatus,
  } satisfies DocumentWorkflowState;
}
