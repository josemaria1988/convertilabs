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
import {
  groupDocumentsByReviewBucket,
  summarizeDocumentReviewSecondaryBuckets,
} from "@/modules/documents/review-queue";
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

  const [recentDocuments, allDocuments, importOperations, recentDocumentsResult] = await Promise.all([
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
  ]);

  if (recentDocumentsResult.error) {
    throw new Error(recentDocumentsResult.error.message);
  }

  const reviewBuckets = groupDocumentsByReviewBucket(allDocuments);
  const secondaryBuckets = summarizeDocumentReviewSecondaryBuckets(allDocuments);
  const bucketCountMap = new Map(reviewBuckets.map((bucket) => [bucket.key, bucket.items.length]));
  const secondaryCountMap = new Map(secondaryBuckets.map((bucket) => [bucket.key, bucket.count]));
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
      description="Superficie de ingreso: cargar originales, confirmar el ultimo tramo y derivar la decision humana a Revision."
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
                  principal del piloto sigue en Revision.
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
                  Subir documentos
                </h1>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Esta pantalla se dedica a cargar originales, confirmar que entraron bien y
                  derivar el trabajo humano a Revision.
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

          <section className="ui-panel" id="document-upload-panel">
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
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="metric-card">
              <span className="metric-card__label">En procesamiento</span>
              <span className="metric-card__value">{secondaryCountMap.get("processing") ?? 0}</span>
              <p className="metric-card__hint">Archivos que todavia estan entrando al sistema.</p>
            </article>
            <article className="metric-card">
              <span className="metric-card__label">Listos para revisar</span>
              <span className="metric-card__value">
                {(bucketCountMap.get("factual_review") ?? 0) + (bucketCountMap.get("assignment") ?? 0)}
              </span>
              <p className="metric-card__hint">Documentos que ya requieren una decision humana.</p>
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
              <p className="metric-card__hint">Casos que ya pasaron la parte pesada de la revision.</p>
            </article>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Que pasa despues de cargar</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Usa este resumen para confirmar que el lote entro bien y despues sigue en Revision.
                </p>
              </div>
              <LoadingLink
                href={`/app/o/${organization.slug}/review`}
                pendingLabel="Abriendo revision..."
                className="ui-button ui-button--primary"
              >
                Ir a Revision
              </LoadingLink>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                <p className="font-semibold text-white">1. Confirmar entrada</p>
                <p className="mt-2 text-[color:var(--color-muted)]">
                  Revisa que el lote haya quedado cargado y en procesamiento normal.
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                <p className="font-semibold text-white">2. Abrir Revision</p>
                <p className="mt-2 text-[color:var(--color-muted)]">
                  La cola principal separa validacion factual, asignacion, bloqueos y cierres.
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                <p className="font-semibold text-white">3. Importacion masiva</p>
                <p className="mt-2 text-[color:var(--color-muted)]">
                  Usala solo cuando la entrada venga por planillas o staging estructurado.
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                <p className="font-semibold text-white">4. Internacional</p>
                <p className="mt-2 text-[color:var(--color-muted)]">
                  Sigue disponible, pero como carril secundario del piloto.
                </p>
              </div>
            </div>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Ultimos archivos subidos</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Lista corta para validar que la carga entro bien antes de pasar a Revision.
                </p>
              </div>
              <span className="ui-filter">{Math.min(recentDocuments.length, 8)}</span>
            </div>

            <div className="mt-4 space-y-3">
              {recentDocuments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
                  Todavia no hay documentos cargados.
                </div>
              ) : (
                recentDocuments.slice(0, 8).map((document) => (
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
                        {document.processedHref ? "Abrir en Revision" : "Ver cola"}
                      </LoadingLink>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </PrivateDashboardShell>
  );
}
