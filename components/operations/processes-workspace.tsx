import { SubmitButton } from "@/components/ui/submit-button";
import type {
  CaptureNoteItem,
  ObligationItem,
  OperationsWorkspaceData,
  ProcessItem,
} from "@/modules/operations";

type ProcessesWorkspaceProps = {
  slug: string;
  canManage: boolean;
  data: OperationsWorkspaceData;
  createProcessAction: (formData: FormData) => void | Promise<void>;
  createObligationAction: (formData: FormData) => void | Promise<void>;
  createCaptureNoteAction: (formData: FormData) => void | Promise<void>;
  startProcessRunAction: (formData: FormData) => void | Promise<void>;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function criticalityLabel(value: ProcessItem["criticality"]) {
  switch (value) {
    case "critical":
      return "Critico";
    case "high":
      return "Alto";
    case "low":
      return "Bajo";
    default:
      return "Medio";
  }
}

function criticalityClassName(value: ProcessItem["criticality"]) {
  if (value === "critical") {
    return "status-pill status-pill--danger";
  }

  if (value === "high") {
    return "status-pill status-pill--warning";
  }

  return "status-pill status-pill--info";
}

function ProcessCard({
  slug,
  process,
  disabled,
  startProcessRunAction,
}: {
  slug: string;
  process: ProcessItem;
  disabled: boolean;
  startProcessRunAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <article className="rounded-[6px] border border-[color:var(--color-border)] bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{process.name}</p>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            {process.category ?? "Sin categoria"} / {process.frequency ?? "Sin frecuencia"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={criticalityClassName(process.criticality)}>
            {criticalityLabel(process.criticality)}
          </span>
          <span className="status-pill status-pill--info">{process.publishedVersionCount} version(es)</span>
        </div>
      </div>

      {process.description ? (
        <p className="mt-3 text-sm text-[color:var(--color-muted)]">{process.description}</p>
      ) : null}

      <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
        <div className="ui-subtle-row">
          <span>Responsable actual</span>
          <span>{process.currentOwnerLabel ?? "Sin dato"}</span>
        </div>
        <div className="ui-subtle-row">
          <span>Responsable futuro</span>
          <span>{process.futureOwnerLabel ?? "Pendiente"}</span>
        </div>
        <div className="ui-subtle-row">
          <span>Proxima corrida</span>
          <span>{formatDate(process.nextRunDate)}</span>
        </div>
      </div>

      <form action={startProcessRunAction} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_140px]">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="processId" value={process.id} />
        <input
          name="title"
          disabled={disabled}
          placeholder={`Ejecutar ${process.name}`}
          className="input-surface-dark min-h-[40px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
        />
        <input
          type="date"
          name="dueDate"
          disabled={disabled}
          className="input-surface-dark min-h-[40px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
        />
        <SubmitButton
          disabled={disabled}
          pendingLabel="Iniciando..."
          className="ui-button ui-button--secondary min-h-[40px] w-full"
        >
          Iniciar
        </SubmitButton>
      </form>
    </article>
  );
}

function ObligationRow({ obligation }: { obligation: ObligationItem }) {
  return (
    <div className="ui-subtle-row">
      <span className="min-w-0">
        <span className="block truncate text-white">{obligation.title}</span>
        <span className="block text-[12px] text-[color:var(--color-muted)]">
          {obligation.obligationType} / {obligation.frequency}
        </span>
      </span>
      <span>{formatDate(obligation.nextDueDate)}</span>
    </div>
  );
}

function CaptureNoteRow({ note }: { note: CaptureNoteItem }) {
  return (
    <article className="rounded-[6px] border border-[color:var(--color-border)] bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{note.title ?? "Captura sin titulo"}</p>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            {note.source} / {formatDate(note.createdAt.slice(0, 10))}
          </p>
        </div>
        <span className="status-pill status-pill--warning">{note.status}</span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-[color:var(--color-muted)]">{note.rawText}</p>
    </article>
  );
}

export function ProcessesWorkspace({
  slug,
  canManage,
  data,
  createProcessAction,
  createObligationAction,
  createCaptureNoteAction,
  startProcessRunAction,
}: ProcessesWorkspaceProps) {
  const disabled = !canManage || !data.isAvailable;
  const criticalProcesses = data.processes.filter((process) =>
    ["high", "critical"].includes(process.criticality));

  if (!data.isAvailable) {
    return (
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Procesos
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              El schema de procesos todavia no esta disponible en esta base.
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
              Procesos
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Recetas versionadas, obligaciones recurrentes y captura de conocimiento antes de que se pierda.
            </p>
          </div>
          <span className="status-pill status-pill--info">{data.processes.length} proceso(s)</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <article className="metric-card">
            <span className="metric-card__label">Procesos</span>
            <span className="metric-card__value">{data.processes.length}</span>
            <p className="metric-card__hint">Activos o borradores no archivados.</p>
          </article>
          <article className="metric-card" data-tone={criticalProcesses.length > 0 ? "warning" : undefined}>
            <span className="metric-card__label">Criticos</span>
            <span className="metric-card__value">{criticalProcesses.length}</span>
            <p className="metric-card__hint">Alta criticidad para continuidad.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Obligaciones</span>
            <span className="metric-card__value">{data.obligations.length}</span>
            <p className="metric-card__hint">Vencimientos recurrentes activos.</p>
          </article>
          <article className="metric-card" data-tone={data.captureNotes.length > 0 ? "info" : undefined}>
            <span className="metric-card__label">Capturas</span>
            <span className="metric-card__value">{data.captureNotes.length}</span>
            <p className="metric-card__hint">Conocimiento crudo pendiente de estructurar.</p>
          </article>
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Nuevo proceso versionado</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Publica una primera version con pasos simples; despues puede evolucionar.
            </p>
          </div>
        </div>

        <form action={createProcessAction} className="mt-4 grid gap-3 lg:grid-cols-6">
          <input type="hidden" name="slug" value={slug} />
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Nombre</span>
            <input
              name="name"
              required
              disabled={disabled}
              placeholder="Pago a proveedores"
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Categoria</span>
            <input
              name="category"
              disabled={disabled}
              placeholder="Administracion"
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Criticidad</span>
            <select
              name="criticality"
              defaultValue="medium"
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Critica</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Frecuencia</span>
            <input
              name="frequency"
              disabled={disabled}
              placeholder="Mensual"
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Proxima</span>
            <input
              type="date"
              name="nextRunDate"
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Responsable actual</span>
            <input
              name="currentOwnerLabel"
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Responsable futuro</span>
            <input
              name="futureOwnerLabel"
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Descripcion</span>
            <input
              name="description"
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1 lg:col-span-5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Pasos</span>
            <textarea
              name="stepsText"
              rows={4}
              disabled={disabled}
              placeholder={"1. Reunir facturas\n2. Confirmar saldos\n3. Ejecutar pago"}
              className="input-surface-dark w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm text-white"
            />
          </label>
          <div className="flex items-end">
            <SubmitButton
              disabled={disabled}
              pendingLabel="Publicando..."
              className="ui-button ui-button--primary min-h-[42px] w-full"
            >
              Publicar
            </SubmitButton>
          </div>
        </form>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Procesos</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Cada proceso puede iniciar una corrida con pasos materializados.
              </p>
            </div>
            <span className="ui-filter">{data.processes.length}</span>
          </div>
          <div className="mt-4 space-y-3">
            {data.processes.length === 0 ? (
              <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
                Todavia no hay procesos documentados.
              </div>
            ) : (
              data.processes.map((process) => (
                <ProcessCard
                  key={process.id}
                  slug={slug}
                  process={process}
                  disabled={disabled}
                  startProcessRunAction={startProcessRunAction}
                />
              ))
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Nueva obligacion</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Crea vencimientos recurrentes visibles en Agenda.
                </p>
              </div>
            </div>
            <form action={createObligationAction} className="mt-4 space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <input
                name="title"
                required
                disabled={disabled}
                placeholder="Renovar certificado DGI"
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  name="frequency"
                  defaultValue="monthly"
                  disabled={disabled}
                  className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
                >
                  <option value="once">Una vez</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="yearly">Anual</option>
                  <option value="ad_hoc">Ad hoc</option>
                </select>
                <input
                  type="date"
                  name="nextDueDate"
                  disabled={disabled}
                  className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
                />
              </div>
              <input
                name="responsibleLabel"
                disabled={disabled}
                placeholder="Responsable actual"
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              />
              <input
                name="futureOwnerLabel"
                disabled={disabled}
                placeholder="Responsable futuro"
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              />
              <SubmitButton
                disabled={disabled}
                pendingLabel="Creando..."
                className="ui-button ui-button--primary w-full"
              >
                Crear obligacion
              </SubmitButton>
            </form>
            <div className="mt-4 space-y-2">
              {data.obligations.slice(0, 6).map((obligation) => (
                <ObligationRow key={obligation.id} obligation={obligation} />
              ))}
            </div>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Captura cruda</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Guarda conocimiento antes de estructurarlo.
                </p>
              </div>
            </div>
            <form action={createCaptureNoteAction} className="mt-4 space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <input
                name="title"
                disabled={disabled}
                placeholder="Como se paga BPS"
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              />
              <textarea
                name="rawText"
                required
                rows={5}
                disabled={disabled}
                className="input-surface-dark w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm text-white"
              />
              <SubmitButton
                disabled={disabled}
                pendingLabel="Guardando..."
                className="ui-button ui-button--secondary w-full"
              >
                Guardar captura
              </SubmitButton>
            </form>
          </section>
        </div>
      </div>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Capturas pendientes</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Material para convertir luego en tareas, procesos u obligaciones.
            </p>
          </div>
          <span className="ui-filter">{data.captureNotes.length}</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {data.captureNotes.length === 0 ? (
            <div className="text-sm text-[color:var(--color-muted)]">No hay capturas crudas.</div>
          ) : (
            data.captureNotes.map((note) => <CaptureNoteRow key={note.id} note={note} />)
          )}
        </div>
      </section>
    </div>
  );
}
