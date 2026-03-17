import type { Metadata } from "next";
import Link from "next/link";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { DocumentsWorkspaceTable } from "@/components/documents/documents-workspace-table";
import { DocumentUploadDropzone } from "@/components/documents/upload-dropzone";
import { InternationalOperationsWorkspace } from "@/components/documents/international-operations-workspace";
import { LoadingLink } from "@/components/ui/loading-link";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { listOrganizationWorkspaceDocuments } from "@/modules/documents/review";
import { listOrganizationImportOperations } from "@/modules/imports";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationDocumentsPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    tab?: string;
  }>;
};

type DocumentsTabKey = "documents" | "international";

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

function buildDocumentsTabHref(slug: string, tab: DocumentsTabKey) {
  return tab === "documents"
    ? `/app/o/${slug}/documents`
    : `/app/o/${slug}/documents?tab=international`;
}

export default async function OrganizationDocumentsPage({
  params,
  searchParams,
}: OrganizationDocumentsPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const activeTab: DocumentsTabKey =
    resolvedSearchParams.tab === "international" ? "international" : "documents";
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const [documents, importOperations, recentDocumentsResult] = await Promise.all([
    listOrganizationWorkspaceDocuments({
      organizationId: organization.id,
      organizationSlug: organization.slug,
    }),
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
              Cargar documentos
            </Link>
          ) : (
            <LoadingLink
              href={buildDocumentsTabHref(organization.slug, "documents")}
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
                  href={buildDocumentsTabHref(organization.slug, tab.key)}
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
            <div className="flex flex-wrap gap-2">
              <span className="ui-filter">Tipo</span>
              <span className="ui-filter">Estado</span>
              <span className="ui-filter">Buscar</span>
              <span className="ui-filter min-w-[138px] justify-between">Bandeja</span>
            </div>

            <DocumentsWorkspaceTable
              slug={organization.slug}
              documents={documents}
            />

            <div className="ui-panel" id="document-upload-panel">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold text-white">
                    Ingreso documental
                  </h2>
                  <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                    La carga solo guarda el archivo en el bucket privado. La extraccion
                    se dispara despues desde la bandeja operativa.
                  </p>
                </div>
                <span className="status-pill status-pill--info">Flujo separado</span>
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
