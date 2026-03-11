import Link from "next/link";

type DashboardEmptyStateProps = {
  uploadHref: string;
};

export function DashboardEmptyState({
  uploadHref,
}: DashboardEmptyStateProps) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[color:var(--color-border)] bg-white/55 p-6">
      <p className="text-sm font-semibold">Todavia no hay documentos</p>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--color-muted)]">
        Este dashboard ya esta leyendo la organizacion real y puede mostrar la
        lista cuando existan cargas. El siguiente paso del flujo es subir el
        primer PDF, JPG o PNG para empezar la trazabilidad contable.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={uploadHref}
          className="rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
        >
          Subir primer documento
        </Link>
        <p className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-5 py-3 text-sm text-[color:var(--color-muted)]">
          Formatos esperados: PDF, JPG, PNG
        </p>
      </div>
    </div>
  );
}
