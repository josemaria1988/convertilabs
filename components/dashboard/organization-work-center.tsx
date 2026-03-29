import { LoadingLink } from "@/components/ui/loading-link";
import type { DocumentWorkspaceListItem } from "@/modules/documents/review";
import {
  groupDocumentsByReviewBucket,
  summarizeDocumentReviewSecondaryBuckets,
} from "@/modules/documents/review-queue";

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
  const secondaryBuckets = summarizeDocumentReviewSecondaryBuckets(documents);
  const bucketCountMap = new Map(groupedBuckets.map((bucket) => [bucket.key, bucket.items.length]));
  const secondaryCountMap = new Map(secondaryBuckets.map((bucket) => [bucket.key, bucket.count]));
  const reviewPendingCount =
    (bucketCountMap.get("factual_review") ?? 0)
    + (bucketCountMap.get("assignment") ?? 0);
  const closeReadyCount =
    (bucketCountMap.get("ready_provisional") ?? 0)
    + (bucketCountMap.get("ready_final") ?? 0);
  const recentDocuments = documents.slice(0, 8);
  const todayTasks = [
    reviewPendingCount > 0
      ? {
        key: "review_pending",
        title: `Revisar ${reviewPendingCount} documento(s) pendientes`,
        helper: "Validacion factual y asignacion contable en la cola principal.",
        href: `/app/o/${slug}/review`,
        cta: "Abrir Revision",
      }
      : null,
    (bucketCountMap.get("blocked") ?? 0) > 0
      ? {
        key: "review_blocked",
        title: `Destrabar ${bucketCountMap.get("blocked") ?? 0} documento(s) bloqueados`,
        helper: "Duplicados, FX y alcance viven en la misma cola operativa.",
        href: `/app/o/${slug}/review`,
        cta: "Resolver bloqueos",
      }
      : null,
    missingFxSummary.count > 0
      ? {
        key: "tax_fx",
        title: `Resolver ${missingFxSummary.count} documento(s) con cotizacion pendiente`,
        helper: "Limpia el periodo fiscal antes de generar el IVA definitivo.",
        href: `/app/o/${slug}/tax`,
        cta: "Abrir Impuestos",
      }
      : null,
    {
      key: "close_period",
      title: "Validar el estado del cierre mensual",
      helper: "Corre el validator y revisa la siguiente transicion disponible.",
      href: `/app/o/${slug}/close`,
      cta: "Abrir Cierre",
    },
  ].filter((item): item is {
    key: string;
    title: string;
    helper: string;
    href: string;
    cta: string;
  } => Boolean(item));

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Centro de trabajo
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Responde que conviene hacer ahora: cargar, revisar, destrabar el periodo fiscal o avanzar el cierre.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={getToneBadgeClassName(supportLevelTone)}>{supportLevelLabel}</span>
            <LoadingLink
              href={`/app/o/${slug}/advanced`}
              pendingLabel="Abriendo..."
              className="ui-button ui-button--secondary"
            >
              Avanzado
            </LoadingLink>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              key: "documents",
              label: "Subir documentos",
              value: secondaryCountMap.get("processing") ?? recentDocuments.length,
              hint: "Carga originales y confirma rapidamente si el lote entro bien.",
              href: `/app/o/${slug}/documents`,
              cta: "Cargar ahora",
              tone: "secondary",
            },
            {
              key: "review",
              label: "Pendientes de revision",
              value: reviewPendingCount,
              hint: "Validacion factual y asignacion viven en una sola cola operativa.",
              href: `/app/o/${slug}/review`,
              cta: "Abrir Revision",
              tone: "primary",
            },
            {
              key: "tax",
              label: "IVA del periodo",
              value: bucketCountMap.get("blocked") ?? 0,
              hint: "Entra por Impuestos para limpiar pendientes antes de generar el resultado.",
              href: `/app/o/${slug}/tax`,
              cta: "Abrir Impuestos",
              tone: "secondary",
            },
            {
              key: "close",
              label: "Estado de cierre",
              value: closeReadyCount,
              hint: "Usa Cierre para correr validator y decidir la siguiente transicion.",
              href: `/app/o/${slug}/close`,
              cta: "Abrir Cierre",
              tone: "secondary",
            },
          ].map((card) => (
            <LoadingLink
              key={card.key}
              href={card.href}
              pendingLabel="Abriendo..."
              className={`rounded-3xl border p-5 transition ${
                card.tone === "primary"
                  ? "border-[rgba(124,157,255,0.34)] bg-[rgba(124,157,255,0.08)] hover:bg-[rgba(124,157,255,0.14)]"
                  : "border-[color:var(--color-border)] bg-white/70 hover:bg-white/85"
              }`}
            >
              <p className="text-sm font-semibold text-white">{card.label}</p>
              <p className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-white">{card.value}</p>
              <p className="mt-2 text-sm text-[color:var(--color-muted)]">{card.hint}</p>
              <span className="mt-4 inline-flex text-sm font-semibold text-white">{card.cta}</span>
            </LoadingLink>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {groupedBuckets.map((bucket) => (
          <article key={bucket.key} className="metric-card">
            <span className="metric-card__label">{bucket.label}</span>
            <span className="metric-card__value">{bucket.items.length}</span>
            <p className="metric-card__hint">{bucket.description}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Tareas de hoy</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                CTAs unicos para mover el cuello de botella del dia sin abrir superficies expertas.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {todayTasks.map((task) => (
              <article
                key={task.key}
                className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{task.title}</p>
                    <p className="mt-1 text-sm text-[color:var(--color-muted)]">{task.helper}</p>
                  </div>
                  <LoadingLink
                    href={task.href}
                    pendingLabel="Abriendo..."
                    className="ui-button ui-button--primary"
                  >
                    {task.cta}
                  </LoadingLink>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Condiciones del piloto</h2>
                <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                  Soporte automatico y observaciones visibles para no perder contexto operativo.
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
                <h2 className="text-[16px] font-semibold text-white">Actividad reciente</h2>
                <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                  Ultimos documentos cargados para saltar rapido al trabajo correcto.
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
