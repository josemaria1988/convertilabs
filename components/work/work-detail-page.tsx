import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import type {
  WorkUnitDetail,
  WorkUnitDocumentOption,
} from "@/modules/work";

type WorkDetailPageProps = {
  slug: string;
  workUnit: WorkUnitDetail;
  canManage: boolean;
  documentOptions: WorkUnitDocumentOption[];
  assignDocumentAction: (formData: FormData) => void | Promise<void>;
};

function formatMoney(value: number | null, currencyCode = "UYU") {
  if (value === null) {
    return "Sin dato";
  }

  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatStatus(value: string) {
  switch (value) {
    case "active":
      return "Activo";
    case "planned":
      return "Planificado";
    case "paused":
      return "Pausado";
    case "blocked":
      return "Bloqueado";
    case "completed":
      return "Completado";
    case "archived":
      return "Archivado";
    default:
      return value;
  }
}

function formatDirection(value: string) {
  switch (value) {
    case "purchase":
      return "Compra";
    case "sale":
      return "Venta";
    default:
      return "Documento";
  }
}

function getDocumentHref(slug: string, documentId: string) {
  return `/app/o/${slug}/documents/${documentId}`;
}

export function WorkDetailPage({
  slug,
  workUnit,
  canManage,
  documentOptions,
  assignDocumentAction,
}: WorkDetailPageProps) {
  const unlinkedDocumentOptions = documentOptions.filter((document) =>
    !document.workUnitId || document.workUnitId === workUnit.id);

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <LoadingLink
              href={`/app/o/${slug}/work`}
              pendingLabel="Volviendo..."
              className="text-sm font-semibold text-[color:var(--color-muted)] underline-offset-4 hover:text-white hover:underline"
            >
              Trabajos
            </LoadingLink>
            <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-white">
              {workUnit.name}
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              {workUnit.customer?.displayName ?? "Cliente pendiente"} / {formatStatus(workUnit.status)}
            </p>
          </div>
          <span className="status-pill status-pill--info">{workUnit.documentCount} documento(s)</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <article className="metric-card">
            <span className="metric-card__label">Venta actual</span>
            <span className="metric-card__value">{formatMoney(workUnit.actualRevenue, workUnit.currencyCode)}</span>
            <p className="metric-card__hint">Resumen guardado en el trabajo.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Costo actual</span>
            <span className="metric-card__value">{formatMoney(workUnit.actualCost, workUnit.currencyCode)}</span>
            <p className="metric-card__hint">Resumen guardado en el trabajo.</p>
          </article>
          <article className="metric-card" data-tone={workUnit.actualMargin >= 0 ? "success" : "warning"}>
            <span className="metric-card__label">Margen actual</span>
            <span className="metric-card__value">{formatMoney(workUnit.actualMargin, workUnit.currencyCode)}</span>
            <p className="metric-card__hint">Ingresos menos costos actuales.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Margen documentos</span>
            <span className="metric-card__value">{formatMoney(workUnit.documentMargin, workUnit.currencyCode)}</span>
            <p className="metric-card__hint">Ventas y compras vinculadas al trabajo.</p>
          </article>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="status-pill status-pill--success">{workUnit.saleDocumentCount} venta(s)</span>
          <span className="status-pill status-pill--info">{workUnit.purchaseDocumentCount} compra(s)</span>
          <span className="status-pill status-pill--warning">{workUnit.pendingDocumentCount} pendiente(s)</span>
          <span className="status-pill status-pill--danger">{workUnit.blockedDocumentCount} bloqueado(s)</span>
          <span className="status-pill status-pill--info">{workUnit.postedDocumentCount} posteado(s)</span>
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Impacto contable y fiscal</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Asientos, open items e IVA derivados de documentos vinculados al trabajo.
            </p>
          </div>
          <LoadingLink
            href={`/app/o/${slug}/money?work=${workUnit.id}`}
            pendingLabel="Abriendo..."
            className="ui-button ui-button--secondary"
          >
            Tesoreria
          </LoadingLink>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <article className="metric-card">
            <span className="metric-card__label">Asientos</span>
            <span className="metric-card__value">{workUnit.journalEntryCount}</span>
            <p className="metric-card__hint">Journal entries con work_unit.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Open items</span>
            <span className="metric-card__value">{workUnit.openItemCount}</span>
            <p className="metric-card__hint">Cuentas vivas del trabajo.</p>
          </article>
          <article className="metric-card" data-tone={workUnit.openReceivableAmount > 0 ? "info" : undefined}>
            <span className="metric-card__label">A cobrar</span>
            <span className="metric-card__value">{formatMoney(workUnit.openReceivableAmount, workUnit.currencyCode)}</span>
            <p className="metric-card__hint">Receivables abiertos.</p>
          </article>
          <article className="metric-card" data-tone={workUnit.openPayableAmount > 0 ? "warning" : undefined}>
            <span className="metric-card__label">A pagar</span>
            <span className="metric-card__value">{formatMoney(workUnit.openPayableAmount, workUnit.currencyCode)}</span>
            <p className="metric-card__hint">Payables abiertos.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">IVA compras</span>
            <span className="metric-card__value">{formatMoney(workUnit.vatInputAmount, workUnit.currencyCode)}</span>
            <p className="metric-card__hint">Tax amount en compras.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">IVA ventas</span>
            <span className="metric-card__value">{formatMoney(workUnit.vatOutputAmount, workUnit.currencyCode)}</span>
            <p className="metric-card__hint">Tax amount en ventas.</p>
          </article>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Ficha</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Cliente, periodo y presupuesto inicial.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="ui-subtle-row">
              <span>Cliente</span>
              <span>{workUnit.customer?.displayName ?? "Pendiente"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Codigo</span>
              <span>{workUnit.code ?? "Sin codigo"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Inicio</span>
              <span>{formatDate(workUnit.startDate)}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Fin</span>
              <span>{formatDate(workUnit.endDate)}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Venta estimada</span>
              <span>{formatMoney(workUnit.estimatedRevenue, workUnit.currencyCode)}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Costo estimado</span>
              <span>{formatMoney(workUnit.estimatedCost, workUnit.currencyCode)}</span>
            </div>
          </div>

          {workUnit.description ? (
            <p className="mt-4 rounded-[6px] border border-[color:var(--color-border)] bg-white/60 px-4 py-3 text-sm text-[color:var(--color-muted)]">
              {workUnit.description}
            </p>
          ) : null}
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Documentos vinculados</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Compras y ventas que alimentan el margen basico del trabajo.
              </p>
            </div>
            <LoadingLink
              href={`/app/o/${slug}/documents`}
              pendingLabel="Abriendo..."
              className="ui-button ui-button--secondary"
            >
              Documentos
            </LoadingLink>
          </div>

          <form action={assignDocumentAction} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="workUnitId" value={workUnit.id} />
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
                Asociar documento existente
              </span>
              <select
                name="documentId"
                disabled={!canManage || unlinkedDocumentOptions.length === 0}
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              >
                <option value="">
                  {unlinkedDocumentOptions.length === 0
                    ? "No hay documentos disponibles"
                    : "Seleccionar documento"}
                </option>
                {unlinkedDocumentOptions.map((document) => (
                  <option key={document.id} value={document.id}>
                    {formatDirection(document.direction)} / {document.originalFilename}
                    {document.documentDate ? ` / ${formatDate(document.documentDate)}` : ""}
                    {document.workUnitId === workUnit.id ? " / ya vinculado" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <SubmitButton
                disabled={!canManage || unlinkedDocumentOptions.length === 0}
                pendingLabel="Asociando..."
                className="ui-button ui-button--primary min-h-[42px] w-full"
              >
                Asociar
              </SubmitButton>
            </div>
          </form>

          <div className="mt-4 space-y-3">
            {workUnit.documents.length === 0 ? (
              <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
                Todavia no hay documentos asociados a este trabajo.
              </div>
            ) : (
              workUnit.documents.map((document) => (
                <LoadingLink
                  key={document.id}
                  href={getDocumentHref(slug, document.id)}
                  pendingLabel="Abriendo..."
                  className="block rounded-[6px] border border-[color:var(--color-border)] bg-white/70 p-4 transition hover:bg-white/85"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{document.originalFilename}</p>
                      <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                        {formatDirection(document.direction)} / {document.documentType ?? "Sin tipo"} / {formatDate(document.documentDate)}
                      </p>
                    </div>
                    <span className="status-pill status-pill--info">
                      {formatMoney(document.totalAmount, document.currencyCode ?? workUnit.currencyCode)}
                    </span>
                  </div>
                </LoadingLink>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
