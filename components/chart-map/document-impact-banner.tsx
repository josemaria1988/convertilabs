import type { ChartMapDocumentPath } from "@/modules/accounting/chart-map/types";

type DocumentImpactBannerProps = {
  document: ChartMapDocumentPath;
};

export function DocumentImpactBanner({ document }: DocumentImpactBannerProps) {
  return (
    <section className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Documento real</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Camino exacto que siguio el documento dentro del motor contable actual.
          </p>
        </div>
        <span className="ui-filter">{document.direction}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
          <p className="font-semibold">Documento</p>
          <p className="mt-2 text-[color:var(--color-muted)]">{document.label}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
          <p className="font-semibold">Regla ganadora</p>
          <p className="mt-2 text-[color:var(--color-muted)]">{document.appliedRuleScope}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
          <p className="font-semibold">Template</p>
          <p className="mt-2 text-[color:var(--color-muted)]">{document.templateCode ?? "Sin template explicito"}</p>
        </div>
      </div>
    </section>
  );
}
