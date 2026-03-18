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
  formatAccountingDateTime,
  getConfirmabilityPillClass,
  getLifecycleStatusPillClass,
  getLineagePillClass,
} from "@/modules/accounting/read-model-presenters";
import { loadJournalEntriesWorkspaceData } from "@/modules/accounting/read-model-repository";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  formatLifecycleStatusLabel,
  formatLineageKindLabel,
  formatPostingModeLabel,
  formatProposalConfirmabilityLabel,
  formatSourceChannelLabel,
} from "@/modules/presentation/labels";

type OrganizationJournalEntriesPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    status?: string;
    source?: string;
    period?: string;
    journalType?: string;
    q?: string;
    entry?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Libro diario",
};

function buildPageHref(
  slug: string,
  search: {
    status?: string | null;
    source?: string | null;
    period?: string | null;
    journalType?: string | null;
    q?: string | null;
    entry?: string | null;
  },
) {
  const params = new URLSearchParams();

  if (search.status) {
    params.set("status", search.status);
  }

  if (search.source) {
    params.set("source", search.source);
  }

  if (search.period) {
    params.set("period", search.period);
  }

  if (search.journalType) {
    params.set("journalType", search.journalType);
  }

  if (search.q) {
    params.set("q", search.q);
  }

  if (search.entry) {
    params.set("entry", search.entry);
  }

  const query = params.toString();
  return `/app/o/${slug}/journal-entries${query ? `?${query}` : ""}`;
}

export default async function OrganizationJournalEntriesPage({
  params,
  searchParams,
}: OrganizationJournalEntriesPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const data = await loadJournalEntriesWorkspaceData(supabase, {
    organizationId: organization.id,
    status: resolvedSearchParams.status ?? null,
    sourceChannel: resolvedSearchParams.source ?? null,
    fiscalPeriodCode: resolvedSearchParams.period ?? null,
    journalTypeCode: resolvedSearchParams.journalType ?? null,
    searchTerm: resolvedSearchParams.q ?? null,
  });
  const selectedEntry = data.rows.find((row) => row.journalEntryId === resolvedSearchParams.entry) ?? data.rows[0] ?? null;
  const selectedLineageRows = selectedEntry
    ? data.lineageRows.filter((row) =>
      row.journalEntryId === selectedEntry.journalEntryId
      || row.relatedJournalEntryId === selectedEntry.journalEntryId)
    : [];

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Libro diario"
      toolbarLabel="Libro diario"
      description="Consulta read-only del journal inmutable con linaje de reversas y ajustes anclado al kernel."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "accounting")}
    >
      <div className="space-y-4">
        <AccountingWorkspaceTabs organizationSlug={organization.slug} current="journal-entries" />

        {!data.isAvailable ? (
          <ReadModelUnavailablePanel title="Libro diario no disponible" />
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-4">
              <article className="metric-card">
                <span className="metric-card__label">Entradas visibles</span>
                <span className="metric-card__value">{data.summary.totalEntries}</span>
                <p className="metric-card__hint">Asientos dentro del filtro actual.</p>
              </article>
              <article className="metric-card">
                <span className="metric-card__label">Hojas activas</span>
                <span className="metric-card__value">{data.summary.activeLeafCount}</span>
                <p className="metric-card__hint">Entradas que no fueron reemplazadas por otra hoja.</p>
              </article>
              <article className="metric-card">
                <span className="metric-card__label">Open items</span>
                <span className="metric-card__value">{data.summary.openItemCount}</span>
                <p className="metric-card__hint">Partidas abiertas originadas por este set de asientos.</p>
              </article>
              <article className="metric-card">
                <span className="metric-card__label">Settlements</span>
                <span className="metric-card__value">{data.summary.settlementLinkCount}</span>
                <p className="metric-card__hint">Links de cancelacion asociados a este corte.</p>
              </article>
            </section>

            <section className="ui-panel">
              <div className="ui-panel-header">
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Filtros del diario</h2>
                  <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                    Acota por estado, periodo, fuente y tipo de journal sin salir del ledger.
                  </p>
                </div>
                <span className="ui-filter">Read model</span>
              </div>

              <form className="mt-4 grid gap-3 lg:grid-cols-[170px_170px_170px_170px_minmax(0,1fr)_120px]">
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
                  <span className="font-medium text-white">Periodo</span>
                  <select
                    name="period"
                    defaultValue={resolvedSearchParams.period ?? ""}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  >
                    <option value="">Todos</option>
                    {data.filterOptions.fiscalPeriodCodes.map((periodCode) => (
                      <option key={periodCode} value={periodCode}>{periodCode}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Journal type</span>
                  <select
                    name="journalType"
                    defaultValue={resolvedSearchParams.journalType ?? ""}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  >
                    <option value="">Todos</option>
                    {data.filterOptions.journalTypeCodes.map((journalTypeCode) => (
                      <option key={journalTypeCode} value={journalTypeCode}>{journalTypeCode}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Buscar</span>
                  <input
                    name="q"
                    defaultValue={resolvedSearchParams.q ?? ""}
                    placeholder="Nro, referencia o descripcion"
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
                    <h2 className="text-[16px] font-semibold text-white">Entradas del diario</h2>
                    <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                      Selecciona un asiento para inspeccionar su linaje y origen.
                    </p>
                  </div>
                  <span className="ui-filter">{data.rows.length}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table min-w-[1100px]">
                    <thead>
                      <tr>
                        <th>Asiento</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Fuente</th>
                        <th>Periodo</th>
                        <th>Referencia</th>
                        <th className="text-right">Total UYU</th>
                        <th>Linaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-sm text-[color:var(--color-muted)]">
                            No hay asientos para este filtro.
                          </td>
                        </tr>
                      ) : (
                        data.rows.map((row) => {
                          const isSelected = selectedEntry?.journalEntryId === row.journalEntryId;

                          return (
                            <tr key={row.journalEntryId} data-selected={isSelected ? "true" : undefined}>
                              <td>
                                <LoadingLink
                                  href={buildPageHref(organization.slug, {
                                    status: resolvedSearchParams.status ?? null,
                                    source: resolvedSearchParams.source ?? null,
                                    period: resolvedSearchParams.period ?? null,
                                    journalType: resolvedSearchParams.journalType ?? null,
                                    q: resolvedSearchParams.q ?? null,
                                    entry: row.journalEntryId,
                                  })}
                                  pendingLabel="Abriendo..."
                                  className="block"
                                >
                                  <div className="font-semibold text-white">
                                    {row.entryNumber ? `#${row.entryNumber}` : "Sin numero"}
                                  </div>
                                  <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                                    {row.journalTypeCode ?? row.auxiliaryBookCode ?? "Sin clasificacion"}
                                  </div>
                                </LoadingLink>
                              </td>
                              <td>{formatAccountingDate(row.entryDate)}</td>
                              <td>
                                <span className={getLifecycleStatusPillClass(row.status)}>
                                  {formatLifecycleStatusLabel(row.status)}
                                </span>
                              </td>
                              <td>{formatSourceChannelLabel(row.sourceChannel)}</td>
                              <td>{row.fiscalPeriodCode ?? "--"}</td>
                              <td>
                                <div>{row.reference ?? "Sin referencia"}</div>
                                <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                                  {row.description ?? "Sin descripcion"}
                                </div>
                              </td>
                              <td className="text-right">{formatAccountingAmount(row.functionalTotalDebit)}</td>
                              <td>
                                <span className={getLineagePillClass(row.lineageKind)}>
                                  {formatLineageKindLabel(row.lineageKind)}
                                </span>
                              </td>
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
                      <h2 className="text-[16px] font-semibold text-white">Asiento seleccionado</h2>
                      <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                        Contexto operativo y origen del asiento activo.
                      </p>
                    </div>
                    <span className="ui-filter">{selectedEntry?.entryNumber ?? "--"}</span>
                  </div>

                  {!selectedEntry ? (
                    <div className="mt-4 text-sm text-[color:var(--color-muted)]">
                      Selecciona un asiento para ver sus metadatos.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4">
                        <p className="text-lg font-semibold text-white">
                          {selectedEntry.entryNumber ? `Asiento #${selectedEntry.entryNumber}` : "Asiento sin numero"}
                        </p>
                        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                          {selectedEntry.reference ?? selectedEntry.description ?? "Sin referencia"}
                        </p>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Estado</span>
                        <span className={getLifecycleStatusPillClass(selectedEntry.status)}>
                          {formatLifecycleStatusLabel(selectedEntry.status)}
                        </span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Modo</span>
                        <span>{formatPostingModeLabel(selectedEntry.postingMode)}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Fuente</span>
                        <span>{formatSourceChannelLabel(selectedEntry.sourceChannel)}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Periodo</span>
                        <span>{selectedEntry.fiscalPeriodCode ?? "--"}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Open items / settlements</span>
                        <span>{selectedEntry.openItemCount} / {selectedEntry.settlementLinkCount}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Proposal</span>
                        <span className={getConfirmabilityPillClass(selectedEntry.postingProposalConfirmabilityStatus)}>
                          {formatProposalConfirmabilityLabel(selectedEntry.postingProposalConfirmabilityStatus)}
                        </span>
                      </div>
                      {selectedEntry.sourceDocumentId ? (
                        <LoadingLink
                          href={`/app/o/${organization.slug}/documents/${selectedEntry.sourceDocumentId}`}
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
                    <div>
                      <h2 className="text-[16px] font-semibold text-white">Linaje</h2>
                      <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                        Relaciones directas de reversa y ajuste para el asiento elegido.
                      </p>
                    </div>
                    <span className="ui-filter">{selectedLineageRows.length}</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedLineageRows.length === 0 ? (
                      <div className="text-sm text-[color:var(--color-muted)]">
                        Este asiento no tiene relaciones directas visibles en el filtro actual.
                      </div>
                    ) : (
                      selectedLineageRows.map((row) => {
                        const otherEntryId = row.journalEntryId === selectedEntry?.journalEntryId
                          ? row.relatedJournalEntryId
                          : row.journalEntryId;
                        const otherEntryNumber = row.journalEntryId === selectedEntry?.journalEntryId
                          ? row.relatedEntryNumber
                          : row.entryNumber;
                        const otherEntryDate = row.journalEntryId === selectedEntry?.journalEntryId
                          ? row.relatedEntryDate
                          : row.entryDate;
                        const otherEntryStatus = row.journalEntryId === selectedEntry?.journalEntryId
                          ? row.relatedEntryStatus
                          : row.entryStatus;

                        return (
                          <LoadingLink
                            key={`${row.journalEntryId}-${row.relatedJournalEntryId}-${row.relationType}`}
                            href={buildPageHref(organization.slug, {
                              status: resolvedSearchParams.status ?? null,
                              source: resolvedSearchParams.source ?? null,
                              period: resolvedSearchParams.period ?? null,
                              journalType: resolvedSearchParams.journalType ?? null,
                              q: resolvedSearchParams.q ?? null,
                              entry: otherEntryId,
                            })}
                            pendingLabel="Abriendo..."
                            className="block rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-white">
                                {formatLineageKindLabel(row.relationType)}
                              </p>
                              <span className={getLifecycleStatusPillClass(otherEntryStatus)}>
                                {formatLifecycleStatusLabel(otherEntryStatus)}
                              </span>
                            </div>
                            <p className="mt-2 text-[13px] text-[color:var(--color-muted)]">
                              Asiento {otherEntryNumber ? `#${otherEntryNumber}` : otherEntryId}
                            </p>
                            <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                              {formatAccountingDate(otherEntryDate)}
                            </p>
                          </LoadingLink>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="ui-panel">
                  <div className="ui-panel-header">
                    <h2 className="text-[16px] font-semibold text-white">Trazabilidad tecnica</h2>
                    <span className="ui-filter">Snapshot</span>
                  </div>

                  {!selectedEntry ? null : (
                    <div className="mt-4 space-y-3 text-sm text-[color:var(--color-muted)]">
                      <div className="ui-subtle-row">
                        <span>Snapshot</span>
                        <span>{selectedEntry.accountingSnapshotFingerprint?.slice(0, 12) ?? "--"}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Ultimo seen</span>
                        <span>{formatAccountingDateTime(selectedEntry.lastSeenAt)}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Source event</span>
                        <span>{selectedEntry.sourceEventId ?? "--"}</span>
                      </div>
                      <div className="ui-subtle-row">
                        <span>Source external</span>
                        <span>{selectedEntry.sourceExternalId ?? "--"}</span>
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
