import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import {
  buttonBaseClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  formatLifecycleStatusLabel,
  formatSourceTypeLabel,
  formatSpreadsheetImportTypeLabel,
  formatSpreadsheetRunModeLabel,
} from "@/modules/presentation/labels";
import {
  canCancelSpreadsheetImportRun,
  canRetrySpreadsheetImportRun,
  listOrganizationSpreadsheetImportRuns,
  loadSpreadsheetImportRun,
} from "@/modules/spreadsheets";
import {
  cancelSpreadsheetImportAction,
  confirmSpreadsheetImportAction,
  retrySpreadsheetImportAction,
  uploadSpreadsheetImportAction,
} from "./actions";

type OrganizationImportsPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    focus?: string;
    run?: string;
  }>;
};

type SpreadsheetSupportFocus =
  | "chart_of_accounts_import"
  | "historical_vat_import"
  | "journal_template_import"
  | null;

export const metadata: Metadata = {
  title: "Planillas de soporte",
};

function formatUsd(value: number | null) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeFocus(value: string | undefined): SpreadsheetSupportFocus {
  if (
    value === "chart_of_accounts_import"
    || value === "historical_vat_import"
    || value === "journal_template_import"
  ) {
    return value;
  }

  return null;
}

function getFocusSummary(focus: SpreadsheetSupportFocus) {
  switch (focus) {
    case "chart_of_accounts_import":
      return {
        title: "Plan de cuentas",
        description:
          "Trae cuentas, jerarquias y codigos externos desde una planilla para revisarlas antes de aplicarlas.",
      };
    case "historical_vat_import":
      return {
        title: "Historicos IVA",
        description:
          "Carga periodos anteriores de IVA cuando necesites reconstruir contexto fiscal o conciliar datos previos.",
      };
    case "journal_template_import":
      return {
        title: "Plantillas contables",
        description:
          "Importa estructuras auxiliares de plantillas cuando tengas una planilla preparada para ese fin.",
      };
    default:
      return {
        title: "Planillas de soporte",
        description:
          "Este espacio sirve para soporte del motor contable y fiscal. Las operaciones economicas internacionales ahora viven en Documentos.",
      };
  }
}

function renderCanonicalSummary(
  run: Awaited<ReturnType<typeof listOrganizationSpreadsheetImportRuns>>[number],
) {
  const canonical = run.result?.canonical;

  if (!canonical) {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm text-[color:var(--color-muted)]">
        Todavia no hay JSON canonico generado para esta corrida.
      </div>
    );
  }

  if (canonical.importType === "historical_vat_liquidation") {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
          <p className="font-semibold">Tipo</p>
          <p className="mt-2 text-[color:var(--color-muted)]">Historico IVA</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
          <p className="font-semibold">Periodos detectados</p>
          <p className="mt-2 text-[color:var(--color-muted)]">{canonical.periods.length}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
          <p className="font-semibold">Origen</p>
          <p className="mt-2 text-[color:var(--color-muted)]">
            {formatSourceTypeLabel(canonical.sourceType)}
          </p>
        </div>
      </div>
    );
  }

  if (canonical.importType === "journal_template_import") {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm text-[color:var(--color-muted)]">
        Plantillas detectadas: {canonical.templates.length}
      </div>
    );
  }

  if (canonical.importType === "chart_of_accounts_import") {
    const previewAccounts = canonical.accounts.slice(0, 12);

    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm text-[color:var(--color-muted)]">
          Cuentas detectadas: {canonical.accounts.length}
        </div>

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
          <p className="font-semibold">Vista previa del plan</p>
          <div className="mt-3 space-y-2">
            {previewAccounts.map((account, index) => (
              <div
                key={`${account.code}-${index}`}
                className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{account.code || "Sin codigo"}</span>
                  <span className="text-[13px] text-[color:var(--color-muted)]">
                    {account.isPostable ? "Movimiento" : "No postable"}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                  {account.name || "Cuenta importada"}
                </p>
              </div>
            ))}
          </div>

          {canonical.accounts.length > previewAccounts.length ? (
            <p className="mt-3 text-[13px] text-[color:var(--color-muted)]">
              + {canonical.accounts.length - previewAccounts.length} cuenta(s) mas en esta vista previa.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm text-[color:var(--color-muted)]">
      {canonical.importType === "mixed"
        ? `Importacion mixta con ${canonical.sheets.length} hoja(s) interpretadas.`
        : canonical.warnings.join(" ") || "Importacion no soportada."}
    </div>
  );
}

function getAvailableSections(
  run: Awaited<ReturnType<typeof listOrganizationSpreadsheetImportRuns>>[number],
) {
  const explicitSections = new Set<string>();

  if (run.importType === "historical_vat_liquidation") {
    explicitSections.add("historical_vat_liquidation");
  }

  if (run.importType === "chart_of_accounts_import") {
    explicitSections.add("chart_of_accounts_import");
  }

  if (run.importType === "journal_template_import") {
    explicitSections.add("journal_template_import");
  }

  for (const intent of run.result?.sheetIntents ?? []) {
    if (intent.intent !== "irrelevant") {
      explicitSections.add(intent.intent);
    }
  }

  return Array.from(explicitSections) as Array<
    "historical_vat_liquidation"
    | "chart_of_accounts_import"
    | "journal_template_import"
  >;
}

export default async function OrganizationImportsPage({
  params,
  searchParams,
}: OrganizationImportsPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const focus = normalizeFocus(resolvedSearchParams.focus);
  const selectedRunId = typeof resolvedSearchParams.run === "string"
    ? resolvedSearchParams.run
    : null;
  const focusSummary = getFocusSummary(focus);
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const [runs, requestedRun] = await Promise.all([
    listOrganizationSpreadsheetImportRuns(
      supabase,
      organization.id,
      10,
    ),
    selectedRunId
      ? loadSpreadsheetImportRun(supabase, organization.id, selectedRunId)
      : Promise.resolve(null),
  ]);

  const activeRun = requestedRun ?? runs[0] ?? null;

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Planillas de soporte"
      toolbarLabel="Planillas de soporte"
      description="Carga auxiliar de planillas para plan de cuentas, plantillas contables e historicos IVA, separada de la operatoria economica diaria."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "advanced")}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h1 className="text-[20px] font-semibold text-white">Planillas de soporte</h1>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  {focusSummary.description}
                </p>
              </div>
              <span className="status-pill status-pill--info">Soporte del sistema</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{focusSummary.title}</p>
                <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                  Esta vista no registra operaciones economicas. Si necesitas trabajar con DUA, proveedor exterior o tributos de una importacion, usa la pestana correspondiente dentro de Documentos.
                </p>
              </div>
              <LoadingLink
                href={`/app/o/${organization.slug}/documents?tab=international`}
                pendingLabel="Abriendo documentos..."
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
              >
                Ir a operaciones internacionales
              </LoadingLink>
            </div>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Importar planilla</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Soporta `.csv`, `.tsv`, `.xlsx` y `.xls` en variantes compatibles.
                </p>
              </div>
              <span className="ui-filter">
                {focusSummary.title}
              </span>
            </div>

            <form
              action={async (formData: FormData) => {
                "use server";
                await uploadSpreadsheetImportAction({
                  slug,
                  formData,
                });
              }}
              className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto]"
            >
              <input
                type="file"
                name="spreadsheet"
                accept=".csv,.tsv,.xlsx,.xls"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <select
                name="preferredMode"
                defaultValue="auto"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              >
                <option value="auto">Modo auto</option>
                <option value="interactive">Interactivo</option>
              </select>
              <SubmitButton pendingLabel="Analizando..." className="ui-button ui-button--primary">
                Analizar planilla
              </SubmitButton>
            </form>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Corridas recientes</h2>
              <span className="ui-filter">{runs.length} corrida(s)</span>
            </div>

            <div className="mt-4 space-y-3">
              {runs.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Todavia no hay corridas de planillas de soporte en esta organizacion.
                </div>
              ) : (
                runs.map((run) => {
                  const isActiveRun = activeRun?.id === run.id;

                  return (
                    <div
                      key={run.id}
                      className={`rounded-2xl border p-4 ${
                        isActiveRun
                          ? "border-[rgba(124,157,255,0.34)] bg-[rgba(124,157,255,0.08)]"
                          : "border-[color:var(--color-border)] bg-white/70"
                      }`.trim()}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{run.fileName}</p>
                          <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                            {formatSpreadsheetImportTypeLabel(run.importType)} / {formatSpreadsheetRunModeLabel(run.runMode)} / {formatLifecycleStatusLabel(run.status)}
                          </p>
                        </div>
                        <div className="text-right text-[13px] text-[color:var(--color-muted)]">
                          <p>{formatDateTime(run.createdAt)}</p>
                          <p>Costo estimado {formatUsd(run.estimatedCostUsd)}</p>
                        </div>
                      </div>

                      {run.warnings.length > 0 ? (
                        <p className="mt-3 text-[13px] text-amber-900">
                          {run.warnings.join(" ")}
                        </p>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <LoadingLink
                          href={`/app/o/${organization.slug}/imports?run=${run.id}${focus ? `&focus=${focus}` : ""}`}
                          pendingLabel="Abriendo corrida..."
                          className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
                        >
                          Ver vista previa
                        </LoadingLink>

                        {run.status === "completed" && !run.confirmedAt ? (
                          <form
                            action={async () => {
                              "use server";
                              await confirmSpreadsheetImportAction({
                                slug,
                                runId: run.id,
                              });
                            }}
                          >
                            <SubmitButton pendingLabel="Confirmando..." className="ui-button ui-button--primary">
                              Confirmar vista previa
                            </SubmitButton>
                          </form>
                        ) : null}

                        {run.status === "completed"
                        && !run.confirmedAt
                        && run.importType === "mixed"
                        && getAvailableSections(run).includes("chart_of_accounts_import") ? (
                          <form
                            action={async () => {
                              "use server";
                              await confirmSpreadsheetImportAction({
                                slug,
                                runId: run.id,
                                selectedSections: ["chart_of_accounts_import"],
                              });
                            }}
                          >
                            <SubmitButton pendingLabel="Confirmando..." className="ui-button ui-button--secondary">
                              Confirmar plan de cuentas
                            </SubmitButton>
                          </form>
                        ) : null}

                        {run.status === "completed"
                        && !run.confirmedAt
                        && run.importType === "mixed"
                        && getAvailableSections(run).includes("journal_template_import") ? (
                          <form
                            action={async () => {
                              "use server";
                              await confirmSpreadsheetImportAction({
                                slug,
                                runId: run.id,
                                selectedSections: ["journal_template_import"],
                              });
                            }}
                          >
                            <SubmitButton pendingLabel="Confirmando..." className="ui-button ui-button--secondary">
                              Confirmar plantillas
                            </SubmitButton>
                          </form>
                        ) : null}

                        {canRetrySpreadsheetImportRun(run) ? (
                          <form
                            action={async () => {
                              "use server";
                              await retrySpreadsheetImportAction({
                                slug,
                                runId: run.id,
                              });
                            }}
                          >
                            <SubmitButton pendingLabel="Reintentando..." className="ui-button ui-button--secondary">
                              Reintentar
                            </SubmitButton>
                          </form>
                        ) : null}

                        {canCancelSpreadsheetImportRun(run) ? (
                          <form
                            action={async () => {
                              "use server";
                              await cancelSpreadsheetImportAction({
                                slug,
                                runId: run.id,
                              });
                            }}
                          >
                            <SubmitButton pendingLabel="Cancelando..." className="ui-button ui-button--secondary">
                              Cancelar
                            </SubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">
                {selectedRunId ? "Vista previa seleccionada" : "Ultima vista previa"}
              </h2>
              <span className="ui-filter">
                {activeRun?.confirmedAt ? "Confirmado" : "Pendiente"}
              </span>
            </div>

            {activeRun ? (
              <div className="mt-4 space-y-4">
                {renderCanonicalSummary(activeRun)}

                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                  <p className="font-semibold">Hojas detectadas</p>
                  <div className="mt-3 space-y-3">
                    {(activeRun.preview?.sheets ?? []).map((sheet) => (
                      <div
                        key={sheet.sheetName}
                        className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{sheet.sheetName}</span>
                          <span className="text-[13px] text-[color:var(--color-muted)]">
                            {sheet.rowCount} filas
                          </span>
                        </div>
                        <p className="mt-2 text-[13px] text-[color:var(--color-muted)]">
                          Encabezados: {sheet.headers.join(", ") || "sin encabezados"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                  <p className="font-semibold">Eventos</p>
                  <div className="mt-3 space-y-2">
                    {activeRun.statusEvents.map((event) => (
                      <div
                        key={`${event.code}-${event.createdAt}`}
                        className="ui-subtle-row"
                      >
                        <span className="text-white">{event.code}</span>
                        <span>{formatDateTime(event.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {Array.isArray(activeRun.metadata?.materialized_sections) ? (
                  <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                    <p className="font-semibold">Materializacion aplicada</p>
                    <p className="mt-2 text-[color:var(--color-muted)]">
                      {(activeRun.metadata.materialized_sections as string[])
                        .map((section) => formatSpreadsheetImportTypeLabel(section))
                        .join(", ")}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 text-sm text-[color:var(--color-muted)]">
                Todavia no hay vistas previas para mostrar.
              </div>
            )}
          </section>
        </div>
      </div>
    </PrivateDashboardShell>
  );
}
