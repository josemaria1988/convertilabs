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
  const normalized = status.replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getDocumentStatusVariant(status: string) {
  if (["classified", "approved"].includes(status)) {
    return "status-pill status-pill--success";
  }

  if (["needs_review", "draft_ready", "classified_with_open_revision"].includes(status)) {
    return "status-pill status-pill--warning";
  }

  if (["error", "rejected"].includes(status)) {
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
