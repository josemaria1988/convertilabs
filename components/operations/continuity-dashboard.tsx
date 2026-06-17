import { LoadingLink } from "@/components/ui/loading-link";
import type {
  ContinuityDashboardData,
  ContinuityRiskItem,
  TaskItem,
} from "@/modules/operations";

type ContinuityDashboardProps = {
  slug: string;
  data: ContinuityDashboardData;
};

function severityClassName(severity: ContinuityRiskItem["severity"]) {
  if (severity === "critical") {
    return "status-pill status-pill--danger";
  }

  if (severity === "high") {
    return "status-pill status-pill--warning";
  }

  return "status-pill status-pill--info";
}

function taskLabel(task: TaskItem) {
  const labels = [
    task.partyName,
    task.workUnitName,
    task.documentName,
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(" / ") : "Sin vinculos";
}

function RiskCard({ risk }: { risk: ContinuityRiskItem }) {
  const content = (
    <article className="rounded-[6px] border border-[color:var(--color-border)] bg-white/70 p-4 transition hover:bg-white/85">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white">{risk.title}</p>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">{risk.description}</p>
        </div>
        <span className={severityClassName(risk.severity)}>{risk.severity}</span>
      </div>
    </article>
  );

  if (!risk.href) {
    return content;
  }

  return (
    <LoadingLink href={risk.href} pendingLabel="Abriendo..." className="block">
      {content}
    </LoadingLink>
  );
}

export function ContinuityDashboard({
  slug,
  data,
}: ContinuityDashboardProps) {
  if (!data.isAvailable) {
    return (
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Continuidad
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              El schema de operaciones todavia no esta disponible en esta base.
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
              Continuidad
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Riesgos operativos derivados de procesos, obligaciones, tareas y conocimiento sin estructurar.
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

        <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <article className="metric-card" data-tone={data.summary.riskCount > 0 ? "warning" : "success"}>
            <span className="metric-card__label">Riesgos</span>
            <span className="metric-card__value">{data.summary.riskCount}</span>
            <p className="metric-card__hint">Senales abiertas de continuidad.</p>
          </article>
          <article className="metric-card" data-tone={data.summary.criticalUnownedProcesses > 0 ? "danger" : undefined}>
            <span className="metric-card__label">Sin sucesor</span>
            <span className="metric-card__value">{data.summary.criticalUnownedProcesses}</span>
            <p className="metric-card__hint">Procesos criticos sin responsable futuro.</p>
          </article>
          <article className="metric-card" data-tone={data.summary.undocumentedCriticalProcesses > 0 ? "danger" : undefined}>
            <span className="metric-card__label">Sin receta</span>
            <span className="metric-card__value">{data.summary.undocumentedCriticalProcesses}</span>
            <p className="metric-card__hint">Criticos sin pasos publicados.</p>
          </article>
          <article className="metric-card" data-tone={data.summary.obligationsWithoutFutureOwner > 0 ? "warning" : undefined}>
            <span className="metric-card__label">Obligaciones</span>
            <span className="metric-card__value">{data.summary.obligationsWithoutFutureOwner}</span>
            <p className="metric-card__hint">Activas sin responsable futuro.</p>
          </article>
          <article className="metric-card" data-tone={data.summary.unassignedTasks > 0 ? "warning" : undefined}>
            <span className="metric-card__label">Tareas sueltas</span>
            <span className="metric-card__value">{data.summary.unassignedTasks}</span>
            <p className="metric-card__hint">Sin party/trabajo/documento.</p>
          </article>
          <article className="metric-card" data-tone={data.summary.blockedTasks > 0 ? "danger" : undefined}>
            <span className="metric-card__label">Bloqueadas</span>
            <span className="metric-card__value">{data.summary.blockedTasks}</span>
            <p className="metric-card__hint">Tareas que frenan operacion.</p>
          </article>
          <article className="metric-card" data-tone={data.summary.rawCaptures > 0 ? "info" : undefined}>
            <span className="metric-card__label">Capturas</span>
            <span className="metric-card__value">{data.summary.rawCaptures}</span>
            <p className="metric-card__hint">Conocimiento sin estructurar.</p>
          </article>
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Riesgos detectados</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Senales calculadas desde datos reales; no se inventan tareas ni responsables.
            </p>
          </div>
          <span className="ui-filter">{data.risks.length}</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {data.risks.length === 0 ? (
            <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
              No hay riesgos derivados con la informacion actual.
            </div>
          ) : (
            data.risks.map((risk) => <RiskCard key={risk.key} risk={risk} />)
          )}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Procesos criticos</h2>
            <span className="ui-filter">{data.criticalProcesses.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {data.criticalProcesses.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">No hay procesos criticos cargados.</div>
            ) : (
              data.criticalProcesses.map((process) => (
                <div key={process.id} className="ui-subtle-row">
                  <span className="truncate">{process.name}</span>
                  <span>{process.futureOwnerLabel ?? "Sin sucesor"}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Tareas sueltas</h2>
            <span className="ui-filter">{data.unassignedTasks.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {data.unassignedTasks.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">No hay tareas sueltas.</div>
            ) : (
              data.unassignedTasks.slice(0, 8).map((task) => (
                <LoadingLink
                  key={task.id}
                  href={`/app/o/${slug}/agenda`}
                  pendingLabel="Abriendo..."
                  className="ui-subtle-row"
                >
                  <span className="truncate">{task.title}</span>
                  <span>{taskLabel(task)}</span>
                </LoadingLink>
              ))
            )}
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Capturas crudas</h2>
            <span className="ui-filter">{data.captureNotes.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {data.captureNotes.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">No hay conocimiento crudo pendiente.</div>
            ) : (
              data.captureNotes.slice(0, 8).map((note) => (
                <LoadingLink
                  key={note.id}
                  href={`/app/o/${slug}/processes`}
                  pendingLabel="Abriendo..."
                  className="ui-subtle-row"
                >
                  <span className="truncate">{note.title ?? "Captura sin titulo"}</span>
                  <span>{note.status}</span>
                </LoadingLink>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
