import type { ChartMapDocumentPath, ChartMapImpactView, ChartMapMode, ChartMapPageData } from "@/modules/accounting/chart-map/types";

type ChartInspectorProps = {
  mode: ChartMapMode;
  summary: ChartMapPageData["summary"];
  selectedAccount: ChartMapPageData["tree"]["selectedAccount"];
  impact: ChartMapImpactView | null;
  document: ChartMapDocumentPath | null;
};

export function ChartInspector({
  mode,
  summary,
  selectedAccount,
  impact,
  document,
}: ChartInspectorProps) {
  return (
    <>
      <section className="ui-panel">
        <div className="ui-panel-header">
          <h2 className="text-[16px] font-semibold text-white">Inspector</h2>
          <span className="ui-filter">{mode}</span>
        </div>

        {selectedAccount ? (
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4">
              <p className="font-semibold text-white">{selectedAccount.code} - {selectedAccount.name}</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {selectedAccount.accountType} / {selectedAccount.normalSide} / {selectedAccount.isPostable ? "Postable" : "Agrupadora"}
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4">
              <p className="font-semibold">Uso</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                Reglas activas: {selectedAccount.usage.directRuleCount}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Templates visibles: {selectedAccount.usage.templateCount}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Posteos ultimos 90 dias: {selectedAccount.usage.recentPostingCount}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Hijas directas: {selectedAccount.usage.childCount}
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4">
              <p className="font-semibold">Metadata</p>
              <p className="mt-2 text-[color:var(--color-muted)]">Padre: {selectedAccount.parentCode ?? "Raiz"}</p>
              <p className="mt-1 text-[color:var(--color-muted)]">externalCode: {selectedAccount.externalCode ?? "Pendiente"}</p>
              <p className="mt-1 text-[color:var(--color-muted)]">taxProfileHint: {selectedAccount.taxProfileHint ?? "Pendiente"}</p>
              <p className="mt-1 text-[color:var(--color-muted)]">currencyPolicy: {selectedAccount.currencyPolicy ?? "Pendiente"}</p>
              <p className="mt-1 text-[color:var(--color-muted)]">Origen: {selectedAccount.source ?? "No informado"}</p>
            </div>

            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4">
              <p className="font-semibold">Warnings</p>
              <div className="mt-3 space-y-2">
                {selectedAccount.warnings.length > 0 ? selectedAccount.warnings.map((warning) => (
                  <div key={`${warning.code}-${warning.message}`} className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-3 py-2 text-[color:var(--color-muted)]">
                    {warning.message}
                  </div>
                )) : (
                  <p className="text-[color:var(--color-muted)]">Sin warnings relevantes para esta cuenta.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-[color:var(--color-muted)]">
            Selecciona una cuenta para ver su uso y metadata.
          </div>
        )}
      </section>

      {impact ? (
        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Evento seleccionado</h2>
          </div>
          <div className="mt-4 text-sm text-[color:var(--color-muted)]">
            <p className="font-semibold text-white">{impact.selectedEvent.label}</p>
            <p className="mt-2">{impact.selectedEvent.description}</p>
            <p className="mt-2">
              Reglas: {impact.matchingRules.length} / Cuentas impactadas: {impact.impactedAccounts.length}
            </p>
          </div>
          {impact.warnings.length > 0 ? (
            <div className="mt-4 space-y-2 text-sm">
              {impact.warnings.map((warning) => (
                <div key={`${warning.code}-${warning.message}`} className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-3 py-2 text-[color:var(--color-muted)]">
                  {warning.message}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {document ? (
        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Documento seleccionado</h2>
          </div>
          <div className="mt-4 space-y-3 text-sm text-[color:var(--color-muted)]">
            <p className="font-semibold text-white">{document.label}</p>
            <p>Tipo: {document.documentType ?? "Sin tipo"}</p>
            <p>Operacion: {document.operationCategory ?? "Sin categoria"}</p>
            <p>Cuenta aplicada: {document.appliedRuleAccountLabel ?? "Pendiente"}</p>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-semibold">Ladder de precedencia</p>
            {document.precedenceLadder.map((entry) => (
              <div
                key={entry.code}
                className={`rounded-2xl border px-3 py-2 ${
                  entry.active
                    ? "border-[rgba(124,157,255,0.34)] bg-[rgba(124,157,255,0.08)] text-white"
                    : "border-[color:var(--color-border)] bg-white/70 text-[color:var(--color-muted)]"
                }`}
              >
                {entry.label}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ui-panel">
        <div className="ui-panel-header">
          <h2 className="text-[16px] font-semibold text-white">Resumen</h2>
        </div>
        <div className="mt-4 space-y-2 text-sm text-[color:var(--color-muted)]">
          <p>Cuentas activas: {summary.accountCount}</p>
          <p>Postables: {summary.postableCount}</p>
          <p>Provisionales: {summary.provisionalCount}</p>
          <p>Sin externalCode: {summary.missingExternalCodeCount}</p>
          <p>Reglas activas: {summary.activeRuleCount}</p>
          <p>Eventos visibles: {summary.eventCount}</p>
        </div>
      </section>
    </>
  );
}
