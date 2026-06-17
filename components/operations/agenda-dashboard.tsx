import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import type {
  AgendaDashboardData,
  EntityOption,
  ObligationItem,
  TaskItem,
} from "@/modules/operations";

type AgendaDashboardProps = {
  slug: string;
  canManage: boolean;
  data: AgendaDashboardData;
  createTaskAction: (formData: FormData) => void | Promise<void>;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "UYU",
  }).format(value);
}

function taxStatusLabel(value: string) {
  switch (value) {
    case "finalized":
      return "Finalizado";
    case "locked":
      return "Bloqueado";
    case "draft":
      return "Borrador";
    case "review":
      return "En revision";
    default:
      return value;
  }
}

function statusLabel(value: TaskItem["status"]) {
  switch (value) {
    case "pending":
      return "Pendiente";
    case "in_progress":
      return "En curso";
    case "blocked":
      return "Bloqueada";
    case "done":
      return "Hecha";
    case "cancelled":
      return "Cancelada";
    default:
      return value;
  }
}

function priorityLabel(value: TaskItem["priority"]) {
  switch (value) {
    case "urgent":
      return "Urgente";
    case "high":
      return "Alta";
    case "low":
      return "Baja";
    default:
      return "Normal";
  }
}

function taskTone(task: TaskItem) {
  if (task.status === "blocked") {
    return "danger";
  }

  if (task.priority === "urgent" || task.priority === "high") {
    return "warning";
  }

  if (task.status === "done") {
    return "success";
  }

  return undefined;
}

function OptionSelect({
  name,
  label,
  options,
  disabled,
}: {
  name: string;
  label: string;
  options: EntityOption[];
  disabled: boolean;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">{label}</span>
      <select
        name={name}
        disabled={disabled}
        className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
      >
        <option value="">Sin vinculo</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}{option.secondaryLabel ? ` / ${option.secondaryLabel}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function TaskCard({
  slug,
  task,
}: {
  slug: string;
  task: TaskItem;
}) {
  return (
    <article
      className="rounded-[6px] border border-[color:var(--color-border)] bg-white/70 p-4"
      data-tone={taskTone(task)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{task.title}</p>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            {formatDate(task.dueDate)} / {priorityLabel(task.priority)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={task.status === "blocked" ? "status-pill status-pill--danger" : "status-pill status-pill--info"}>
            {statusLabel(task.status)}
          </span>
        </div>
      </div>

      {task.description ? (
        <p className="mt-3 text-sm text-[color:var(--color-muted)]">{task.description}</p>
      ) : null}

      {task.blockedReason ? (
        <p className="mt-3 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {task.blockedReason}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {task.partyId ? (
          <LoadingLink
            href={`/app/o/${slug}/directory/${task.partyId}`}
            pendingLabel="Abriendo..."
            className="status-pill status-pill--info"
          >
            {task.partyName ?? "Party"}
          </LoadingLink>
        ) : null}
        {task.workUnitId ? (
          <LoadingLink
            href={`/app/o/${slug}/work/${task.workUnitId}`}
            pendingLabel="Abriendo..."
            className="status-pill status-pill--info"
          >
            {task.workUnitName ?? "Trabajo"}
          </LoadingLink>
        ) : null}
        {task.documentId ? (
          <LoadingLink
            href={`/app/o/${slug}/documents/${task.documentId}`}
            pendingLabel="Abriendo..."
            className="status-pill status-pill--info"
          >
            {task.documentName ?? "Documento"}
          </LoadingLink>
        ) : null}
        {!task.partyId && !task.workUnitId && !task.documentId ? (
          <span className="status-pill status-pill--warning">Sin vinculos</span>
        ) : null}
      </div>
    </article>
  );
}

function ObligationRow({ obligation }: { obligation: ObligationItem }) {
  return (
    <div className="ui-subtle-row">
      <span className="min-w-0">
        <span className="block truncate text-white">{obligation.title}</span>
        <span className="block text-[12px] text-[color:var(--color-muted)]">
          {obligation.frequency} / {obligation.responsibleLabel ?? "Sin responsable"}
        </span>
      </span>
      <span>{formatDate(obligation.nextDueDate)}</span>
    </div>
  );
}

export function AgendaDashboard({
  slug,
  canManage,
  data,
  createTaskAction,
}: AgendaDashboardProps) {
  const disabled = !canManage || !data.isAvailable;

  if (!data.isAvailable) {
    return (
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Agenda
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              El schema de tareas y obligaciones todavia no esta disponible en esta base.
            </p>
          </div>
          <span className="status-pill status-pill--warning">Schema pendiente</span>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Agenda
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Tareas, vencimientos simples y obligaciones conectadas a trabajo, documento y party.
            </p>
          </div>
          <LoadingLink
            href={`/app/o/${slug}/continuity`}
            pendingLabel="Abriendo..."
            className="ui-button ui-button--secondary"
          >
            Continuidad
          </LoadingLink>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <article className="metric-card" data-tone={data.summary.pendingTasks > 0 ? "info" : undefined}>
            <span className="metric-card__label">Abiertas</span>
            <span className="metric-card__value">{data.summary.pendingTasks}</span>
            <p className="metric-card__hint">Pendientes o en curso.</p>
          </article>
          <article className="metric-card" data-tone={data.summary.blockedTasks > 0 ? "danger" : undefined}>
            <span className="metric-card__label">Bloqueadas</span>
            <span className="metric-card__value">{data.summary.blockedTasks}</span>
            <p className="metric-card__hint">Necesitan decision o informacion.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Esta semana</span>
            <span className="metric-card__value">{data.summary.dueThisWeek}</span>
            <p className="metric-card__hint">Tareas con vencimiento cercano.</p>
          </article>
          <article className="metric-card" data-tone={data.summary.unassignedTasks > 0 ? "warning" : undefined}>
            <span className="metric-card__label">Sin vinculo</span>
            <span className="metric-card__value">{data.summary.unassignedTasks}</span>
            <p className="metric-card__hint">No apuntan a party/trabajo/documento.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Obligaciones</span>
            <span className="metric-card__value">{data.summary.activeObligations}</span>
            <p className="metric-card__hint">Vencimientos recurrentes activos.</p>
          </article>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <section className="rounded-[6px] border border-[color:var(--color-border)] bg-white/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-white">IVA</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  {data.tax.isAvailable
                    ? data.tax.latestVatRun
                      ? `${data.tax.latestVatRun.periodLabel} / ${taxStatusLabel(data.tax.latestVatRun.status)}`
                      : "Sin corrida IVA registrada."
                    : "Schema fiscal no disponible."}
                </p>
              </div>
              <LoadingLink
                href={`/app/o/${slug}/tax`}
                pendingLabel="Abriendo..."
                className="ui-button ui-button--secondary"
              >
                Tax
              </LoadingLink>
            </div>
            {data.tax.latestVatRun ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="ui-subtle-row">
                  <span>Neto</span>
                  <span>{formatAmount(data.tax.latestVatRun.netVatPayable)}</span>
                </div>
                <div className="ui-subtle-row">
                  <span>Docs</span>
                  <span>{data.tax.latestVatRun.tracedDocumentsCount}</span>
                </div>
                <div className="ui-subtle-row">
                  <span>Flags</span>
                  <span>{data.tax.latestVatRun.reviewFlagsCount}</span>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-[6px] border border-[color:var(--color-border)] bg-white/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Cierre</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  {data.close.isAvailable
                    ? data.close.latestCheckRun
                      ? `${data.close.latestCheckRun.status} / ${formatDate(data.close.latestCheckRun.createdAt)}`
                      : "Sin validator ejecutado."
                    : "Schema de cierre no disponible."}
                </p>
              </div>
              <LoadingLink
                href={`/app/o/${slug}/close`}
                pendingLabel="Abriendo..."
                className="ui-button ui-button--secondary"
              >
                Cierre
              </LoadingLink>
            </div>
            {data.close.latestCheckRun ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="ui-subtle-row">
                  <span>Blockers</span>
                  <span>{data.close.latestCheckRun.blockerCount}</span>
                </div>
                <div className="ui-subtle-row">
                  <span>Warnings</span>
                  <span>{data.close.latestCheckRun.warningCount}</span>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Crear tarea</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Captura una accion concreta y conectala al modelo madre desde el alta.
            </p>
          </div>
        </div>

        <form action={createTaskAction} className="mt-4 grid gap-3 lg:grid-cols-6">
          <input type="hidden" name="slug" value={slug} />
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Titulo</span>
            <input
              name="title"
              required
              disabled={disabled}
              placeholder="Llamar al cliente por vencimiento"
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Fecha</span>
            <input
              type="date"
              name="dueDate"
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Prioridad</span>
            <select
              name="priority"
              defaultValue="normal"
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            >
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
              <option value="low">Baja</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Estado</span>
            <select
              name="status"
              defaultValue="pending"
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            >
              <option value="pending">Pendiente</option>
              <option value="in_progress">En curso</option>
              <option value="blocked">Bloqueada</option>
            </select>
          </label>
          <OptionSelect name="partyId" label="Party" options={data.options.parties} disabled={disabled} />
          <OptionSelect name="workUnitId" label="Trabajo" options={data.options.workUnits} disabled={disabled} />
          <OptionSelect name="documentId" label="Documento" options={data.options.documents} disabled={disabled} />
          <label className="space-y-1 lg:col-span-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Descripcion</span>
            <input
              name="description"
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Bloqueo</span>
            <input
              name="blockedReason"
              disabled={disabled}
              placeholder="Motivo si queda bloqueada"
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <div className="flex items-end">
            <SubmitButton
              disabled={disabled}
              pendingLabel="Creando..."
              className="ui-button ui-button--primary min-h-[42px] w-full"
            >
              Crear tarea
            </SubmitButton>
          </div>
        </form>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Tareas</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Las tareas se ordenan por vencimiento y mantienen vinculos navegables.
              </p>
            </div>
            <span className="ui-filter">{data.tasks.length}</span>
          </div>
          <div className="mt-4 space-y-3">
            {data.tasks.length === 0 ? (
              <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
                Todavia no hay tareas. Crea la primera para que Inicio y Continuidad puedan priorizar trabajo real.
              </div>
            ) : (
              data.tasks.map((task) => <TaskCard key={task.id} slug={slug} task={task} />)
            )}
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Obligaciones</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Vencimientos recurrentes creados desde Procesos.
              </p>
            </div>
            <LoadingLink
              href={`/app/o/${slug}/processes`}
              pendingLabel="Abriendo..."
              className="ui-button ui-button--secondary"
            >
              Procesos
            </LoadingLink>
          </div>
          <div className="mt-4 space-y-2">
            {data.obligations.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">No hay obligaciones activas.</div>
            ) : (
              data.obligations.map((obligation) => (
                <ObligationRow key={obligation.id} obligation={obligation} />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
