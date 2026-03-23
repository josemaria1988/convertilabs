import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { VatRunPreviewCard } from "@/components/tax/vat-run-preview-card";
import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { loadVatRunExportDataset } from "@/modules/exports";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { formatLifecycleStatusLabel } from "@/modules/presentation/labels";
import { listOrganizationSpreadsheetImportRuns } from "@/modules/spreadsheets";
import {
  describeVatPeriodOperationalStatus,
  loadVatPeriodUniverse,
} from "@/modules/tax/vat-period-universe";
import { loadTaxPeriodWorkbenchData } from "@/modules/tax/tax-period-workbench";
import { buildVatRunPreview } from "@/modules/tax/vat-run-preview";
import { loadOrganizationVatRuns } from "@/modules/tax/vat-runs";
import { TaxPeriodWorkbench } from "./tax-period-workbench";
import {
  createVatRunExportAction,
  generateVatRunDefinitiveAction,
  updateVatRunLifecycleAction,
} from "./actions";

type OrganizationTaxPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    periodYear?: string;
    periodMonth?: string;
    workbenchState?: string;
    workbenchDirection?: string;
    workbenchManualResolution?: string;
    workbenchQuery?: string;
    workbenchPage?: string;
    focusDocumentId?: string;
    workbenchModal?: string;
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

function getCurrentPeriod() {
  const now = new Date();

  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
}

function normalizePeriodYear(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    return fallback;
  }

  return parsed;
}

function normalizePeriodMonth(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    return fallback;
  }

  return parsed;
}

function normalizePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function buildPeriodLabel(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildTaxPageHref(
  slug: string,
  search: {
    periodYear?: number | null;
    periodMonth?: number | null;
  } = {},
) {
  const params = new URLSearchParams();

  if (typeof search.periodYear === "number") {
    params.set("periodYear", String(search.periodYear));
  }

  if (typeof search.periodMonth === "number") {
    params.set("periodMonth", String(search.periodMonth));
  }

  const query = params.toString();
  return `/app/o/${slug}/tax${query ? `?${query}` : ""}`;
}

function buildAvailableTaxYears(input: {
  vatRuns: Awaited<ReturnType<typeof loadOrganizationVatRuns>>;
  selectedYear: number;
  currentYear: number;
}) {
  const years = new Set<number>([input.currentYear, input.selectedYear]);

  for (const run of input.vatRuns) {
    const year = Number.parseInt(run.periodLabel.slice(0, 4), 10);

    if (Number.isInteger(year)) {
      years.add(year);
    }
  }

  return Array.from(years).sort((left, right) => right - left);
}

export default async function OrganizationTaxPage({
  params,
  searchParams,
}: OrganizationTaxPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const [vatRuns, spreadsheetRuns] = await Promise.all([
    loadOrganizationVatRuns(supabase, organization.id),
    listOrganizationSpreadsheetImportRuns(supabase, organization.id, 8),
  ]);
  const historicalImports = spreadsheetRuns.filter((run) =>
    run.importType === "historical_vat_liquidation"
    && run.status === "completed",
  );

  const currentPeriod = getCurrentPeriod();
  const selectedYear = normalizePeriodYear(resolvedSearchParams.periodYear, currentPeriod.year);
  const selectedMonth = normalizePeriodMonth(resolvedSearchParams.periodMonth, currentPeriod.month);
  const selectedPeriod = buildPeriodLabel(selectedYear, selectedMonth);
  const selectedRun = vatRuns.find((run) => run.periodLabel === selectedPeriod) ?? null;
  const [vatUniverse, vatPreview] = await Promise.all([
    loadVatPeriodUniverse(supabase, {
      organizationId: organization.id,
      period: selectedPeriod,
    }),
    buildVatRunPreview({
      organizationId: organization.id,
      year: selectedYear,
      month: selectedMonth,
    }),
  ]);
  const workbenchData = await loadTaxPeriodWorkbenchData({
    organizationId: organization.id,
    organizationSlug: organization.slug,
    userRole: organization.role as
      | "owner"
      | "admin"
      | "admin_processing"
      | "accountant"
      | "reviewer"
      | "operator"
      | "viewer"
      | "developer",
    actorId: authState.user?.id ?? null,
    period: selectedPeriod,
    selectedRun,
    filters: {
      state:
        resolvedSearchParams.workbenchState === "detected"
        || resolvedSearchParams.workbenchState === "needs_review"
        || resolvedSearchParams.workbenchState === "eligible"
        || resolvedSearchParams.workbenchState === "confirmed"
        || resolvedSearchParams.workbenchState === "excluded"
        || resolvedSearchParams.workbenchState === "included_in_run"
          ? resolvedSearchParams.workbenchState
          : "all",
      direction:
        resolvedSearchParams.workbenchDirection === "purchase"
        || resolvedSearchParams.workbenchDirection === "sale"
          ? resolvedSearchParams.workbenchDirection
          : "all",
      manualResolution:
        resolvedSearchParams.workbenchManualResolution === "without_manual"
          ? "without_manual"
          : "all",
      query: resolvedSearchParams.workbenchQuery ?? "",
      page: normalizePositiveInt(resolvedSearchParams.workbenchPage, 1),
      pageSize: 25,
      focusDocumentId: resolvedSearchParams.focusDocumentId ?? null,
    },
  });
  const selectedExportDataset = selectedRun
    ? await loadVatRunExportDataset(supabase, organization.id, selectedRun.id)
    : null;
  const periodTitle = formatVatTitle(selectedPeriod);
  const selectedSales = selectedRun?.tracedDocuments.filter((document) => document.role === "sale")
    ?? vatPreview.includedDocuments.filter((document) => document.role === "sale");
  const selectedPurchases = selectedRun?.tracedDocuments.filter((document) => document.role === "purchase")
    ?? vatPreview.includedDocuments.filter((document) => document.role === "purchase");
  const availableYears = buildAvailableTaxYears({
    vatRuns,
    selectedYear,
    currentYear: currentPeriod.year,
  });
  const isClosedRun = selectedRun?.status === "finalized" || selectedRun?.status === "locked";
  const periodOperationalStatus = describeVatPeriodOperationalStatus({
    runStatus: selectedRun?.status ?? null,
    reviewFlagsCount: selectedRun?.reviewFlagsCount ?? 0,
    universe: vatUniverse,
  });
  const headerStatusLabel = periodOperationalStatus.label;
  const headerStatusTone =
    periodOperationalStatus.tone === "success"
      ? "status-pill status-pill--success"
      : periodOperationalStatus.tone === "warning"
        ? "status-pill status-pill--warning"
        : "status-pill status-pill--info";
  const displayOutputVat = selectedRun?.outputVat ?? vatPreview.totals.outputVat;
  const displayInputVatCreditable = selectedRun?.inputVatCreditable ?? vatPreview.totals.inputVatCreditable;
  const displayInputVatNonDeductible = selectedRun?.inputVatNonDeductible ?? vatPreview.totals.inputVatNonDeductible;
  const displayImportVat = selectedRun?.importVat ?? 0;
  const displayImportVatAdvance = selectedRun?.importVatAdvance ?? 0;
  const displayNetVatPayable = selectedRun?.netVatPayable ?? vatPreview.totals.netVatPayable;

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Impuestos"
      toolbarLabel={`Declaracion de IVA - ${periodTitle}`}
      description="Declaracion mensual de IVA con resumen del periodo, alertas, historial y acciones reales del ciclo de vida."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "tax")}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Declaracion de IVA - {periodTitle}
            </h1>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                {selectedRun
                  ? periodOperationalStatus.summary
                  : "Periodo abierto en modo preview; todavia no hay cierre oficial generado."}
              </p>
            </div>
            <span className={headerStatusTone}>{headerStatusLabel}</span>
          </div>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Periodo de trabajo</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Selecciona el mes que quieres liquidar o revisar. Si existe cierre oficial se muestra como reporte; si no existe, queda abierto para trabajar y cerrarlo.
                </p>
              </div>
              <span className="ui-filter">{selectedPeriod}</span>
            </div>

            <form className="mt-4 flex flex-wrap items-end gap-3">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-white">Ano</span>
                <select
                  name="periodYear"
                  defaultValue={selectedYear}
                  className="min-w-[130px] rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-2 text-[14px] text-white outline-none"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-white">Mes</span>
                <select
                  name="periodMonth"
                  defaultValue={selectedMonth}
                  className="min-w-[180px] rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-2 text-[14px] text-white outline-none"
                >
                  {monthNames.map((monthName, index) => (
                    <option key={monthName} value={index + 1}>{monthName}</option>
                  ))}
                </select>
              </label>
              <SubmitButton formMethod="get" pendingLabel="Cambiando..." className="ui-button ui-button--secondary">
                Cambiar periodo
              </SubmitButton>
            </form>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <article className="metric-card">
              <span className="metric-card__label">Debito Fiscal</span>
              <span className="ui-kpi-badge bg-[rgba(94,130,184,0.92)]">
                {formatAmount(displayOutputVat)}
              </span>
              <span className="metric-card__value">
                {formatAmount(displayOutputVat)}
              </span>
              <p className="metric-card__hint">Ventas gravadas del periodo seleccionado.</p>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">Credito Fiscal</span>
              <span className="ui-kpi-badge bg-[rgba(95,157,115,0.92)]">
                {formatAmount(displayInputVatCreditable)}
              </span>
              <span className="metric-card__value">
                {formatAmount(displayInputVatCreditable)}
              </span>
              <p className="metric-card__hint">Compras creditables confirmadas.</p>
            </article>
            <article className="metric-card" data-tone="success">
              <span className="metric-card__label">IVA a Pagar</span>
              <span className="ui-kpi-badge bg-[rgba(95,157,115,0.92)]">
                {selectedRun?.status ?? "preview"}
              </span>
              <span className="metric-card__value">
                {formatAmount(displayNetVatPayable)}
              </span>
              <p className="metric-card__hint">
                {selectedRun ? "Resultado neto de la corrida oficial del periodo." : "Resultado neto de la simulacion abierta."}
              </p>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">IVA Importacion</span>
              <span className="ui-kpi-badge bg-[rgba(94,130,184,0.92)]">
                {formatAmount(displayImportVat)}
              </span>
              <span className="metric-card__value">
                {formatAmount(displayImportVat)}
              </span>
              <p className="metric-card__hint">
                Anticipos e IVA aduanero aprobados para el periodo.
              </p>
            </article>
          </section>

          <TaxPeriodWorkbench
            slug={slug}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            period={selectedPeriod}
            workbench={workbenchData}
            isClosedRun={isClosedRun}
            manualResolveDocumentId={
              resolvedSearchParams.workbenchModal === "manual_assignment"
                ? resolvedSearchParams.focusDocumentId ?? null
                : null
            }
          />

          {isClosedRun ? (
            <section className="ui-panel">
              <div className="ui-panel-header">
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Reporte del cierre</h2>
                  <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                    Este periodo ya tiene una corrida cerrada. Se muestra en modo reporte y solo requiere reapertura si necesitas corregir documentos o recalcular.
                  </p>
                </div>
                <span className="ui-filter">{headerStatusLabel}</span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
                  <p className="text-[13px] text-[color:var(--color-muted)]">Debito oficial</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatAmount(displayOutputVat)}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
                  <p className="text-[13px] text-[color:var(--color-muted)]">Credito oficial</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatAmount(displayInputVatCreditable)}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
                  <p className="text-[13px] text-[color:var(--color-muted)]">No deducible</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatAmount(displayInputVatNonDeductible)}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
                  <p className="text-[13px] text-[color:var(--color-muted)]">Neto oficial</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatAmount(displayNetVatPayable)}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4 text-sm text-[color:var(--color-muted)]">
                Comparacion contra la simulacion actual: debito {formatAmount(vatPreview.officialRunComparison.deltaOutputVat)} / credito {formatAmount(vatPreview.officialRunComparison.deltaInputVatCreditable)} / neto {formatAmount(vatPreview.officialRunComparison.deltaNetVatPayable)}.
              </div>
            </section>
          ) : (
            <VatRunPreviewCard preview={vatPreview} />
          )}

          {!isClosedRun ? (
            <form
              action={async () => {
                "use server";
                await generateVatRunDefinitiveAction({
                  slug,
                  period: vatPreview.period,
                });
              }}
            >
              <SubmitButton pendingLabel="Regenerando..." className="ui-button ui-button--primary">
                {selectedRun ? "Regenerar IVA definitivo del periodo" : "Generar IVA definitivo desde la simulacion"}
              </SubmitButton>
            </form>
          ) : null}

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Resumen del Periodo</h2>
              <span className="ui-filter">{selectedRun ? "Oficial" : "Preview"}</span>
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
                  <span>{formatAmount(displayOutputVat)}</span>
                  <span className="status-pill status-pill--success">
                    {selectedSales.length} documentos
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
                  <span>{formatAmount(displayInputVatCreditable)}</span>
                  <span className="status-pill status-pill--success">
                    {selectedPurchases.length} documentos
                  </span>
                </div>
              </div>
              <div className="ui-subtle-row">
                <div className="flex items-center gap-3">
                  <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/10 bg-white/10 text-[12px] text-white">
                    I
                  </span>
                  <span className="text-white">IVA importacion / anticipo</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    {formatAmount(displayImportVat + displayImportVatAdvance)}
                  </span>
                  <span className="status-pill status-pill--success">
                    {selectedExportDataset?.imports.length ?? 0} trib.
                  </span>
                </div>
              </div>
            </div>

            {selectedRun ? (
              <div className="mt-4 space-y-3 border-t border-[color:var(--color-border)] pt-4">
                {!isClosedRun ? (
                  <div className="grid gap-2 md:grid-cols-4">
                    <form
                      action={async () => {
                        "use server";
                        await updateVatRunLifecycleAction({
                          slug,
                          vatRunId: selectedRun.id,
                          action: "review",
                        });
                      }}
                    >
                      <SubmitButton pendingLabel="Revisando..." className="ui-button ui-button--secondary w-full">
                        Revisar
                      </SubmitButton>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await updateVatRunLifecycleAction({
                          slug,
                          vatRunId: selectedRun.id,
                          action: "finalize",
                        });
                      }}
                    >
                      <SubmitButton pendingLabel="Finalizando..." className="ui-button ui-button--primary w-full">
                        Finalizar
                      </SubmitButton>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await updateVatRunLifecycleAction({
                          slug,
                          vatRunId: selectedRun.id,
                          action: "lock",
                        });
                      }}
                    >
                      <SubmitButton pendingLabel="Bloqueando..." className="ui-button ui-button--secondary w-full">
                        Bloquear
                      </SubmitButton>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await createVatRunExportAction({
                          slug,
                          vatRunId: selectedRun.id,
                        });
                      }}
                    >
                      <SubmitButton pendingLabel="Exportando..." className="ui-button ui-button--secondary w-full">
                        Exportar
                      </SubmitButton>
                    </form>
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    <form
                      action={async () => {
                        "use server";
                        await createVatRunExportAction({
                          slug,
                          vatRunId: selectedRun.id,
                        });
                      }}
                    >
                      <SubmitButton pendingLabel="Exportando..." className="ui-button ui-button--secondary w-full">
                        Exportar reporte
                      </SubmitButton>
                    </form>
                    <div className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-2 text-[13px] text-[color:var(--color-muted)]">
                      Periodo cerrado: reabre solo si necesitas corregir o recalcular.
                    </div>
                  </div>
                )}

                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await updateVatRunLifecycleAction({
                      slug,
                      vatRunId: selectedRun.id,
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
                  <SubmitButton pendingLabel="Reabriendo..." className="ui-button ui-button--secondary w-full">
                    Reabrir
                  </SubmitButton>
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
                <LoadingLink
                  href={`/app/o/${organization.slug}/tax/reconciliation`}
                  pendingLabel="Abriendo..."
                  className="ui-button ui-button--primary min-h-[28px] px-3 text-[13px]"
                >
                  Conciliar Diferencias
                </LoadingLink>
              </div>
              <div className="ui-alert-row">
                <span className="ui-alert-row__icon" />
                <span className="flex-1 text-[14px] font-medium text-white">
                  Credito Fiscal Inconsistente
                </span>
                <LoadingLink
                  href={`/app/o/${organization.slug}/tax/reconciliation`}
                  pendingLabel="Abriendo..."
                  className="ui-button ui-button--secondary min-h-[28px] px-3 text-[13px]"
                >
                  Ver Detalles
                </LoadingLink>
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
                Estado del periodo
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              {[
                {
                  label: "Estado operativo",
                  value: periodOperationalStatus.label,
                  ready: periodOperationalStatus.tone === "success",
                },
                {
                  label: "VAT preview",
                  value: `${vatUniverse.eligibleForVatPreviewCount} elegibles / ${vatUniverse.documentsInPeriod} del periodo`,
                  ready: vatUniverse.eligibleForVatPreviewCount > 0,
                },
                {
                  label: "VAT run oficial",
                  value: `${vatUniverse.eligibleForVatRunCount} elegibles / ${vatUniverse.documentsInPeriod} del periodo`,
                  ready: vatUniverse.eligibleForVatRunCount > 0,
                },
                {
                  label: "Exclusiones activas",
                  value: `Preview ${vatUniverse.excludedFromVatPreviewCount} / Run ${vatUniverse.excludedFromVatRunCount}`,
                  ready:
                    vatUniverse.excludedFromVatPreviewCount === 0
                    && vatUniverse.excludedFromVatRunCount === 0
                    && vatUniverse.documentsInPeriod > 0,
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
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {selectedRun ? (
              <form
                action={async () => {
                  "use server";
                  await createVatRunExportAction({
                    slug,
                    vatRunId: selectedRun.id,
                  });
                }}
                className="mt-4"
              >
                <SubmitButton pendingLabel="Generando..." className="ui-button ui-button--secondary w-full">
                  Generar export
                </SubmitButton>
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
                  <LoadingLink
                    key={run.id}
                    href={buildTaxPageHref(organization.slug, {
                      periodYear: Number.parseInt(run.periodLabel.slice(0, 4), 10),
                      periodMonth: Number.parseInt(run.periodLabel.slice(5, 7), 10),
                    })}
                    pendingLabel="Abriendo..."
                    className="ui-subtle-row"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/10 bg-white/10 text-[12px] text-white">
                        ✓
                      </span>
                      <span className="text-white">{run.periodLabel}</span>
                    </div>
                    <span>{formatLifecycleStatusLabel(run.status)}</span>
                  </LoadingLink>
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
                    <span>{run.confirmedAt ? "Confirmado" : "Vista previa"}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">
                Resumen DGI
              </h2>
              <span className="ui-filter">
                {selectedExportDataset?.dgiFormSummary.formCode ?? "2176"}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {!selectedExportDataset ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Todavia no hay run fiscal listo para mapear a formulario.
                </div>
              ) : (
                selectedExportDataset.dgiFormSummary.lines.map((line) => (
                  <div key={`${line.lineCode}-${line.metricKey}`} className="ui-subtle-row">
                    <div>
                      <p className="text-white">{line.lineCode} - {line.label}</p>
                      <p className="text-[13px] text-[color:var(--color-muted)]">
                        {line.metricKey} / {line.sourceType}
                      </p>
                    </div>
                    <span>{formatAmount(line.value)}</span>
                  </div>
                ))
              )}
            </div>

            {selectedExportDataset?.dgiFormSummary.warnings.length ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {selectedExportDataset.dgiFormSummary.warnings.join(" ")}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </PrivateDashboardShell>
  );
}
