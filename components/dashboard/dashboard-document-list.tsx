import Link from "next/link";
import type { DashboardDocument } from "@/modules/documents/dashboard";
import {
  formatDocumentStatusLabel,
  getDocumentStatusVariant,
} from "@/modules/documents/status";

type DashboardDocumentListProps = {
  documents: DashboardDocument[];
  organizationSlug?: string;
};

const dateFormatter = new Intl.DateTimeFormat("es-UY", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
                <span className={getDocumentStatusVariant(document.status)}>
                  {formatDocumentStatusLabel(document.status)}
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
