import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { DocumentOriginalModalTrigger } from "@/components/documents/document-original-modal-trigger";
import { SectionCard } from "@/components/section-card";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { LoadingLink } from "@/components/ui/loading-link";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { listOrganizationWorkspaceDocuments } from "@/modules/documents/review";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationDocumentsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Documents",
};

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

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
      title="Documents"
      description="Vista operativa de todos los documentos del tenant actual, con acceso separado al original subido y al draft procesado cuando ya existe."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "documents")}
    >
      <SectionCard
        title="Bandeja documental"
        description="Cada fila separa el acceso al draft procesado del acceso al archivo original que se subio al bucket privado."
      >
        {documents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-6 py-14 text-center text-sm text-[color:var(--color-muted)]">
            Aun no hay documentos en esta organizacion.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  <th className="pb-1 pr-4">Archivo</th>
                  <th className="pb-1 pr-4">Estado</th>
                  <th className="pb-1 pr-4">Rol</th>
                  <th className="pb-1 pr-4">Fecha doc</th>
                  <th className="pb-1">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td className="rounded-l-2xl border border-r-0 border-[color:var(--color-border)] bg-white/70 px-4 py-4 text-sm font-medium">
                      {document.originalFilename}
                    </td>
                    <td className="border-y border-[color:var(--color-border)] bg-white/70 px-4 py-4 text-sm text-[color:var(--color-muted)]">
                      {formatStatus(document.status)}
                    </td>
                    <td className="border-y border-[color:var(--color-border)] bg-white/70 px-4 py-4 text-sm text-[color:var(--color-muted)]">
                      {document.role}
                    </td>
                    <td className="border-y border-[color:var(--color-border)] bg-white/70 px-4 py-4 text-sm text-[color:var(--color-muted)]">
                      {document.documentDate ?? "-"}
                    </td>
                    <td className="rounded-r-2xl border border-l-0 border-[color:var(--color-border)] bg-white/70 px-4 py-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {document.processedHref ? (
                          <LoadingLink
                            href={document.processedHref}
                            pendingLabel="Abriendo..."
                            className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-2 text-sm`}
                          >
                            Ver documento procesado
                          </LoadingLink>
                        ) : (
                          <span
                            className="rounded-full border border-dashed border-[color:var(--color-border)] px-4 py-2 font-semibold text-[color:var(--color-muted)]"
                            aria-disabled="true"
                            title="Disponible cuando exista draft persistido."
                          >
                            Ver documento procesado
                          </span>
                        )}
                        <DocumentOriginalModalTrigger
                          previewUrl={document.previewUrl}
                          mimeType={document.mimeType}
                          originalFilename={document.originalFilename}
                          triggerLabel="Ver documento original"
                          triggerClassName={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
                          modalTitle={document.originalFilename}
                          modalDescription="Archivo original subido por el usuario. Se abre en grande para contrastar la informacion real del comprobante."
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PrivateDashboardShell>
  );
}
