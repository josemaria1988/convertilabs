import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { DocumentReviewQueue } from "@/components/documents/document-review-queue";
import { LoadingLink } from "@/components/ui/loading-link";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { listAllOrganizationWorkspaceDocuments } from "@/modules/documents/review";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationReviewPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Revision",
};

export default async function OrganizationReviewPage({
  params,
}: OrganizationReviewPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const documents = await listAllOrganizationWorkspaceDocuments({
    organizationId: organization.id,
    organizationSlug: organization.slug,
    sortOrder: "date_desc",
  });
  const canUsePendingAssignmentQueue = ["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(
    organization.role,
  );

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Revision"
      toolbarLabel="Revision"
      description="Cola principal del trabajo humano: prioriza pendientes, blockers, listos para provisional y listos para final."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "review")}
    >
      <div className="space-y-4">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
                Cola de revision
              </h1>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Los estados tecnicos se agrupan en un recorrido operativo legible para el equipo:
                procesar, revisar, destrabar, postear provisional y confirmar final.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LoadingLink
                href={`/app/o/${organization.slug}/documents`}
                pendingLabel="Abriendo documentos..."
                className="ui-button ui-button--secondary"
              >
                Documentos
              </LoadingLink>
              <LoadingLink
                href={`/app/o/${organization.slug}/audit`}
                pendingLabel="Abriendo importacion..."
                className="ui-button ui-button--secondary"
              >
                Importacion masiva
              </LoadingLink>
              {canUsePendingAssignmentQueue ? (
                <LoadingLink
                  href={`/app/o/${organization.slug}/documents/pending-assignment`}
                  pendingLabel="Abriendo cola..."
                  className="ui-button ui-button--secondary"
                >
                  Pending assignment
                </LoadingLink>
              ) : null}
            </div>
          </div>
        </section>

        <DocumentReviewQueue slug={organization.slug} documents={documents} />
      </div>
    </PrivateDashboardShell>
  );
}
