import type {
  DocumentDecisionSnapshot,
  EligibilityDecision,
  PostingState,
} from "@/modules/documents/document-decision-snapshot";
import {
  formatCanonicalNextActionLabel,
  formatCanonicalResolutionSourceLabel,
  formatCanonicalWorkflowStateLabel,
  formatCanonicalWorkflowStateSummary,
} from "@/modules/presentation/product-language";

type DecisionTone = "success" | "warning" | "blocking";

export type DecisionGateView = {
  ok: boolean;
  label: string;
  summary: string;
  reasons: string[];
  missingConditions: string[];
  actionHint: string | null;
  tone: DecisionTone;
};

export type DocumentOperationalHeaderView = {
  workflowLabel: string;
  workflowSummary: string;
  resolutionSourceLabel: string;
  confidenceLabel: string;
  postingStateLabel: string;
  provisional: DecisionGateView;
  final: DecisionGateView;
  nextBestAction: string | null;
};

const POSTING_STATE_LANGUAGE: Record<PostingState, string> = {
  draft: "Draft operativo",
  ready_provisional: "Listo para provisional",
  posted_provisional: "Posteado provisional",
  ready_final: "Listo para final",
  posted_final: "Confirmado final",
  locked: "Bloqueado",
};

const MISSING_CONDITION_ACTIONS: Record<string, string> = {
  "Datos documentales revisados": "Revisar datos del comprobante",
  "Contexto contable resuelto": "Completar contexto contable",
  "Clasificacion resuelta": "Resolver clasificacion",
  "Cuenta principal definida": "Confirmar cuenta principal",
  "Asiento balanceado": "Revisar preview contable",
  "Tratamiento fiscal resuelto": "Revisar tratamiento fiscal",
  "Sin cuentas temporales": "Cambiar cuentas provisorias",
  "Sin bloqueos criticos": "Resolver blockers visibles",
  "Elegibilidad fiscal para preview": "Revisar elegibilidad fiscal",
  "Posting suficiente para corrida oficial": "Completar posting suficiente",
};

function formatConfidenceLabel(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Sin score visible";
  }

  return `${Math.round(value * 100)}%`;
}

function resolveActionHint(decision: EligibilityDecision) {
  const firstMissingCondition = decision.missingConditions[0] ?? null;

  if (firstMissingCondition && MISSING_CONDITION_ACTIONS[firstMissingCondition]) {
    return MISSING_CONDITION_ACTIONS[firstMissingCondition];
  }

  return null;
}

export function formatPostingStateLabel(value: PostingState) {
  return POSTING_STATE_LANGUAGE[value] ?? value.replace(/_/g, " ");
}

export function buildDecisionGateView(input: {
  decision: EligibilityDecision;
  readyLabel: string;
  blockedLabel: string;
  readySummary: string;
  blockedSummary: string;
}) {
  if (input.decision.ok) {
    return {
      ok: true,
      label: input.readyLabel,
      summary: input.readySummary,
      reasons: [],
      missingConditions: [],
      actionHint: null,
      tone: "success",
    } satisfies DecisionGateView;
  }

  const summary =
    input.decision.reasons[0]
    ?? (input.decision.missingConditions[0]
      ? `Falta: ${input.decision.missingConditions[0]}.`
      : input.blockedSummary);

  return {
    ok: false,
    label: input.blockedLabel,
    summary,
    reasons: input.decision.reasons,
    missingConditions: input.decision.missingConditions,
    actionHint: resolveActionHint(input.decision),
    tone: input.decision.reasons.length > 0 ? "blocking" : "warning",
  } satisfies DecisionGateView;
}

export function buildDocumentOperationalHeaderView(
  snapshot: DocumentDecisionSnapshot,
) {
  const fallbackNextAction = formatCanonicalNextActionLabel(snapshot.workflowState);

  return {
    workflowLabel: formatCanonicalWorkflowStateLabel(snapshot.workflowState),
    workflowSummary: formatCanonicalWorkflowStateSummary(snapshot.workflowState),
    resolutionSourceLabel: formatCanonicalResolutionSourceLabel(snapshot.resolutionSource),
    confidenceLabel: formatConfidenceLabel(snapshot.resolutionConfidence),
    postingStateLabel: formatPostingStateLabel(snapshot.postingState),
    provisional: buildDecisionGateView({
      decision: snapshot.provisionalEligibility,
      readyLabel: "Puede postear provisional",
      blockedLabel: "Todavia no puede postear provisional",
      readySummary: "El documento ya cumple las condiciones operativas para impactar provisionalmente.",
      blockedSummary: "Todavia faltan condiciones para el posting provisional.",
    }),
    final: buildDecisionGateView({
      decision: snapshot.finalEligibility,
      readyLabel: "Puede confirmar final",
      blockedLabel: "Todavia no puede confirmar final",
      readySummary: "El documento ya puede cerrarse como definitivo.",
      blockedSummary: "Todavia faltan condiciones para la confirmacion final.",
    }),
    nextBestAction: snapshot.nextBestAction ?? fallbackNextAction ?? null,
  } satisfies DocumentOperationalHeaderView;
}
