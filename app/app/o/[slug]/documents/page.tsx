import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { DocumentUploadDropzone } from "@/components/documents/upload-dropzone";
import { DocumentOperationalTray } from "@/components/documents/document-operational-tray";
import { LoadingLink } from "@/components/ui/loading-link";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  listAllOrganizationWorkspaceDocuments,
  loadDocumentOriginalPageData,
  loadDocumentReviewPageData,
  MissingPersistedDraftError,
} from "@/modules/documents/review";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  confirmFinalDocumentReviewAction,
  resolveDocumentAssistantSuggestionAction,
  runDocumentClassificationAction,
} from "./[documentId]/actions";

type OrganizationDocumentsPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    documentId?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Documentos",
};

export default async function OrganizationDocumentsPage({
  params,
  searchParams,
}: OrganizationDocumentsPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const userRole = organization.role as
    | "owner"
    | "admin"
    | "admin_processing"
    | "accountant"
    | "reviewer"
    | "operator"
    | "viewer"
    | "developer";
  const documents = await listAllOrganizationWorkspaceDocuments({
    organizationId: organization.id,
    organizationSlug: organization.slug,
    sortOrder: "date_desc",
  });
  const selectedDocumentId = (
    resolvedSearchParams.documentId
    && documents.some((document) => document.id === resolvedSearchParams.documentId)
      ? resolvedSearchParams.documentId
      : documents.find((document) => document.processedHref)?.id
        ?? documents[0]?.id
        ?? null
  );
  const selectedWorkspaceDocument = selectedDocumentId
    ? documents.find((document) => document.id === selectedDocumentId) ?? null
    : null;

  let selectedDocument: Parameters<typeof DocumentOperationalTray>[0]["selectedDocument"] = null;

  if (selectedWorkspaceDocument) {
    try {
      selectedDocument = {
        kind: "review",
        pageData: await loadDocumentReviewPageData({
          organizationId: organization.id,
          organizationSlug: organization.slug,
          documentId: selectedWorkspaceDocument.id,
          actorId: authState.user?.id ?? null,
          userRole,
        }),
      };
    } catch (error) {
      if (error instanceof MissingPersistedDraftError) {
        selectedDocument = {
          kind: "original",
          pageData: await loadDocumentOriginalPageData({
            organizationId: organization.id,
            organizationSlug: organization.slug,
            documentId: selectedWorkspaceDocument.id,
            userRole,
          }),
        };
      } else {
        throw error;
      }
    }
  }

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Documentos"
      toolbarLabel="Documentos"
      description="Ingreso, revision y trazabilidad de comprobantes conectados a trabajos, dinero, contabilidad e IVA."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "documents")}
    >
      <div className="space-y-3">
        <DocumentOperationalTray
          slug={organization.slug}
          documents={documents}
          selectedDocumentId={selectedDocumentId}
          selectedDocument={selectedDocument}
          confirmFinalDocumentAction={selectedWorkspaceDocument
            ? async () => {
              "use server";
              return confirmFinalDocumentReviewAction({
                slug,
                documentId: selectedWorkspaceDocument.id,
              });
            }
            : undefined}
          runClassificationAction={selectedWorkspaceDocument
            ? async () => {
              "use server";
              return runDocumentClassificationAction({
                slug,
                documentId: selectedWorkspaceDocument.id,
              });
            }
            : undefined}
          resolveAssistantSuggestionAction={selectedWorkspaceDocument
            ? async (input) => {
              "use server";
              return resolveDocumentAssistantSuggestionAction({
                slug,
                documentId: selectedWorkspaceDocument.id,
                ...input,
              });
            }
            : undefined}
        />

        <section className="ui-panel" id="document-upload-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[17px] font-semibold text-white">Ingreso directo</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                La carga sigue disponible, pero ya no domina la pantalla. Primero ves la bandeja; despues agregas nuevos comprobantes o entras por Auditoria para un lote masivo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LoadingLink
                href={`/app/o/${organization.slug}/audit`}
                pendingLabel="Abriendo..."
                className="ui-button ui-button--secondary w-full sm:w-auto"
              >
                Auditoria
              </LoadingLink>
              <LoadingLink
                href={`/app/o/${organization.slug}/settings?tab=chart`}
                pendingLabel="Abriendo..."
                className="ui-button ui-button--secondary w-full sm:w-auto"
              >
                Contabilidad
              </LoadingLink>
              <LoadingLink
                href={`/app/o/${organization.slug}/tax`}
                pendingLabel="Abriendo..."
                className="ui-button ui-button--secondary w-full sm:w-auto"
              >
                Impuestos (IVA)
              </LoadingLink>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_320px]">
            <DocumentUploadDropzone slug={organization.slug} showSpreadsheetImport={false} />
            <div className="space-y-3">
              {[
                "La revision documental ya no entra por un menu aparte.",
                "El criterio IA se confirma desde la bandeja sobre cada documento.",
                "La sugerencia completa sigue disponible para casos que necesiten mas contexto.",
              ].map((note) => (
                <div
                  key={note}
                  className="rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[color:var(--color-muted)]"
                >
                  {note}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PrivateDashboardShell>
  );
}
