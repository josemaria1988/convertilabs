import type { Metadata } from "next";
import Link from "next/link";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { DocumentsWorkspaceTable } from "@/components/documents/documents-workspace-table";
import { DocumentUploadDropzone } from "@/components/documents/upload-dropzone";
import { InternationalOperationsWorkspace } from "@/components/documents/international-operations-workspace";
import { LoadingLink } from "@/components/ui/loading-link";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  listPaginatedOrganizationWorkspaceDocuments,
  type DocumentWorkspaceDirectionFilter,
  type DocumentWorkspaceStateFilter,
  type DocumentWorkspaceSortOrder,
} from "@/modules/documents/review";
import { listOrganizationImportOperations } from "@/modules/imports";
import {
  evaluateOrganizationLaunchScope,
  formatLaunchSupportLevelLabel,
} from "@/modules/launch/scope";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { loadMissingFxDocumentsSummary } from "@/modules/documents/spreadsheet-fx-resolution";

type OrganizationDocumentsPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    tab?: string;
    page?: string;
    direction?: string;
    state?: string;
    sort?: string;
  }>;
};

type DocumentsTabKey = "documents" | "international";

const documentDirectionOptions: Array<{
  key: DocumentWorkspaceDirectionFilter;
  label: string;
}> = [
  {
    key: "all",
    label: "Todos",
  },
  {
    key: "purchase",
    label: "Compras",
  },
  {
    key: "sale",
    label: "Ventas",
  },
];

const documentSortOptions: Array<{
  key: DocumentWorkspaceSortOrder;
  label: string;
}> = [
  {
    key: "date_desc",
    label: "Fecha mas reciente",
  },
  {
    key: "date_asc",
    label: "Fecha mas antigua",
  },
  {
    key: "period_desc",
    label: "Periodo mas reciente",
  },
  {
    key: "period_asc",
    label: "Periodo mas antiguo",
  },
  {
    key: "confidence_desc",
    label: "Confianza mas alta",
  },
  {
    key: "confidence_asc",
    label: "Confianza mas baja",
  },
];

const documentStateOptions: Array<{
  key: DocumentWorkspaceStateFilter;
  label: string;
}> = [
  { key: "all", label: "Todos" },
  { key: "processing", label: "Procesando" },
  { key: "review", label: "Revision" },
  { key: "blocked_duplicate", label: "Duplicado" },
  { key: "blocked_missing_fx", label: "FX faltante" },
  { key: "blocked_scope", label: "Fuera de alcance" },
  { key: "imports_assisted", label: "Importacion asistida" },
  { key: "ready_provisional", label: "Listos provisional" },
  { key: "ready_final", label: "Listos final" },
  { key: "posted_final", label: "Finalizados" },
];

const documentTabs: Array<{
  key: DocumentsTabKey;
  label: string;
  description: string;
}> = [
  {
    key: "documents",
    label: "Documentos",
    description: "Bandeja, carga y revision contable",
  },
  {
    key: "international",
    label: "Operaciones internacionales",
    description: "DUA, factura exterior y tributos",
  },
];

export const metadata: Metadata = {
  title: "Documentos",
};

function normalizeDocumentsPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function normalizeDocumentDirectionFilter(value: string | undefined): DocumentWorkspaceDirectionFilter {
  if (value === "purchase" || value === "sale") {
    return value;
  }

  return "all";
}

function normalizeDocumentStateFilter(value: string | undefined): DocumentWorkspaceStateFilter {
  switch (value) {
    case "processing":
    case "review":
    case "blocked_duplicate":
    case "blocked_missing_fx":
    case "blocked_scope":
    case "imports_assisted":
    case "ready_provisional":
    case "ready_final":
    case "posted_final":
      return value;
    default:
      return "all";
  }
}

function normalizeDocumentSortOrder(value: string | undefined): DocumentWorkspaceSortOrder {
  switch (value) {
    case "date_asc":
    case "period_desc":
    case "period_asc":
    case "confidence_desc":
    case "confidence_asc":
      return value;
    default:
      return "date_desc";
  }
}

function buildDocumentsPageHref(
  slug: string,
  search: {
    tab?: DocumentsTabKey;
    page?: number | null;
    direction?: DocumentWorkspaceDirectionFilter;
    state?: DocumentWorkspaceStateFilter;
    sort?: DocumentWorkspaceSortOrder;
  } = {},
) {
  const params = new URLSearchParams();

  if (search.tab === "international") {
    params.set("tab", "international");
  }

  if ((search.page ?? 1) > 1) {
    params.set("page", String(search.page));
  }

  if (search.direction && search.direction !== "all") {
    params.set("direction", search.direction);
  }

  if (search.state && search.state !== "all") {
    params.set("state", search.state);
  }

  if (search.sort && search.sort !== "date_desc") {
    params.set("sort", search.sort);
  }

  const query = params.toString();
  return `/app/o/${slug}/documents${query ? `?${query}` : ""}`;
}

function formatDocumentPageSummary(input: {
  page: number;
  pageSize: number;
  visibleItems: number;
  totalItems: number;
}) {
  if (input.totalItems === 0 || input.visibleItems === 0) {
    return "Sin documentos para este filtro";
  }

  const from = (input.page - 1) * input.pageSize + 1;
  const to = from + input.visibleItems - 1;
  return `Mostrando ${from}-${to} de ${input.totalItems}`;
}

export default async function OrganizationDocumentsPage({
  params,
  searchParams,
}: OrganizationDocumentsPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const activeTab: DocumentsTabKey =
    resolvedSearchParams.tab === "international" ? "international" : "documents";
  const currentPage = normalizeDocumentsPage(resolvedSearchParams.page);
  const directionFilter = normalizeDocumentDirectionFilter(resolvedSearchParams.direction);
  const stateFilter = normalizeDocumentStateFilter(resolvedSearchParams.state);
  const sortOrder = normalizeDocumentSortOrder(resolvedSearchParams.sort);
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const [documentsPage, importOperations, recentDocumentsResult, missingFxSummary, organizationScopeRow] = await Promise.all([
    activeTab === "documents"
      ? listPaginatedOrganizationWorkspaceDocuments({
        organizationId: organization.id,
        organizationSlug: organization.slug,
        page: currentPage,
        directionFilter,
        stateFilter,
        sortOrder,
      })
      : Promise.resolve(null),
    activeTab === "international"
      ? listOrganizationImportOperations(
        supabase,
        organization.id,
        8,
      )
      : Promise.resolve([]),
    activeTab === "international"
      ? supabase
        .from("documents")
        .select("id, original_filename, document_type, direction, created_at, current_draft_id")
        .eq("organization_id", organization.id)
        .not("current_draft_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(8)
      : Promise.resolve({ data: [], error: null }),
    activeTab === "documents"
      ? loadMissingFxDocumentsSummary({ organizationId: organization.id, supabase })
      : Promise.resolve({ count: 0, dates: [] }),
    supabase
      .from("organizations")
      .select("country_code, legal_entity_type, tax_regime_code, vat_regime")
      .eq("id", organization.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (recentDocumentsResult.error) {
    throw new Error(recentDocumentsResult.error.message);
  }

  if (organizationScopeRow.error) {
    throw new Error(organizationScopeRow.error.message);
  }

  const organizationScope = evaluateOrganizationLaunchScope({
    countryCode: organizationScopeRow.data?.country_code ?? "UY",
    legalEntityType: organizationScopeRow.data?.legal_entity_type ?? null,
    taxRegimeCode: organizationScopeRow.data?.tax_regime_code ?? null,
    vatRegime: organizationScopeRow.data?.vat_regime ?? null,
  });

  const recentDocuments = (((recentDocumentsResult.data as Array<{
    id: string;
    original_filename: string;
    document_type: string | null;
    direction: string;
    created_at: string;
    current_draft_id: string | null;
  }> | null) ?? []));
  const documentPageSummary = documentsPage
    ? formatDocumentPageSummary({
      page: documentsPage.page,
      pageSize: documentsPage.pageSize,
      visibleItems: documentsPage.items.length,
      totalItems: documentsPage.totalItems,
    })
    : null;
  const canUsePendingAssignmentQueue = ["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(
    organization.role,
  );

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Documentos"
      toolbarLabel="Documentos"
      description="Bandeja documental, revision contable y carril especial para operaciones internacionales dentro del mismo motor de decisiones."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "documents")}
    >
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Documentos
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              La carga documental, la clasificacion y los eventos internacionales viven separados de las planillas de soporte para evitar cruces conceptuales.
            </p>
          </div>

          {activeTab === "documents" ? (
            <div className="flex flex-wrap items-center gap-2">
              {canUsePendingAssignmentQueue ? (
                <Link
                  href={`/app/o/${organization.slug}/documents/pending-assignment`}
                  className="ui-button ui-button--secondary"
                >
                  Pending assignment
                </Link>
              ) : null}
              <Link
                href={`/app/o/${organization.slug}/audit`}
                className="ui-button ui-button--secondary"
              >
                Ir a Auditoria
              </Link>
              <Link
                href="#document-upload-panel"
                className="ui-button ui-button--secondary"
              >
                Cargar originales
              </Link>
            </div>
          ) : (
            <LoadingLink
              href={buildDocumentsPageHref(organization.slug, {
                tab: "documents",
                page: currentPage,
                direction: directionFilter,
                state: stateFilter,
                sort: sortOrder,
              })}
              pendingLabel="Volviendo..."
              className="ui-button ui-button--secondary"
            >
              Volver a la bandeja
            </LoadingLink>
          )}
        </div>

        <div className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Carriles de trabajo</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Usa la bandeja para comprobantes locales y la pestana internacional cuando una misma operacion combine DUA, proveedor exterior y tributos asociados.
              </p>
            </div>
            <span className="status-pill status-pill--info">Separado por contexto</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {documentTabs.map((tab) => {
              const isCurrent = tab.key === activeTab;

              return (
                <LoadingLink
                  key={tab.key}
                  href={buildDocumentsPageHref(organization.slug, {
                    tab: tab.key,
                    page: tab.key === "documents" ? currentPage : null,
                    direction: directionFilter,
                    sort: sortOrder,
                  })}
                  pendingLabel="Abriendo..."
                  className={isCurrent ? "ui-button ui-button--primary" : "ui-button ui-button--secondary"}
                >
                  <span className="text-left">
                    <span className="block">{tab.label}</span>
                    <span className="mt-1 block text-[11px] font-medium text-white/75">
                      {tab.description}
                    </span>
                  </span>
                </LoadingLink>
              );
            })}
          </div>
        </div>

        <div className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Alcance operativo del MVP</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                El producto muestra de forma explicita cuando una organizacion queda en modo automatico y cuando solo puede operar en modo asistido.
              </p>
            </div>
            <span className={`status-pill ${
              organizationScope.supportLevel === "automatic"
                ? "status-pill--success"
                : organizationScope.supportLevel === "assisted_only"
                  ? "status-pill--warning"
                  : "status-pill--danger"
            }`}
            >
              {formatLaunchSupportLevelLabel(organizationScope.supportLevel)}
            </span>
          </div>

          {organizationScope.reasons.length > 0 ? (
            <div className="mt-4 space-y-2 text-sm text-[color:var(--color-muted)]">
              {organizationScope.reasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--color-muted)]">
              La organizacion entra dentro del perimetro automatico conservador del MVP para Uruguay.
            </p>
          )}
        </div>

        {activeTab === "documents" ? (
          <>
            <div className="ui-panel">
              <div className="ui-panel-header">
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Filtros de bandeja</h2>
                  <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                    Acota la vista por direccion y reordena por fecha, periodo o confianza.
                  </p>
                </div>
                <span className="ui-filter">
                  {documentPageSummary ?? "Sin datos"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ui-filter">Direccion</span>
                  {documentDirectionOptions.map((option) => {
                    const isActive = directionFilter === option.key;

                    return (
                      <LoadingLink
                        key={option.key}
                        href={buildDocumentsPageHref(organization.slug, {
                          tab: "documents",
                          direction: option.key,
                          state: stateFilter,
                          sort: sortOrder,
                        })}
                        pendingLabel="Filtrando..."
                        className={isActive ? "ui-button ui-button--primary" : "ui-button ui-button--secondary"}
                      >
                        {option.label}
                      </LoadingLink>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="ui-filter">Estado operativo</span>
                  {documentStateOptions.map((option) => {
                    const isActive = stateFilter === option.key;

                    return (
                      <LoadingLink
                        key={option.key}
                        href={buildDocumentsPageHref(organization.slug, {
                          tab: "documents",
                          direction: directionFilter,
                          state: option.key,
                          sort: sortOrder,
                        })}
                        pendingLabel="Filtrando..."
                        className={isActive ? "ui-button ui-button--primary" : "ui-button ui-button--secondary"}
                      >
                        {option.label}
                      </LoadingLink>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="ui-filter">Orden</span>
                  {documentSortOptions.map((option) => {
                    const isActive = sortOrder === option.key;

                    return (
                      <LoadingLink
                        key={option.key}
                        href={buildDocumentsPageHref(organization.slug, {
                          tab: "documents",
                          direction: directionFilter,
                          state: stateFilter,
                          sort: option.key,
                        })}
                        pendingLabel="Ordenando..."
                        className={isActive ? "ui-button ui-button--primary" : "ui-button ui-button--secondary"}
                      >
                        {option.label}
                      </LoadingLink>
                    );
                  })}
                </div>
              </div>
            </div>

            <DocumentsWorkspaceTable
              slug={organization.slug}
              documents={documentsPage?.items ?? []}
              missingFxSummary={missingFxSummary}
            />

            {documentsPage ? (
              <div className="ui-panel">
                <div className="ui-panel-header">
                  <div>
                    <h2 className="text-[16px] font-semibold text-white">Paginacion</h2>
                    <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                      Pagina {documentsPage.page} de {documentsPage.totalPages}.
                    </p>
                  </div>
                  <span className="ui-filter">{documentPageSummary}</span>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  {documentsPage.hasPreviousPage ? (
                    <LoadingLink
                      href={buildDocumentsPageHref(organization.slug, {
                        tab: "documents",
                        page: documentsPage.page - 1,
                        direction: directionFilter,
                        state: stateFilter,
                        sort: sortOrder,
                      })}
                      pendingLabel="Cargando..."
                      className="ui-button ui-button--secondary"
                    >
                      Anterior
                    </LoadingLink>
                  ) : (
                    <span className="ui-button ui-button--secondary pointer-events-none opacity-50">
                      Anterior
                    </span>
                  )}

                  <span className="ui-button ui-button--primary pointer-events-none">
                    {documentsPage.page}
                  </span>

                  {documentsPage.hasNextPage ? (
                    <LoadingLink
                      href={buildDocumentsPageHref(organization.slug, {
                        tab: "documents",
                        page: documentsPage.page + 1,
                        direction: directionFilter,
                        state: stateFilter,
                        sort: sortOrder,
                      })}
                      pendingLabel="Cargando..."
                      className="ui-button ui-button--secondary"
                    >
                      Siguiente
                    </LoadingLink>
                  ) : (
                    <span className="ui-button ui-button--secondary pointer-events-none opacity-50">
                      Siguiente
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            <div className="ui-panel" id="document-upload-panel">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold text-white">
                    Ingreso documental
                  </h2>
                  <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                    Sube comprobantes originales cuando necesites conservar el archivo firmado.
                    La importacion masiva por planilla ahora vive en Auditoria para que puedas
                    revisar un preview y decidir que entra a la base antes de materializarlo.
                  </p>
                </div>
                <Link
                  href={`/app/o/${organization.slug}/audit`}
                  className="ui-button ui-button--secondary"
                >
                  Abrir Auditoria
                </Link>
              </div>
              <DocumentUploadDropzone slug={organization.slug} showSpreadsheetImport={false} />
            </div>
          </>
        ) : (
          <InternationalOperationsWorkspace
            slug={organization.slug}
            importOperations={importOperations}
            recentDocuments={recentDocuments}
          />
        )}
      </section>
    </PrivateDashboardShell>
  );
}
