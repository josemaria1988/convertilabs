import { LoadingLink } from "@/components/ui/loading-link";
import type { ChartMapFilter, ChartMapMode, ChartMapTreeNode } from "@/modules/accounting/chart-map/types";

type ChartTreePanelProps = {
  organizationSlug: string;
  mode: ChartMapMode;
  selectedEventId: string | null;
  selectedAccountId: string | null;
  documentId: string | null;
  searchTerm: string;
  filter: ChartMapFilter;
  nodes: ChartMapTreeNode[];
};

function buildAccountHref(input: {
  organizationSlug: string;
  mode: ChartMapMode;
  selectedEventId?: string | null;
  selectedAccountId: string;
  documentId?: string | null;
  searchTerm?: string | null;
  filter?: ChartMapFilter | null;
}) {
  const query = new URLSearchParams();
  query.set("mode", input.mode);
  query.set("accountId", input.selectedAccountId);

  if (input.selectedEventId) {
    query.set("eventId", input.selectedEventId);
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

function renderNode(input: {
  organizationSlug: string;
  mode: ChartMapMode;
  selectedEventId: string | null;
  selectedAccountId: string | null;
  documentId: string | null;
  searchTerm: string;
  filter: ChartMapFilter;
  node: ChartMapTreeNode;
}) {
  const { node } = input;
  const href = buildAccountHref({
    organizationSlug: input.organizationSlug,
    mode: input.mode,
    selectedEventId: input.selectedEventId,
    selectedAccountId: node.id,
    documentId: input.documentId,
    searchTerm: input.searchTerm,
    filter: input.filter,
  });
  const badges = [
    node.isProvisional ? "Provisional" : null,
    !node.externalCode && node.isPostable ? "Sin externalCode" : null,
    node.highlighted ? "Impactada" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div key={node.id} className={node.depth > 0 ? "ml-4 border-l border-[color:var(--color-border)] pl-4" : ""}>
      <LoadingLink
        href={href}
        pendingLabel="Abriendo cuenta..."
        className={`block rounded-2xl border px-4 py-3 transition ${
          input.selectedAccountId === node.id
            ? "border-[rgba(124,157,255,0.34)] bg-[rgba(124,157,255,0.08)]"
            : node.highlighted
              ? "border-emerald-400/40 bg-emerald-400/10"
              : "border-[color:var(--color-border)] bg-white/70"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">
              {node.code} - {node.name}
            </p>
            <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
              {node.accountType} / {node.normalSide} / {node.isPostable ? "Postable" : "Agrupadora"}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-[color:var(--color-border)] px-2 py-1"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </LoadingLink>

      {node.children.length > 0 ? (
        <div className="mt-3 space-y-3">
          {node.children.map((child) => renderNode({
            ...input,
            node: child,
          }))}
        </div>
      ) : null}
    </div>
  );
}

export function ChartTreePanel(props: ChartTreePanelProps) {
  return (
    <section className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Arbol del plan</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Jerarquia viva del plan de cuentas con resaltado cruzado desde impacto o documento.
          </p>
        </div>
        <span className="ui-filter">{props.nodes.length} raiz(es)</span>
      </div>

      <div className="mt-4 space-y-3">
        {props.nodes.length > 0 ? props.nodes.map((node) => renderNode({
          ...props,
          node,
        })) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-8 text-sm text-[color:var(--color-muted)]">
            No hay cuentas visibles con los filtros actuales.
          </div>
        )}
      </div>
    </section>
  );
}
