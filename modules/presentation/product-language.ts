export type CanonicalWorkflowState =
  | "pending_factual_review"
  | "pending_assignment"
  | "pending_learning_decision"
  | "ready_for_provisional_posting"
  | "posted_provisional"
  | "ready_for_final_confirmation"
  | "posted_final"
  | "reopened_needs_manual_remap"
  | "locked";

export type CanonicalResolutionSource =
  | "rule"
  | "ai"
  | "manual"
  | "mixed"
  | "unknown";

type WorkflowLanguageEntry = {
  label: string;
  summary: string;
  nextActionLabel: string;
};

const WORKFLOW_LANGUAGE: Record<CanonicalWorkflowState, WorkflowLanguageEntry> = {
  pending_factual_review: {
    label: "Pendiente de revision factual",
    summary: "Todavia faltan validar datos del comprobante antes de decidir la clasificacion.",
    nextActionLabel: "Revisar datos del comprobante",
  },
  pending_assignment: {
    label: "Pendiente de asignacion",
    summary: "El documento ya tiene contexto basico, pero la resolucion contable todavia no quedo consolidada.",
    nextActionLabel: "Resolver clasificacion",
  },
  pending_learning_decision: {
    label: "Pendiente de aprendizaje",
    summary: "El documento ya puede avanzar y solo falta decidir si conviene guardar el criterio reusable.",
    nextActionLabel: "Decidir aprendizaje",
  },
  ready_for_provisional_posting: {
    label: "Listo para posting provisional",
    summary: "El documento ya puede impactar contabilidad en modo provisional.",
    nextActionLabel: "Postear provisional",
  },
  posted_provisional: {
    label: "Posteado provisional",
    summary: "El documento ya impacto en contabilidad, pero aun puede requerir confirmacion final o recategorizacion.",
    nextActionLabel: "Revisar para confirmacion final",
  },
  ready_for_final_confirmation: {
    label: "Listo para confirmacion final",
    summary: "La resolucion esta cerrada y ya puede confirmarse como definitiva.",
    nextActionLabel: "Confirmar final",
  },
  posted_final: {
    label: "Confirmado final",
    summary: "El documento ya quedo confirmado y solo admite reapertura controlada.",
    nextActionLabel: "Ver trazabilidad",
  },
  reopened_needs_manual_remap: {
    label: "Reabierto para remap",
    summary: "La revision fue reabierta y requiere remapeo manual antes de volver a cerrar.",
    nextActionLabel: "Remapear manualmente",
  },
  locked: {
    label: "Bloqueado",
    summary: "El documento o su periodo ya no admiten cambios sin una reapertura formal.",
    nextActionLabel: "Revisar bloqueo",
  },
};

const RESOLUTION_SOURCE_LANGUAGE: Record<CanonicalResolutionSource, string> = {
  rule: "Regla",
  ai: "IA",
  manual: "Revision manual",
  mixed: "Mixto",
  unknown: "Pendiente",
};

function normalizeReasonText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function isFiscalFxBlockingReason(value: string | null | undefined) {
  const normalized = normalizeReasonText(value);

  return (
    normalized.includes("mising_fx_rate")
    || normalized.includes("missing_fx_rate")
    || normalized.includes("cotizacion bcu")
    || normalized.includes("tipo de cambio fiscal")
    || normalized.includes("sin cotizacion")
  );
}

export function inferBlockingActionHintFromReasons(
  reasons: Array<string | null | undefined>,
) {
  if (reasons.some((reason) => isFiscalFxBlockingReason(reason))) {
    return "Resolver tipo de cambio fiscal";
  }

  return null;
}

export function formatCanonicalWorkflowStateLabel(
  value: CanonicalWorkflowState | null | undefined,
) {
  if (!value) {
    return "Sin estado";
  }

  return WORKFLOW_LANGUAGE[value]?.label ?? value.replace(/_/g, " ");
}

export function formatCanonicalWorkflowStateSummary(
  value: CanonicalWorkflowState | null | undefined,
) {
  if (!value) {
    return "Todavia no hay una etapa operativa visible.";
  }

  return WORKFLOW_LANGUAGE[value]?.summary ?? value.replace(/_/g, " ");
}

export function formatCanonicalNextActionLabel(
  value: CanonicalWorkflowState | null | undefined,
) {
  if (!value) {
    return "Revisar estado";
  }

  return WORKFLOW_LANGUAGE[value]?.nextActionLabel ?? "Revisar estado";
}

export function formatCanonicalResolutionSourceLabel(
  value: CanonicalResolutionSource | null | undefined,
) {
  if (!value) {
    return RESOLUTION_SOURCE_LANGUAGE.unknown;
  }

  return RESOLUTION_SOURCE_LANGUAGE[value] ?? RESOLUTION_SOURCE_LANGUAGE.unknown;
}
