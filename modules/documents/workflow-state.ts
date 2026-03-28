import type {
  DerivedDraftArtifacts,
  DocumentAssignmentRunRecord,
  DocumentPostingStatus,
} from "@/modules/accounting";
import { hasManualClassificationResolution } from "@/modules/accounting/manual-resolution";

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

export type CanonicalDocumentState =
  | "processing"
  | "needs_review"
  | "blocked_duplicate"
  | "blocked_scope"
  | "blocked_missing_fx"
  | "ready_provisional"
  | "posted_provisional_pending_final"
  | "ready_final"
  | "posted_final"
  | "archived"
  | "locked"
  | "error";

export type DocumentOperationalBucket =
  | "processing"
  | "review"
  | "blocked"
  | "ready_to_post"
  | "done";

export type DocumentOperationalFlagCode =
  | "blocked_duplicate"
  | "blocked_missing_fx"
  | "blocked_scope"
  | "imports_assisted";

export type DocumentSupportLevel =
  | "automatic"
  | "assisted_only"
  | "blocked";

export type ImportReviewStatus =
  | "assisted_ok"
  | "manual_required"
  | "blocked";

export type WorkflowStepStatus =
  | "pending"
  | "ready"
  | "blocked"
  | "completed";

export type DocumentActionPermissions = {
  canRunClassification: boolean;
  canCreateLearningRule: boolean;
  canPostProvisional: boolean;
  canConfirmFinal: boolean;
  canConfirm: boolean;
  canReopen: boolean;
  canRunVatPreview: boolean;
};

export type DocumentWorkflowState = {
  queueCode: DocumentWorkflowQueueCode;
  canonicalState: CanonicalDocumentState;
  operationalBucket: DocumentOperationalBucket;
  operationalFlags: DocumentOperationalFlagCode[];
  blockingReason: string | null;
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
  permissions: DocumentActionPermissions;
  canRunClassification: boolean;
  canCreateLearningRule: boolean;
  canPostProvisional: boolean;
  canConfirmFinal: boolean;
  canConfirm: boolean;
  canReopen: boolean;
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

function normalizeReasonText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function hasMissingFxBlockingReason(reasons: Array<string | null | undefined>) {
  return reasons.some((reason) => {
    const normalized = normalizeReasonText(reason);

    return (
      normalized.includes("missing_fx_rate")
      || normalized.includes("mising_fx_rate")
      || normalized.includes("cotizacion bcu")
      || normalized.includes("tipo de cambio fiscal")
      || normalized.includes("sin cotizacion")
      || normalized.includes("cross-currency settlement")
    );
  });
}

function hasUnresolvedDuplicateStatus(duplicateStatus: string | null | undefined) {
  return (
    duplicateStatus === "suspected_duplicate"
    || duplicateStatus === "confirmed_duplicate"
  );
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value && value.trim()))),
  );
}

function buildSupportLevelFlags(input: {
  supportLevel?: DocumentSupportLevel | null;
  importReviewStatus?: ImportReviewStatus | null;
}) {
  const flags: DocumentOperationalFlagCode[] = [];

  if (input.supportLevel && input.supportLevel !== "automatic") {
    flags.push("blocked_scope");
  }

  if (input.importReviewStatus) {
    flags.push("imports_assisted");
  }

  return flags;
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

export function deriveCanonicalDocumentState(input: {
  documentStatus: string;
  postingStatus: DocumentPostingStatus | null;
  hasDraft: boolean;
  factualReady: boolean;
  classificationUpToDate: boolean;
  canPostProvisional: boolean;
  canConfirmFinal: boolean;
  visibleWarnings: string[];
  duplicateStatus?: string | null;
  supportLevel?: DocumentSupportLevel | null;
  importReviewStatus?: ImportReviewStatus | null;
}): {
  canonicalState: CanonicalDocumentState;
  operationalBucket: DocumentOperationalBucket;
  operationalFlags: DocumentOperationalFlagCode[];
  blockingReason: string | null;
} {
  const operationalFlags = unique([
    hasUnresolvedDuplicateStatus(input.duplicateStatus) ? "blocked_duplicate" : null,
    hasMissingFxBlockingReason(input.visibleWarnings) ? "blocked_missing_fx" : null,
    ...buildSupportLevelFlags({
      supportLevel: input.supportLevel,
      importReviewStatus: input.importReviewStatus,
    }),
  ]) as DocumentOperationalFlagCode[];
  const blockingReason =
    hasUnresolvedDuplicateStatus(input.duplicateStatus)
      ? "El documento sigue marcado como duplicado y requiere resolucion manual."
      : input.visibleWarnings[0] ?? null;

  let canonicalState: CanonicalDocumentState;

  if (input.documentStatus === "archived") {
    canonicalState = "archived";
  } else if (input.postingStatus === "locked") {
    canonicalState = "locked";
  } else if (input.postingStatus === "posted_final") {
    canonicalState = "posted_final";
  } else if (input.documentStatus === "error") {
    canonicalState = "error";
  } else if (
    !input.hasDraft
    || ["uploaded", "queued", "extracting", "processing"].includes(input.documentStatus)
  ) {
    canonicalState = "processing";
  } else if (operationalFlags.includes("blocked_duplicate")) {
    canonicalState = "blocked_duplicate";
  } else if (operationalFlags.includes("blocked_missing_fx")) {
    canonicalState = "blocked_missing_fx";
  } else if (
    operationalFlags.includes("blocked_scope")
    && input.supportLevel === "blocked"
  ) {
    canonicalState = "blocked_scope";
  } else if (input.postingStatus === "posted_provisional") {
    canonicalState = "posted_provisional_pending_final";
  } else if (input.canConfirmFinal) {
    canonicalState = "ready_final";
  } else if (input.canPostProvisional) {
    canonicalState = "ready_provisional";
  } else if (!input.factualReady || !input.classificationUpToDate) {
    canonicalState = "needs_review";
  } else {
    canonicalState = "needs_review";
  }

  const operationalBucket: DocumentOperationalBucket =
    canonicalState === "processing"
      ? "processing"
      : [
          "blocked_duplicate",
          "blocked_missing_fx",
          "blocked_scope",
          "error",
        ].includes(canonicalState)
        ? "blocked"
        : [
            "ready_provisional",
            "ready_final",
            "posted_provisional_pending_final",
          ].includes(canonicalState)
          ? "ready_to_post"
          : ["posted_final", "archived", "locked"].includes(canonicalState)
            ? "done"
            : "review";

  return {
    canonicalState,
    operationalBucket,
    operationalFlags,
    blockingReason,
  };
}

export function deriveDocumentActionPermissions(input: {
  classificationUpToDate: boolean;
  canRunClassification: boolean;
  canCreateLearningRule: boolean;
  canPostProvisionalByValidation: boolean;
  canConfirmFinalByValidation: boolean;
  postingStatus: DocumentPostingStatus | null;
  documentStatus: string;
  draftStatus: string;
  supportLevel?: DocumentSupportLevel | null;
  importReviewStatus?: ImportReviewStatus | null;
}) {
  const scopeBlocksFinal =
    input.supportLevel === "assisted_only"
    || input.supportLevel === "blocked";
  const importBlocksFinal = input.importReviewStatus !== null && input.importReviewStatus !== undefined;
  const canPostProvisional =
    input.classificationUpToDate
    && input.canPostProvisionalByValidation
    && input.supportLevel !== "blocked";
  const canConfirmFinal =
    input.classificationUpToDate
    && input.canConfirmFinalByValidation
    && !scopeBlocksFinal
    && !importBlocksFinal;

  return {
    canRunClassification: input.canRunClassification,
    canCreateLearningRule: input.canCreateLearningRule,
    canPostProvisional,
    canConfirmFinal,
    canConfirm: canConfirmFinal,
    canReopen:
      input.documentStatus === "classified"
      || input.draftStatus === "confirmed"
      || input.postingStatus === "posted_final"
      || input.postingStatus === "locked",
    canRunVatPreview:
      canPostProvisional
      || input.postingStatus === "posted_provisional"
      || input.postingStatus === "posted_final",
  } satisfies DocumentActionPermissions;
}

export function deriveDocumentWorkflowState(input: {
  documentStatus: string;
  postingStatus: DocumentPostingStatus | null;
  draftStatus: string;
  steps: DraftStepStatus[];
  derived: DerivedDraftArtifacts;
  latestClassificationRun: DocumentAssignmentRunRecord | null;
  learningOptionCount: number;
  duplicateStatus?: string | null;
  supportLevel?: DocumentSupportLevel | null;
  importReviewStatus?: ImportReviewStatus | null;
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
  const manualClassificationResolved = Boolean(
    input.derived.appliedRule.accountId
    && hasManualClassificationResolution(input.derived.accountingContext),
  );
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
  const permissions = deriveDocumentActionPermissions({
    classificationUpToDate,
    canRunClassification,
    canCreateLearningRule,
    canPostProvisionalByValidation: input.derived.validation.canPostProvisional,
    canConfirmFinalByValidation: input.derived.validation.canConfirmFinal,
    postingStatus: input.postingStatus,
    documentStatus: input.documentStatus,
    draftStatus: input.draftStatus,
    supportLevel: input.supportLevel,
    importReviewStatus: input.importReviewStatus,
  });
  const canonical = deriveCanonicalDocumentState({
    documentStatus: input.documentStatus,
    postingStatus: input.postingStatus,
    hasDraft: true,
    factualReady,
    classificationUpToDate,
    canPostProvisional: permissions.canPostProvisional,
    canConfirmFinal: permissions.canConfirmFinal,
    visibleWarnings,
    duplicateStatus: input.duplicateStatus,
    supportLevel: input.supportLevel,
    importReviewStatus: input.importReviewStatus,
  });

  let queueCode: DocumentWorkflowQueueCode;

  if (input.documentStatus === "classified_with_open_revision") {
    queueCode = "reopened_needs_manual_remap";
  } else if (input.postingStatus === "posted_final" || input.postingStatus === "locked") {
    queueCode = "posted_final";
  } else if (input.postingStatus === "posted_provisional" && permissions.canConfirmFinal) {
    queueCode = "ready_for_final_confirmation";
  } else if (input.postingStatus === "posted_provisional") {
    queueCode = "posted_provisional";
  } else if (canonical.canonicalState === "blocked_duplicate") {
    queueCode = "pending_assignment";
  } else if (canonical.canonicalState === "blocked_missing_fx") {
    queueCode = "ready_for_provisional_posting";
  } else if (canonical.canonicalState === "blocked_scope") {
    queueCode = permissions.canPostProvisional
      ? "ready_for_provisional_posting"
      : "pending_assignment";
  } else if (!factualReady) {
    queueCode = "pending_factual_review";
  } else if (!classificationUpToDate) {
    queueCode = "pending_assignment";
  } else if (permissions.canPostProvisional && canCreateLearningRule) {
    queueCode = "pending_learning_decision";
  } else if (permissions.canConfirmFinal) {
    queueCode = "ready_for_final_confirmation";
  } else if (permissions.canPostProvisional) {
    queueCode = "ready_for_provisional_posting";
  } else {
    queueCode = "pending_assignment";
  }

  const nextRecommendedAction =
    canonical.canonicalState === "blocked_duplicate"
      ? "Resolver duplicado"
      : canonical.canonicalState === "blocked_missing_fx"
        ? "Resolver tipo de cambio fiscal"
        : canonical.canonicalState === "blocked_scope"
          ? "Continuar en modo asistido"
          : canonical.canonicalState === "processing"
            ? "Esperar procesamiento"
            : queueCode === "pending_factual_review"
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
    canonicalState: canonical.canonicalState,
    operationalBucket: canonical.operationalBucket,
    operationalFlags: canonical.operationalFlags,
    blockingReason: canonical.blockingReason,
    stepStatuses: {
      factual: resolveStepStatus(input.steps, ["identity", "fields", "amounts"], false),
      context: resolveStepStatus(input.steps, ["operation_context", "accounting_context"], !contextReady),
      classification: classificationUpToDate
        ? "completed"
        : canRunClassification
          ? "ready"
          : classificationStatus === "failed"
              || classificationStatus === "stale"
              || classificationStatus === "needs_context"
            ? "blocked"
            : "pending",
      learning: canCreateLearningRule ? "ready" : "pending",
      posting:
        input.postingStatus === "posted_final" || input.postingStatus === "posted_provisional"
          ? "completed"
          : classificationUpToDate
              && (permissions.canPostProvisional || permissions.canConfirmFinal)
            ? "ready"
            : "blocked",
      vat:
        input.postingStatus === "posted_provisional" || input.postingStatus === "posted_final"
          ? "ready"
          : "pending",
    },
    nextRecommendedAction,
    visibleWarnings,
    permissions,
    canRunClassification: permissions.canRunClassification,
    canCreateLearningRule: permissions.canCreateLearningRule,
    canPostProvisional: permissions.canPostProvisional,
    canConfirmFinal: permissions.canConfirmFinal,
    canConfirm: permissions.canConfirm,
    canReopen: permissions.canReopen,
    canRunVatPreview: permissions.canRunVatPreview,
    classificationStatus,
  } satisfies DocumentWorkflowState;
}
