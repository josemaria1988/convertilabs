export type DocumentDirection = "purchase" | "sale" | "other" | "unknown";

export const documentTerminalStatuses = new Set([
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
