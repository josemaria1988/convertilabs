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
  type DocumentWorkspaceSortOrder,
} from "@/modules/documents/review";
import { listOrganizationImportOperations } from "@/modules/imports";
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

function normalizeDocumentSortOrder(value: string | undefined): DocumentWorkspaceSortOrder {
  return value === "date_asc" ? "date_asc" : "date_desc";
}

function buildDocumentsPageHref(
  slug: string,
  search: {
    tab?: DocumentsTabKey;
    page?: number | null;
    direction?: DocumentWorkspaceDirectionFilter;
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
  const sortOrder = normalizeDocumentSortOrder(resolvedSearchParams.sort);
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const [documentsPage, importOperations, recentDocumentsResult, missingFxSummary] = await Promise.all([
    activeTab === "documents"
      ? listPaginatedOrganizationWorkspaceDocuments({
        organizationId: organization.id,
        organizationSlug: organization.slug,
        page: currentPage,
        directionFilter,
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
  ]);

  if (recentDocumentsResult.error) {
    throw new Error(recentDocumentsResult.error.message);
  }

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
            <Link
              href="#document-upload-panel"
              className="ui-button ui-button--secondary"
            >
              Cargar o importar
            </Link>
          ) : (
            <LoadingLink
              href={buildDocumentsPageHref(organization.slug, {
                tab: "documents",
                page: currentPage,
                direction: directionFilter,
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

        {activeTab === "documents" ? (
          <>
            <div className="ui-panel">
              <div className="ui-panel-header">
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Filtros de bandeja</h2>
                  <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                    Acota la vista por direccion y reordena por fecha del comprobante.
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
                    Sube comprobantes originales cuando necesites conservar el archivo firmado
                    y usa planillas mensuales para crear lotes de compras o ventas desde ERPs legacy
                    sin mezclar ese flujo con operaciones internacionales.
                  </p>
                </div>
                <span className="status-pill status-pill--info">Originales + planilla mensual</span>
              </div>
              <DocumentUploadDropzone slug={organization.slug} />
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
