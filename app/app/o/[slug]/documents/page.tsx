import type { Metadata } from "next";
import Link from "next/link";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { DocumentsWorkspaceTable } from "@/components/documents/documents-workspace-table";
import { DocumentUploadDropzone } from "@/components/documents/upload-dropzone";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { listOrganizationWorkspaceDocuments } from "@/modules/documents/review";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationDocumentsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Documentos",
};

export default async function OrganizationDocumentsPage({
  params,
}: OrganizationDocumentsPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const documents = await listOrganizationWorkspaceDocuments({
    organizationId: organization.id,
    organizationSlug: organization.slug,
  });

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Documentos"
      toolbarLabel="Documentos"
      description="Bandeja documental con carga desacoplada, extraccion explicita y clasificacion manual sobre drafts persistidos."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "documents")}
    >
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
            Documentos
          </h1>
          <Link
            href="#document-upload-panel"
            className="ui-button ui-button--secondary"
          >
            Cargar Documentos
          </Link>
        </div>

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
      </section>
    </PrivateDashboardShell>
  );
}
