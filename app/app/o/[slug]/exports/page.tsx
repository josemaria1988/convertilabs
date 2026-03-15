import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  listAccountingExportLayouts,
  loadAccountingExportDataset,
  loadRecentExports,
} from "@/modules/exports";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { formatLifecycleStatusLabel } from "@/modules/presentation/labels";
import { createAccountingExportAction } from "./actions";

type OrganizationExportsPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    periodYear?: string;
    periodMonth?: string;
    scope?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Exportaciones",
};

function formatAmount(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getScopeLabel(value: string) {
  switch (value) {
    case "posted_provisional":
      return "Solo provisionales";
    case "posted_final":
      return "Solo finales";
    case "all_posted":
    default:
      return "Todo lo posteado";
  }
}

function getCurrentPeriod() {
  const now = new Date();

  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
}

export default async function OrganizationExportsPage({
  params,
  searchParams,
}: OrganizationExportsPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const currentPeriod = getCurrentPeriod();
  const periodYear = Number(resolvedSearchParams?.periodYear ?? currentPeriod.year);
  const periodMonth = Number(resolvedSearchParams?.periodMonth ?? currentPeriod.month);
  const scope = resolvedSearchParams?.scope === "posted_provisional" || resolvedSearchParams?.scope === "posted_final"
    ? resolvedSearchParams.scope
    : "all_posted";
  const supabase = getSupabaseServiceRoleClient();
  const [previewDataset, recentExports] = await Promise.all([
    loadAccountingExportDataset(supabase, organization.id, {
      periodYear,
      periodMonth,
      scope,
    }),
    loadRecentExports(organization.id),
  ]);
  const layouts = listAccountingExportLayouts();
  const accountingExports = recentExports.filter((artifact) =>
    artifact.exportType?.startsWith("accounting_")
    || artifact.filename?.startsWith("convertilabs-contable-"));

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Exportaciones"
      toolbarLabel="Exportaciones"
      description="Bridge contable hacia el ERP existente, con exportacion generica de asientos provisionales o finales y lectura de external_code."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "journal_entries")}
      isExportCurrent
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="grid gap-3 md:grid-cols-4">
            <article className="metric-card">
              <span className="metric-card__label">Lineas exportables</span>
              <span className="metric-card__value">{previewDataset.rows.length}</span>
              <p className="metric-card__hint">{getScopeLabel(scope)}</p>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">Provisionales pendientes</span>
              <span className="metric-card__value">{previewDataset.recategorizationQueue.length}</span>
              <p className="metric-card__hint">Cola de recategorizacion del periodo.</p>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">Buckets DGI</span>
              <span className="metric-card__value">{previewDataset.dgiDifferences.length}</span>
              <p className="metric-card__hint">Ultima conciliacion del periodo.</p>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">Periodo</span>
              <span className="metric-card__value">{previewDataset.periodLabel}</span>
              <p className="metric-card__hint">Preview previo a generar artefacto.</p>
            </article>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h1 className="text-[20px] font-semibold text-white">Generar exportacion contable</h1>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Exporta los asientos del periodo sin exigir cambio de ERP, usando `external_code` cuando exista.
                </p>
              </div>
              <span className="status-pill status-pill--info">Bridge ERP</span>
            </div>

            <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm text-[color:var(--color-muted)]">
              {previewDataset.warnings.length > 0
                ? previewDataset.warnings.join(" ")
                : "La vista previa no detecto alertas para este periodo."}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <form className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">Preview del periodo</p>
                  <p className="text-sm text-[color:var(--color-muted)]">
                    Cambia periodo y scope para revisar el set de asientos antes de exportar.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-white">Ano</span>
                    <input
                      type="number"
                      name="periodYear"
                      defaultValue={periodYear}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-white">Mes</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      name="periodMonth"
                      defaultValue={periodMonth}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-white">Scope</span>
                    <select
                      name="scope"
                      defaultValue={scope}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                    >
                      <option value="all_posted">Todo lo posteado</option>
                      <option value="posted_final">Solo finales</option>
                      <option value="posted_provisional">Solo provisionales</option>
                    </select>
                  </label>
                </div>
                <SubmitButton formMethod="get" pendingLabel="Actualizando..." className="ui-button ui-button--secondary">
                  Actualizar preview
                </SubmitButton>
              </form>

              <form action={createAccountingExportAction} className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4">
                <input type="hidden" name="slug" value={organization.slug} />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">Generar artefacto</p>
                  <p className="text-sm text-[color:var(--color-muted)]">
                    Crea el archivo y lo deja disponible en el bucket de exportaciones.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-white">Ano</span>
                    <input
                      type="number"
                      name="periodYear"
                      defaultValue={periodYear}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-white">Mes</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      name="periodMonth"
                      defaultValue={periodMonth}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-white">Scope</span>
                    <select
                      name="scope"
                      defaultValue={scope}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                    >
                      <option value="all_posted">Todo lo posteado</option>
                      <option value="posted_final">Solo finales</option>
                      <option value="posted_provisional">Solo provisionales</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-white">Layout</span>
                    <select
                      name="layoutCode"
                      defaultValue={layouts[0]?.code ?? "generic_csv"}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                    >
                      {layouts.map((layout) => (
                        <option key={layout.code} value={layout.code}>
                          {layout.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <SubmitButton pendingLabel="Generando..." className="ui-button ui-button--primary">
                  Generar exportacion
                </SubmitButton>
              </form>
            </div>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Preview de lineas</h2>
              <span className="ui-filter">{previewDataset.rows.length}</span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="data-table min-w-[1100px]">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Referencia</th>
                    <th>Documento</th>
                    <th>Posting</th>
                    <th>Cuenta</th>
                    <th>Ext.</th>
                    <th className="text-right">Debe</th>
                    <th className="text-right">Haber</th>
                    <th className="text-right">Original</th>
                    <th className="text-right">UYU</th>
                    <th className="text-right">FX</th>
                  </tr>
                </thead>
                <tbody>
                  {previewDataset.rows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-sm text-[color:var(--color-muted)]">
                        No hay lineas exportables para el periodo y scope elegidos.
                      </td>
                    </tr>
                  ) : (
                    previewDataset.rows.slice(0, 16).map((row, index) => (
                      <tr key={`${row.reference}-${row.accountCode}-${index}`}>
                        <td>{row.entryDate}</td>
                        <td>{row.reference}</td>
                        <td>{row.documentFilename ?? "--"}</td>
                        <td>{row.documentPostingStatus ?? row.postingMode ?? "--"}</td>
                        <td>
                          <div className="font-semibold text-white">{row.accountCode}</div>
                          <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                            {row.accountName}
                          </div>
                        </td>
                        <td>{row.externalAccountCode ?? "--"}</td>
                        <td className="text-right">{formatAmount(row.debit)}</td>
                        <td className="text-right">{formatAmount(row.credit)}</td>
                        <td className="text-right">
                          {row.originalCurrencyCode ?? "--"} {formatAmount(row.originalAmount)}
                        </td>
                        <td className="text-right">{formatAmount(row.functionalAmountUyu)}</td>
                        <td className="text-right">{formatAmount(row.fxRateApplied)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Recategorizacion pendiente</h2>
              <span className="ui-filter">{previewDataset.recategorizationQueue.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {previewDataset.recategorizationQueue.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  No hay documentos provisionales pendientes en este periodo.
                </div>
              ) : (
                previewDataset.recategorizationQueue.map((document) => (
                  <LoadingLink
                    key={document.documentId}
                    href={`/app/o/${organization.slug}/documents/${document.documentId}`}
                    pendingLabel="Abriendo..."
                    className="block rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                  >
                    <p className="font-semibold text-white">{document.documentFilename}</p>
                    <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                      {document.documentDate ?? "Sin fecha"} / {document.postingStatus ?? "Sin posting status"}
                    </p>
                  </LoadingLink>
                ))
              )}
            </div>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Diferencias DGI</h2>
              <span className="ui-filter">{previewDataset.dgiDifferences.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {previewDataset.dgiDifferences.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  No hay una conciliacion DGI registrada para este periodo.
                </div>
              ) : (
                previewDataset.dgiDifferences.map((bucket) => (
                  <div
                    key={bucket.bucketCode}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">{bucket.label}</p>
                      <span className="status-pill status-pill--warning">
                        {bucket.differenceStatus.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] text-[color:var(--color-muted)]">
                      Neto {formatAmount(bucket.deltaNetAmountUyu)} / IVA {formatAmount(bucket.deltaTaxAmountUyu)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Exportaciones recientes</h2>
              <span className="ui-filter">{accountingExports.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {accountingExports.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Todavia no hay artefactos de exportacion generados.
                </div>
              ) : (
                accountingExports.slice(0, 8).map((artifact) => (
                  <div
                    key={artifact.id}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{artifact.filename ?? artifact.id}</p>
                        <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                          {formatLifecycleStatusLabel(artifact.status)}
                        </p>
                      </div>
                      {artifact.downloadUrl ? (
                        <a href={artifact.downloadUrl} className="ui-button ui-button--secondary">
                          Descargar
                        </a>
                      ) : null}
                    </div>
                    <p className="mt-3 text-[13px] text-[color:var(--color-muted)]">
                      {formatDateTime(artifact.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </PrivateDashboardShell>
  );
}
