import { LoadingLink } from "@/components/ui/loading-link";
import type {
  AccountingRulesAdminFilters,
  AccountingRulesAdminListItem,
  AccountingRulesAdminStatusFilter,
} from "@/modules/accounting/rules-admin";
import {
  formatAccountingRuleCreatedFromLabel,
  formatLifecycleStatusLabel,
  formatRuleScopeLabel,
} from "@/modules/presentation/labels";

type AccountingRulesTableProps = {
  slug: string;
  filters: AccountingRulesAdminFilters;
  rules: AccountingRulesAdminListItem[];
  selectedRuleId: string | null;
};

const statusTabs: Array<{
  value: AccountingRulesAdminStatusFilter;
  label: string;
}> = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Activas" },
  { value: "paused", label: "Pausadas" },
  { value: "superseded", label: "Reemplazadas" },
  { value: "draft", label: "Draft" },
];

function buildRulesAdminHref(
  slug: string,
  input: {
    ruleId?: string | null;
    q?: string | null;
    status?: string | null;
    scope?: string | null;
    source?: string | null;
  },
) {
  const params = new URLSearchParams();

  if (input.ruleId) {
    params.set("rule", input.ruleId);
  }

  if (input.q) {
    params.set("q", input.q);
  }

  if (input.status && input.status !== "all") {
    params.set("status", input.status);
  }

  if (input.scope && input.scope !== "all") {
    params.set("scope", input.scope);
  }

  if (input.source && input.source !== "all") {
    params.set("source", input.source);
  }

  const query = params.toString();
  return `/app/o/${slug}/settings/accounting-rules${query ? `?${query}` : ""}`;
}

function getRuleStatusChrome(status: AccountingRulesAdminListItem["lifecycleStatus"]) {
  switch (status) {
    case "active":
      return "border-emerald-300/35 bg-emerald-500/10 text-emerald-100";
    case "paused":
      return "border-amber-300/35 bg-amber-500/10 text-amber-100";
    case "superseded":
      return "border-slate-300/25 bg-slate-500/10 text-slate-100";
    case "draft":
      return "border-sky-300/35 bg-sky-500/10 text-sky-100";
    default:
      return "border-[color:var(--color-border)] bg-white/10 text-[color:var(--color-muted)]";
  }
}

export function AccountingRulesTable({
  slug,
  filters,
  rules,
  selectedRuleId,
}: AccountingRulesTableProps) {
  return (
    <section className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h1 className="text-[20px] font-semibold text-white">Reglas contables</h1>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Vista consolidada para gobernar criterios reusables, revisar alcance y pausar sin borrar historia.
          </p>
        </div>
        <span className="ui-filter">{rules.length} visible(s)</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {statusTabs.map((tab) => {
          const isCurrent = filters.status === tab.value;

          return (
            <LoadingLink
              key={tab.value}
              href={buildRulesAdminHref(slug, {
                q: filters.search,
                status: tab.value,
                scope: filters.scope,
                source: filters.source,
              })}
              pendingLabel="Filtrando..."
              className={isCurrent ? "ui-button ui-button--primary" : "ui-button ui-button--secondary"}
            >
              {tab.label}
            </LoadingLink>
          );
        })}
      </div>

      <form method="get" className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,0.6fr))_auto]">
        <input
          type="text"
          name="q"
          defaultValue={filters.search}
          placeholder="Buscar por proveedor, concepto, cuenta o scope"
          className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm text-slate-900"
        />
        <select
          name="status"
          defaultValue={filters.status}
          className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm text-slate-900"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="paused">Pausadas</option>
          <option value="superseded">Reemplazadas</option>
          <option value="draft">Draft</option>
        </select>
        <select
          name="scope"
          defaultValue={filters.scope}
          className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm text-slate-900"
        >
          <option value="all">Todos los scopes</option>
          <option value="document_override">Document override</option>
          <option value="vendor_concept_operation_category">Vendor + concept + op</option>
          <option value="vendor_concept">Vendor + concept</option>
          <option value="concept_global">Concept global</option>
          <option value="vendor_default">Vendor default</option>
        </select>
        <select
          name="source"
          defaultValue={filters.source}
          className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm text-slate-900"
        >
          <option value="all">Todos los origenes</option>
          <option value="manual">Manual</option>
          <option value="learning">Aprendidas</option>
          <option value="imported">Importadas</option>
          <option value="migrated">Migradas</option>
        </select>
        <button type="submit" className="ui-button ui-button--secondary">
          Aplicar
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/6 p-6 text-sm text-[color:var(--color-muted)]">
            No encontramos reglas para este filtro. Ajusta texto, estado o scope para ampliar la vista.
          </div>
        ) : (
          rules.map((rule) => {
            const isSelected = selectedRuleId === rule.id;

            return (
              <LoadingLink
                key={rule.id}
                href={buildRulesAdminHref(slug, {
                  ruleId: rule.id,
                  q: filters.search,
                  status: filters.status,
                  scope: filters.scope,
                  source: filters.source,
                })}
                pendingLabel="Abriendo regla..."
                className={`block rounded-2xl border p-4 transition ${
                  isSelected
                    ? "border-[rgba(124,157,255,0.34)] bg-[rgba(124,157,255,0.08)]"
                    : "border-[color:var(--color-border)] bg-white/6 hover:bg-white/10"
                }`.trim()}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{rule.name}</p>
                    <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                      {formatRuleScopeLabel(rule.scope)} · {rule.accountLabel ?? "Sin cuenta"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getRuleStatusChrome(rule.lifecycleStatus)}`}
                  >
                    {formatLifecycleStatusLabel(rule.lifecycleStatus)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="ui-filter">Prioridad {rule.priority}</span>
                  <span className="ui-filter">v{rule.versionNumber}</span>
                  <span className="ui-filter">
                    {formatAccountingRuleCreatedFromLabel(rule.createdFrom ?? rule.source)}
                  </span>
                  {rule.sourceDocumentLabel ? (
                    <span className="ui-filter">{rule.sourceDocumentLabel}</span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2 text-[13px] text-[color:var(--color-muted)]">
                  <p>{rule.conditionSummary.slice(0, 3).join(" · ")}</p>
                  <p>{rule.resultSummary.slice(0, 3).join(" · ")}</p>
                </div>

                <div className="mt-3 grid gap-2 text-[12px] text-[color:var(--color-muted)] md:grid-cols-3">
                  <div className="ui-subtle-row">
                    <span>Aplicaciones</span>
                    <span>{rule.documentsAppliedCount}</span>
                  </div>
                  <div className="ui-subtle-row">
                    <span>Matches</span>
                    <span>{rule.matchesCount}</span>
                  </div>
                  <div className="ui-subtle-row">
                    <span>Ultimo cambio</span>
                    <span>{rule.lastEditedAt?.slice(0, 10) ?? "Sin dato"}</span>
                  </div>
                </div>
              </LoadingLink>
            );
          })
        )}
      </div>
    </section>
  );
}
