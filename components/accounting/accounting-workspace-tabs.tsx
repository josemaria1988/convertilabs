import { LoadingLink } from "@/components/ui/loading-link";

type AccountingWorkspaceTabsProps = {
  organizationSlug: string;
  current: "trial-balance" | "journal-entries" | "open-items";
};

const tabs = [
  {
    key: "trial-balance",
    href: (slug: string) => `/app/o/${slug}/trial-balance`,
    label: "Balance",
    description: "Comprobacion y mayor",
  },
  {
    key: "journal-entries",
    href: (slug: string) => `/app/o/${slug}/journal-entries`,
    label: "Diario",
    description: "Libro y linaje",
  },
  {
    key: "open-items",
    href: (slug: string) => `/app/o/${slug}/open-items`,
    label: "Open items",
    description: "CxC y CxP vivas",
  },
] as const;

export function AccountingWorkspaceTabs({
  organizationSlug,
  current,
}: AccountingWorkspaceTabsProps) {
  return (
    <section className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Inspeccion contable</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Superficies read-only del kernel para revisar balance, diario y partidas vivas sin depender del workflow documental.
          </p>
        </div>
        <span className="ui-filter">Kernel</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {tabs.map((tab) => {
          const isCurrent = tab.key === current;

          if (isCurrent) {
            return (
              <div
                key={tab.key}
                className="rounded-2xl border border-[color:var(--color-border)] bg-[rgba(94,130,184,0.16)] px-4 py-4"
              >
                <p className="text-sm font-semibold text-white">{tab.label}</p>
                <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">{tab.description}</p>
              </div>
            );
          }

          return (
            <LoadingLink
              key={tab.key}
              href={tab.href(organizationSlug)}
              pendingLabel="Abriendo..."
              className="block rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-4 transition hover:bg-white/85"
            >
              <p className="text-sm font-semibold text-white">{tab.label}</p>
              <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">{tab.description}</p>
            </LoadingLink>
          );
        })}
      </div>
    </section>
  );
}
