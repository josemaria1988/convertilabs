import type { DocumentDecisionSnapshot } from "@/modules/documents/document-decision-snapshot";
import type { DocumentWorkflowState, WorkflowStepStatus } from "@/modules/documents/workflow-state";
import { buildDocumentOperationalHeaderView } from "@/modules/presentation/document-decision-view";

export type DocumentReviewGuidedRouteStepStatus = "done" | "current" | "pending";

export type DocumentReviewGuidedRouteStep = {
  key: "classification" | "context" | "accounting" | "close";
  label: string;
  href: string;
  description: string;
  status: DocumentReviewGuidedRouteStepStatus;
};

export type DocumentReviewGuidedRouteView = {
  reviewClosed: boolean;
  reviewSteps: DocumentReviewGuidedRouteStep[];
  nextBestActionCopy: string;
  readinessStatusLabel: string | null;
  provisionalReadinessCopy: string;
  finalReadinessCopy: string;
};

type BuildDocumentReviewGuidedRouteInput = {
  workflowState: DocumentWorkflowState;
  decisionSnapshot: DocumentDecisionSnapshot;
  accountingContextStatus: string | null | undefined;
  hasSavedContext: boolean;
  hasPostingTemplate: boolean;
  manualAssignmentReady: boolean;
};

const ACCOUNTING_CONTEXT_RESOLVED_STATUSES = new Set([
  "not_required",
  "provided",
  "assistant_completed",
  "manual_override",
]);

function isClosedReviewWorkflowState(value: DocumentDecisionSnapshot["workflowState"]) {
  return value === "posted_final" || value === "locked" || value === "archived";
}

function mapWorkflowStepStatus(value: WorkflowStepStatus): DocumentReviewGuidedRouteStepStatus {
  if (value === "completed") {
    return "done";
  }

  if (value === "pending") {
    return "pending";
  }

  return "current";
}

function findChecklistItemDone(snapshot: DocumentDecisionSnapshot, code: string) {
  return snapshot.checklist.find((item) => item.code === code)?.done ?? false;
}

function resolveReadinessStatusLabel(workflowState: DocumentDecisionSnapshot["workflowState"]) {
  if (workflowState === "locked") {
    return "Bloqueado";
  }

  if (workflowState === "archived") {
    return "Archivado";
  }

  return "Cerrado";
}

export function buildDocumentReviewGuidedRoute(
  input: BuildDocumentReviewGuidedRouteInput,
): DocumentReviewGuidedRouteView {
  const operationalHeader = buildDocumentOperationalHeaderView(input.decisionSnapshot);
  const reviewClosed = isClosedReviewWorkflowState(input.decisionSnapshot.workflowState);
  const contextResolved =
    reviewClosed
    || input.decisionSnapshot.accountingContextResolved
    || input.hasSavedContext
    || ACCOUNTING_CONTEXT_RESOLVED_STATUSES.has(input.accountingContextStatus ?? "")
    || input.workflowState.stepStatuses.context === "completed";
  const mainAccountResolved = findChecklistItemDone(input.decisionSnapshot, "main_account");
  const previewBalanced =
    input.decisionSnapshot.previewBalanced
    || findChecklistItemDone(input.decisionSnapshot, "balanced_preview");
  const postingStageReady =
    input.workflowState.stepStatuses.posting === "ready"
    || input.workflowState.stepStatuses.posting === "completed";
  const accountingResolved =
    reviewClosed
    || input.decisionSnapshot.canPostProvisional
    || input.decisionSnapshot.canConfirmFinal
    || postingStageReady
    || (
      input.decisionSnapshot.classificationResolved
      && contextResolved
      && input.hasPostingTemplate
      && (input.manualAssignmentReady || mainAccountResolved)
      && previewBalanced
    );

  const classificationStatus: DocumentReviewGuidedRouteStepStatus =
    reviewClosed || input.decisionSnapshot.classificationResolved
      ? "done"
      : mapWorkflowStepStatus(input.workflowState.stepStatuses.classification);
  const contextStatus: DocumentReviewGuidedRouteStepStatus =
    contextResolved
      ? "done"
      : classificationStatus === "done"
        ? mapWorkflowStepStatus(input.workflowState.stepStatuses.context)
        : "pending";
  const accountingStatus: DocumentReviewGuidedRouteStepStatus =
    accountingResolved
      ? "done"
      : contextStatus === "done"
        ? mapWorkflowStepStatus(input.workflowState.stepStatuses.posting)
        : "pending";
  const closeStatus: DocumentReviewGuidedRouteStepStatus =
    reviewClosed
      ? "done"
      : accountingStatus === "done" || input.decisionSnapshot.postingState === "posted_provisional"
        ? "current"
        : "pending";

  const readinessSummary = reviewClosed ? operationalHeader.workflowSummary : null;

  return {
    reviewClosed,
    reviewSteps: [
      {
        key: "classification",
        label: "1. Clasificacion",
        href: "#review-stage-classification",
        description: "Revisar sugerencia automatica y decidir si basta o hay que abrir manual.",
        status: classificationStatus,
      },
      {
        key: "context",
        label: "2. Contexto",
        href: "#review-stage-context",
        description: "Definir operacion, cobro o pago y notas del negocio cuando haga falta.",
        status: contextStatus,
      },
      {
        key: "accounting",
        label: "3. Asiento",
        href: "#review-stage-accounting",
        description: "Confirmar plantilla contable y asiento tipo, resolver cuentas por rol y validar preview contable.",
        status: accountingStatus,
      },
      {
        key: "close",
        label: "4. Cierre",
        href: "#review-stage-close",
        description: "Postear provisional, confirmar final o reabrir la revision.",
        status: closeStatus,
      },
    ],
    nextBestActionCopy:
      operationalHeader.nextBestAction ?? "Revisar estado actual del documento",
    readinessStatusLabel:
      reviewClosed ? resolveReadinessStatusLabel(input.decisionSnapshot.workflowState) : null,
    provisionalReadinessCopy:
      readinessSummary ?? operationalHeader.provisional.summary,
    finalReadinessCopy:
      readinessSummary ?? operationalHeader.final.summary,
  };
}
