import { buttonBaseClassName, buttonSecondaryChromeClassName } from "@/components/ui/button-styles";
import { LoadingLink } from "@/components/ui/loading-link";
import type { ChartMapFilter, ChartMapMode } from "@/modules/accounting/chart-map/types";

type ChartMapToolbarProps = {
  organizationSlug: string;
  mode: ChartMapMode;
  selectedEventId: string | null;
  selectedAccountId: string | null;
  documentId: string | null;
  searchTerm: string;
  filter: ChartMapFilter;
};

function buildChartMapHref(input: {
  organizationSlug: string;
  mode: ChartMapMode;
  selectedEventId?: string | null;
  selectedAccountId?: string | null;
  documentId?: string | null;
  searchTerm?: string | null;
  filter?: ChartMapFilter | null;
}) {
  const query = new URLSearchParams();
  query.set("mode", input.mode);

  if (input.selectedEventId) {
    query.set("eventId", input.selectedEventId);
  }

  if (input.selectedAccountId) {
    query.set("accountId", input.selectedAccountId);
  }

  if (input.documentId) {
    query.set("documentId", input.documentId);
  }

  if (input.searchTerm) {
    query.set("search", input.searchTerm);
  }

  if (input.filter && input.filter !== "all") {
    query.set("filter", input.filter);
  }

  return `/app/o/${input.organizationSlug}/chart-map?${query.toString()}`;
}

export function ChartMapToolbar({
  organizationSlug,
  mode,
  selectedEventId,
  selectedAccountId,
  documentId,
  searchTerm,
  filter,
}: ChartMapToolbarProps) {
  const modes: Array<{ id: ChartMapMode; label: string }> = [
    { id: "impact", label: "Impacto" },
    { id: "tree", label: "Arbol" },
    { id: "document", label: "Documento" },
  ];

  return (
    <section className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Vista coordinada</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Alterna entre estructura, impacto y documento real sin salir del contexto contable.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {modes.map((entry) => {
          const href = buildChartMapHref({
            organizationSlug,
            mode: entry.id,
            selectedEventId,
            selectedAccountId,
            documentId,
            searchTerm,
            filter,
          });

          if (entry.id === mode) {
            return (
              <span
                key={entry.id}
                className="rounded-full bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                {entry.label}
              </span>
            );
          }

          return (
            <LoadingLink
              key={entry.id}
              href={href}
              pendingLabel="Abriendo vista..."
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
            >
              {entry.label}
            </LoadingLink>
          );
        })}
      </div>

      <form className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <input type="hidden" name="mode" value={mode} />
        {selectedEventId ? <input type="hidden" name="eventId" value={selectedEventId} /> : null}
        {selectedAccountId ? <input type="hidden" name="accountId" value={selectedAccountId} /> : null}
        {documentId ? <input type="hidden" name="documentId" value={documentId} /> : null}
        <input
          type="search"
          name="search"
          defaultValue={searchTerm}
          placeholder="Buscar por codigo, nombre, externalCode o taxProfileHint"
          className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
        />
        <select
          name="filter"
          defaultValue={filter}
          className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
        >
          <option value="all">Todas</option>
          <option value="impacted">Solo impactadas</option>
          <option value="provisional">Solo provisionales</option>
          <option value="missing_external_code">Sin externalCode</option>
          <option value="warnings">Con warnings</option>
        </select>
        <button
          type="submit"
          className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
        >
          Aplicar filtros
        </button>
      </form>
    </section>
  );
}
