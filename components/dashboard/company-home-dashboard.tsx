import type { ReactNode } from "react";
import { LoadingLink } from "@/components/ui/loading-link";
import { SupplierInvoicesBoard } from "@/components/money/supplier-invoices-board";
import type { CompanyHomeAction, CompanyHomeDashboard as CompanyHomeDashboardData } from "@/modules/presentation/company-home";
import { formatLifecycleStatusLabel } from "@/modules/presentation/labels";

type Props = { data: CompanyHomeDashboardData; organizationSlug: string };

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  if (!match) return "Sin fecha";
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  if (!Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return "Sin fecha";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function SectionHeading({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold tracking-tight">{title}</h2><LoadingLink href={href} pendingLabel="Abriendo..." className="inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--color-accent)] hover:underline">{linkLabel} <span aria-hidden="true" className="ml-1">→</span></LoadingLink></div>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-5 text-sm leading-relaxed text-[color:var(--color-muted)]">{children}</p>;
}

function ActionRow({ action }: { action: CompanyHomeAction }) {
  const attention = action.tone === "danger" || action.tone === "warning";
  return <li className="border-t border-[color:var(--color-border)] first:border-0"><LoadingLink href={action.href} pendingLabel="Abriendo..." className="flex min-h-14 items-center justify-between gap-3 py-3 hover:text-[color:var(--color-accent)]">
    <span className="flex min-w-0 items-start gap-2 text-sm"><span aria-hidden="true" className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${attention ? "bg-[color:var(--color-warning)]" : "bg-[color:var(--color-accent)]"}`} /><span className="break-words font-medium">{action.title}</span></span>
    <span className="shrink-0 text-[color:var(--color-accent)]" aria-hidden="true">→</span><span className="sr-only">{action.cta}</span>
  </LoadingLink></li>;
}

const overviewLabels: Record<string, string> = { documents: "Documentos pendientes", work: "Trabajos activos", intake: "Solicitudes abiertas", agenda: "Tareas abiertas" };

export function CompanyHomeDashboard({ data, organizationSlug }: Props) {
  const base = `/app/o/${organizationSlug}`;
  const overview = ["documents", "work", "intake", "agenda"].flatMap((key) => data.metrics.filter((metric) => metric.key === key));
  const pendingDocuments = data.documents.filter((document) => document.bucket !== "done");
  const moneyMetric = data.metrics.find((metric) => metric.key === "money");

  return <div className="space-y-5 text-[color:var(--color-foreground)]">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold tracking-tight">Inicio</h1><p className="mt-1 text-sm text-[color:var(--color-muted)]">La administración de Rontil, en un vistazo.</p></div>
      <LoadingLink href={`${base}/documents#document-upload-panel`} pendingLabel="Abriendo..." className="ui-button ui-button--primary min-h-11 w-full sm:w-auto">Cargar documento</LoadingLink>
    </header>

    <section aria-label="Resumen de actividad" className="ui-panel"><div className="grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4">
      {overview.map((metric) => <LoadingLink key={metric.key} href={metric.href} pendingLabel="Abriendo..." className="group min-w-0 rounded-md py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--color-accent)]">
        <p className="text-xs font-medium text-[color:var(--color-muted)]">{overviewLabels[metric.key]}</p>
        <div className="mt-1 flex items-center gap-3"><span className="break-words text-3xl font-semibold tracking-tight tabular-nums">{metric.value}</span><span aria-hidden="true" className="text-sm text-[color:var(--color-accent)] opacity-60 group-hover:opacity-100">↗</span></div>
        {metric.value === "--" ? <p className="mt-1 text-xs text-[color:var(--color-muted)]">Sin información disponible</p> : null}
      </LoadingLink>)}
    </div></section>

    {data.supplierInvoices ? <SupplierInvoicesBoard {...data.supplierInvoices} /> : null}

    <div className="grid items-start gap-5 xl:grid-cols-2">
      <section className="ui-panel min-w-0">
        <SectionHeading title="Documentos pendientes" href={`${base}/documents`} linkLabel="Ver documentos" />
        {pendingDocuments.length === 0 ? <EmptyState>{data.documents.length ? "No hay documentos pendientes en esta vista." : "Todavía no hay documentos cargados."}</EmptyState> : <ul className="mt-1">
          {pendingDocuments.map((document) => <li key={document.id} className="border-t border-[color:var(--color-border)] first:border-0"><LoadingLink href={document.href ?? `${base}/documents`} pendingLabel="Abriendo..." className="block min-w-0 py-3 hover:text-[color:var(--color-accent)]">
            <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{document.label}</p><p className="mt-1 text-xs text-[color:var(--color-muted)]">{formatLifecycleStatusLabel(document.bucket)} · {formatDate(document.createdAt)}</p></div><span aria-hidden="true" className="shrink-0 text-[color:var(--color-accent)]">→</span></div>
            {document.blockingReason ? <p className="mt-1 break-words text-xs leading-relaxed text-[color:var(--color-danger)]">{document.blockingReason}</p> : null}
            <span className="sr-only">{document.nextActionLabel ?? "Ver documento"}</span>
          </LoadingLink></li>)}
        </ul>}
      </section>

      <section className="ui-panel min-w-0">
        <SectionHeading title="Trabajos activos" href={`${base}/work`} linkLabel="Ver trabajos" />
        {!data.availability.work ? <EmptyState>No pudimos obtener los trabajos.</EmptyState> : data.workUnits.length === 0 ? <EmptyState>No hay trabajos activos. Podés consultar los anteriores en Trabajos.</EmptyState> : <ul className="mt-1">
          {data.workUnits.map((workUnit) => <li key={workUnit.id} className="border-t border-[color:var(--color-border)] first:border-0"><LoadingLink href={`${base}/work`} pendingLabel="Abriendo..." className="flex min-w-0 items-center justify-between gap-3 py-3 hover:text-[color:var(--color-accent)]"><div className="min-w-0"><p className="break-words text-sm font-medium">{workUnit.name}</p><p className="mt-1 text-xs text-[color:var(--color-muted)]">{formatLifecycleStatusLabel(workUnit.status)}</p></div><span className="shrink-0 text-xs text-[color:var(--color-muted)]">{formatDate(workUnit.updatedAt)}</span></LoadingLink></li>)}
        </ul>}
        <div className="mt-2 border-t border-[color:var(--color-border)] pt-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Solicitudes y cotizaciones</h3><LoadingLink href={`${base}/work#work-intake`} pendingLabel="Abriendo..." className="inline-flex min-h-11 items-center text-xs font-medium text-[color:var(--color-accent)] hover:underline">Ver solicitudes →</LoadingLink></div>
          {!data.availability.intake ? <p className="pb-2 text-xs text-[color:var(--color-muted)]">Información no disponible.</p> : data.intakeItems.length === 0 ? <p className="pb-2 text-xs text-[color:var(--color-muted)]">No hay solicitudes abiertas.</p> : <ul>{data.intakeItems.map((item) => <li key={item.id}><LoadingLink href={`${base}/work#work-intake`} pendingLabel="Abriendo..." className="flex items-start justify-between gap-3 py-2 text-sm hover:text-[color:var(--color-accent)]"><span className="min-w-0 break-words">{item.title}</span><span className="shrink-0 text-xs text-[color:var(--color-muted)]">{formatDate(item.dueDate ?? item.createdAt)}</span></LoadingLink></li>)}</ul>}
        </div>
      </section>
    </div>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <section className="ui-panel min-w-0"><h2 className="text-lg font-semibold tracking-tight">Próximas acciones</h2>{data.actions.length ? <ul className="mt-2">{data.actions.map((action) => <ActionRow key={action.key} action={action} />)}</ul> : <EmptyState>No hay acciones pendientes detectadas en los datos disponibles.</EmptyState>}</section>
      <section className="ui-panel min-w-0"><h2 className="text-lg font-semibold tracking-tight">Otras consultas</h2><div className="mt-2 divide-y divide-[color:var(--color-border)]">
        <LoadingLink href={`${base}/money`} pendingLabel="Abriendo..." className="block py-3 hover:text-[color:var(--color-accent)]"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Dinero y vencimientos</p><span aria-hidden="true" className="text-[color:var(--color-accent)]">→</span></div><p className="mt-1 text-xs text-[color:var(--color-muted)]">{!data.availability.money && !data.availability.treasury ? "Información no disponible." : data.availability.treasury && moneyMetric ? `${moneyMetric.label}: ${moneyMetric.value}` : `${data.summary.openMoneyItems} registros con saldo · ${data.summary.overdueMoneyItems} vencidos`}</p>{data.summary.treasuryAlertCount > 0 ? <p className="mt-1 text-xs text-[color:var(--color-danger)]">{data.summary.treasuryAlertCount} alertas de tesorería para revisar.</p> : null}</LoadingLink>
        <LoadingLink href={`${base}/agenda`} pendingLabel="Abriendo..." className="block py-3 hover:text-[color:var(--color-accent)]"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Agenda y cierre</p><span aria-hidden="true" className="text-[color:var(--color-accent)]">→</span></div><p className="mt-1 text-xs text-[color:var(--color-muted)]">{!data.availability.operations ? "Información no disponible." : `${data.summary.openTasks} tareas abiertas · ${data.summary.blockedTasks} bloqueadas`}</p>{data.availability.operations && (data.summary.vatReviewFlags > 0 || data.summary.closeBlockers > 0) ? <p className="mt-1 text-xs text-[color:var(--color-danger)]">{data.summary.vatReviewFlags} observaciones de IVA · {data.summary.closeBlockers} pendientes de cierre</p> : null}</LoadingLink>
        <LoadingLink href={`${base}/directory`} pendingLabel="Abriendo..." className="block py-3 hover:text-[color:var(--color-accent)]"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Clientes y proveedores</p><span aria-hidden="true" className="text-[color:var(--color-accent)]">→</span></div><p className="mt-1 text-xs text-[color:var(--color-muted)]">{data.availability.directory ? `${data.summary.directoryParties} contactos registrados` : "Información no disponible."}</p></LoadingLink>
      </div></section>
    </div>
  </div>;
}
