type ReadModelUnavailablePanelProps = {
  title: string;
  migrationHint?: string;
};

export function ReadModelUnavailablePanel({
  title,
  migrationHint = "20260318_doc013_accounting_read_models.sql",
}: ReadModelUnavailablePanelProps) {
  return (
    <section className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">{title}</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Esta vista todavia no esta disponible en la base conectada. El front queda estable, pero falta aplicar el read model SQL del kernel.
          </p>
        </div>
        <span className="status-pill status-pill--warning">Schema pendiente</span>
      </div>

      <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm text-[color:var(--color-muted)]">
        Corre la migracion <code>{migrationHint}</code> y refresca esta pantalla.
      </div>
    </section>
  );
}
