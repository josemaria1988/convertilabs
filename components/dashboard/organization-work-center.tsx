import { LoadingLink } from "@/components/ui/loading-link";
import type { DocumentWorkspaceListItem } from "@/modules/documents/review";
import {
  buildDocumentReviewChips,
  getDocumentReviewBucketKey,
  groupDocumentsByReviewBucket,
} from "@/modules/documents/review-queue";
import {
  formatDocumentOperationalStatusLabel,
  getDocumentOperationalStatusVariant,
} from "@/modules/documents/status";

type OrganizationWorkCenterProps = {
  slug: string;
  documents: DocumentWorkspaceListItem[];
  supportLevelLabel: string;
  supportLevelTone: "success" | "warning" | "danger";
  supportReasons: string[];
  missingFxSummary: {
    count: number;
    dates: string[];
  };
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

function getToneBadgeClassName(tone: OrganizationWorkCenterProps["supportLevelTone"]) {
  switch (tone) {
    case "success":
      return "status-pill status-pill--success";
    case "warning":
      return "status-pill status-pill--warning";
    default:
      return "status-pill status-pill--danger";
  }
}

export function OrganizationWorkCenter({
  slug,
  documents,
  supportLevelLabel,
  supportLevelTone,
  supportReasons,
  missingFxSummary,
}: OrganizationWorkCenterProps) {
  const groupedBuckets = groupDocumentsByReviewBucket(documents);
  const priorities = documents
    .filter((document) => {
      const bucketKey = getDocumentReviewBucketKey(document);
      return bucketKey !== "done" && bucketKey !== "processing";
    })
    .slice(0, 6);
  const recentDocuments = documents.slice(0, 8);

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Centro de trabajo
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Prioriza lo que esta esperando decision humana, deja la carga en un carril separado
              y reserva las superficies expertas para trabajo puntual.
            </p>
          </div>
          <span className={getToneBadgeClassName(supportLevelTone)}>{supportLevelLabel}</span>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-6">
          <LoadingLink href={`/app/o/${slug}/documents`} pendingLabel="Abriendo..." className="rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-4 transition hover:bg-white/85">
            <p className="text-sm font-semibold text-white">Documentos</p>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">
              Subir originales, recibir CFEs y abrir importacion guiada.
            </p>
          </LoadingLink>
          <LoadingLink href={`/app/o/${slug}/review`} pendingLabel="Abriendo..." className="rounded-3xl border border-[rgba(124,157,255,0.34)] bg-[rgba(124,157,255,0.08)] p-4 transition hover:bg-[rgba(124,157,255,0.14)]">
            <p className="text-sm font-semibold text-white">Revision</p>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">
              Cola principal por estados operativos y blockers visibles.
            </p>
          </LoadingLink>
          <LoadingLink href={`/app/o/${slug}/tax`} pendingLabel="Abriendo..." className="rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-4 transition hover:bg-white/85">
            <p className="text-sm font-semibold text-white">Impuestos</p>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">
              Recorrer el periodo IVA y resolver alertas fiscales.
            </p>
          </LoadingLink>
          <LoadingLink href={`/app/o/${slug}/close`} pendingLabel="Abriendo..." className="rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-4 transition hover:bg-white/85">
            <p className="text-sm font-semibold text-white">Cierre</p>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">
              Validar el mes y ejecutar transiciones formales.
            </p>
          </LoadingLink>
          <LoadingLink href={`/app/o/${slug}/audit`} pendingLabel="Abriendo..." className="rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-4 transition hover:bg-white/85">
            <p className="text-sm font-semibold text-white">Importacion masiva</p>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">
              Corridas auditadas para planillas y lotes fuera del loop diario.
            </p>
          </LoadingLink>
          <LoadingLink href={`/app/o/${slug}/advanced`} pendingLabel="Abriendo..." className="rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-4 transition hover:bg-white/85">
            <p className="text-sm font-semibold text-white">Avanzado</p>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">
              Balance, reglas, mapa contable, imports y exports.
            </p>
          </LoadingLink>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {groupedBuckets.map((bucket) => (
          <article key={bucket.key} className="metric-card">
            <span className="metric-card__label">{bucket.label}</span>
            <span className="metric-card__value">{bucket.items.length}</span>
            <p className="metric-card__hint">{bucket.description}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Prioridades de revision</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Lo mas util para mover hoy: revisar pendientes, destrabar blockers y cerrar
                documentos listos.
              </p>
            </div>
            <LoadingLink
              href={`/app/o/${slug}/review`}
              pendingLabel="Abriendo revision..."
              className="ui-button ui-button--secondary"
            >
              Abrir cola completa
            </LoadingLink>
          </div>

          <div className="mt-4 space-y-3">
            {priorities.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                No hay documentos esperando decision manual inmediata.
              </div>
            ) : (
              priorities.map((document) => {
                const chips = buildDocumentReviewChips(document);

                return (
                  <article
                    key={document.id}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{document.originalFilename}</p>
                        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                          {document.counterpartyName ?? "Contraparte pendiente"} · {formatDateLabel(document.documentDate ?? document.createdAt)}
                        </p>
                      </div>
                      <span className={getDocumentOperationalStatusVariant(document.canonicalState)}>
                        {formatDocumentOperationalStatusLabel(document.canonicalState)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {chips.map((chip) => (
                        <span key={`${document.id}:${chip}`} className="status-pill status-pill--warning">
                          {chip}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--color-muted)]">
                      <span>Total {formatAmount(document.totalAmount)}</span>
                      <LoadingLink
                        href={document.processedHref ?? `/app/o/${slug}/documents`}
                        pendingLabel="Abriendo..."
                        className="ui-button ui-button--primary"
                      >
                        {document.processedHref ? "Abrir revision" : "Ir a Documentos"}
                      </LoadingLink>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Guardrails del MVP</h2>
                <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                  Estado de soporte automatico y observaciones visibles para el equipo.
                </p>
              </div>
              <span className={getToneBadgeClassName(supportLevelTone)}>{supportLevelLabel}</span>
            </div>

            <div className="mt-4 space-y-3 text-sm text-[color:var(--color-muted)]">
              {supportReasons.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950">
                  La organizacion entra dentro del perimetro automatico conservador del MVP.
                </div>
              ) : (
                supportReasons.map((reason) => (
                  <div key={reason} className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3">
                    {reason}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Moneda extranjera</h2>
                <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                  Seguimiento rapido de documentos trabados por cotizacion fiscal.
                </p>
              </div>
              <span className={missingFxSummary.count > 0 ? "status-pill status-pill--danger" : "status-pill status-pill--success"}>
                {missingFxSummary.count}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-sm text-[color:var(--color-muted)]">
              {missingFxSummary.count > 0
                ? `Hay ${missingFxSummary.count} documento(s) esperando cotizacion. ${missingFxSummary.dates.length > 0 ? `Fechas visibles: ${missingFxSummary.dates.slice(0, 3).join(", ")}.` : ""}`
                : "No hay documentos visibles bloqueados por cotizacion BCU."}
            </div>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Actividad reciente</h2>
                <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                  Ultimos documentos cargados en la organizacion.
                </p>
              </div>
              <span className="ui-filter">{recentDocuments.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {recentDocuments.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Todavia no hay documentos visibles.
                </div>
              ) : (
                recentDocuments.map((document) => (
                  <LoadingLink
                    key={document.id}
                    href={document.processedHref ?? `/app/o/${slug}/documents`}
                    pendingLabel="Abriendo..."
                    className="ui-subtle-row"
                  >
                    <div>
                      <p className="text-white">{document.originalFilename}</p>
                      <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                        {document.counterpartyName ?? "Contraparte pendiente"}
                      </p>
                    </div>
                    <span>{formatDateLabel(document.createdAt)}</span>
                  </LoadingLink>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
