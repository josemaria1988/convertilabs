import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { DocumentReviewQueue } from "@/components/documents/document-review-queue";
import { LoadingLink } from "@/components/ui/loading-link";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { listOrganizationCostCenters } from "@/modules/cost-centers/service";
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
  const [documents, costCenters] = await Promise.all([
    listAllOrganizationWorkspaceDocuments({
      organizationId: organization.id,
      organizationSlug: organization.slug,
      sortOrder: "date_desc",
    }),
    listOrganizationCostCenters({
      organizationId: organization.id,
      includeArchived: true,
    }),
  ]);
  const costCenterNameById = Object.fromEntries(costCenters.map((item) => [item.id, item.name]));
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
      description="Cola principal del trabajo humano: separa subir de revisar y concentra solo el trabajo accionable."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "review")}
    >
      <div className="space-y-4">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
                Revision operativa
              </h1>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                La carga documental vive en otra pantalla. Aqui solo aparece el trabajo que
                necesita una decision humana para seguir avanzando.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LoadingLink
                href={`/app/o/${organization.slug}/documents`}
                pendingLabel="Abriendo documentos..."
                className="ui-button ui-button--secondary w-full sm:w-auto"
              >
                Documentos
              </LoadingLink>
              {canUsePendingAssignmentQueue ? (
                <LoadingLink
                  href={`/app/o/${organization.slug}/documents/pending-assignment`}
                  pendingLabel="Abriendo cola..."
                  className="ui-button ui-button--secondary w-full sm:w-auto"
                >
                  Lotes y asignacion
                </LoadingLink>
              ) : null}
            </div>
          </div>
        </section>

        <DocumentReviewQueue
          slug={organization.slug}
          documents={documents}
          costCenterNameById={costCenterNameById}
        />
      </div>
    </PrivateDashboardShell>
  );
}
