import Link from "next/link";
import type { DashboardDocument } from "@/modules/documents/dashboard";

type DashboardDocumentListProps = {
  documents: DashboardDocument[];
  organizationSlug?: string;
};

const dateFormatter = new Intl.DateTimeFormat("es-UY", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatStatusLabel(status: string) {
  const normalized = status.replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getStatusVariant(status: string) {
  switch (status) {
    case "approved":
    case "classified":
      return "status-pill status-pill--success";
    case "needs_review":
    case "classified_with_open_revision":
    case "draft_ready":
      return "status-pill status-pill--warning";
    case "error":
    case "rejected":
      return "status-pill status-pill--danger";
    default:
      return "status-pill status-pill--info";
  }
}

export function DashboardDocumentList({
  documents,
  organizationSlug,
}: DashboardDocumentListProps) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[760px]">
        <thead>
          <tr>
            <th>Documento</th>
            <th>Estado</th>
            <th>Subido</th>
            <th>Usuario</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td>
                <div className="font-semibold text-white">{document.originalFilename}</div>
                <div className="mt-1 text-xs text-[color:var(--color-muted)]">
                  Pipeline documental privado
                </div>
              </td>
              <td>
                <span className={getStatusVariant(document.status)}>
                  {formatStatusLabel(document.status)}
                </span>
              </td>
              <td className="text-[color:var(--color-muted)]">
                {dateFormatter.format(new Date(document.createdAt))}
              </td>
              <td className="text-[color:var(--color-muted)]">
                {document.uploadedByDisplay}
              </td>
              <td>
                {organizationSlug ? (
                  <Link
                    href={`/app/o/${organizationSlug}/documents/${document.id}`}
                    className="inline-flex rounded-[0.85rem] border border-[color:var(--color-border)] bg-[rgba(24,39,77,0.92)] px-3 py-2 text-xs font-semibold text-white transition hover:border-[rgba(124,157,255,0.22)] hover:bg-[rgba(30,47,91,0.96)]"
                  >
                    Abrir
                  </Link>
                ) : (
                  <span className="text-xs text-[color:var(--color-muted)]">Solo lectura</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
