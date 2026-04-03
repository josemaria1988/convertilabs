import type { Metadata } from "next";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { DocumentCostCenterPanel } from "@/components/cost-centers/document-cost-center-panel";
import { DocumentReviewStagedWorkspace } from "@/components/documents/document-review-staged-workspace";
import { DocumentRecoveryActionButton } from "@/components/documents/document-recovery-action-button";
import { DocumentOriginalModalTrigger } from "@/components/documents/document-original-modal-trigger";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { SectionCard } from "@/components/section-card";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
} from "@/components/ui/button-styles";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  canAssignOrganizationCostCenter,
  listOrganizationCostCenters,
} from "@/modules/cost-centers/service";
import {
  loadDocumentOriginalPageData,
  loadDocumentReviewPageData,
  MissingPersistedDraftError,
} from "@/modules/documents/review";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  confirmDocumentManualAssignmentAction,
  confirmFinalDocumentReviewAction,
  createDocumentReviewOverrideAccountAction,
  postProvisionalDocumentReviewAction,
  refreshDocumentAssistantAction,
  reopenDocumentReviewAction,
  resolveDocumentAssistantSuggestionAction,
  runDocumentClassificationAction,
  resolveDocumentDuplicateAction,
  saveDocumentDraftReviewAction,
  saveDocumentLearningRuleAction,
} from "./actions";
import { assignOrganizationDocumentCostCenterAction } from "../../cost-centers/actions";

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
  const supabase = getSupabaseServiceRoleClient();
  const costCentersPromise = listOrganizationCostCenters({
    organizationId: organization.id,
    includeArchived: true,
  });
  const documentCostCenterPromise = supabase
    .from("documents")
    .select("id, cost_center_id")
    .eq("organization_id", organization.id)
    .eq("id", documentId)
    .maybeSingle();
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
        | "admin_processing"
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
          | "admin_processing"
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

  const [costCenters, documentCostCenterResult] = await Promise.all([
    costCentersPromise,
    documentCostCenterPromise,
  ]);

  if (documentCostCenterResult.error) {
    throw new Error(documentCostCenterResult.error.message);
  }

  const costCenterPanel = (
    <DocumentCostCenterPanel
      slug={organization.slug}
      projects={costCenters}
      currentCostCenterId={documentCostCenterResult.data?.cost_center_id ?? null}
      canEdit={canAssignOrganizationCostCenter(organization.role)}
      assignCostCenterAction={async (input) => {
        "use server";
        return assignOrganizationDocumentCostCenterAction({
          slug,
          documentId,
          costCenterId: input.costCenterId,
          sourceSurface: "desktop_review",
        });
      }}
    />
  );

  if (originalPageData) {
    return (
      <PrivateDashboardShell
        organizationName={organization.name}
        organizationSlug={organization.slug}
        userEmail={authState.user?.email}
        userRole={organization.role}
        title="Revision documental"
        description="Este documento todavia no tiene draft persistido. Igual podes abrir el original para validar el comprobante real sin salir de la pantalla."
        navItems={buildOrganizationPrivateNavItems(organization.slug, "review")}
      >
        {costCenterPanel}
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
            {originalPageData.recoveryActionLabel ? (
              <DocumentRecoveryActionButton
                slug={slug}
                documentId={documentId}
                label={originalPageData.recoveryActionLabel}
              />
            ) : (
              <span
                className="rounded-full border border-dashed border-[color:var(--color-border)] px-4 py-2 text-sm font-semibold text-[color:var(--color-muted)]"
                aria-disabled="true"
              >
                Ver documento procesado
              </span>
            )}
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
      description="La revision avanza por etapas: clasificacion automatica, contexto manual solo si hace falta, asignacion contable y cierre."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "review")}
    >
      <div className="space-y-4">
        {costCenterPanel}
        <DocumentReviewStagedWorkspace
          pageData={pageData}
          saveDraftReviewAction={async (input) => {
            "use server";
            return saveDocumentDraftReviewAction({
              slug,
              documentId,
              ...input,
            });
          }}
          postProvisionalDocumentAction={async () => {
            "use server";
            return postProvisionalDocumentReviewAction({
              slug,
              documentId,
            });
          }}
          confirmFinalDocumentAction={async (payload) => {
            "use server";
            return confirmFinalDocumentReviewAction({
              slug,
              documentId,
              ...payload,
            });
          }}
          confirmManualAssignmentAction={async (payload) => {
            "use server";
            return confirmDocumentManualAssignmentAction({
              slug,
              documentId,
              ...payload,
            });
          }}
          createReviewAccountAction={async (payload) => {
            "use server";
            return createDocumentReviewOverrideAccountAction({
              slug,
              documentId,
              ...payload,
            });
          }}
          saveLearningRuleAction={async (payload) => {
            "use server";
            return saveDocumentLearningRuleAction({
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
          runClassificationAction={async () => {
            "use server";
            return runDocumentClassificationAction({
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
          refreshAssistantAction={async () => {
            "use server";
            return refreshDocumentAssistantAction({
              slug,
              documentId,
            });
          }}
          resolveAssistantSuggestionAction={async (payload) => {
            "use server";
            return resolveDocumentAssistantSuggestionAction({
              slug,
              documentId,
              ...payload,
            });
          }}
        />
      </div>
    </PrivateDashboardShell>
  );
}
