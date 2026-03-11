import type { DashboardDocument } from "@/modules/documents/dashboard";

type DashboardDocumentListProps = {
  documents: DashboardDocument[];
};

const dateFormatter = new Intl.DateTimeFormat("es-UY", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatStatusLabel(status: string) {
  const normalized = status.replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getStatusClasses(status: string) {
  switch (status) {
    case "uploading":
      return "bg-sky-100 text-sky-900";
    case "approved":
      return "bg-emerald-100 text-emerald-900";
    case "needs_review":
    case "classified":
      return "bg-amber-100 text-amber-900";
    case "rejected":
    case "error":
      return "bg-rose-100 text-rose-900";
    default:
      return "bg-slate-100 text-slate-900";
  }
}

export function DashboardDocumentList({
  documents,
}: DashboardDocumentListProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-3">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            <th className="pb-1 pr-4 font-medium">Archivo</th>
            <th className="pb-1 pr-4 font-medium">Estado</th>
            <th className="pb-1 pr-4 font-medium">Subido</th>
            <th className="pb-1 font-medium">Usuario</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id} className="align-top">
              <td className="rounded-l-2xl border border-r-0 border-[color:var(--color-border)] bg-white/70 px-4 py-4 text-sm font-medium">
                {document.originalFilename}
              </td>
              <td className="border-y border-[color:var(--color-border)] bg-white/70 px-4 py-4 text-sm">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(document.status)}`}
                >
                  {formatStatusLabel(document.status)}
                </span>
              </td>
              <td className="border-y border-[color:var(--color-border)] bg-white/70 px-4 py-4 text-sm text-[color:var(--color-muted)]">
                {dateFormatter.format(new Date(document.createdAt))}
              </td>
              <td className="rounded-r-2xl border border-l-0 border-[color:var(--color-border)] bg-white/70 px-4 py-4 text-sm text-[color:var(--color-muted)]">
                {document.uploadedByDisplay}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
