import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { DocumentUploadDropzone } from "@/components/documents/upload-dropzone";
import { InternationalOperationsWorkspace } from "@/components/documents/international-operations-workspace";
import { LoadingLink } from "@/components/ui/loading-link";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  listAllOrganizationWorkspaceDocuments,
  listOrganizationWorkspaceDocuments,
} from "@/modules/documents/review";
import { groupDocumentsByReviewBucket } from "@/modules/documents/review-queue";
import { loadMissingFxDocumentsSummary } from "@/modules/documents/spreadsheet-fx-resolution";
import { listOrganizationImportOperations } from "@/modules/imports";
import {
  evaluateOrganizationLaunchScope,
  formatLaunchSupportLevelLabel,
} from "@/modules/launch/scope";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationDocumentsPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    tab?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Documentos",
};

function formatDateLabel(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default async function OrganizationDocumentsPage({
  params,
  searchParams,
}: OrganizationDocumentsPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const activeTab = resolvedSearchParams.tab === "international" ? "international" : "documents";
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();

  const [
    recentDocuments,
    allDocuments,
    missingFxSummary,
    importOperations,
    recentDocumentsResult,
    organizationScopeRow,
  ] = await Promise.all([
    listOrganizationWorkspaceDocuments({
      organizationId: organization.id,
      organizationSlug: organization.slug,
    }),
    activeTab === "documents"
      ? listAllOrganizationWorkspaceDocuments({
        organizationId: organization.id,
        organizationSlug: organization.slug,
        sortOrder: "date_desc",
      })
      : Promise.resolve([]),
    loadMissingFxDocumentsSummary({
      organizationId: organization.id,
      supabase,
    }),
    activeTab === "international"
      ? listOrganizationImportOperations(supabase, organization.id, 8)
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
    supabase
      .from("organizations")
      .select("country_code, legal_entity_type, tax_regime_code, vat_regime")
      .eq("id", organization.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (recentDocumentsResult.error) {
    throw new Error(recentDocumentsResult.error.message);
  }

  if (organizationScopeRow.error) {
    throw new Error(organizationScopeRow.error.message);
  }

  const organizationScope = evaluateOrganizationLaunchScope({
    countryCode: organizationScopeRow.data?.country_code ?? "UY",
    legalEntityType: organizationScopeRow.data?.legal_entity_type ?? null,
    taxRegimeCode: organizationScopeRow.data?.tax_regime_code ?? null,
    vatRegime: organizationScopeRow.data?.vat_regime ?? null,
  });
  const reviewBuckets = groupDocumentsByReviewBucket(allDocuments);
  const bucketCountMap = new Map(reviewBuckets.map((bucket) => [bucket.key, bucket.items.length]));
  const recentInternationalDocuments = (((recentDocumentsResult.data as Array<{
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
      description="Superficie de ingreso: cargar originales, resumir el ultimo lote y derivar la decision humana a Revision."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "documents")}
    >
      {activeTab === "international" ? (
        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
                  Operaciones internacionales
                </h1>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Vista secundaria para DUA, proveedor exterior y tributos asociados. El flujo
                  principal de trabajo sigue en Revision.
                </p>
              </div>
              <LoadingLink
                href={`/app/o/${organization.slug}/documents`}
                pendingLabel="Volviendo..."
                className="ui-button ui-button--secondary"
              >
                Volver a ingreso documental
              </LoadingLink>
            </div>
          </section>

          <InternationalOperationsWorkspace
            slug={organization.slug}
            importOperations={importOperations}
            recentDocuments={recentInternationalDocuments}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
                  Ingreso documental
                </h1>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Este carril se enfoca en cargar documentos y confirmar que entraron bien al
                  sistema. La revision detallada vive en una cola aparte.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <LoadingLink
                  href={`/app/o/${organization.slug}/review`}
                  pendingLabel="Abriendo revision..."
                  className="ui-button ui-button--primary"
                >
                  Ir a Revision
                </LoadingLink>
                <LoadingLink
                  href={`/app/o/${organization.slug}/audit`}
                  pendingLabel="Abriendo importacion..."
                  className="ui-button ui-button--secondary"
                >
                  Importacion masiva
                </LoadingLink>
                <LoadingLink
                  href={`/app/o/${organization.slug}/documents?tab=international`}
                  pendingLabel="Abriendo..."
                  className="ui-button ui-button--secondary"
                >
                  Operaciones internacionales
                </LoadingLink>
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="metric-card">
              <span className="metric-card__label">Pendientes de revision</span>
              <span className="metric-card__value">{bucketCountMap.get("needs_review") ?? 0}</span>
              <p className="metric-card__hint">Documentos listos para entrar al wizard humano.</p>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">Bloqueados</span>
              <span className="metric-card__value">{bucketCountMap.get("blocked") ?? 0}</span>
              <p className="metric-card__hint">Duplicados, FX, alcance o incidencias visibles.</p>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">Listos para cierre</span>
              <span className="metric-card__value">
                {(bucketCountMap.get("ready_provisional") ?? 0) + (bucketCountMap.get("ready_final") ?? 0)}
              </span>
              <p className="metric-card__hint">Documentos que ya superaron la parte pesada de revision.</p>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">Sin cotizacion</span>
              <span className="metric-card__value">{missingFxSummary.count}</span>
              <p className="metric-card__hint">Casos en moneda extranjera visibles desde ingreso.</p>
            </article>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Ultimo lote visible</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Resumen rapido de las cargas mas recientes antes de saltar a Revision.
                </p>
              </div>
              <span className={`status-pill ${
                organizationScope.supportLevel === "automatic"
                  ? "status-pill--success"
                  : organizationScope.supportLevel === "assisted_only"
                    ? "status-pill--warning"
                    : "status-pill--danger"
              }`}>
                {formatLaunchSupportLevelLabel(organizationScope.supportLevel)}
              </span>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-3">
                {recentDocuments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
                    Todavia no hay documentos cargados.
                  </div>
                ) : (
                  recentDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{document.originalFilename}</p>
                          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                            {document.counterpartyName ?? "Contraparte pendiente"} · {formatDateLabel(document.createdAt)}
                          </p>
                        </div>
                        <LoadingLink
                          href={document.processedHref ?? `/app/o/${organization.slug}/review`}
                          pendingLabel="Abriendo..."
                          className="ui-button ui-button--secondary"
                        >
                          {document.processedHref ? "Abrir" : "Ver cola"}
                        </LoadingLink>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm text-[color:var(--color-muted)]">
                  <p className="font-semibold text-white">Que sigue despues de cargar</p>
                  <p className="mt-2">
                    1. Verifica que el lote entro bien.
                  </p>
                  <p className="mt-1">
                    2. Abre Revision para trabajar pendientes, blockers y listos para cierre.
                  </p>
                  <p className="mt-1">
                    3. Usa Importacion masiva cuando la entrada venga desde planillas o staging estructurado.
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm text-[color:var(--color-muted)]">
                  <p className="font-semibold text-white">Alcance operativo</p>
                  {organizationScope.reasons.length === 0 ? (
                    <p className="mt-2">
                      La organizacion entra dentro del perimetro automatico conservador del MVP.
                    </p>
                  ) : (
                    organizationScope.reasons.map((reason) => (
                      <p key={reason} className="mt-2">
                        {reason}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="ui-panel" id="document-upload-panel">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold text-white">
                  Cargar originales
                </h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Sube comprobantes firmados, recibidos por email o respaldos necesarios para que
                  entren al loop principal de revision.
                </p>
              </div>
              <LoadingLink
                href={`/app/o/${organization.slug}/review`}
                pendingLabel="Abriendo revision..."
                className="ui-button ui-button--secondary"
              >
                Abrir Revision
              </LoadingLink>
            </div>
            <DocumentUploadDropzone slug={organization.slug} showSpreadsheetImport={false} />
          </div>
        </div>
      )}
    </PrivateDashboardShell>
  );
}
