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
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    periodYear?: string;
    periodMonth?: string;
    view?: string;
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
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
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
  return index >= 0 && index < 12 ? `${monthNames[index]} ${year}` : periodLabel;
}

function getCurrentPeriod() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

function normalizePeriodYear(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : fallback;
}

function normalizePeriodMonth(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : fallback;
}

function normalizePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeTaxView(value: string | undefined, hasClosedRun: boolean) {
  if (value === "result") {
    return "result" as const;
  }

  if (value === "resolve") {
    return "resolve" as const;
  }

  return hasClosedRun ? "result" as const : "resolve" as const;
}

function buildPeriodLabel(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildTaxPageHref(
  slug: string,
  search: { periodYear?: number | null; periodMonth?: number | null; view?: "resolve" | "result" | null } = {},
) {
  const params = new URLSearchParams();

  if (typeof search.periodYear === "number") {
    params.set("periodYear", String(search.periodYear));
  }

  if (typeof search.periodMonth === "number") {
    params.set("periodMonth", String(search.periodMonth));
  }

  if (search.view) {
    params.set("view", search.view);
  }

  const query = params.toString();
  return `/app/o/${slug}/tax${query ? `?${query}` : ""}`;
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

  const currentPeriod = getCurrentPeriod();
  const selectedYear = normalizePeriodYear(resolvedSearchParams.periodYear, currentPeriod.year);
  const selectedMonth = normalizePeriodMonth(resolvedSearchParams.periodMonth, currentPeriod.month);
  const selectedPeriod = buildPeriodLabel(selectedYear, selectedMonth);
  const selectedRun = vatRuns.find((run) => run.periodLabel === selectedPeriod) ?? null;
  const isClosedRun = selectedRun?.status === "finalized" || selectedRun?.status === "locked";
  const activeView = normalizeTaxView(resolvedSearchParams.view, isClosedRun);
  const [vatUniverse, vatPreview, selectedExportDataset, workbenchData] = await Promise.all([
    loadVatPeriodUniverse(supabase, { organizationId: organization.id, period: selectedPeriod }),
    buildVatRunPreview({ organizationId: organization.id, year: selectedYear, month: selectedMonth }),
    selectedRun ? loadVatRunExportDataset(supabase, organization.id, selectedRun.id) : Promise.resolve(null),
    loadTaxPeriodWorkbenchData({
      organizationId: organization.id,
      organizationSlug: organization.slug,
      userRole: organization.role as
        | "owner" | "admin" | "admin_processing" | "accountant"
        | "reviewer" | "operator" | "viewer" | "developer",
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
    }),
  ]);
  const historicalImports = spreadsheetRuns.filter((run) =>
    run.importType === "historical_vat_liquidation" && run.status === "completed");
  const periodTitle = formatVatTitle(selectedPeriod);
  const periodOperationalStatus = describeVatPeriodOperationalStatus({
    runStatus: selectedRun?.status ?? null,
    reviewFlagsCount: selectedRun?.reviewFlagsCount ?? 0,
    universe: vatUniverse,
  });
  const displayOutputVat = selectedRun?.outputVat ?? vatPreview.totals.outputVat;
  const displayInputVatCreditable = selectedRun?.inputVatCreditable ?? vatPreview.totals.inputVatCreditable;
  const displayImportVat = selectedRun?.importVat ?? 0;
  const displayNetVatPayable = selectedRun?.netVatPayable ?? vatPreview.totals.netVatPayable;

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Impuestos"
      toolbarLabel={`Flujo guiado de IVA - ${periodTitle}`}
      description="Recorrido guiado del periodo fiscal: elegir mes, resolver pendientes y cerrar la corrida de IVA."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "tax")}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
                  Flujo guiado de IVA - {periodTitle}
                </h1>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  {selectedRun ? periodOperationalStatus.summary : "Periodo abierto en modo preview; todavia no hay cierre oficial generado."}
                </p>
              </div>
              <span className={periodOperationalStatus.tone === "success" ? "status-pill status-pill--success" : periodOperationalStatus.tone === "warning" ? "status-pill status-pill--warning" : "status-pill status-pill--info"}>
                {periodOperationalStatus.label}
              </span>
            </div>

            <form className="mt-4 flex flex-wrap items-end gap-3">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-white">Ano</span>
                <input name="periodYear" defaultValue={selectedYear} className="min-w-[120px] rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-2 text-[14px] text-white outline-none" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-white">Mes</span>
                <input name="periodMonth" defaultValue={selectedMonth} className="min-w-[120px] rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-2 text-[14px] text-white outline-none" />
              </label>
              <input type="hidden" name="view" value={activeView} />
              <SubmitButton formMethod="get" pendingLabel="Cambiando..." className="ui-button ui-button--secondary">
                Cambiar periodo
              </SubmitButton>
            </form>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <LoadingLink
                href={buildTaxPageHref(organization.slug, { periodYear: selectedYear, periodMonth: selectedMonth, view: "resolve" })}
                pendingLabel="Abriendo pendientes..."
                className={activeView === "resolve" ? "rounded-3xl border border-transparent bg-[color:var(--color-accent)] p-4 text-white" : "rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-4"}
              >
                <p className="text-sm font-semibold">Resolver pendientes del periodo</p>
                <p className={`mt-2 text-sm ${activeView === "resolve" ? "text-white/80" : "text-[color:var(--color-muted)]"}`}>
                  Workbench, elegibilidad fiscal y acciones operativas.
                </p>
              </LoadingLink>
              <LoadingLink
                href={buildTaxPageHref(organization.slug, { periodYear: selectedYear, periodMonth: selectedMonth, view: "result" })}
                pendingLabel="Abriendo resultado..."
                className={activeView === "result" ? "rounded-3xl border border-transparent bg-[color:var(--color-accent)] p-4 text-white" : "rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-4"}
              >
                <p className="text-sm font-semibold">Ver resultado IVA</p>
                <p className={`mt-2 text-sm ${activeView === "result" ? "text-white/80" : "text-[color:var(--color-muted)]"}`}>
                  Corrida, exportes e historia del periodo.
                </p>
              </LoadingLink>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <article className="metric-card"><span className="metric-card__label">Debito</span><span className="metric-card__value">{formatAmount(displayOutputVat)}</span></article>
            <article className="metric-card"><span className="metric-card__label">Credito</span><span className="metric-card__value">{formatAmount(displayInputVatCreditable)}</span></article>
            <article className="metric-card"><span className="metric-card__label">IVA neto</span><span className="metric-card__value">{formatAmount(displayNetVatPayable)}</span></article>
            <article className="metric-card"><span className="metric-card__label">IVA importacion</span><span className="metric-card__value">{formatAmount(displayImportVat)}</span></article>
          </section>

          {activeView === "resolve" ? (
            <>
              <TaxPeriodWorkbench
                slug={slug}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                period={selectedPeriod}
                workbench={workbenchData}
                isClosedRun={isClosedRun}
                manualResolveDocumentId={resolvedSearchParams.workbenchModal === "manual_assignment" ? resolvedSearchParams.focusDocumentId ?? null : null}
              />
              <section className="ui-panel">
                <div className="ui-panel-header">
                  <div>
                    <h2 className="text-[16px] font-semibold text-white">Generar resultado</h2>
                    <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                      Cuando el periodo quede limpio, genera la corrida definitiva o cambia a la vista de resultado.
                    </p>
                  </div>
                </div>
                {isClosedRun ? (
                  <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4 text-sm text-[color:var(--color-muted)]">
                    Este periodo ya tiene una corrida cerrada. Usa la vista Ver
                    resultado IVA para exportar o reabrir.
                  </div>
                ) : (
                  <>
                    <VatRunPreviewCard preview={vatPreview} />
                    <form
                      action={async () => {
                        "use server";
                        await generateVatRunDefinitiveAction({ slug, period: vatPreview.period });
                      }}
                      className="mt-4"
                    >
                      <SubmitButton pendingLabel="Generando..." className="ui-button ui-button--primary">
                        {selectedRun ? "Regenerar IVA definitivo" : "Generar IVA definitivo"}
                      </SubmitButton>
                    </form>
                  </>
                )}
              </section>
            </>
          ) : (
            <section className="ui-panel">
              <div className="ui-panel-header">
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Resultado del periodo</h2>
                  <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                    Resultado oficial cuando existe corrida cerrada; preview cuando el periodo todavia sigue abierto.
                  </p>
                </div>
              </div>
              {isClosedRun ? (
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4"><p className="text-[13px] text-[color:var(--color-muted)]">Debito</p><p className="mt-2 text-lg font-semibold text-white">{formatAmount(displayOutputVat)}</p></div>
                  <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4"><p className="text-[13px] text-[color:var(--color-muted)]">Credito</p><p className="mt-2 text-lg font-semibold text-white">{formatAmount(displayInputVatCreditable)}</p></div>
                  <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4"><p className="text-[13px] text-[color:var(--color-muted)]">Neto</p><p className="mt-2 text-lg font-semibold text-white">{formatAmount(displayNetVatPayable)}</p></div>
                  <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4"><p className="text-[13px] text-[color:var(--color-muted)]">Estado</p><p className="mt-2 text-lg font-semibold text-white">{formatLifecycleStatusLabel(selectedRun.status)}</p></div>
                </div>
              ) : (
                <VatRunPreviewCard preview={vatPreview} />
              )}

              {selectedRun ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  <form
                    action={async () => {
                      "use server";
                      await createVatRunExportAction({ slug, vatRunId: selectedRun.id });
                    }}
                  >
                    <SubmitButton pendingLabel="Exportando..." className="ui-button ui-button--secondary w-full">
                      Exportar reporte
                    </SubmitButton>
                  </form>
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
                    className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px]"
                  >
                    <input name="reason" placeholder="Motivo de reapertura" className="h-[34px] rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 text-[14px] outline-none" />
                    <SubmitButton pendingLabel="Reabriendo..." className="ui-button ui-button--secondary w-full">
                      Reabrir
                    </SubmitButton>
                  </form>
                </div>
              ) : null}
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Estado del periodo</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div className="ui-subtle-row"><span>Estado operativo</span><span>{periodOperationalStatus.label}</span></div>
              <div className="ui-subtle-row"><span>Preview</span><span>{vatUniverse.eligibleForVatPreviewCount} elegibles / {vatUniverse.documentsInPeriod}</span></div>
              <div className="ui-subtle-row"><span>Run oficial</span><span>{vatUniverse.eligibleForVatRunCount} elegibles / {vatUniverse.documentsInPeriod}</span></div>
              <div className="ui-subtle-row"><span>Exclusiones</span><span>Preview {vatUniverse.excludedFromVatPreviewCount} / Run {vatUniverse.excludedFromVatRunCount}</span></div>
            </div>
          </section>

          <details className="ui-panel" open={activeView === "result"}>
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-white">Historia y soportes</summary>
            <div className="border-t border-[color:var(--color-border)] p-4 space-y-4">
              <div className="space-y-3">
                {vatRuns.slice(0, 3).map((run) => (
                  <LoadingLink
                    key={run.id}
                    href={buildTaxPageHref(organization.slug, {
                      periodYear: Number.parseInt(run.periodLabel.slice(0, 4), 10),
                      periodMonth: Number.parseInt(run.periodLabel.slice(5, 7), 10),
                      view: "result",
                    })}
                    pendingLabel="Abriendo..."
                    className="ui-subtle-row"
                  >
                    <span className="text-white">{run.periodLabel}</span>
                    <span>{formatLifecycleStatusLabel(run.status)}</span>
                  </LoadingLink>
                ))}
                {vatRuns.length === 0 ? (
                  <div className="text-sm text-[color:var(--color-muted)]">Todavia no hay periodos liquidados.</div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4 text-sm text-[color:var(--color-muted)]">
                Historicos importados: {historicalImports.length}
              </div>
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4 text-sm text-[color:var(--color-muted)]">
                Resumen DGI: {selectedExportDataset ? selectedExportDataset.dgiFormSummary.formCode : "Pendiente"}
              </div>
            </div>
          </details>
        </div>
      </div>
    </PrivateDashboardShell>
  );
}
