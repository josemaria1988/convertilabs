import type { Metadata } from "next";
import { AccountingWorkspaceTabs } from "@/components/accounting/accounting-workspace-tabs";
import { ReadModelUnavailablePanel } from "@/components/accounting/read-model-unavailable-panel";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  formatAccountingAmount,
  formatAccountingDate,
  getLifecycleStatusPillClass,
} from "@/modules/accounting/read-model-presenters";
import { loadOpenItemsWorkspaceData } from "@/modules/accounting/read-model-repository";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  formatCounterpartyTypeLabel,
  formatDocumentRoleLabel,
  formatLifecycleStatusLabel,
  formatSourceChannelLabel,
} from "@/modules/presentation/labels";

type OrganizationOpenItemsPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    status?: string;
    source?: string;
    counterparty?: string;
    q?: string;
    due?: string;
    item?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Open items",
};

function buildPageHref(
  slug: string,
  search: {
    status?: string | null;
    source?: string | null;
    counterparty?: string | null;
    q?: string | null;
    due?: string | null;
    item?: string | null;
  },
) {
  const params = new URLSearchParams();

  if (search.status) {
    params.set("status", search.status);
  }

  if (search.source) {
    params.set("source", search.source);
  }

  if (search.counterparty) {
    params.set("counterparty", search.counterparty);
  }

  if (search.q) {
    params.set("q", search.q);
  }

  if (search.due) {
    params.set("due", search.due);
  }

  if (search.item) {
    params.set("item", search.item);
  }

  const query = params.toString();
  return `/app/o/${slug}/open-items${query ? `?${query}` : ""}`;
}

export default async function OrganizationOpenItemsPage({
  params,
  searchParams,
}: OrganizationOpenItemsPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const data = await loadOpenItemsWorkspaceData(supabase, {
    organizationId: organization.id,
    status: resolvedSearchParams.status ?? null,
    sourceChannel: resolvedSearchParams.source ?? null,
    counterpartyType: resolvedSearchParams.counterparty ?? null,
    searchTerm: resolvedSearchParams.q ?? null,
    overdueOnly: resolvedSearchParams.due === "overdue",
  });
  const selectedItem = data.rows.find((row) => row.openItemId === resolvedSearchParams.item) ?? data.rows[0] ?? null;

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Open items"
      toolbarLabel="Open items"
      description="Partidas vivas del ledger para cuentas a cobrar, cuentas a pagar y saldos residuales sin depender del estado del documento."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "accounting")}
    >
      <div className="space-y-4">
        <AccountingWorkspaceTabs organizationSlug={organization.slug} current="open-items" />

        {!data.isAvailable ? (
          <ReadModelUnavailablePanel title="Open items no disponible" />
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-4">
              <article className="metric-card">
                <span className="metric-card__label">Partidas visibles</span>
                <span className="metric-card__value">{data.summary.totalItems}</span>
                <p className="metric-card__hint">Items con saldo vivo dentro del filtro actual.</p>
              </article>
              <article className="metric-card">
                <span className="metric-card__label">Saldo pendiente</span>
                <span className="metric-card__value">{formatAccountingAmount(data.summary.outstandingAmount)}</span>
                <p className="metric-card__hint">Saldo acumulado pendiente sobre el set actual.</p>
              </article>
              <article className="metric-card">
                <span className="metric-card__label">Vencidos</span>
                <span className="metric-card__value">{data.summary.overdueCount}</span>
                <p className="metric-card__hint">Items con vencimiento anterior a hoy.</p>
              </article>
              <article className="metric-card">
                <span className="metric-card__label">Residual / FX</span>
                <span className="metric-card__value">
                  {data.summary.residualCreditCount} / {data.summary.foreignCurrencyCount}
                </span>
                <p className="metric-card__hint">Creditos residuales y partidas en moneda distinta.</p>
              </article>
            </section>

            <section className="ui-panel">
              <div className="ui-panel-header">
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Filtros de partidas</h2>
                  <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                    Acota por estado, fuente y contraparte para revisar saldos pendientes y vencimientos.
                  </p>
                </div>
                <span className="ui-filter">Subledger</span>
              </div>

              <form className="mt-4 grid gap-3 lg:grid-cols-[170px_170px_170px_minmax(0,1fr)_140px_120px]">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Estado</span>
                  <select
                    name="status"
                    defaultValue={resolvedSearchParams.status ?? ""}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  >
                    <option value="">Todos</option>
                    {data.filterOptions.statuses.map((status) => (
                      <option key={status} value={status}>{formatLifecycleStatusLabel(status)}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Fuente</span>
                  <select
                    name="source"
                    defaultValue={resolvedSearchParams.source ?? ""}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  >
                    <option value="">Todas</option>
                    {data.filterOptions.sourceChannels.map((sourceChannel) => (
                      <option key={sourceChannel} value={sourceChannel}>
                        {formatSourceChannelLabel(sourceChannel)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Contraparte</span>
                  <select
                    name="counterparty"
                    defaultValue={resolvedSearchParams.counterparty ?? ""}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  >
                    <option value="">Todas</option>
                    {data.filterOptions.counterpartyTypes.map((counterpartyType) => (
                      <option key={counterpartyType} value={counterpartyType}>
                        {formatCounterpartyTypeLabel(counterpartyType)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Buscar</span>
                  <input
                    name="q"
                    defaultValue={resolvedSearchParams.q ?? ""}
                    placeholder="Razon social, RUT o tipo"
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Vencimiento</span>
                  <select
                    name="due"
                    defaultValue={resolvedSearchParams.due ?? ""}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="overdue">Solo vencidos</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <SubmitButton formMethod="get" pendingLabel="Actualizando..." className="ui-button ui-button--secondary w-full">
                    Filtrar
                  </SubmitButton>
                </div>
              </form>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="ui-panel overflow-hidden p-0">
                <div className="ui-panel-header border-b border-[color:var(--color-border)] px-4 py-3">
                  <div>
                    <h2 className="text-[16px] font-semibold text-white">Partidas pendientes</h2>
                    <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                      Selecciona una partida para revisar su asiento de apertura y su saldo vivo.
                    </p>
                  </div>
                  <span className="ui-filter">{data.rows.length}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table min-w-[1050px]">
                    <thead>
                      <tr>
                        <th>Contraparte</th>
                        <th>Rol</th>
                        <th>Emision</th>
                        <th>Vencimiento</th>
                        <th>Fuente</th>
                        <th>Estado</th>
                        <th className="text-right">Saldo</th>
                        <th className="text-right">Settlements</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-sm text-[color:var(--color-muted)]">
                            No hay partidas abiertas para este filtro.
                          </td>
                        </tr>
                      ) : (
                        data.rows.map((row) => {
                          const isSelected = selectedItem?.openItemId === row.openItemId;

                          return (
                            <tr key={row.openItemId} data-selected={isSelected ? "true" : undefined}>
                              <td>
                                <LoadingLink
                                  href={buildPageHref(organization.slug, {
                                    status: resolvedSearchParams.status ?? null,
                                    source: resolvedSearchParams.source ?? null,
                                    counterparty: resolvedSearchParams.counterparty ?? null,
                                    q: resolvedSearchParams.q ?? null,
                                    due: resolvedSearchParams.due ?? null,
                                    item: row.openItemId,
                                  })}
                                  pendingLabel="Abriendo..."
                                  className="block"
                                >
                                  <div className="font-semibold text-white">{row.counterpartyName ?? "Sin contraparte"}</div>
                                  <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                                    {row.counterpartyTaxIdNormalized ?? formatCounterpartyTypeLabel(row.counterpartyType)}
                                  </div>
                                </LoadingLink>
                              </td>
                              <td>
                                <div>{formatDocumentRoleLabel(row.documentRole)}</div>
                                <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">{row.documentType ?? "Sin tipo"}</div>
                              </td>
                              <td>{formatAccountingDate(row.issueDate)}</td>
                              <td>
                                <div>{formatAccountingDate(row.dueDate)}</div>
                                <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                                  {row.daysOverdue > 0 ? `${row.daysOverdue} dia(s)` : "Al dia"}
                                </div>
                              </td>
                              <td>{formatSourceChannelLabel(row.sourceChannel)}</td>
                              <td>
                                <span className={getLifecycleStatusPillClass(row.status)}>
                                  {formatLifecycleStatusLabel(row.status)}
                                </span>
                              </td>
                              <td className="text-right">{formatAccountingAmount(row.outstandingAmount)}</td>
                              <td className="text-right">{row.settlementCount}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="space-y-4">
                <section className="ui-panel">
                  <div className="ui-panel-header">
                    <div>
                      <h2 className="text-[16px] font-semibold text-white">Partida seleccionada</h2>
                      <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                        Detalle operativo del saldo vivo.
                      </p>
                    </div>
                    <span className="ui-filter">{selectedItem?.openingEntryNumber ?? "--"}</span>
                  </div>

                  {!selectedItem ? (
                    <div className="mt-4 text-sm text-[color:var(--color-muted)]">
                      Selecciona una partida para ver su detalle.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4">
                        <p className="text-lg font-semibold text-white">{selectedItem.counterpartyName ?? "Sin contraparte"}</p>
                        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                          {formatDocumentRoleLabel(selectedItem.documentRole)} / {selectedItem.documentType ?? "Sin tipo"}
                        </p>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Saldo pendiente</span>
                        <span>{formatAccountingAmount(selectedItem.outstandingAmount)}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Original / funcional</span>
                        <span>
                          {selectedItem.originalCurrencyCode ?? selectedItem.currencyCode ?? "--"} {formatAccountingAmount(selectedItem.originalAmount)}
                          {" / "}
                          {selectedItem.functionalCurrencyCode ?? "--"} {formatAccountingAmount(selectedItem.functionalAmount)}
                        </span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Settled / vivo</span>
                        <span>
                          {formatAccountingAmount(selectedItem.settledAmount)} / {formatAccountingAmount(selectedItem.outstandingAmount)}
                        </span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Estado</span>
                        <span className={getLifecycleStatusPillClass(selectedItem.status)}>
                          {formatLifecycleStatusLabel(selectedItem.status)}
                        </span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Fuente</span>
                        <span>{formatSourceChannelLabel(selectedItem.sourceChannel)}</span>
                      </div>
                      {selectedItem.openingJournalEntryId ? (
                        <LoadingLink
                          href={`/app/o/${organization.slug}/journal-entries?entry=${selectedItem.openingJournalEntryId}`}
                          pendingLabel="Abriendo..."
                          className="ui-button ui-button--secondary w-full"
                        >
                          Abrir asiento de apertura
                        </LoadingLink>
                      ) : null}
                      {selectedItem.sourceDocumentId ? (
                        <LoadingLink
                          href={`/app/o/${organization.slug}/documents/${selectedItem.sourceDocumentId}`}
                          pendingLabel="Abriendo..."
                          className="ui-button ui-button--secondary w-full"
                        >
                          Abrir documento origen
                        </LoadingLink>
                      ) : null}
                    </div>
                  )}
                </section>

                <section className="ui-panel">
                  <div className="ui-panel-header">
                    <h2 className="text-[16px] font-semibold text-white">Aging</h2>
                    <span className="ui-filter">Buckets</span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {data.agingBuckets.map((bucket) => (
                      <div key={bucket.label} className="ui-subtle-row">
                        <span>{bucket.label}</span>
                        <span>
                          {bucket.count} / {formatAccountingAmount(bucket.outstandingAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="ui-panel">
                  <div className="ui-panel-header">
                    <h2 className="text-[16px] font-semibold text-white">Trazabilidad</h2>
                    <span className="ui-filter">Ledger</span>
                  </div>

                  {!selectedItem ? null : (
                    <div className="mt-4 space-y-3 text-sm text-[color:var(--color-muted)]">
                      <div className="ui-subtle-row">
                        <span>Asiento apertura</span>
                        <span>{selectedItem.openingEntryNumber ?? "--"}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Fecha apertura</span>
                        <span>{formatAccountingDate(selectedItem.openingEntryDate)}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Ultimo settlement</span>
                        <span>{formatAccountingDate(selectedItem.lastSettledAt)}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Residual credit</span>
                        <span>{selectedItem.isResidualCreditBalance ? "Si" : "No"}</span>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </PrivateDashboardShell>
  );
}
