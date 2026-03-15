import type { Metadata } from "next";
import Link from "next/link";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { DocumentOriginalModalTrigger } from "@/components/documents/document-original-modal-trigger";
import { DocumentUploadDropzone } from "@/components/documents/upload-dropzone";
import { LoadingLink } from "@/components/ui/loading-link";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { listOrganizationWorkspaceDocuments } from "@/modules/documents/review";
import {
  formatDocumentStatusLabel,
  getDocumentRoleLabel,
  getDocumentRoleVariant,
  getDocumentStatusVariant,
} from "@/modules/documents/status";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  formatDecisionSourceLabel,
  formatDuplicateStatusLabel,
} from "@/modules/presentation/labels";

type OrganizationDocumentsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Documentos",
};

function formatAmount(value: number | null) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getCertaintyClasses(level: "green" | "yellow" | "red" | null) {
  if (level === "green") {
    return "status-pill status-pill--success";
  }

  if (level === "yellow") {
    return "status-pill status-pill--warning";
  }

  if (level === "red") {
    return "status-pill status-pill--danger";
  }

  return "status-pill status-pill--info";
}

function formatCertaintyLabel(level: "green" | "yellow" | "red" | null) {
  if (level === "green") {
    return "Alta";
  }

  if (level === "yellow") {
    return "Media";
  }

  if (level === "red") {
    return "Baja";
  }

  return "s/d";
}

function getReviewButtonClasses(status: string) {
  if (["classified", "approved"].includes(status)) {
    return "ui-button ui-button--success";
  }

  if (["error", "rejected", "duplicate"].includes(status)) {
    return "ui-button ui-button--danger";
  }

  return "ui-button ui-button--warning";
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
      title="Documentos"
      toolbarLabel="Documentos"
      description="Bandeja documental de la organizacion actual, con filtros visuales compactos y acceso al original y al borrador cuando exista."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "documents")}
    >
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
            Documentos
          </h1>
          <Link
            href="#document-upload-panel"
            className="ui-button ui-button--secondary"
          >
            Cargar Documentos
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="ui-filter">Tipo</span>
          <span className="ui-filter">Estado</span>
          <span className="ui-filter">Buscar</span>
          <span className="ui-filter min-w-[138px] justify-between">Escritorio</span>
        </div>

        <div className="ui-panel overflow-hidden p-0">
          {documents.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-[color:var(--color-muted)]">
              Aun no hay documentos en esta organizacion.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[860px]">
                <thead>
                  <tr>
                    <th className="w-8"> </th>
                    <th>Archivo</th>
                    <th>Contraparte</th>
                    <th>Estado</th>
                    <th>Tipo</th>
                    <th>Confianza</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <span className="block h-2.5 w-2.5 rounded-[2px] bg-[#79b6d7]" />
                      </td>
                      <td>
                        <div className="font-semibold text-white">
                          {document.originalFilename}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-[color:var(--color-muted)]">
                          {document.processedHref ? (
                            <LoadingLink
                              href={document.processedHref}
                              pendingLabel="Abriendo..."
                              className={getReviewButtonClasses(document.status)}
                            >
                              Abrir revision
                            </LoadingLink>
                          ) : (
                            <span>Draft pendiente</span>
                          )}
                          <DocumentOriginalModalTrigger
                            previewUrl={document.previewUrl}
                            mimeType={document.mimeType}
                            originalFilename={document.originalFilename}
                            triggerLabel="Ver original"
                            triggerClassName="text-[13px] text-[color:var(--color-accent-strong)]"
                            modalTitle={document.originalFilename}
                            modalDescription="Archivo original cargado al bucket privado."
                          />
                        </div>
                      </td>
                      <td>
                        <div className="text-white">
                          {document.counterpartyName ?? "Contraparte pendiente"}
                        </div>
                        <div className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                          {document.documentType ?? "Documento fiscal"}
                        </div>
                      </td>
                      <td>
                        <span className={getDocumentStatusVariant(document.status)}>
                          {formatDocumentStatusLabel(document.status)}
                        </span>
                      </td>
                      <td>
                        <span className={getDocumentRoleVariant(document.role)}>
                          {getDocumentRoleLabel(document.role)}
                        </span>
                        <div className="mt-2 text-[13px] text-[color:var(--color-muted)]">
                          {formatDecisionSourceLabel(document.decisionSource)}
                        </div>
                        {document.duplicateStatus && document.duplicateStatus !== "clear" ? (
                          <div className="mt-1 text-[13px] text-amber-900">
                            {formatDuplicateStatusLabel(document.duplicateStatus)}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span className={getCertaintyClasses(document.certaintyLevel)}>
                          {formatCertaintyLabel(document.certaintyLevel)}
                        </span>
                        <div className="mt-2 text-[13px] text-[color:var(--color-muted)]">
                          {document.certaintyConfidence !== null
                            ? `${Math.round(document.certaintyConfidence * 100)}%`
                            : "Sin score"}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="font-semibold text-white">
                          {formatAmount(document.totalAmount)}
                        </div>
                        <div className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                          IVA {formatAmount(document.taxAmount)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ui-panel" id="document-upload-panel">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-white">
                Ingreso documental
              </h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Carga real al bucket privado con procesamiento en segundo plano.
              </p>
            </div>
            <span className="status-pill status-pill--info">Pipeline activo</span>
          </div>
          <DocumentUploadDropzone slug={organization.slug} />
        </div>
      </section>
    </PrivateDashboardShell>
  );
}
