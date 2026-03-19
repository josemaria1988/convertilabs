import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { LoadingLink } from "@/components/ui/loading-link";
import { DocumentAuditPreviewWorkspace } from "@/components/audit/document-audit-preview-workspace";
import { DocumentAuditUploadPanel } from "@/components/audit/document-audit-upload-panel";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { loadDocumentAuditWorkspace } from "@/modules/audit/document-import-audit";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  formatDocumentRoleLabel,
  formatLifecycleStatusLabel,
} from "@/modules/presentation/labels";

type OrganizationAuditPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    run?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Auditoria",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function OrganizationAuditPage({
  params,
  searchParams,
}: OrganizationAuditPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedRunId = typeof resolvedSearchParams.run === "string"
    ? resolvedSearchParams.run
    : null;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const { runs, selectedRun } = await loadDocumentAuditWorkspace({
    supabase: getSupabaseServiceRoleClient(),
    organizationId: organization.id,
    selectedRunId,
    limit: 12,
  });

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Auditoria"
      toolbarLabel="Auditoria"
      description="Ingreso masivo auditado con preview estructurado, decisiones controladas e historico trazable por usuario y fecha."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "audit")}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h1 className="text-[22px] font-semibold text-white">Auditoria</h1>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Este modulo separa la importacion documental masiva del flujo diario de `Documentos`.
                  Primero genera un staging auditable y despues materializa solo lo que apruebes.
                </p>
              </div>
              <span className="status-pill status-pill--info">Trazabilidad explicita</span>
            </div>
          </section>

          <DocumentAuditUploadPanel slug={organization.slug} />

          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Historico de importaciones</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Cada corrida registra archivo, usuario, timestamps y resultado del batch para sostener auditabilidad end-to-end.
                </p>
              </div>
              <span className="ui-filter">{runs.length} corrida(s)</span>
            </div>

            <div className="mt-4 space-y-3">
              {runs.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
                  Todavia no hay auditorias documentales en esta organizacion.
                </div>
              ) : (
                runs.map((run) => {
                  const isCurrent = selectedRun?.runId === run.runId;

                  return (
                    <div
                      key={run.runId}
                      className={`rounded-2xl border p-4 ${
                        isCurrent
                          ? "border-[rgba(124,157,255,0.34)] bg-[rgba(124,157,255,0.08)]"
                          : "border-[color:var(--color-border)] bg-white/6"
                      }`.trim()}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{run.fileName}</p>
                          <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                            {formatDocumentRoleLabel(run.ledgerKind)} / {formatLifecycleStatusLabel(run.status)}
                          </p>
                        </div>
                        <LoadingLink
                          href={`/app/o/${organization.slug}/audit?run=${run.runId}`}
                          pendingLabel="Abriendo batch..."
                          className="ui-button ui-button--secondary"
                        >
                          Ver batch
                        </LoadingLink>
                      </div>

                      <div className="mt-3 grid gap-2 text-[13px] text-[color:var(--color-muted)]">
                        <div className="ui-subtle-row">
                          <span>Subida</span>
                          <span>{formatDateTime(run.createdAt)}</span>
                        </div>
                        <div className="ui-subtle-row">
                          <span>Usuario</span>
                          <span>{run.uploadedByDisplay ?? "Usuario del tenant"}</span>
                        </div>
                        <div className="ui-subtle-row">
                          <span>Preview</span>
                          <span>{run.previewCounts.total} detectado(s)</span>
                        </div>
                        <div className="ui-subtle-row">
                          <span>Aceptados / Rechazados / Error</span>
                          <span>
                            {run.previewCounts.accepted} / {run.previewCounts.rejected} / {run.previewCounts.failed}
                          </span>
                        </div>
                        <div className="ui-subtle-row">
                          <span>Materializados</span>
                          <span>{run.importedCount}</span>
                        </div>
                        <div className="ui-subtle-row">
                          <span>Cierre</span>
                          <span>{formatDateTime(run.confirmedAt)}</span>
                        </div>
                      </div>

                      {run.latestEventMessage ? (
                        <p className="mt-3 text-[13px] text-[color:var(--color-muted)]">
                          {run.latestEventMessage}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <DocumentAuditPreviewWorkspace slug={organization.slug} run={selectedRun} />
      </div>
    </PrivateDashboardShell>
  );
}
