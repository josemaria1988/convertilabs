import type { Metadata } from "next";
import Link from "next/link";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { loadRecentExports } from "@/modules/exports";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { listOrganizationSpreadsheetImportRuns } from "@/modules/spreadsheets";
import { loadOrganizationVatRuns } from "@/modules/tax/vat-runs";
import {
  createVatRunExportAction,
  updateVatRunLifecycleAction,
} from "./actions";

type OrganizationTaxPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Impuestos",
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

function formatAmount(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatVatTitle(periodLabel: string | null) {
  if (!periodLabel || !periodLabel.includes("-")) {
    return "Periodo pendiente";
  }

  const [year, month] = periodLabel.split("-");
  const index = Number(month) - 1;

  if (!Number.isFinite(index) || index < 0 || index > 11) {
    return periodLabel;
  }

  return `${monthNames[index]} ${year}`;
}

export default async function OrganizationTaxPage({
  params,
}: OrganizationTaxPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const [vatRuns, exports, spreadsheetRuns] = await Promise.all([
    loadOrganizationVatRuns(supabase, organization.id),
    loadRecentExports(organization.id),
    listOrganizationSpreadsheetImportRuns(supabase, organization.id, 8),
  ]);
  const historicalImports = spreadsheetRuns.filter((run) =>
    run.importType === "historical_vat_liquidation"
    && run.status === "completed",
  );

  const latestRun = vatRuns[0] ?? null;
  const periodTitle = formatVatTitle(latestRun?.periodLabel ?? null);
  const latestExports = latestRun
    ? exports.filter((artifact) => artifact.targetId === latestRun.id)
    : [];
  const latestSales = latestRun?.tracedDocuments.filter((document) => document.role === "sale") ?? [];
  const latestPurchases = latestRun?.tracedDocuments.filter((document) => document.role === "purchase") ?? [];

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Impuestos"
      toolbarLabel={latestRun ? `Declaracion de IVA - ${periodTitle}` : "Impuestos"}
      description="Declaracion mensual de IVA con resumen del periodo, alertas, historial y acciones reales de lifecycle."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "tax")}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Declaracion de IVA - {periodTitle}
            </h1>
          </div>

          <section className="grid gap-3 md:grid-cols-3">
            <article className="metric-card">
              <span className="metric-card__label">Debito Fiscal</span>
              <span className="ui-kpi-badge bg-[rgba(94,130,184,0.92)]">
                {formatAmount(latestRun?.outputVat ?? null)}
              </span>
              <span className="metric-card__value">
                {formatAmount(latestRun?.outputVat ?? null)}
              </span>
              <p className="metric-card__hint">Ventas gravadas del periodo actual.</p>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">Credito Fiscal</span>
              <span className="ui-kpi-badge bg-[rgba(95,157,115,0.92)]">
                {formatAmount(latestRun?.inputVatCreditable ?? null)}
              </span>
              <span className="metric-card__value">
                {formatAmount(latestRun?.inputVatCreditable ?? null)}
              </span>
              <p className="metric-card__hint">Compras creditables confirmadas.</p>
            </article>
            <article className="metric-card" data-tone="success">
              <span className="metric-card__label">IVA a Pagar</span>
              <span className="ui-kpi-badge bg-[rgba(95,157,115,0.92)]">
                {latestRun?.status ?? "Pendiente"}
              </span>
              <span className="metric-card__value">
                {formatAmount(latestRun?.netVatPayable ?? null)}
              </span>
              <p className="metric-card__hint">Resultado neto del ultimo run consolidado.</p>
            </article>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Resumen del Periodo</h2>
              <span className="ui-filter">Financiero</span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="ui-subtle-row">
                <div className="flex items-center gap-3">
                  <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/10 bg-white/10 text-[12px] text-white">
                    ✓
                  </span>
                  <span className="text-white">Ventas Gravadas</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>{formatAmount(latestRun?.outputVat ?? null)}</span>
                  <span className="status-pill status-pill--success">
                    {latestSales.length} docs
                  </span>
                </div>
              </div>
              <div className="ui-subtle-row">
                <div className="flex items-center gap-3">
                  <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/10 bg-white/10 text-[12px] text-white">
                    ✓
                  </span>
                  <span className="text-white">Compras Gravadas</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>{formatAmount(latestRun?.inputVatCreditable ?? null)}</span>
                  <span className="status-pill status-pill--success">
                    {latestPurchases.length} docs
                  </span>
                </div>
              </div>
            </div>

            {latestRun ? (
              <div className="mt-4 space-y-3 border-t border-[color:var(--color-border)] pt-4">
                <div className="grid gap-2 md:grid-cols-4">
                  <form
                    action={async () => {
                      "use server";
                      await updateVatRunLifecycleAction({
                        slug,
                        vatRunId: latestRun.id,
                        action: "review",
                      });
                    }}
                  >
                    <button className="ui-button ui-button--secondary w-full">
                      Revisar
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await updateVatRunLifecycleAction({
                        slug,
                        vatRunId: latestRun.id,
                        action: "finalize",
                      });
                    }}
                  >
                    <button className="ui-button ui-button--primary w-full">
                      Finalizar
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await updateVatRunLifecycleAction({
                        slug,
                        vatRunId: latestRun.id,
                        action: "lock",
                      });
                    }}
                  >
                    <button className="ui-button ui-button--secondary w-full">
                      Bloquear
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await createVatRunExportAction({
                        slug,
                        vatRunId: latestRun.id,
                      });
                    }}
                  >
                    <button className="ui-button ui-button--secondary w-full">
                      Exportar
                    </button>
                  </form>
                </div>

                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await updateVatRunLifecycleAction({
                      slug,
                      vatRunId: latestRun.id,
                      action: "reopen",
                      reason: String(formData.get("reason") ?? ""),
                    });
                  }}
                  className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px]"
                >
                  <input
                    name="reason"
                    placeholder="Motivo de reapertura"
                    className="h-[34px] rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 text-[14px] outline-none"
                  />
                  <button className="ui-button ui-button--secondary w-full">
                    Reabrir
                  </button>
                </form>
              </div>
            ) : null}
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-semibold text-white">Alertas y Diferencias</h2>
                <span className="text-[13px] text-[color:var(--color-muted)]">i</span>
              </div>
              <span className="ui-filter">Diferencias</span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="ui-alert-row">
                <span className="ui-alert-row__icon" />
                <span className="flex-1 text-[14px] font-medium text-white">
                  Diferencia en Ventas
                </span>
                <span className="ui-button ui-button--primary min-h-[28px] px-3 text-[13px]">
                  Conciliar Diferencias
                </span>
              </div>
              <div className="ui-alert-row">
                <span className="ui-alert-row__icon" />
                <span className="flex-1 text-[14px] font-medium text-white">
                  Credito Fiscal Inconsistente
                </span>
                <span className="ui-button ui-button--secondary min-h-[28px] px-3 text-[13px]">
                  Ver Detalles
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[14px] text-[color:var(--color-muted)]">
              <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/10 bg-white/10 text-[12px] text-white">
                ✓
              </span>
              <span>Ver Detalles</span>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">
                Historial de declaraciones
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              {[
                {
                  label: "Resumen mensual",
                  ready: Boolean(latestRun),
                },
                {
                  label: "Ventas",
                  ready: latestSales.length > 0,
                },
                {
                  label: "Documentos",
                  ready: latestPurchases.length > 0 || latestSales.length > 0,
                },
                {
                  label: "Retenciones",
                  ready: latestExports.length > 0,
                },
              ].map((item) => (
                <div key={item.label} className="ui-subtle-row">
                  <div className="flex items-center gap-3">
                    <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/10 bg-white/10 text-[12px] text-white">
                      {item.ready ? "✓" : " "}
                    </span>
                    <span className="text-white">{item.label}</span>
                  </div>
                  <span className={item.ready ? "text-[#daf0e0]" : "text-[color:var(--color-muted)]"}>
                    {item.ready ? "Listo" : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>

            {latestRun ? (
              <form
                action={async () => {
                  "use server";
                  await createVatRunExportAction({
                    slug,
                    vatRunId: latestRun.id,
                  });
                }}
                className="mt-4"
              >
                <button className="ui-button ui-button--secondary w-full">
                  Generar export
                </button>
              </form>
            ) : (
              <span className="ui-button ui-button--secondary mt-4 w-full">
                Export pendiente
              </span>
            )}
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">
                Historia de Declaraciones
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              {vatRuns.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Todavia no hay periodos liquidados.
                </div>
              ) : (
                vatRuns.slice(0, 3).map((run) => (
                  <Link
                    key={run.id}
                    href={`/app/o/${organization.slug}/tax`}
                    className="ui-subtle-row"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/10 bg-white/10 text-[12px] text-white">
                        ✓
                      </span>
                      <span className="text-white">{run.periodLabel}</span>
                    </div>
                    <span>{run.status}</span>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">
                Historicos importados
              </h2>
              <span className="ui-filter">{historicalImports.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {historicalImports.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Todavia no hay periodos historicos traidos desde planillas.
                </div>
              ) : (
                historicalImports.slice(0, 3).map((run) => (
                  <div key={run.id} className="ui-subtle-row">
                    <div className="flex items-center gap-3">
                      <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/10 bg-white/10 text-[12px] text-white">
                        I
                      </span>
                      <span className="text-white">{run.fileName}</span>
                    </div>
                    <span>{run.confirmedAt ? "confirmado" : "preview"}</span>
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
