import type { DocumentWorkspaceListItem } from "@/modules/documents/review";

export type DocumentReviewBucketKey =
  | "factual_review"
  | "assignment"
  | "blocked"
  | "ready_provisional"
  | "ready_final"
  | "processing"
  | "done";

export type DocumentReviewBucketDefinition = {
  key: DocumentReviewBucketKey;
  label: string;
  description: string;
};

export const documentReviewPrimaryBucketDefinitions: DocumentReviewBucketDefinition[] = [
  {
    key: "factual_review",
    label: "Por revisar factual",
    description: "Todavia falta validar identidad, datos base o consistencia visible del comprobante.",
  },
  {
    key: "assignment",
    label: "Por asignar o clasificar",
    description: "Casos listos para decision humana, reclasificacion o aprendizaje reutilizable.",
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
];

export const documentReviewSecondaryBucketDefinitions: DocumentReviewBucketDefinition[] = [
  {
    key: "processing",
    label: "Procesando",
    description: "Documentos todavia en ingestion, extraccion o reintento tecnico.",
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
    "canonicalState" | "operationalFlags" | "classificationStatus" | "manualInterventionBy" | "canClassify"
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

  if (item.classificationStatus === "not_started" && !item.canClassify) {
    return "factual_review";
  }

  return "assignment";
}

export function buildDocumentReviewChips(
  item: Pick<
    DocumentWorkspaceListItem,
    "canonicalState" | "operationalFlags" | "classificationStatus" | "manualInterventionBy" | "canClassify"
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

  if (bucketKey === "factual_review") {
    chips.add("Validacion factual");
  }

  if (bucketKey === "assignment") {
    chips.add("Decision contable");
  }

  if (item.classificationStatus === "failed") {
    chips.add("Clasificacion fallida");
  }

  if (item.classificationStatus === "stale") {
    chips.add("Clasificacion vencida");
  }

  if (item.manualInterventionBy) {
    chips.add("Intervencion manual");
  }

  return Array.from(chips);
}

export function groupDocumentsByReviewBucket(
  items: DocumentWorkspaceListItem[],
  options: {
    includeSecondary?: boolean;
  } = {},
) {
  const definitions = options.includeSecondary
    ? [...documentReviewPrimaryBucketDefinitions, ...documentReviewSecondaryBucketDefinitions]
    : documentReviewPrimaryBucketDefinitions;

  return definitions.map((bucket) => ({
    ...bucket,
    items: items.filter((item) => getDocumentReviewBucketKey(item) === bucket.key),
  }));
}

export function summarizeDocumentReviewSecondaryBuckets(items: DocumentWorkspaceListItem[]) {
  return documentReviewSecondaryBucketDefinitions.map((bucket) => ({
    ...bucket,
    count: items.filter((item) => getDocumentReviewBucketKey(item) === bucket.key).length,
  }));
}
