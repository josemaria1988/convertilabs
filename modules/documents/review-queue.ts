import type { DocumentWorkspaceListItem } from "@/modules/documents/review";

export type DocumentReviewBucketKey =
  | "processing"
  | "needs_review"
  | "blocked"
  | "ready_provisional"
  | "ready_final"
  | "done";

export type DocumentReviewBucketDefinition = {
  key: DocumentReviewBucketKey;
  label: string;
  description: string;
};

export const documentReviewBucketDefinitions: DocumentReviewBucketDefinition[] = [
  {
    key: "processing",
    label: "Procesando",
    description: "Documentos todavia en ingestion, extraccion o reintento tecnico.",
  },
  {
    key: "needs_review",
    label: "Pendientes de revision",
    description: "Casos listos para decision humana dentro del flujo principal.",
  },
  {
    key: "blocked",
    label: "Bloqueados",
    description: "Documentos detenidos por duplicados, FX, alcance o incidencias visibles.",
  },
  {
    key: "ready_provisional",
    label: "Listos para provisional",
    description: "Documentos ya aptos para impacto contable provisional.",
  },
  {
    key: "ready_final",
    label: "Listos para final",
    description: "Documentos casi cerrados o ya posteados provisionalmente.",
  },
  {
    key: "done",
    label: "Finalizados",
    description: "Documentos confirmados, archivados o bloqueados por periodo.",
  },
];

export function getDocumentReviewBucketKey(
  item: Pick<
    DocumentWorkspaceListItem,
    "canonicalState" | "operationalFlags" | "classificationStatus" | "manualInterventionBy"
  >,
): DocumentReviewBucketKey {
  if (item.canonicalState === "processing") {
    return "processing";
  }

  if (
    item.canonicalState === "blocked_duplicate"
    || item.canonicalState === "blocked_missing_fx"
    || item.canonicalState === "blocked_scope"
    || item.canonicalState === "error"
  ) {
    return "blocked";
  }

  if (item.canonicalState === "ready_provisional") {
    return "ready_provisional";
  }

  if (
    item.canonicalState === "ready_final"
    || item.canonicalState === "posted_provisional_pending_final"
  ) {
    return "ready_final";
  }

  if (
    item.canonicalState === "posted_final"
    || item.canonicalState === "archived"
    || item.canonicalState === "locked"
  ) {
    return "done";
  }

  return "needs_review";
}

export function buildDocumentReviewChips(
  item: Pick<
    DocumentWorkspaceListItem,
    "canonicalState" | "operationalFlags" | "classificationStatus" | "manualInterventionBy"
  >,
) {
  const chips = new Set<string>();
  const bucketKey = getDocumentReviewBucketKey(item);

  for (const flag of item.operationalFlags) {
    switch (flag) {
      case "blocked_duplicate":
        chips.add("Duplicado");
        break;
      case "blocked_missing_fx":
        chips.add("Falta cotizacion");
        break;
      case "blocked_scope":
        chips.add("Fuera de alcance automatico");
        break;
      case "imports_assisted":
        chips.add("Importacion asistida");
        break;
      default:
        break;
    }
  }

  if (
    bucketKey === "needs_review"
    || item.classificationStatus === "failed"
    || item.classificationStatus === "stale"
    || item.manualInterventionBy
  ) {
    chips.add("Requiere revision manual");
  }

  return Array.from(chips);
}

export function groupDocumentsByReviewBucket(items: DocumentWorkspaceListItem[]) {
  return documentReviewBucketDefinitions.map((bucket) => ({
    ...bucket,
    items: items.filter((item) => getDocumentReviewBucketKey(item) === bucket.key),
  }));
}
