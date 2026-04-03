import { LoadingLink } from "@/components/ui/loading-link";
import type { DocumentWorkspaceListItem } from "@/modules/documents/review";
import {
  buildDocumentReviewChips,
  groupDocumentsByReviewBucket,
  summarizeDocumentReviewSecondaryBuckets,
} from "@/modules/documents/review-queue";
import {
  formatDocumentOperationalStatusLabel,
  getDocumentOperationalStatusVariant,
} from "@/modules/documents/status";

type DocumentReviewQueueProps = {
  slug: string;
  documents: DocumentWorkspaceListItem[];
  costCenterNameById: Record<string, string>;
};

function formatDateLabel(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatAmount(value: number | null) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function DocumentReviewQueue({
  slug,
  documents,
  costCenterNameById,
}: DocumentReviewQueueProps) {
  const groupedBuckets = groupDocumentsByReviewBucket(documents);
  const secondaryBuckets = summarizeDocumentReviewSecondaryBuckets(documents);
  const firstActionableDocument = groupedBuckets.flatMap((bucket) => bucket.items)
    .find((document) => document.processedHref);
  const assignmentDocuments = groupedBuckets.find((bucket) => bucket.key === "assignment")?.items ?? [];

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {groupedBuckets.map((bucket) => (
          <article key={bucket.key} className="metric-card">
            <span className="metric-card__label">{bucket.label}</span>
            <span className="metric-card__value">{bucket.items.length}</span>
            <p className="metric-card__hint">{bucket.description}</p>
          </article>
        ))}
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Siguiente mejor movimiento</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              La cola principal muestra solo trabajo accionable. Procesando y finalizados quedan como referencias secundarias.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {secondaryBuckets.map((bucket) => (
              <span key={bucket.key} className="ui-filter">
                {bucket.label}: {bucket.count}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <LoadingLink
            href={firstActionableDocument?.processedHref ?? `/app/o/${slug}/documents`}
            pendingLabel="Abriendo..."
            className="ui-button ui-button--primary w-full sm:w-auto"
          >
            {firstActionableDocument ? "Abrir siguiente pendiente" : "Ir a Documentos"}
          </LoadingLink>
          <LoadingLink
            href={`/app/o/${slug}/documents/pending-assignment`}
            pendingLabel="Abriendo lotes..."
            className="ui-button ui-button--secondary w-full sm:w-auto"
          >
            {assignmentDocuments.length > 0 ? "Aplicar decision a lote" : "Abrir cola de lotes"}
          </LoadingLink>
        </div>
      </section>

      {groupedBuckets.map((bucket) => (
        <section key={bucket.key} className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">{bucket.label}</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                {bucket.description}
              </p>
            </div>
            <span className="ui-filter">{bucket.items.length}</span>
          </div>

          <div className="mt-4 space-y-3">
            {bucket.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
                No hay documentos visibles en este bucket.
              </div>
            ) : (
              bucket.items.map((document) => {
                const chips = buildDocumentReviewChips(document);
                const costCenterName = document.costCenterId
                  ? costCenterNameById[document.costCenterId] ?? null
                  : null;

                return (
                  <article
                    key={document.id}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{document.originalFilename}</p>
                        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                          {document.counterpartyName ?? "Contraparte pendiente"}
                          {" · "}
                          {formatDateLabel(document.documentDate ?? document.createdAt)}
                        </p>
                      </div>
                      <span className={getDocumentOperationalStatusVariant(document.canonicalState)}>
                        {formatDocumentOperationalStatusLabel(document.canonicalState)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {costCenterName ? (
                            <span className="status-pill status-pill--info">
                              Proyecto: {costCenterName}
                            </span>
                          ) : null}
                          {chips.map((chip) => (
                            <span key={`${document.id}:${chip}`} className="status-pill status-pill--warning">
                              {chip}
                            </span>
                          ))}
                          {chips.length === 0 ? (
                            <span className="status-pill status-pill--info">Sin observaciones visibles</span>
                          ) : null}
                        </div>
                        <div className="grid gap-2 text-sm text-[color:var(--color-muted)] md:grid-cols-3">
                          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 px-4 py-3">
                            <p className="font-semibold text-white">Clasificacion</p>
                            <p className="mt-1">{document.classificationStatusLabel}</p>
                          </div>
                          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 px-4 py-3">
                            <p className="font-semibold text-white">Extraccion</p>
                            <p className="mt-1">{document.extractionStatusLabel}</p>
                          </div>
                          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 px-4 py-3">
                            <p className="font-semibold text-white">Monto</p>
                            <p className="mt-1">Total {formatAmount(document.totalAmount)}</p>
                          </div>
                        </div>
                        {document.blockingReason ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                            {document.blockingReason}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-3">
                        <LoadingLink
                          href={document.processedHref ?? `/app/o/${slug}/documents`}
                          pendingLabel="Abriendo..."
                          className="ui-button ui-button--primary w-full"
                        >
                          {document.processedHref ? "Abrir wizard" : "Ir a Documentos"}
                        </LoadingLink>
                        {document.processedHref ? (
                          <LoadingLink
                            href={document.processedHref}
                            pendingLabel="Abriendo..."
                            className="ui-button ui-button--secondary w-full"
                          >
                            Ver detalle
                          </LoadingLink>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
