import { LoadingLink } from "@/components/ui/loading-link";
import { buildRulesAdminHref } from "@/components/rules/accounting-rules-href";
import type {
  AccountingRulesAdminFilterOptions,
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
  filterOptions: AccountingRulesAdminFilterOptions;
  metrics: {
    total: number;
    active: number;
    paused: number;
    superseded: number;
    createdFromLearning: number;
  };
  rules: AccountingRulesAdminListItem[];
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

function formatDate(value: string | null) {
  if (!value) {
    return "Sin uso";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function countActiveFilters(filters: AccountingRulesAdminFilters) {
  let count = 0;

  if (filters.search) {
    count += 1;
  }

  if (filters.scope !== "all") {
    count += 1;
  }

  if (filters.source !== "all") {
    count += 1;
  }

  if (filters.vendorId !== "all") {
    count += 1;
  }

  if (filters.accountId !== "all") {
    count += 1;
  }

  if (filters.operationCategory !== "all") {
    count += 1;
  }

  if (filters.onlyWithConflicts) {
    count += 1;
  }

  if (filters.onlyUnused) {
    count += 1;
  }

  return count;
}

export function AccountingRulesTable({
  slug,
  filters,
  filterOptions,
  metrics,
  rules,
}: AccountingRulesTableProps) {
  const activeFilterCount = countActiveFilters(filters);

  return (
    <section className="space-y-4">
      <article className="ui-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-[24px] font-semibold tracking-[-0.04em] text-white">Reglas contables</h1>
            <p className="mt-2 text-[14px] leading-6 text-[color:var(--color-muted)]">
              Administra reglas reutilizables con prioridad, lifecycle y trazabilidad visible sin mezclar en la home
              edición, auditoría y chat consultivo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-filter">{rules.length} visibles</span>
            <LoadingLink
              href={buildRulesAdminHref(slug, {
                mode: "new",
                filters,
              })}
              pendingLabel="Abriendo editor..."
              className="ui-button ui-button--primary"
            >
              Nueva regla
            </LoadingLink>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">Totales</p>
            <p className="mt-2 text-xl font-semibold text-white">{metrics.total}</p>
            <p className="mt-1 text-sm text-[color:var(--color-muted)]">Inventario visible de reglas.</p>
          </article>
          <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">Activas</p>
            <p className="mt-2 text-xl font-semibold text-white">{metrics.active}</p>
            <p className="mt-1 text-sm text-[color:var(--color-muted)]">Compiten en nuevas corridas.</p>
          </article>
          <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">Pausadas</p>
            <p className="mt-2 text-xl font-semibold text-white">{metrics.paused}</p>
            <p className="mt-1 text-sm text-[color:var(--color-muted)]">Fuera de carrera sin borrar historia.</p>
          </article>
          <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">Desde learning</p>
            <p className="mt-2 text-xl font-semibold text-white">{metrics.createdFromLearning}</p>
            <p className="mt-1 text-sm text-[color:var(--color-muted)]">Aprobadas desde revisión documental.</p>
          </article>
        </div>
      </article>

      <article className="ui-panel">
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => {
            const isCurrent = filters.status === tab.value;

            return (
              <LoadingLink
                key={tab.value}
                href={buildRulesAdminHref(slug, {
                  mode: "list",
                  filters: {
                    ...filters,
                    status: tab.value,
                  },
                })}
                pendingLabel="Filtrando..."
                className={isCurrent ? "ui-button ui-button--primary" : "ui-button ui-button--secondary"}
              >
                {tab.label}
              </LoadingLink>
            );
          })}
        </div>

        <form method="get" className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <input
              type="text"
              name="q"
              defaultValue={filters.search}
              placeholder="Buscar por nombre, proveedor, cuenta, concepto u origen"
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900"
            />
            <select
              name="status"
              defaultValue={filters.status}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="paused">Pausadas</option>
              <option value="superseded">Reemplazadas</option>
              <option value="draft">Draft</option>
            </select>
            <button type="submit" className="ui-button ui-button--secondary">
              Aplicar
            </button>
          </div>

          <details
            open={activeFilterCount > 0}
            className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 px-4 py-3"
          >
            <summary className="cursor-pointer text-sm font-semibold text-white">
              Filtros avanzados {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
            </summary>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <select
                name="scope"
                defaultValue={filters.scope}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900"
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
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900"
              >
                <option value="all">Todos los origenes</option>
                <option value="manual">Manual</option>
                <option value="learning">Aprendidas</option>
                <option value="imported">Importadas</option>
                <option value="migrated">Migradas</option>
              </select>
              <select
                name="vendorId"
                defaultValue={filters.vendorId}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900"
              >
                <option value="all">Todos los proveedores</option>
                {filterOptions.vendors.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                name="accountId"
                defaultValue={filters.accountId}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900"
              >
                <option value="all">Todas las cuentas</option>
                {filterOptions.accounts.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                name="operationCategory"
                defaultValue={filters.operationCategory}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900"
              >
                <option value="all">Todas las categorias</option>
                {filterOptions.operationCategories.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-white/10 px-4 py-3 text-sm text-[color:var(--color-muted)]">
                  <input type="checkbox" name="conflicts" value="1" defaultChecked={filters.onlyWithConflicts} />
                  Solo con conflictos
                </label>
                <label className="flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-white/10 px-4 py-3 text-sm text-[color:var(--color-muted)]">
                  <input type="checkbox" name="unused" value="1" defaultChecked={filters.onlyUnused} />
                  Solo unused
                </label>
              </div>
            </div>
          </details>
        </form>
      </article>

      <article className="ui-panel overflow-hidden p-0">
        <div className="ui-panel-header border-b border-[color:var(--color-border)] px-4 py-3">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Listado operativo</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Entra a una regla para ver detalle, impacto, conflictos, auditoría o abrir análisis IA contextual.
            </p>
          </div>
          <span className="ui-filter">{rules.length} fila(s)</span>
        </div>

        {rules.length === 0 ? (
          <div className="p-6 text-sm text-[color:var(--color-muted)]">
            No encontramos reglas para este filtro. Ajusta texto, proveedor, estado o conflictos para ampliar la vista.
          </div>
        ) : (
          <>
            <div className="md:hidden">
              <div className="space-y-3 p-4">
                {rules.map((rule) => (
                  <LoadingLink
                    key={rule.id}
                    href={buildRulesAdminHref(slug, {
                      mode: "detail",
                      ruleId: rule.id,
                      filters,
                    })}
                    pendingLabel="Abriendo regla..."
                    className="block rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{rule.name}</p>
                        <p className="mt-1 truncate text-xs text-[color:var(--color-muted)]">
                          {rule.accountLabel ?? "Sin cuenta"}
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
                      {rule.conflictCount > 0 ? (
                        <span className="ui-filter text-amber-200">Conflictos {rule.conflictCount}</span>
                      ) : null}
                    </div>
                  </LoadingLink>
                ))}
              </div>
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="data-table min-w-[1120px]">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Scope</th>
                    <th>Cuenta destino</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                    <th>Ultimo uso</th>
                    <th>Conflictos</th>
                    <th>Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <div className="min-w-[220px]">
                          <LoadingLink
                            href={buildRulesAdminHref(slug, {
                              mode: "detail",
                              ruleId: rule.id,
                              filters,
                            })}
                            pendingLabel="Abriendo regla..."
                            className="text-sm font-semibold text-white underline-offset-4 hover:underline"
                          >
                            {rule.name}
                          </LoadingLink>
                          <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                            v{rule.versionNumber} / {rule.vendorName ?? rule.conceptName ?? "Scope reusable"}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className="text-sm text-[color:var(--color-muted)]">
                          {formatRuleScopeLabel(rule.scope)}
                        </span>
                      </td>
                      <td>
                        <div className="text-sm text-white">{rule.accountLabel ?? "Sin cuenta"}</div>
                        {rule.resultSummary[1] ? (
                          <p className="mt-1 text-xs text-[color:var(--color-muted)]">{rule.resultSummary[1]}</p>
                        ) : null}
                      </td>
                      <td>
                        <span className="ui-filter">#{rule.priority}</span>
                      </td>
                      <td>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getRuleStatusChrome(rule.lifecycleStatus)}`}
                        >
                          {formatLifecycleStatusLabel(rule.lifecycleStatus)}
                        </span>
                      </td>
                      <td>
                        <div className="text-sm text-[color:var(--color-muted)]">{formatDate(rule.lastMatchedAt)}</div>
                        <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                          {rule.documentsAppliedCount} doc / {rule.matchesCount} match
                        </p>
                      </td>
                      <td>
                        {rule.conflictCount > 0 ? (
                          <LoadingLink
                            href={buildRulesAdminHref(slug, {
                              mode: "detail",
                              ruleId: rule.id,
                              tab: "conflicts",
                              filters,
                            })}
                            pendingLabel="Abriendo conflictos..."
                            className="text-sm text-amber-100 underline-offset-4 hover:underline"
                          >
                            {rule.conflictCount} competidora(s)
                          </LoadingLink>
                        ) : (
                          <span className="text-sm text-[color:var(--color-muted)]">Sin conflicto visible</span>
                        )}
                      </td>
                      <td>
                        <div className="text-sm text-[color:var(--color-muted)]">
                          {formatAccountingRuleCreatedFromLabel(rule.createdFrom ?? rule.source)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </article>
    </section>
  );
}
