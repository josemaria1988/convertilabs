import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { loadCloseWorkspaceData, type CloseCheckResult } from "@/modules/close/service";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { formatLifecycleStatusLabel } from "@/modules/presentation/labels";
import {
  runCloseValidatorAction,
  transitionFiscalPeriodStatusAction,
} from "./actions";
import type { CanonicalFiscalPeriodStatus } from "@/modules/accounting/fiscal-period-status";

type OrganizationClosePageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ period?: string }>;
};

export const metadata: Metadata = {
  title: "Cierre",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getRunTone(status: "pass" | "warning" | "blocker") {
  switch (status) {
    case "pass":
      return "status-pill status-pill--success";
    case "warning":
      return "status-pill status-pill--warning";
    default:
      return "status-pill status-pill--danger";
  }
}

function getCheckTone(status: string) {
  switch (status) {
    case "pass":
      return "status-pill status-pill--success";
    case "warning":
      return "status-pill status-pill--warning";
    case "blocker":
      return "status-pill status-pill--danger";
    default:
      return "status-pill status-pill--info";
  }
}

function getPeriodTone(status: CanonicalFiscalPeriodStatus) {
  switch (status) {
    case "open":
      return "status-pill status-pill--info";
    case "ready_to_close":
    case "soft_closed":
      return "status-pill status-pill--warning";
    case "tax_locked":
    case "hard_closed":
    case "audit_frozen":
      return "status-pill status-pill--success";
    default:
      return "status-pill status-pill--info";
  }
}

function groupCloseResults(results: CloseCheckResult[]) {
  return [
    { key: "documents", label: "Documentos" },
    { key: "tax", label: "Impuestos" },
    { key: "accounting", label: "Contabilidad" },
    { key: "operations", label: "Open items y operaciones" },
  ].map((group) => ({
    ...group,
    items: results.filter((result) => result.family === group.key),
  }));
}

export default async function OrganizationClosePage({
  params,
  searchParams,
}: OrganizationClosePageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const workspace = await loadCloseWorkspaceData(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    fiscalPeriodCode: resolvedSearchParams.period ?? null,
  });

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Cierre"
      toolbarLabel="Cierre mensual"
      description="Secuencia de cierre mensual: elegir periodo, correr validator, resolver bloqueos y ejecutar la siguiente transicion."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "close")}
    >
      {!workspace.isAvailable || !workspace.selectedPeriod || !workspace.preview ? (
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h1 className="text-[22px] font-semibold text-white">Cierre mensual</h1>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Todavia no hay periodos contables abiertos en esta organizacion.
              </p>
            </div>
            <span className="status-pill status-pill--info">Pendiente</span>
          </div>
        </section>
      ) : (
        (() => {
          const resultGroups = groupCloseResults(workspace.preview.results);
          const primaryTransition = workspace.transitionOptions.find((option) => option.enabled) ?? null;
          const secondaryTransitions = workspace.transitionOptions.filter((option) => option.enabled).slice(1);

          return (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <section className="ui-panel">
                  <div className="ui-panel-header">
                    <div>
                      <h1 className="text-[22px] font-semibold text-white">
                        Cierre mensual - {workspace.selectedPeriod.code}
                      </h1>
                      <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                        El objetivo es simple: validar el mes, entender los bloqueos por origen y ejecutar una sola transicion dominante.
                      </p>
                    </div>
                    <span className={getPeriodTone(workspace.selectedPeriod.normalizedStatus)}>
                      {formatLifecycleStatusLabel(workspace.selectedPeriod.normalizedStatus)}
                    </span>
                  </div>

                  <form className="mt-4 flex flex-wrap items-end gap-3">
                    <label className="w-full space-y-2 text-sm sm:w-auto">
                      <span className="font-medium text-white">Periodo</span>
                      <select
                        name="period"
                        defaultValue={workspace.selectedPeriod.code}
                        className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm sm:min-w-[220px]"
                      >
                        {workspace.periods.map((period) => (
                          <option key={period.id} value={period.code}>
                            {period.code} - {formatLifecycleStatusLabel(period.normalizedStatus)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <SubmitButton formMethod="get" pendingLabel="Abriendo..." className="ui-button ui-button--secondary w-full sm:w-auto">
                      Cambiar periodo
                    </SubmitButton>
                  </form>
                </section>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <article className="rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-4">
                    <p className="text-sm font-semibold text-white">Paso 1 · Correr validator</p>
                    <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                      Ejecuta el chequeo deterministico para obtener blockers y warnings reales del mes.
                    </p>
                  </article>
                  <article className="rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-4">
                    <p className="text-sm font-semibold text-white">Paso 2 · Resolver bloqueos</p>
                    <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                      Agrupa los resultados por documentos, impuestos, contabilidad y open items.
                    </p>
                  </article>
                  <article className="rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-4">
                    <p className="text-sm font-semibold text-white">Paso 3 · Transicionar</p>
                    <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                      Cuando el validator este sano, ejecuta la siguiente transicion formal disponible.
                    </p>
                  </article>
                </section>

                <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <article className="metric-card" data-tone={workspace.preview.blockerCount > 0 ? "warning" : "success"}>
                    <span className="metric-card__label">Blockers</span>
                    <span className="metric-card__value">{workspace.preview.blockerCount}</span>
                    <p className="metric-card__hint">Checks que frenan la siguiente transicion.</p>
                  </article>
                  <article className="metric-card">
                    <span className="metric-card__label">Warnings</span>
                    <span className="metric-card__value">{workspace.preview.warningCount}</span>
                    <p className="metric-card__hint">Puntos a documentar o resolver antes del cierre.</p>
                  </article>
                  <article className="metric-card">
                    <span className="metric-card__label">Documentos del mes</span>
                    <span className="metric-card__value">{workspace.preview.snapshot.documents.totalCount}</span>
                    <p className="metric-card__hint">Base documental visible para este corte.</p>
                  </article>
                </section>

                <section className="ui-panel">
                  <div className="ui-panel-header">
                    <div>
                      <h2 className="text-[16px] font-semibold text-white">Paso 1 · Validator deterministico</h2>
                      <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                        Guarda una corrida formal cuando quieras dejar trazabilidad del chequeo.
                      </p>
                    </div>
                    <span className={getRunTone(workspace.preview.status)}>
                      {workspace.preview.status === "blocker" ? "Con blockers" : workspace.preview.status === "warning" ? "Con warnings" : "En verde"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await runCloseValidatorAction({
                          slug,
                          fiscalPeriodId: workspace.selectedPeriod!.id,
                        });
                      }}
                    >
                      <SubmitButton pendingLabel="Corriendo..." className="ui-button ui-button--primary">
                        Ejecutar validator
                      </SubmitButton>
                    </form>
                    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 px-4 py-3 text-sm text-[color:var(--color-muted)]">
                      Ultima corrida guardada: {formatDateTime(workspace.latestCheckRun?.createdAt)}
                    </div>
                  </div>
                </section>

                <section className="ui-panel">
                  <div className="ui-panel-header">
                    <div>
                      <h2 className="text-[16px] font-semibold text-white">Paso 2 · Bloqueos agrupados</h2>
                      <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                        Cada grupo muestra primero lo que esta bloqueando y deja los passes en segundo plano.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    {resultGroups.map((group) => (
                      <div key={group.key} className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{group.label}</p>
                            <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                              {group.items.filter((item) => item.status !== "pass").length} item(s) con trabajo visible.
                            </p>
                          </div>
                          <span className="ui-filter">{group.items.length}</span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {(group.items.filter((item) => item.status !== "pass").length > 0
                            ? group.items.filter((item) => item.status !== "pass")
                            : group.items
                          ).map((result) => (
                            <article key={result.code} className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-white">{result.label}</p>
                                  <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">{result.message}</p>
                                </div>
                                <span className={getCheckTone(result.status)}>
                                  {result.status === "blocker" ? "Blocker" : result.status === "warning" ? "Warning" : "Pass"}
                                </span>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-4">
                <section className="ui-panel">
                  <div className="ui-panel-header">
                    <div>
                      <h2 className="text-[16px] font-semibold text-white">Paso 3 · Siguiente transicion</h2>
                      <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                        Muestra solo la accion dominante y deja el resto como alternativas secundarias.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {primaryTransition ? (
                      <form
                        action={async () => {
                          "use server";
                          await transitionFiscalPeriodStatusAction({
                            slug,
                            fiscalPeriodId: workspace.selectedPeriod!.id,
                            nextStatus: primaryTransition.nextStatus,
                          });
                        }}
                      >
                        <SubmitButton pendingLabel="Actualizando..." className="ui-button ui-button--primary w-full">
                          Pasar a {formatLifecycleStatusLabel(primaryTransition.nextStatus)}
                        </SubmitButton>
                      </form>
                    ) : (
                      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4 text-sm text-[color:var(--color-muted)]">
                        No hay una transicion habilitada todavia. Primero resuelve blockers o vuelve a correr el validator.
                      </div>
                    )}

                    {workspace.transitionOptions.filter((option) => !option.enabled).map((option) => (
                      <div key={option.nextStatus} className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
                        <p className="font-semibold text-white">{formatLifecycleStatusLabel(option.nextStatus)}</p>
                        <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                          {option.reason}
                        </p>
                      </div>
                    ))}

                    {secondaryTransitions.length > 0 ? (
                      <details className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-white">
                          Ver transiciones secundarias
                        </summary>
                        <div className="mt-4 space-y-2">
                          {secondaryTransitions.map((option) => (
                            <form
                              key={option.nextStatus}
                              action={async () => {
                                "use server";
                                await transitionFiscalPeriodStatusAction({
                                  slug,
                                  fiscalPeriodId: workspace.selectedPeriod!.id,
                                  nextStatus: option.nextStatus,
                                });
                              }}
                            >
                              <SubmitButton pendingLabel="Actualizando..." className="ui-button ui-button--secondary w-full">
                                Pasar a {formatLifecycleStatusLabel(option.nextStatus)}
                              </SubmitButton>
                            </form>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </section>

                <section className="ui-panel">
                  <div className="ui-panel-header">
                    <h2 className="text-[16px] font-semibold text-white">Cruces del periodo</h2>
                    <span className="ui-filter">Integrado</span>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-[color:var(--color-muted)]">
                    <div className="ui-subtle-row">
                      <span>Estado IVA</span>
                      <span>{formatLifecycleStatusLabel(workspace.preview.snapshot.tax.vatStatus)}</span>
                    </div>
                    <div className="ui-subtle-row">
                      <span>Open items visibles</span>
                      <span>{workspace.preview.snapshot.operations.outstandingOpenItemsCount}</span>
                    </div>
                    <LoadingLink
                      href={`/app/o/${organization.slug}/tax`}
                      pendingLabel="Abriendo..."
                      className="ui-button ui-button--secondary w-full"
                    >
                      Ir a Impuestos
                    </LoadingLink>
                  </div>
                </section>
              </div>
            </div>
          );
        })()
      )}
    </PrivateDashboardShell>
  );
}
