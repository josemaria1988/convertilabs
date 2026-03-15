import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  dgiBucketDefinitions,
  type DgiReconciliationBucketCode,
} from "@/modules/tax/dgi-summary-normalizer";
import {
  listOrganizationDgiReconciliationRuns,
  loadDgiReconciliationRunDetail,
} from "@/modules/tax/dgi-reconciliation";
import { formatLifecycleStatusLabel } from "@/modules/presentation/labels";
import {
  closeDgiReconciliationRunAction,
  createDgiReconciliationRunAction,
  reopenDocumentFromDgiAction,
  reviewDgiBucketAction,
} from "./actions";

type DgiReconciliationPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    run?: string;
  }>;
};

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const metadata: Metadata = {
  title: "Conciliacion DGI",
};

function formatAmount(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);
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

function formatDifferenceStatus(value: string) {
  switch (value) {
    case "matched":
      return "Sin diferencias";
    case "missing_in_system":
      return "Falta en sistema";
    case "extra_in_system":
      return "Extra en sistema";
    case "amount_mismatch":
      return "Diferencia de monto";
    case "tax_treatment_mismatch":
      return "Tratamiento fiscal distinto";
    case "pending_manual_adjustment":
      return "Ajuste externo pendiente";
    default:
      return value.replace(/_/g, " ");
  }
}

function getStatusPillClass(value: string) {
  switch (value) {
    case "matched":
    case "reviewed":
    case "closed":
      return "status-pill status-pill--success";
    case "missing_in_system":
    case "extra_in_system":
    case "amount_mismatch":
    case "tax_treatment_mismatch":
      return "status-pill status-pill--warning";
    case "pending_manual_adjustment":
      return "status-pill status-pill--danger";
    default:
      return "status-pill status-pill--info";
  }
}

function getDefaultPeriod() {
  const now = new Date();

  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
}

function buildFieldNames(code: DgiReconciliationBucketCode) {
  switch (code) {
    case "sales_basic":
      return { net: "salesBasicNet", tax: "salesBasicTax" };
    case "sales_minimum":
      return { net: "salesMinimumNet", tax: "salesMinimumTax" };
    case "purchase_basic":
      return { net: "purchaseBasicNet", tax: "purchaseBasicTax" };
    case "purchase_minimum":
      return { net: "purchaseMinimumNet", tax: "purchaseMinimumTax" };
    case "exempt_or_non_taxed":
      return { net: "exemptNet", tax: "exemptTax" };
    case "import_vat":
      return { net: "importVatNet", tax: "importVatTax" };
    case "import_vat_advance":
      return { net: "importVatAdvanceNet", tax: "importVatAdvanceTax" };
    case "withholdings":
      return { net: "withholdingsNet", tax: "withholdingsTax" };
    default:
      return { net: `${code}Net`, tax: `${code}Tax` };
  }
}

export default async function DgiReconciliationPage({
  params,
  searchParams,
}: DgiReconciliationPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const runs = await listOrganizationDgiReconciliationRuns(supabase, organization.id, 8);
  const selectedRunId = resolvedSearchParams?.run ?? runs[0]?.id ?? null;
  const selectedRun = selectedRunId
    ? await loadDgiReconciliationRunDetail(supabase, organization.id, selectedRunId)
    : null;
  const defaultPeriod = selectedRun
    ? { year: selectedRun.periodYear, month: selectedRun.periodMonth }
    : getDefaultPeriod();

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Conciliacion DGI"
      toolbarLabel="Conciliacion DGI"
      description="Baseline mensual DGI contra el universo procesado por Convertilabs, con buckets, diferencias auditables y reapertura deliberada."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "tax")}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h1 className="text-[20px] font-semibold text-white">Nueva corrida DGI</h1>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Carga manual del baseline por bucket para comparar contra documentos ya posteados.
                </p>
              </div>
              <span className="status-pill status-pill--info">MVP manual</span>
            </div>

            <form action={createDgiReconciliationRunAction} className="mt-4 space-y-4">
              <input type="hidden" name="slug" value={organization.slug} />
              <div className="grid gap-3 md:grid-cols-[140px_140px_minmax(0,1fr)]">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Ano</span>
                  <input
                    type="number"
                    name="periodYear"
                    defaultValue={defaultPeriod.year}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Mes</span>
                  <select
                    name="periodMonth"
                    defaultValue={defaultPeriod.month}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  >
                    {monthNames.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Nota operativa</span>
                  <input
                    name="note"
                    placeholder="Ej. Totales cargados desde portal DGI por el estudio."
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {dgiBucketDefinitions.map((bucket) => {
                  const fields = buildFieldNames(bucket.code);

                  return (
                    <div
                      key={bucket.code}
                      className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                    >
                      <p className="text-sm font-semibold text-white">{bucket.label}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-[color:var(--color-muted)]">Neto UYU</span>
                          <input
                            type="number"
                            step="0.01"
                            name={fields.net}
                            defaultValue={selectedRun?.baseline[bucket.code]?.netAmountUyu ?? 0}
                            className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-[color:var(--color-muted)]">IVA UYU</span>
                          <input
                            type="number"
                            step="0.01"
                            name={fields.tax}
                            defaultValue={selectedRun?.baseline[bucket.code]?.taxAmountUyu ?? 0}
                            className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="ui-button ui-button--primary">
                Calcular conciliacion
              </button>
            </form>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Buckets comparados</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Cada bucket muestra DGI vs sistema, con justificaci&oacute;n manual y ajuste externo opcional.
                </p>
              </div>
              <span className={getStatusPillClass(selectedRun?.status ?? "draft")}>
                {selectedRun ? formatLifecycleStatusLabel(selectedRun.status) : "Sin corrida"}
              </span>
            </div>

            {!selectedRun ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-6 py-12 text-center text-sm text-[color:var(--color-muted)]">
                Todavia no hay una corrida seleccionada. Crea o abre una corrida para revisar diferencias.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {selectedRun.buckets.map((bucket) => (
                  <form
                    key={bucket.id}
                    action={reviewDgiBucketAction}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                  >
                    <input type="hidden" name="slug" value={organization.slug} />
                    <input type="hidden" name="runId" value={selectedRun.id} />
                    <input type="hidden" name="bucketId" value={bucket.id} />

                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{bucket.label}</p>
                        <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                          {bucket.bucketCode}
                        </p>
                      </div>
                      <span className={getStatusPillClass(bucket.differenceStatus)}>
                        {formatDifferenceStatus(bucket.differenceStatus)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 p-3 text-sm">
                        <p className="font-medium text-white">DGI</p>
                        <p className="mt-2 text-[color:var(--color-muted)]">
                          Neto {formatAmount(bucket.dgiNetAmountUyu)} / IVA {formatAmount(bucket.dgiTaxAmountUyu)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 p-3 text-sm">
                        <p className="font-medium text-white">Sistema</p>
                        <p className="mt-2 text-[color:var(--color-muted)]">
                          Neto {formatAmount(bucket.systemNetAmountUyu)} / IVA {formatAmount(bucket.systemTaxAmountUyu)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 p-3 text-sm">
                        <p className="font-medium text-white">Delta</p>
                        <p className="mt-2 text-[color:var(--color-muted)]">
                          Neto {formatAmount(bucket.deltaNetAmountUyu)} / IVA {formatAmount(bucket.deltaTaxAmountUyu)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
                      <input
                        name="note"
                        defaultValue={bucket.notes ?? ""}
                        placeholder="Justificacion o evidencia del ajuste"
                        className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm"
                      />
                      <button
                        type="submit"
                        name="action"
                        value="justify"
                        className="ui-button ui-button--secondary"
                      >
                        Guardar justificacion
                      </button>
                      <button
                        type="submit"
                        name="action"
                        value="mark_external_adjustment"
                        className="ui-button ui-button--danger"
                      >
                        Marcar ajuste externo
                      </button>
                    </div>
                  </form>
                ))}

                {selectedRun.status !== "closed" ? (
                  <form action={closeDgiReconciliationRunAction}>
                    <input type="hidden" name="slug" value={organization.slug} />
                    <input type="hidden" name="runId" value={selectedRun.id} />
                    <button className="ui-button ui-button--primary">
                      Cerrar conciliacion
                    </button>
                  </form>
                ) : null}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Corridas recientes</h2>
              <span className="ui-filter">{runs.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {runs.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Aun no hay corridas de conciliacion para esta organizacion.
                </div>
              ) : (
                runs.map((run) => (
                  <a
                    key={run.id}
                    href={`/app/o/${organization.slug}/tax/reconciliation?run=${run.id}`}
                    className="block rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{run.periodLabel}</p>
                        <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                          {formatLifecycleStatusLabel(run.status)} / {run.sourceKind.replace(/_/g, " ")}
                        </p>
                      </div>
                      <span className={getStatusPillClass(run.status)}>
                        {(run.summary.amount_mismatch ?? 0) + (run.summary.missing_in_system ?? 0) + (run.summary.extra_in_system ?? 0)}
                      </span>
                    </div>
                    <p className="mt-3 text-[13px] text-[color:var(--color-muted)]">
                      Creada {formatDateTime(run.createdAt)}
                    </p>
                  </a>
                ))
              )}
            </div>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Documentos del periodo</h2>
              <span className="ui-filter">{selectedRun?.periodDocuments.length ?? 0}</span>
            </div>

            <div className="mt-4 space-y-3">
              {!selectedRun || selectedRun.periodDocuments.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  No hay documentos posteados para el periodo seleccionado.
                </div>
              ) : (
                selectedRun.periodDocuments.map((document) => (
                  <form
                    key={document.id}
                    action={reopenDocumentFromDgiAction}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                  >
                    <input type="hidden" name="slug" value={organization.slug} />
                    <input type="hidden" name="documentId" value={document.id} />
                    <p className="font-semibold text-white">{document.originalFilename}</p>
                    <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                      {document.documentDate ?? "Sin fecha"} / {document.postingStatus ?? "Sin posting status"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`/app/o/${organization.slug}/documents/${document.id}`}
                        className="ui-button ui-button--secondary"
                      >
                        Ver documento
                      </a>
                      <button className="ui-button ui-button--warning">
                        Reabrir revision
                      </button>
                    </div>
                  </form>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </PrivateDashboardShell>
  );
}
