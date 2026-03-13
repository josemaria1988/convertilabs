import Link from "next/link";

type DashboardEmptyStateProps = {
  uploadHref: string;
};

export function DashboardEmptyState({
  uploadHref,
}: DashboardEmptyStateProps) {
  return (
    <div className="rounded-[1.2rem] border border-dashed border-[color:var(--color-border)] bg-[rgba(16,27,55,0.52)] p-6">
      <p className="text-lg font-semibold tracking-[-0.03em] text-white">
        Todavia no hay documentos cargados
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--color-muted)]">
        La bandeja ya esta enlazada al tenant real. Sube el primer PDF, JPG o PNG
        para habilitar intake, draft persistido, sugerencia contable y trazabilidad de IVA.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={uploadHref}
          className="inline-flex rounded-[0.95rem] border border-[rgba(124,157,255,0.22)] bg-[linear-gradient(180deg,rgba(104,143,255,0.95),rgba(72,115,235,0.95))] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Cargar primer documento
        </Link>
        <p className="inline-flex rounded-[0.95rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.82)] px-5 py-3 text-sm text-[color:var(--color-muted)]">
          Formatos soportados: PDF, JPG, PNG
        </p>
      </div>
    </div>
  );
}
