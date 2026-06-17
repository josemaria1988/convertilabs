import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { CustomerPartySearchField } from "@/components/work/customer-party-search-field";
import type {
  WorkUnitCustomerOption,
  WorkUnitListItem,
} from "@/modules/work";

type WorkListPageProps = {
  slug: string;
  canManage: boolean;
  isAvailable: boolean;
  items: WorkUnitListItem[];
  customerOptions: WorkUnitCustomerOption[];
  createAction: (formData: FormData) => void | Promise<void>;
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

function formatKind(value: string) {
  switch (value) {
    case "job":
      return "Trabajo";
    case "project":
      return "Proyecto";
    case "operation":
      return "Operacion";
    case "internal_cost_center":
      return "Centro interno";
    case "administration":
      return "Administracion";
    case "cost_center":
      return "Centro de costo";
    default:
      return value.replace(/_/g, " ");
  }
}

function getStatusClassName(status: string) {
  if (status === "active") {
    return "status-pill status-pill--success";
  }

  if (status === "blocked" || status === "paused") {
    return "status-pill status-pill--warning";
  }

  return "status-pill status-pill--info";
}

export function WorkListPage({
  slug,
  canManage,
  isAvailable,
  items,
  customerOptions,
  createAction,
}: WorkListPageProps) {
  const activeItems = items.filter((item) =>
    !["archived", "cancelled", "completed"].includes(item.status));
  const documentCount = items.reduce((sum, item) => sum + item.documentCount, 0);
  const totalRevenue = items.reduce((sum, item) => sum + item.actualRevenue, 0);
  const totalCost = items.reduce((sum, item) => sum + item.actualCost, 0);

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Trabajos
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Trabajos, proyectos y centros de costo conectados a clientes, documentos y margen.
            </p>
          </div>
          <span className="status-pill status-pill--info">{items.length} total</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <article className="metric-card" data-tone={activeItems.length > 0 ? "success" : undefined}>
            <span className="metric-card__label">Activos</span>
            <span className="metric-card__value">{activeItems.length}</span>
            <p className="metric-card__hint">Trabajos abiertos para asociar documentos y dinero.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Documentos</span>
            <span className="metric-card__value">{documentCount}</span>
            <p className="metric-card__hint">Comprobantes vinculados a trabajos.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Ingresos</span>
            <span className="metric-card__value">{formatMoney(totalRevenue)}</span>
            <p className="metric-card__hint">Actual segun el resumen del trabajo.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Costos</span>
            <span className="metric-card__value">{formatMoney(totalCost)}</span>
            <p className="metric-card__hint">Actual segun el resumen del trabajo.</p>
          </article>
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Crear trabajo</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Alta minima para empezar el caso operativo: cliente, fechas, presupuesto y descripcion.
            </p>
          </div>
        </div>

        <form action={createAction} className="mt-4 grid gap-3 lg:grid-cols-6">
          <input type="hidden" name="slug" value={slug} />
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Nombre</span>
            <input
              name="name"
              required
              disabled={!canManage || !isAvailable}
              placeholder="Trabajo Nueva Palmira"
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Codigo</span>
            <input
              name="code"
              disabled={!canManage || !isAvailable}
              placeholder="NP-001"
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Tipo</span>
            <select
              name="kind"
              defaultValue="job"
              disabled={!canManage || !isAvailable}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            >
              <option value="job">Trabajo</option>
              <option value="project">Proyecto</option>
              <option value="operation">Operacion</option>
              <option value="internal_cost_center">Centro interno</option>
              <option value="administration">Administracion</option>
            </select>
          </label>
          <CustomerPartySearchField
            name="customerPartyId"
            options={customerOptions}
            disabled={!canManage || !isAvailable}
          />
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Nuevo cliente</span>
            <input
              name="newCustomerName"
              disabled={!canManage || !isAvailable}
              placeholder="Crear cliente si no existe"
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">RUT</span>
            <input
              name="newCustomerTaxId"
              disabled={!canManage || !isAvailable}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Inicio</span>
            <input
              type="date"
              name="startDate"
              disabled={!canManage || !isAvailable}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Fin</span>
            <input
              type="date"
              name="endDate"
              disabled={!canManage || !isAvailable}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Venta estimada</span>
            <input
              name="estimatedRevenue"
              inputMode="decimal"
              disabled={!canManage || !isAvailable}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Costo estimado</span>
            <input
              name="estimatedCost"
              inputMode="decimal"
              disabled={!canManage || !isAvailable}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Moneda</span>
            <input
              name="currencyCode"
              defaultValue="UYU"
              disabled={!canManage || !isAvailable}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1 lg:col-span-5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Descripcion</span>
            <input
              name="description"
              disabled={!canManage || !isAvailable}
              placeholder="Alcance, ubicacion o contexto operativo"
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <div className="flex items-end">
            <SubmitButton
              disabled={!canManage || !isAvailable}
              pendingLabel="Creando..."
              className="ui-button ui-button--primary min-h-[42px] w-full"
            >
              Crear trabajo
            </SubmitButton>
          </div>
        </form>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Listado</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Cada trabajo abre su detalle con cliente, documentos y margen basico.
            </p>
          </div>
          <span className="ui-filter">{items.length}</span>
        </div>

        <div className="mt-4 space-y-3">
          {!isAvailable ? (
            <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
              `work_units` no esta disponible en esta base. Aplica la migracion del modelo madre antes de cargar trabajos.
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
              Todavia no hay trabajos. Crea el primero para conectar cliente, documentos, dinero y margen.
            </div>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className="rounded-[6px] border border-[color:var(--color-border)] bg-white/70 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <LoadingLink
                      href={`/app/o/${slug}/work/${item.id}`}
                      pendingLabel="Abriendo..."
                      className="truncate text-base font-semibold text-white underline-offset-4 hover:underline"
                    >
                      {item.name}
                    </LoadingLink>
                    <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                      {item.customer?.displayName ?? "Cliente pendiente"} / {formatKind(item.kind)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={getStatusClassName(item.status)}>{formatStatus(item.status)}</span>
                    <span className="status-pill status-pill--info">{item.documentCount} documento(s)</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
                  <div className="ui-subtle-row">
                    <span>Venta</span>
                    <span>{formatMoney(item.actualRevenue, item.currencyCode)}</span>
                  </div>
                  <div className="ui-subtle-row">
                    <span>Costo</span>
                    <span>{formatMoney(item.actualCost, item.currencyCode)}</span>
                  </div>
                  <div className="ui-subtle-row">
                    <span>Margen</span>
                    <span>{formatMoney(item.actualMargin, item.currencyCode)}</span>
                  </div>
                  <div className="ui-subtle-row">
                    <span>Actualizado</span>
                    <span>{formatDate(item.updatedAt)}</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
