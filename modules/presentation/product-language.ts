import type { CanonicalDocumentState } from "@/modules/documents/workflow-state";

export type CanonicalWorkflowState = CanonicalDocumentState;

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
  processing: {
    label: "Procesando",
    summary: "El documento todavia esta en ingestion o extraccion y aun no quedo listo para revision operativa.",
    nextActionLabel: "Esperar procesamiento",
  },
  needs_review: {
    label: "Necesita revision",
    summary: "El documento ya existe dentro del flujo, pero todavia no quedo suficientemente resuelto para postear.",
    nextActionLabel: "Completar revision",
  },
  blocked_duplicate: {
    label: "Bloqueado por duplicado",
    summary: "La automatizacion se detiene hasta que el duplicado quede resuelto de forma explicita.",
    nextActionLabel: "Resolver duplicado",
  },
  blocked_scope: {
    label: "Fuera de alcance automatico",
    summary: "El caso puede seguir en modo asistido, pero no debe tratarse como automatizacion cerrada.",
    nextActionLabel: "Continuar en modo asistido",
  },
  blocked_missing_fx: {
    label: "Bloqueado por FX faltante",
    summary: "No hay trazabilidad monetaria suficiente para continuar de forma segura con un documento en moneda extranjera.",
    nextActionLabel: "Resolver tipo de cambio fiscal",
  },
  ready_provisional: {
    label: "Listo para provisional",
    summary: "El documento ya puede impactar contabilidad en modo provisional.",
    nextActionLabel: "Postear provisional",
  },
  posted_provisional_pending_final: {
    label: "Provisional pendiente de final",
    summary: "El documento ya impacto en contabilidad, pero todavia no quedo listo para cierre definitivo.",
    nextActionLabel: "Revisar para confirmacion final",
  },
  ready_final: {
    label: "Listo para final",
    summary: "La resolucion esta cerrada y ya puede confirmarse como definitiva.",
    nextActionLabel: "Confirmar final",
  },
  posted_final: {
    label: "Confirmado final",
    summary: "El documento ya quedo confirmado y solo admite reapertura controlada.",
    nextActionLabel: "Ver trazabilidad",
  },
  archived: {
    label: "Archivado",
    summary: "El documento ya no participa del flujo operativo activo.",
    nextActionLabel: "Ver historial",
  },
  locked: {
    label: "Bloqueado",
    summary: "El documento o su periodo ya no admiten cambios sin una reapertura formal.",
    nextActionLabel: "Revisar bloqueo",
  },
  error: {
    label: "Error",
    summary: "El documento quedo en un estado inconsistente y necesita intervencion operativa.",
    nextActionLabel: "Revisar error",
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

  if (reasons.some((reason) => normalizeReasonText(reason).includes("duplic"))) {
    return "Resolver duplicado";
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
