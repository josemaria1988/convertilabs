import type { Metadata } from "next";
import { DocumentReviewWorkspace } from "@/components/documents/document-review-workspace";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { loadDocumentReviewPageData } from "@/modules/documents/review";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  confirmDocumentReviewAction,
  reopenDocumentReviewAction,
  saveDocumentDraftReviewAction,
} from "./actions";

type DocumentReviewPageProps = {
  params: Promise<{
    slug: string;
    documentId: string;
  }>;
};

export const metadata: Metadata = {
  title: "Revision documental",
};

export default async function DocumentReviewPage({
  params,
}: DocumentReviewPageProps) {
  const { slug, documentId } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const pageData = await loadDocumentReviewPageData({
    organizationId: organization.id,
    organizationSlug: organization.slug,
    documentId,
    actorId: authState.user?.id ?? null,
    userRole: organization.role as
      | "owner"
      | "admin"
      | "accountant"
      | "reviewer"
      | "operator"
      | "viewer"
      | "developer",
  });

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Revision documental"
      description="Cada documento abre sobre su draft persistido, con snapshot congelado de reglas, sugerencia IVA, sugerencia contable y confirmacion final unica."
      uploadHref={`/app/o/${organization.slug}/dashboard#document-upload-panel`}
      navItems={buildOrganizationPrivateNavItems(organization.slug, "documents")}
    >
      <DocumentReviewWorkspace
        pageData={pageData}
        saveDraftReviewAction={async (input) => {
          "use server";
          return saveDocumentDraftReviewAction({
            slug,
            documentId,
            ...input,
          });
        }}
        confirmDocumentAction={async () => {
          "use server";
          return confirmDocumentReviewAction({
            slug,
            documentId,
          });
        }}
        reopenDocumentAction={async () => {
          "use server";
          return reopenDocumentReviewAction({
            slug,
            documentId,
          });
        }}
      />
    </PrivateDashboardShell>
  );
}
