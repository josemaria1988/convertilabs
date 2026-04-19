export function ZetaSoftwareRunHistory() {
  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4">
      <div>
        <p className="text-base font-semibold">Historial de corridas</p>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Las corridas de integracion apareceran aca cuando PR-04 active el runner.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/50 px-4 py-6 text-sm text-[color:var(--color-muted)]">
        Todavia no hay corridas Zetasoftware para esta organizacion.
      </div>
    </div>
  );
}
