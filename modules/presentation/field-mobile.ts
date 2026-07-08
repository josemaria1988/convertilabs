import type { DocumentWorkspaceListItem } from "@/modules/documents/review";
import { getDocumentReviewBucketKey } from "@/modules/documents/review-queue";
import { formatDocumentOperationalStatusLabel } from "@/modules/documents/status";

export type FieldMobileSummaryCard = {
  key: string;
  label: string;
  value: number;
  helper: string;
  tone: "accent" | "success" | "warning";
};

export type FieldMobileActivityCard = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  actionLabel: string;
  statusLabel: string;
  statusTone: "info" | "success" | "warning" | "danger";
  createdAtLabel: string;
  contextLabel: string | null;
  detailLabel: string | null;
  blockingReason: string | null;
};

function formatDateLabel(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function resolveStatusTone(item: DocumentWorkspaceListItem): FieldMobileActivityCard["statusTone"] {
  if (
    item.canonicalState === "blocked_duplicate"
    || item.canonicalState === "blocked_missing_fx"
    || item.canonicalState === "blocked_scope"
    || item.canonicalState === "error"
  ) {
    return "danger";
  }

  if (
    item.canonicalState === "ready_provisional"
    || item.canonicalState === "ready_final"
    || item.canonicalState === "posted_final"
  ) {
    return "success";
  }

  if (
    item.canonicalState === "processing"
    || item.canonicalState === "needs_review"
    || item.canonicalState === "posted_provisional_pending_final"
  ) {
    return "warning";
  }

  return "info";
}

export function buildFieldMobileSummary(items: DocumentWorkspaceListItem[]): FieldMobileSummaryCard[] {
  const summary = {
    processing: 0,
    review: 0,
    blocked: 0,
  };

  for (const item of items) {
    const bucketKey = getDocumentReviewBucketKey(item);

    if (bucketKey === "processing") {
      summary.processing += 1;
      continue;
    }

    if (bucketKey === "blocked") {
      summary.blocked += 1;
      continue;
    }

    summary.review += 1;
  }

  return [
    {
      key: "processing",
      label: "Procesando",
      value: summary.processing,
      helper: "Documentos que ya entraron y siguen corriendo por el loop canonico.",
      tone: "accent",
    },
    {
      key: "review",
      label: "Para revisar",
      value: summary.review,
      helper: "Casos listos para decision humana o seguimiento cercano.",
      tone: "success",
    },
    {
      key: "blocked",
      label: "Bloqueados",
      value: summary.blocked,
      helper: "Duplicados, FX u otras incidencias visibles.",
      tone: "warning",
    },
  ];
}

export function buildFieldMobileActivityCards(input: {
  items: DocumentWorkspaceListItem[];
  organizationSlug: string;
  costCenterNameById?: Map<string, string>;
  workUnitNameById?: Map<string, string>;
  limit?: number;
}) {
  const limitedItems =
    typeof input.limit === "number" && input.limit > 0
      ? input.items.slice(0, input.limit)
      : input.items;

  return limitedItems.map((item) => {
    const href = item.processedHref ?? `/app/o/${input.organizationSlug}/documents`;
    const subtitleParts = [
      item.counterpartyName ?? "Contraparte pendiente",
      formatDateLabel(item.documentDate ?? item.createdAt),
    ];
    const detailLabel =
      typeof item.totalAmount === "number"
        ? `Total ${new Intl.NumberFormat("es-UY", {
            maximumFractionDigits: 0,
          }).format(item.totalAmount)}`
        : null;

    return {
      id: item.id,
      title: item.originalFilename,
      subtitle: subtitleParts.join(" - "),
      href,
      actionLabel: item.processedHref ? "Abrir revision" : "Ver documentos",
      statusLabel: formatDocumentOperationalStatusLabel(item.canonicalState),
      statusTone: resolveStatusTone(item),
      createdAtLabel: formatDateLabel(item.createdAt),
      contextLabel: resolveDocumentContextLabel({
        item,
        costCenterNameById: input.costCenterNameById,
        workUnitNameById: input.workUnitNameById,
      }),
      detailLabel,
      blockingReason: item.blockingReason,
    } satisfies FieldMobileActivityCard;
  });
}

export function resolveDocumentContextLabel(input: {
  item: Pick<DocumentWorkspaceListItem, "costCenterId" | "workUnitId">;
  costCenterNameById?: Map<string, string>;
  workUnitNameById?: Map<string, string>;
}) {
  if (input.item.workUnitId) {
    return `Trabajo: ${input.workUnitNameById?.get(input.item.workUnitId) ?? "asociado"}`;
  }

  if (input.item.costCenterId) {
    return `Proyecto: ${input.costCenterNameById?.get(input.item.costCenterId) ?? "asociado"}`;
  }

  return null;
}
