import type { Metadata } from "next";
import { DocumentReviewWorkspace } from "@/components/documents/document-review-workspace";
import { DocumentOriginalModalTrigger } from "@/components/documents/document-original-modal-trigger";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { SectionCard } from "@/components/section-card";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
} from "@/components/ui/button-styles";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  loadDocumentOriginalPageData,
  loadDocumentReviewPageData,
  MissingPersistedDraftError,
} from "@/modules/documents/review";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  confirmDocumentReviewAction,
  reopenDocumentReviewAction,
  resolveDocumentDuplicateAction,
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
  let pageData: Awaited<ReturnType<typeof loadDocumentReviewPageData>> | null = null;
  let originalPageData: Awaited<ReturnType<typeof loadDocumentOriginalPageData>> | null = null;

  try {
    pageData = await loadDocumentReviewPageData({
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
  } catch (error) {
    if (error instanceof MissingPersistedDraftError) {
      originalPageData = await loadDocumentOriginalPageData({
        organizationId: organization.id,
        organizationSlug: organization.slug,
        documentId,
        userRole: organization.role as
          | "owner"
          | "admin"
          | "accountant"
          | "reviewer"
          | "operator"
          | "viewer"
          | "developer",
      });
    } else {
      throw error;
    }
  }

  if (originalPageData) {
    return (
      <PrivateDashboardShell
        organizationName={organization.name}
        organizationSlug={organization.slug}
        userEmail={authState.user?.email}
        userRole={organization.role}
        title="Revision documental"
        description="Este documento todavia no tiene draft persistido. Igual podes abrir el original para validar el comprobante real sin salir de la pantalla."
        navItems={buildOrganizationPrivateNavItems(organization.slug, "documents")}
      >
        <SectionCard
          title={originalPageData.document.originalFilename}
          description="Cuando exista el draft persistido se habilitara la revision procesada. Mientras tanto, el original queda disponible en modal y en una ventana aparte."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
              <p className="font-semibold">Estado</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {originalPageData.document.status.replace(/_/g, " ")}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
              <p className="font-semibold">Rol documental</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {originalPageData.document.direction}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
              <p className="font-semibold">Fecha documento</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {originalPageData.document.documentDate ?? "Pendiente"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <span
              className="rounded-full border border-dashed border-[color:var(--color-border)] px-4 py-2 text-sm font-semibold text-[color:var(--color-muted)]"
              aria-disabled="true"
            >
              Ver documento procesado
            </span>
            <DocumentOriginalModalTrigger
              previewUrl={originalPageData.document.previewUrl}
              mimeType={originalPageData.document.mimeType}
              originalFilename={originalPageData.document.originalFilename}
              triggerLabel="Ver documento original"
              triggerClassName={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-2 text-sm`}
              modalTitle={originalPageData.document.originalFilename}
              modalDescription="Archivo original subido por el usuario. Se abre en grande para validar la informacion real del comprobante."
            />
          </div>
        </SectionCard>
      </PrivateDashboardShell>
    );
  }

  if (!pageData) {
    throw new Error("No pudimos cargar la revision documental.");
  }

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Revision documental"
      description="Cada documento abre sobre su draft persistido, con snapshot congelado de reglas, sugerencia IVA, sugerencia contable y confirmacion final unica."
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
        confirmDocumentAction={async (payload) => {
          "use server";
          return confirmDocumentReviewAction({
            slug,
            documentId,
            ...payload,
          });
        }}
        resolveDuplicateAction={async (payload) => {
          "use server";
          return resolveDocumentDuplicateAction({
            slug,
            documentId,
            ...payload,
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
