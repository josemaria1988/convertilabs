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
import { loadTrialBalanceWorkspaceData } from "@/modules/accounting/read-model-repository";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  formatAccountTypeLabel,
  formatLifecycleStatusLabel,
  formatNormalSideLabel,
  formatSourceChannelLabel,
} from "@/modules/presentation/labels";

type OrganizationTrialBalancePageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    period?: string;
    source?: string;
    accountType?: string;
    q?: string;
    accountId?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Contabilidad",
};

function buildPageHref(
  slug: string,
  search: {
    period?: string | null;
    source?: string | null;
    accountType?: string | null;
    q?: string | null;
    accountId?: string | null;
  },
) {
  const params = new URLSearchParams();

  if (search.period) {
    params.set("period", search.period);
  }

  if (search.source) {
    params.set("source", search.source);
  }

  if (search.accountType) {
    params.set("accountType", search.accountType);
  }

  if (search.q) {
    params.set("q", search.q);
  }

  if (search.accountId) {
    params.set("accountId", search.accountId);
  }

  const query = params.toString();
  return `/app/o/${slug}/trial-balance${query ? `?${query}` : ""}`;
}

export default async function OrganizationTrialBalancePage({
  params,
  searchParams,
}: OrganizationTrialBalancePageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const data = await loadTrialBalanceWorkspaceData(supabase, {
    organizationId: organization.id,
    fiscalPeriodCode: resolvedSearchParams.period ?? null,
    sourceChannel: resolvedSearchParams.source ?? null,
    accountType: resolvedSearchParams.accountType ?? null,
    searchTerm: resolvedSearchParams.q ?? null,
    selectedAccountId: resolvedSearchParams.accountId ?? null,
  });
  const selectedAccount = data.rows.find((row) => row.accountId === resolvedSearchParams.accountId) ?? data.rows[0] ?? null;
  const imbalanceIsMaterial = Math.abs(data.summary.imbalance) > 0.009;

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Contabilidad"
      toolbarLabel="Contabilidad"
      description="Balance de comprobacion, mayor por cuenta y agregados del journal real para inspeccionar el kernel sin tocar asientos."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "advanced")}
    >
      <div className="space-y-4">
        <AccountingWorkspaceTabs organizationSlug={organization.slug} current="trial-balance" />

        {!data.isAvailable ? (
          <ReadModelUnavailablePanel title="Balance de comprobacion no disponible" />
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-4">
              <article className="metric-card">
                <span className="metric-card__label">Cuentas visibles</span>
                <span className="metric-card__value">{data.summary.accountCount}</span>
                <p className="metric-card__hint">Filtradas sobre el libro posteado e inmutable.</p>
              </article>
              <article className="metric-card">
                <span className="metric-card__label">Debe funcional</span>
                <span className="metric-card__value">{formatAccountingAmount(data.summary.functionalDebit)}</span>
                <p className="metric-card__hint">Suma funcional del periodo y fuente elegidos.</p>
              </article>
              <article className="metric-card">
                <span className="metric-card__label">Haber funcional</span>
                <span className="metric-card__value">{formatAccountingAmount(data.summary.functionalCredit)}</span>
                <p className="metric-card__hint">Contra partida acumulada del mismo set.</p>
              </article>
              <article className="metric-card" data-tone={imbalanceIsMaterial ? "warning" : "success"}>
                <span className="metric-card__label">Diferencia</span>
                <span className="metric-card__value">{formatAccountingAmount(data.summary.imbalance)}</span>
                <p className="metric-card__hint">
                  {imbalanceIsMaterial
                    ? "Hay diferencia material en el set visible."
                    : "El set visible esta balanceado."}
                </p>
              </article>
            </section>

            <section className="ui-panel">
              <div className="ui-panel-header">
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Filtros del balance</h2>
                  <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                    Acota por periodo, carril de origen y tipo de cuenta; el mayor se recalcula sobre la cuenta seleccionada.
                  </p>
                </div>
                <span className="ui-filter">Read model</span>
              </div>

              <form className="mt-4 grid gap-3 lg:grid-cols-[180px_200px_200px_minmax(0,1fr)_120px]">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Periodo</span>
                  <select
                    name="period"
                    defaultValue={data.selectedFiscalPeriodCode ?? ""}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  >
                    {data.filterOptions.fiscalPeriodCodes.map((periodCode) => (
                      <option key={periodCode} value={periodCode}>{periodCode}</option>
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
                  <span className="font-medium text-white">Tipo de cuenta</span>
                  <select
                    name="accountType"
                    defaultValue={resolvedSearchParams.accountType ?? ""}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  >
                    <option value="">Todas</option>
                    {data.filterOptions.accountTypes.map((accountType) => (
                      <option key={accountType} value={accountType}>
                        {formatAccountTypeLabel(accountType)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Buscar</span>
                  <input
                    name="q"
                    defaultValue={resolvedSearchParams.q ?? ""}
                    placeholder="Codigo, nombre o fuente"
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  />
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
                    <h2 className="text-[16px] font-semibold text-white">Balance de comprobacion</h2>
                    <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                      Selecciona una cuenta para inspeccionar su mayor funcional.
                    </p>
                  </div>
                  <span className="ui-filter">{data.rows.length}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table min-w-[1060px]">
                    <thead>
                      <tr>
                        <th>Cuenta</th>
                        <th>Tipo</th>
                        <th>Periodo</th>
                        <th>Fuente</th>
                        <th className="text-right">Debe</th>
                        <th className="text-right">Haber</th>
                        <th className="text-right">Saldo</th>
                        <th className="text-right">Entradas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-sm text-[color:var(--color-muted)]">
                            No hay saldos para los filtros elegidos.
                          </td>
                        </tr>
                      ) : (
                        data.rows.map((row) => {
                          const isSelected = row.accountId && selectedAccount?.accountId === row.accountId;

                          return (
                            <tr key={`${row.accountId}-${row.sourceChannel}-${row.fiscalPeriodCode}`} data-selected={isSelected ? "true" : undefined}>
                              <td>
                                <LoadingLink
                                  href={buildPageHref(organization.slug, {
                                    period: resolvedSearchParams.period ?? null,
                                    source: resolvedSearchParams.source ?? null,
                                    accountType: resolvedSearchParams.accountType ?? null,
                                    q: resolvedSearchParams.q ?? null,
                                    accountId: row.accountId,
                                  })}
                                  pendingLabel="Abriendo..."
                                  className="block"
                                >
                                  <div className="font-semibold text-white">{row.accountCode ?? "Sin codigo"}</div>
                                  <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">{row.accountName ?? "Sin nombre"}</div>
                                </LoadingLink>
                              </td>
                              <td>
                                <div>{formatAccountTypeLabel(row.accountType)}</div>
                                <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                                  {formatNormalSideLabel(row.naturalBalance)}
                                </div>
                              </td>
                              <td>{row.fiscalPeriodCode ?? "--"}</td>
                              <td>{formatSourceChannelLabel(row.sourceChannel)}</td>
                              <td className="text-right">{formatAccountingAmount(row.functionalDebit)}</td>
                              <td className="text-right">{formatAccountingAmount(row.functionalCredit)}</td>
                              <td className="text-right">{formatAccountingAmount(row.functionalBalance)}</td>
                              <td className="text-right">{row.entryCount}</td>
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
                      <h2 className="text-[16px] font-semibold text-white">Cuenta seleccionada</h2>
                      <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                        Inspector rapido del saldo visible y su rango temporal.
                      </p>
                    </div>
                    <span className="ui-filter">{selectedAccount?.accountCode ?? "--"}</span>
                  </div>

                  {!selectedAccount ? (
                    <div className="mt-4 text-sm text-[color:var(--color-muted)]">
                      Selecciona una cuenta del balance para ver su mayor.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4">
                        <p className="text-lg font-semibold text-white">
                          {selectedAccount.accountCode} - {selectedAccount.accountName}
                        </p>
                        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                          {formatAccountTypeLabel(selectedAccount.accountType)} / {formatNormalSideLabel(selectedAccount.naturalBalance)}
                        </p>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Saldo funcional</span>
                        <span>{formatAccountingAmount(selectedAccount.functionalBalance)}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Entradas / lineas</span>
                        <span>{selectedAccount.entryCount} / {selectedAccount.lineCount}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Primera / ultima fecha</span>
                        <span>
                          {formatAccountingDate(selectedAccount.firstEntryDate)} / {formatAccountingDate(selectedAccount.lastEntryDate)}
                        </span>
                      </div>
                    </div>
                  )}
                </section>

                <section className="ui-panel">
                  <div className="ui-panel-header">
                    <div>
                      <h2 className="text-[16px] font-semibold text-white">Mayor por cuenta</h2>
                      <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                        Movimientos de la cuenta seleccionada con saldo funcional acumulado.
                      </p>
                    </div>
                    <span className="ui-filter">{data.generalLedgerRows.length}</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {data.generalLedgerRows.length === 0 ? (
                      <div className="text-sm text-[color:var(--color-muted)]">
                        No hay lineas visibles para la cuenta y filtros elegidos.
                      </div>
                    ) : (
                      data.generalLedgerRows.slice(0, 12).map((row) => (
                        <div
                          key={`${row.journalEntryId}-${row.lineNo}`}
                          className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">
                                Asiento {row.entryNumber ?? "--"} / linea {row.lineNo}
                              </p>
                              <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                                {formatAccountingDate(row.entryDate)} / {row.reference ?? row.entryDescription ?? "Sin referencia"}
                              </p>
                            </div>
                            <span className={getLifecycleStatusPillClass(row.status)}>
                              {formatLifecycleStatusLabel(row.status)}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-[color:var(--color-muted)]">
                            <div className="ui-subtle-row">
                              <span>Debe / Haber</span>
                              <span>
                                {formatAccountingAmount(row.functionalDebit)} / {formatAccountingAmount(row.functionalCredit)}
                              </span>
                            </div>
                            <div className="ui-subtle-row">
                              <span>Saldo acumulado</span>
                              <span>{formatAccountingAmount(row.runningFunctionalBalance)}</span>
                            </div>
                            <div className="ui-subtle-row">
                              <span>Fuente</span>
                              <span>{formatSourceChannelLabel(row.sourceChannel)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="ui-panel">
                  <div className="ui-panel-header">
                    <h2 className="text-[16px] font-semibold text-white">Totales de estados</h2>
                    <span className="ui-filter">Lectura</span>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-white">Balance general</p>
                      <div className="mt-3 space-y-2">
                        {data.balanceSheetTotals.length === 0 ? (
                          <div className="text-sm text-[color:var(--color-muted)]">Sin cuentas patrimoniales en este set.</div>
                        ) : (
                          data.balanceSheetTotals.map((row) => (
                            <div key={row.reportSection} className="ui-subtle-row">
                              <span>{formatAccountTypeLabel(row.reportSection)}</span>
                              <span>{formatAccountingAmount(row.presentationBalance)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Estado de resultados</p>
                      <div className="mt-3 space-y-2">
                        {data.incomeStatementTotals.length === 0 ? (
                          <div className="text-sm text-[color:var(--color-muted)]">Sin cuentas de resultado en este set.</div>
                        ) : (
                          data.incomeStatementTotals.map((row) => (
                            <div key={row.reportSection} className="ui-subtle-row">
                              <span>{formatAccountTypeLabel(row.reportSection)}</span>
                              <span>{formatAccountingAmount(row.presentationBalance)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </PrivateDashboardShell>
  );
}
