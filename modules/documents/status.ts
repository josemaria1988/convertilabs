export type DocumentDirection = "purchase" | "sale" | "other" | "unknown";

export type DocumentOperationalStatus =
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

export const documentTerminalStatuses = new Set([
  "extracted",
  "draft_ready",
  "needs_review",
  "approved",
  "rejected",
  "duplicate",
  "archived",
  "error",
]);

export function formatDocumentStatusLabel(status: string) {
  switch (status) {
    case "uploaded":
      return "Cargado";
    case "queued":
      return "En cola";
    case "extracting":
      return "Extrayendo";
    case "extracted":
      return "Extraido";
    case "processing":
      return "Procesando";
    case "draft_ready":
      return "Borrador listo";
    case "classified":
      return "Clasificado";
    case "classified_with_open_revision":
      return "Revision abierta";
    case "needs_review":
      return "Requiere revision";
    case "approved":
      return "Aprobado";
    case "rejected":
      return "Rechazado";
    case "duplicate":
      return "Duplicado";
    case "archived":
      return "Archivado";
    case "error":
      return "Error";
    default: {
      const normalized = status.replace(/_/g, " ");
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
  }
}

export function getDocumentStatusVariant(status: string) {
  if (["classified", "approved"].includes(status)) {
    return "status-pill status-pill--success";
  }

  if ([
    "uploaded",
    "queued",
    "extracting",
    "extracted",
    "processing",
    "needs_review",
    "draft_ready",
    "classified_with_open_revision",
  ].includes(status)) {
    return "status-pill status-pill--warning";
  }

  if (["error", "rejected", "duplicate"].includes(status)) {
    return "status-pill status-pill--danger";
  }

  return "status-pill status-pill--info";
}

export function formatDocumentOperationalStatusLabel(status: DocumentOperationalStatus | string) {
  switch (status) {
    case "processing":
      return "Procesando";
    case "needs_review":
      return "Necesita revision";
    case "blocked_duplicate":
      return "Bloqueado por duplicado";
    case "blocked_scope":
      return "Fuera de alcance automatico";
    case "blocked_missing_fx":
      return "Bloqueado por FX faltante";
    case "ready_provisional":
      return "Listo para provisional";
    case "posted_provisional_pending_final":
      return "Provisional pendiente de final";
    case "ready_final":
      return "Listo para final";
    case "posted_final":
      return "Confirmado final";
    case "archived":
      return "Archivado";
    case "locked":
      return "Bloqueado";
    case "error":
      return "Error";
    default:
      return formatDocumentStatusLabel(status);
  }
}

export function getDocumentOperationalStatusVariant(status: DocumentOperationalStatus | string) {
  if (["ready_provisional", "ready_final", "posted_final"].includes(status)) {
    return "status-pill status-pill--success";
  }

  if (["processing", "needs_review", "posted_provisional_pending_final"].includes(status)) {
    return "status-pill status-pill--warning";
  }

  if (["blocked_duplicate", "blocked_scope", "blocked_missing_fx", "error"].includes(status)) {
    return "status-pill status-pill--danger";
  }

  return "status-pill status-pill--info";
}

export function getDocumentRoleVariant(role: DocumentDirection | string) {
  if (role === "purchase") {
    return "status-pill status-pill--success";
  }

  if (role === "sale") {
    return "status-pill status-pill--info";
  }

  if (role === "unknown") {
    return "status-pill status-pill--info";
  }

  return "status-pill status-pill--warning";
}

export function getDocumentRoleLabel(role: DocumentDirection | string) {
  if (role === "purchase") {
    return "Compra";
  }

  if (role === "sale") {
    return "Venta";
  }

  if (role === "unknown") {
    return "Pendiente";
  }

  return "Otro";
}
