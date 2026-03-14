import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { listOrganizationImportOperations } from "@/modules/imports";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { getDocumentRoleLabel } from "@/modules/documents/status";
import {
  formatImportOperationStatusLabel,
  formatLifecycleStatusLabel,
  formatSourceTypeLabel,
  formatSpreadsheetImportTypeLabel,
  formatSpreadsheetRunModeLabel,
} from "@/modules/presentation/labels";
import {
  canCancelSpreadsheetImportRun,
  canRetrySpreadsheetImportRun,
  listOrganizationSpreadsheetImportRuns,
} from "@/modules/spreadsheets";
import {
  attachDocumentToImportOperationAction,
  cancelSpreadsheetImportAction,
  confirmSpreadsheetImportAction,
  createImportOperationAction,
  retrySpreadsheetImportAction,
  updateImportOperationStatusAction,
  uploadSpreadsheetImportAction,
} from "./actions";

type OrganizationImportsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Importaciones",
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
          <p className="mt-2 text-[color:var(--color-muted)]">{formatSourceTypeLabel(canonical.sourceType)}</p>
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
        ? `Importacion mixta con ${canonical.sheets.length} hoja(s) interpretadas.`
        : canonical.warnings.join(" ") || "Importacion no soportada."}
    </div>
  );
}

function getAvailableSections(run: Awaited<ReturnType<typeof listOrganizationSpreadsheetImportRuns>>[number]) {
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
}: OrganizationImportsPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const [runs, importOperations, recentDocumentsResult] = await Promise.all([
    listOrganizationSpreadsheetImportRuns(
      supabase,
      organization.id,
      10,
    ),
    listOrganizationImportOperations(
      supabase,
      organization.id,
      8,
    ),
    supabase
      .from("documents")
      .select("id, original_filename, document_type, direction, created_at, current_draft_id")
      .eq("organization_id", organization.id)
      .not("current_draft_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (recentDocumentsResult.error) {
    throw new Error(recentDocumentsResult.error.message);
  }

  const latestRun = runs[0] ?? null;
  const recentDocuments = (((recentDocumentsResult.data as Array<{
    id: string;
    original_filename: string;
    document_type: string | null;
    direction: string;
    created_at: string;
    current_draft_id: string | null;
  }> | null) ?? []));

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Importaciones"
      toolbarLabel="Importaciones e historicos"
      description="Asistente minimo para planillas historicas, vista previa canonica, reintentos y carril por lote cuando el volumen crece."
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
              <span className="status-pill status-pill--info">Asistente MVP</span>
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
                <option value="batch">Lote</option>
              </select>
              <button className="ui-button ui-button--primary">
                Analizar planilla
              </button>
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
                  Todavia no hay importaciones historicas en esta organizacion.
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
                            Confirmar vista previa
                          </button>
                        </form>
                      ) : null}

                      {run.status === "completed" && !run.confirmedAt && run.importType === "mixed" && getAvailableSections(run).includes("chart_of_accounts_import") ? (
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
                          <button className="ui-button ui-button--secondary">
                            Confirmar plan de cuentas
                          </button>
                        </form>
                      ) : null}

                      {run.status === "completed" && !run.confirmedAt && run.importType === "mixed" && getAvailableSections(run).includes("journal_template_import") ? (
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
                          <button className="ui-button ui-button--secondary">
                            Confirmar plantillas
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

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Operacion de importacion</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Alta manual del carril compuesto para DUA y relacionados.
                </p>
              </div>
              <span className="status-pill status-pill--info">Fase 1</span>
            </div>

            <form
              action={async (formData: FormData) => {
                "use server";
                await createImportOperationAction({
                  slug,
                  formData,
                });
              }}
              className="mt-4 grid gap-3 md:grid-cols-2"
            >
              <input
                name="referenceCode"
                placeholder="Referencia interna"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                name="duaNumber"
                placeholder="Numero DUA"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                name="duaYear"
                placeholder="Ano DUA"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                name="customsBrokerName"
                placeholder="Despachante"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                name="supplierName"
                placeholder="Proveedor exterior"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                name="supplierTaxId"
                placeholder="Identificador fiscal proveedor"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                name="currencyCode"
                placeholder="Moneda"
                defaultValue="USD"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                type="date"
                name="operationDate"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                type="date"
                name="paymentDate"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <button className="ui-button ui-button--primary">
                Crear operacion
              </button>
            </form>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Adjuntar documentos a importacion</h2>
              <span className="ui-filter">{recentDocuments.length} documentos</span>
            </div>

            <div className="mt-4 space-y-3">
              {recentDocuments.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Todavia no hay documentos recientes listos para vincular.
                </div>
              ) : importOperations.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Crea primero una operacion de importacion para poder vincular documentos.
                </div>
              ) : (
                recentDocuments.map((document) => (
                  <form
                    key={document.id}
                    action={async (formData: FormData) => {
                      "use server";
                      await attachDocumentToImportOperationAction({
                        slug,
                        formData,
                      });
                    }}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                  >
                    <input type="hidden" name="documentId" value={document.id} />
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{document.original_filename}</p>
                        <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                          {document.document_type ?? "Documento sin tipo"} / {getDocumentRoleLabel(document.direction)}
                        </p>
                      </div>
                      <span className="text-[13px] text-[color:var(--color-muted)]">
                        {formatDateTime(document.created_at)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                      <select
                        name="importOperationId"
                        className="rounded-[10px] border border-[color:var(--color-border)] bg-white/80 px-3 py-3 text-[14px]"
                      >
                        {importOperations.map((operation) => (
                          <option key={operation.id} value={operation.id}>
                            {operation.referenceCode ?? operation.duaNumber ?? operation.id}
                          </option>
                        ))}
                      </select>
                      <button className="ui-button ui-button--secondary">
                        Vincular
                      </button>
                    </div>
                  </form>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Ultima vista previa</h2>
              <span className="ui-filter">
                {latestRun?.confirmedAt ? "Confirmado" : "Pendiente"}
              </span>
            </div>

            {latestRun ? (
              <div className="mt-4 space-y-4">
                {renderCanonicalSummary(latestRun)}

                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                  <p className="font-semibold">Hojas detectadas</p>
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
                          Encabezados: {sheet.headers.join(", ") || "sin encabezados"}
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

                {Array.isArray(latestRun.metadata?.materialized_sections) ? (
                  <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                    <p className="font-semibold">Materializacion aplicada</p>
                    <p className="mt-2 text-[color:var(--color-muted)]">
                      {(latestRun.metadata.materialized_sections as string[]).map((section) => formatSpreadsheetImportTypeLabel(section)).join(", ")}
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

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Operaciones de importacion</h2>
              <span className="ui-filter">{importOperations.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {importOperations.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Todavia no hay operaciones de importacion cargadas.
                </div>
              ) : (
                importOperations.map((operation) => (
                  <div
                    key={operation.id}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          {operation.referenceCode ?? operation.duaNumber ?? operation.id}
                        </p>
                        <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                          {formatImportOperationStatusLabel(operation.status)} / {operation.currencyCode ?? "sin moneda"}
                        </p>
                      </div>
                      <div className="text-right text-[13px] text-[color:var(--color-muted)]">
                        <p>{operation.duaNumber ? `DUA ${operation.duaNumber}` : "Sin DUA"}</p>
                        <p>{operation.supplierName ?? "Proveedor pendiente"}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 p-3 text-sm">
                        <p className="font-medium">Documentos vinculados</p>
                        <p className="mt-2 text-[color:var(--color-muted)]">
                          {operation.linkedDocuments.length}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 p-3 text-sm">
                        <p className="font-medium">Tributos detectados</p>
                        <p className="mt-2 text-[color:var(--color-muted)]">
                          {operation.taxLines.length}
                        </p>
                      </div>
                    </div>
                    {operation.warnings.length > 0 ? (
                      <p className="mt-3 text-[13px] text-amber-900">
                        {operation.warnings.join(" ")}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {operation.status !== "approved" ? (
                        <form
                          action={async () => {
                            "use server";
                            await updateImportOperationStatusAction({
                              slug,
                              importOperationId: operation.id,
                              status: "approved",
                            });
                          }}
                        >
                          <button className="ui-button ui-button--primary">
                            Aprobar
                          </button>
                        </form>
                      ) : null}
                      {operation.status !== "blocked_manual_review" ? (
                        <form
                          action={async () => {
                            "use server";
                            await updateImportOperationStatusAction({
                              slug,
                              importOperationId: operation.id,
                              status: "blocked_manual_review",
                            });
                          }}
                        >
                          <button className="ui-button ui-button--secondary">
                            Bloquear
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
      </div>
    </PrivateDashboardShell>
  );
}
