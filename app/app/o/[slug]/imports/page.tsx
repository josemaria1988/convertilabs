import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  canCancelSpreadsheetImportRun,
  canRetrySpreadsheetImportRun,
  listOrganizationSpreadsheetImportRuns,
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
};

export const metadata: Metadata = {
  title: "Imports",
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

function renderCanonicalSummary(run: Awaited<ReturnType<typeof listOrganizationSpreadsheetImportRuns>>[number]) {
  const canonical = run.result?.canonical;

  if (!canonical) {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm text-[color:var(--color-muted)]">
        Todavia no hay JSON canonico generado para este import.
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
          <p className="mt-2 text-[color:var(--color-muted)]">{canonical.sourceType}</p>
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
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm text-[color:var(--color-muted)]">
        Cuentas detectadas: {canonical.accounts.length}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm text-[color:var(--color-muted)]">
      {canonical.importType === "mixed"
        ? `Import mixto con ${canonical.sheets.length} sheet(s) interpretadas.`
        : canonical.warnings.join(" ") || "Import no soportado."}
    </div>
  );
}

export default async function OrganizationImportsPage({
  params,
}: OrganizationImportsPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const runs = await listOrganizationSpreadsheetImportRuns(
    getSupabaseServiceRoleClient(),
    organization.id,
    10,
  );
  const latestRun = runs[0] ?? null;

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Imports"
      toolbarLabel="Imports e historicos"
      description="Wizard minimo para planillas historicas, preview canonico, retries y carril batch cuando el volumen crece."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "imports")}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h1 className="text-[20px] font-semibold text-white">Importar planilla</h1>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Soporta `.csv`, `.tsv`, `.xlsx` y `.xls` en variantes compatibles.
                </p>
              </div>
              <span className="status-pill status-pill--info">Wizard MVP</span>
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
                <option value="batch">Batch</option>
              </select>
              <button className="ui-button ui-button--primary">
                Analizar planilla
              </button>
            </form>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Runs recientes</h2>
              <span className="ui-filter">{runs.length} run(s)</span>
            </div>

            <div className="mt-4 space-y-3">
              {runs.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Todavia no hay imports historicos en esta organizacion.
                </div>
              ) : (
                runs.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{run.fileName}</p>
                        <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                          {run.importType} / {run.runMode} / {run.status}
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
                          <button className="ui-button ui-button--primary">
                            Confirmar preview
                          </button>
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
                          <button className="ui-button ui-button--secondary">
                            Reintentar
                          </button>
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
                          <button className="ui-button ui-button--secondary">
                            Cancelar
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Ultimo preview</h2>
              <span className="ui-filter">
                {latestRun?.confirmedAt ? "Confirmado" : "Pendiente"}
              </span>
            </div>

            {latestRun ? (
              <div className="mt-4 space-y-4">
                {renderCanonicalSummary(latestRun)}

                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                  <p className="font-semibold">Sheets detectadas</p>
                  <div className="mt-3 space-y-3">
                    {(latestRun.preview?.sheets ?? []).map((sheet) => (
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
                          Headers: {sheet.headers.join(", ") || "sin headers"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                  <p className="font-semibold">Eventos</p>
                  <div className="mt-3 space-y-2">
                    {latestRun.statusEvents.map((event) => (
                      <div key={`${event.code}-${event.createdAt}`} className="ui-subtle-row">
                        <span className="text-white">{event.code}</span>
                        <span>{formatDateTime(event.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-[color:var(--color-muted)]">
                Todavia no hay previews para mostrar.
              </div>
            )}
          </section>
        </div>
      </div>
    </PrivateDashboardShell>
  );
}
