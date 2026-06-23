import { LoadingLink } from "@/components/ui/loading-link";
import type {
  CompanyHomeAction,
  CompanyHomeDashboard as CompanyHomeDashboardData,
  CompanyHomeMoneySignal,
  CompanyHomeTone,
  CompanyHomeWorkUnitSignal,
} from "@/modules/presentation/company-home";
import { buildCompanyStatusBrief } from "@/modules/intelligence/service";
import {
  formatDocumentRoleLabel,
  formatLifecycleStatusLabel,
} from "@/modules/presentation/labels";

type CompanyHomeDashboardProps = {
  data: CompanyHomeDashboardData;
  organizationSlug: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "UYU",
  }).format(value);
}

function getMetricTone(tone: CompanyHomeTone) {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    default:
      return undefined;
  }
}

function getActionClassName(tone: CompanyHomeTone) {
  switch (tone) {
    case "warning":
    case "danger":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "info":
      return "border-[rgba(124,157,255,0.3)] bg-[rgba(124,157,255,0.12)] text-white";
    default:
      return "border-[color:var(--color-border)] bg-white/70 text-white";
  }
}

function getWorkUnitMarginLabel(workUnit: CompanyHomeWorkUnitSignal) {
  const margin = workUnit.actualRevenue - workUnit.actualCost;

  if (workUnit.actualRevenue <= 0 && workUnit.actualCost <= 0) {
    return "Sin movimiento";
  }

  return formatAmount(margin);
}

function ActionRow({ action }: { action: CompanyHomeAction }) {
  return (
    <article className={`rounded-[6px] border px-4 py-3 ${getActionClassName(action.tone)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{action.title}</p>
          <p className="mt-1 text-sm opacity-80">{action.description}</p>
        </div>
        <LoadingLink
          href={action.href}
          pendingLabel="Abriendo..."
          className="ui-button ui-button--primary w-full sm:w-auto"
        >
          {action.cta}
        </LoadingLink>
      </div>
    </article>
  );
}

function WorkUnitRow({ workUnit }: { workUnit: CompanyHomeWorkUnitSignal }) {
  return (
    <div className="ui-subtle-row">
      <div className="min-w-0">
        <p className="truncate text-white">{workUnit.name}</p>
        <p className="mt-1 text-[12px] text-[color:var(--color-muted)]">
          {formatLifecycleStatusLabel(workUnit.status)} / {workUnit.kind.replace(/_/g, " ")}
        </p>
      </div>
      <span>{getWorkUnitMarginLabel(workUnit)}</span>
    </div>
  );
}

function MoneyRow({
  item,
  organizationSlug,
}: {
  item: CompanyHomeMoneySignal;
  organizationSlug: string;
}) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="truncate text-white">{item.counterpartyName ?? "Sin contraparte"}</p>
        <p className="mt-1 text-[12px] text-[color:var(--color-muted)]">
          {formatDocumentRoleLabel(item.documentRole)} / {formatDate(item.dueDate)}
        </p>
      </div>
      <span>{formatAmount(item.outstandingAmount)}</span>
    </>
  );

  if (!item.sourceDocumentId) {
    return <div className="ui-subtle-row">{content}</div>;
  }

  return (
    <LoadingLink
      href={`/app/o/${organizationSlug}/documents/${item.sourceDocumentId}`}
      pendingLabel="Abriendo..."
      className="ui-subtle-row"
    >
      {content}
    </LoadingLink>
  );
}

export function CompanyHomeDashboard({
  data,
  organizationSlug,
}: CompanyHomeDashboardProps) {
  const assistantBrief = buildCompanyStatusBrief({
    actions: data.actions,
    fallbackHref: `/app/o/${organizationSlug}/documents`,
  });

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Inicio
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Estado operativo de la empresa: trabajos, documentos, tesoreria y proximos pasos sin indicadores de relleno.
            </p>
          </div>
          <LoadingLink
            href={`/app/o/${organizationSlug}/documents#document-upload-panel`}
            pendingLabel="Abriendo..."
            className="ui-button ui-button--primary w-full sm:w-auto"
          >
            Cargar documento
          </LoadingLink>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {data.metrics.map((metric) => (
            <LoadingLink
              key={metric.key}
              href={metric.href}
              pendingLabel="Abriendo..."
              className="metric-card"
              data-tone={getMetricTone(metric.tone)}
            >
              <span className="metric-card__label">{metric.label}</span>
              <span className="metric-card__value">{metric.value}</span>
              <p className="metric-card__hint">{metric.hint}</p>
              <span className="mt-3 block text-sm font-semibold text-white">{metric.cta}</span>
            </LoadingLink>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Que mirar ahora</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Acciones derivadas de datos reales cargados en el workspace.
              </p>
            </div>
            <span className="ui-filter">{data.actions.length}</span>
          </div>

          <div className="mt-4 space-y-3">
            <article className="rounded-[6px] border border-[rgba(124,157,255,0.3)] bg-[rgba(124,157,255,0.12)] px-4 py-3 text-white">
              <p className="text-sm font-semibold">{assistantBrief.question}</p>
              <p className="mt-2 text-sm text-[color:var(--color-muted)]">{assistantBrief.answer}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {assistantBrief.links.map((link) => (
                  <LoadingLink
                    key={`${link.href}-${link.title}`}
                    href={link.href}
                    pendingLabel="Abriendo..."
                    className="status-pill status-pill--info"
                  >
                    {link.title}
                  </LoadingLink>
                ))}
              </div>
            </article>
            {data.actions.length === 0 ? (
              <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
                No hay acciones urgentes detectadas. Carga trabajos, documentos o saldos para que Inicio muestre prioridades reales.
              </div>
            ) : (
              data.actions.map((action) => <ActionRow key={action.key} action={action} />)
            )}
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Resumen madre</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Lectura compacta de entidades canonicas y puentes activos.
              </p>
            </div>
            <span className="ui-filter">2.0</span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="ui-subtle-row">
              <span>Documentos accionables</span>
              <span>{data.summary.actionableDocuments}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Bloqueos documentales</span>
              <span>{data.summary.blockedDocuments}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Parties visibles</span>
              <span>{data.availability.directory ? data.summary.directoryParties : "--"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Solicitudes abiertas</span>
              <span>{data.availability.intake ? data.summary.openWorkIntakeItems : "--"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Solicitudes a revisar</span>
              <span>{data.availability.intake ? data.summary.workIntakeNeedsReview : "--"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Open items visibles</span>
              <span>{data.availability.money ? data.summary.openMoneyItems : "--"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Alertas tesoreria</span>
              <span>{data.availability.treasury ? data.summary.treasuryCriticalAlertCount : "--"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Tareas abiertas</span>
              <span>{data.availability.operations ? data.summary.openTasks : "--"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Riesgos continuidad</span>
              <span>{data.availability.operations ? data.summary.continuityRisks : "--"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Flags IVA</span>
              <span>{data.availability.operations ? data.summary.vatReviewFlags : "--"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Blockers cierre</span>
              <span>{data.availability.operations ? data.summary.closeBlockers : "--"}</span>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Solicitudes</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Cotizaciones o pedidos pendientes antes de ser trabajo.
              </p>
            </div>
            <LoadingLink
              href={`/app/o/${organizationSlug}/work#work-intake`}
              pendingLabel="Abriendo..."
              className="ui-button ui-button--secondary"
            >
              Abrir
            </LoadingLink>
          </div>

          <div className="mt-4 space-y-2">
            {!data.availability.intake ? (
              <div className="text-sm text-[color:var(--color-muted)]">work_intake_items no esta disponible.</div>
            ) : data.intakeItems.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">No hay solicitudes abiertas.</div>
            ) : (
              data.intakeItems.map((item) => (
                <LoadingLink
                  key={item.id}
                  href={`/app/o/${organizationSlug}/work#work-intake`}
                  pendingLabel="Abriendo..."
                  className="ui-subtle-row"
                >
                  <div className="min-w-0">
                    <p className="truncate text-white">{item.title}</p>
                    <p className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                      {item.sourceType.replace(/_/g, " ")} / {formatDate(item.dueDate ?? item.createdAt)}
                    </p>
                  </div>
                  <span>{item.status.replace(/_/g, " ")}</span>
                </LoadingLink>
              ))
            )}
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Trabajos</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Work units o centros de costo ya conectados.
              </p>
            </div>
            <LoadingLink
              href={`/app/o/${organizationSlug}/work`}
              pendingLabel="Abriendo..."
              className="ui-button ui-button--secondary"
            >
              Abrir
            </LoadingLink>
          </div>

          <div className="mt-4 space-y-2">
            {!data.availability.work ? (
              <div className="text-sm text-[color:var(--color-muted)]">work_units no esta disponible.</div>
            ) : data.workUnits.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">Todavia no hay trabajos activos.</div>
            ) : (
              data.workUnits.map((workUnit) => <WorkUnitRow key={workUnit.id} workUnit={workUnit} />)
            )}
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Documentos</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Ultimos documentos con estado operativo.
              </p>
            </div>
            <LoadingLink
              href={`/app/o/${organizationSlug}/documents`}
              pendingLabel="Abriendo..."
              className="ui-button ui-button--secondary"
            >
              Abrir
            </LoadingLink>
          </div>

          <div className="mt-4 space-y-2">
            {data.documents.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">Todavia no hay documentos cargados.</div>
            ) : (
              data.documents.map((document) => (
                <LoadingLink
                  key={document.id}
                  href={document.href ?? `/app/o/${organizationSlug}/documents`}
                  pendingLabel="Abriendo..."
                  className="ui-subtle-row"
                >
                  <div className="min-w-0">
                    <p className="truncate text-white">{document.label}</p>
                    <p className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                      {formatLifecycleStatusLabel(document.bucket)} / {formatDate(document.createdAt)}
                    </p>
                  </div>
                  <span>{document.nextActionLabel ?? "Ver"}</span>
                </LoadingLink>
              ))
            )}
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Dinero</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Caja libre, bancos y saldos vivos ordenados por vencimiento.
              </p>
            </div>
            <LoadingLink
              href={`/app/o/${organizationSlug}/money`}
              pendingLabel="Abriendo..."
              className="ui-button ui-button--secondary"
            >
              Abrir
            </LoadingLink>
          </div>

          <div className="mt-4 space-y-2">
            {!data.availability.money ? (
              <div className="text-sm text-[color:var(--color-muted)]">Open items no esta disponible.</div>
            ) : data.moneyItems.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">No hay saldos vivos visibles.</div>
            ) : (
              data.moneyItems.map((item) => (
                <MoneyRow key={item.id} item={item} organizationSlug={organizationSlug} />
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Directorio</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Parties visibles como clientes, proveedores u otros roles.
              </p>
            </div>
            <span className="ui-filter">{data.availability.directory ? data.summary.directoryParties : "--"}</span>
          </div>

          <div className="mt-4 space-y-2">
            {!data.availability.directory ? (
              <div className="text-sm text-[color:var(--color-muted)]">parties no esta disponible.</div>
            ) : data.parties.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">Todavia no hay parties visibles.</div>
            ) : (
              data.parties.map((party) => (
                <LoadingLink
                  key={party.id}
                  href={`/app/o/${organizationSlug}/directory/${party.id}`}
                  pendingLabel="Abriendo..."
                  className="ui-subtle-row"
                >
                  <div className="min-w-0">
                    <p className="truncate text-white">{party.displayName}</p>
                    <p className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                      {party.source ?? "manual"} / {formatLifecycleStatusLabel(party.status)}
                    </p>
                  </div>
                  <span>{formatDate(party.updatedAt)}</span>
                </LoadingLink>
              ))
            )}
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Agenda</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Tareas, vencimientos operativos y senales de continuidad derivadas de datos reales.
              </p>
            </div>
            <LoadingLink
              href={`/app/o/${organizationSlug}/agenda`}
              pendingLabel="Abriendo..."
              className="ui-button ui-button--secondary"
            >
              Abrir
            </LoadingLink>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <article className="metric-card" data-tone={data.summary.openTasks > 0 ? "info" : undefined}>
              <span className="metric-card__label">Tareas abiertas</span>
              <span className="metric-card__value">{data.availability.operations ? data.summary.openTasks : "--"}</span>
              <p className="metric-card__hint">Pendientes o en curso dentro de Agenda.</p>
            </article>
            <article className="metric-card" data-tone={data.summary.blockedTasks > 0 ? "warning" : undefined}>
              <span className="metric-card__label">Tareas bloqueadas</span>
              <span className="metric-card__value">{data.availability.operations ? data.summary.blockedTasks : "--"}</span>
              <p className="metric-card__hint">Bloqueos operativos a destrabar.</p>
            </article>
            <article className="metric-card" data-tone={data.summary.continuityRisks > 0 ? "warning" : undefined}>
              <span className="metric-card__label">Continuidad</span>
              <span className="metric-card__value">{data.availability.operations ? data.summary.continuityRisks : "--"}</span>
              <p className="metric-card__hint">Riesgos por procesos, tareas o capturas.</p>
            </article>
            <article className="metric-card" data-tone={data.summary.closeBlockers > 0 || data.summary.vatReviewFlags > 0 ? "warning" : undefined}>
              <span className="metric-card__label">IVA/cierre</span>
              <span className="metric-card__value">
                {data.availability.operations ? data.summary.vatReviewFlags + data.summary.closeBlockers : "--"}
              </span>
              <p className="metric-card__hint">Flags fiscales y blockers de close.</p>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
