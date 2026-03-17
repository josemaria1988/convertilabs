import { LoadingLink } from "@/components/ui/loading-link";
import type { ChartMapFilter, ChartMapImpactView, ChartMapMode } from "@/modules/accounting/chart-map/types";

type ChartImpactCanvasProps = {
  organizationSlug: string;
  mode: ChartMapMode;
  selectedEventId: string | null;
  selectedAccountId: string | null;
  documentId: string | null;
  searchTerm: string;
  filter: ChartMapFilter;
  events: ChartMapImpactView["selectedEvent"][];
  impact: ChartMapImpactView | null;
};

function buildHref(input: {
  organizationSlug: string;
  mode: ChartMapMode;
  eventId?: string | null;
  accountId?: string | null;
  documentId?: string | null;
  searchTerm?: string | null;
  filter?: ChartMapFilter | null;
}) {
  const query = new URLSearchParams();
  query.set("mode", input.mode);

  if (input.eventId) {
    query.set("eventId", input.eventId);
  }

  if (input.accountId) {
    query.set("accountId", input.accountId);
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

export function ChartImpactCanvas({
  organizationSlug,
  mode,
  selectedEventId,
  selectedAccountId,
  documentId,
  searchTerm,
  filter,
  events,
  impact,
}: ChartImpactCanvasProps) {
  return (
    <section className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Impacto por evento</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Vista por capas: evento, reglas ganadoras, template contable y cuentas afectadas.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {events.map((event) => {
          const href = buildHref({
            organizationSlug,
            mode,
            eventId: event.id,
            accountId: selectedAccountId,
            documentId,
            searchTerm,
            filter,
          });

          if (event.id === selectedEventId) {
            return (
              <span
                key={event.id}
                className="rounded-full bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                {event.label}
              </span>
            );
          }

          return (
            <LoadingLink
              key={event.id}
              href={href}
              pendingLabel="Cambiando evento..."
              className="rounded-full border border-[color:var(--color-border)] bg-white/75 px-4 py-2 text-sm text-[color:var(--color-muted)]"
            >
              {event.label}
            </LoadingLink>
          );
        })}
      </div>

      {impact ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-4">
          <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
            <p className="font-semibold">Evento</p>
            <p className="mt-2 text-white">{impact.selectedEvent.label}</p>
            <p className="mt-2 text-[color:var(--color-muted)]">{impact.selectedEvent.description}</p>
          </article>

          <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
            <p className="font-semibold">Reglas</p>
            <div className="mt-3 space-y-2">
              {impact.matchingRules.length > 0 ? impact.matchingRules.map((rule) => (
                <div key={rule.id} className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-3 py-2">
                  <p className="font-medium">{rule.scope}</p>
                  <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                    Prioridad {rule.priority ?? 0} / {rule.operationCategory ?? "sin categoria"}
                  </p>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-muted)]">
                  Sin reglas activas enlazadas.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
            <p className="font-semibold">Template</p>
            <div className="mt-3 rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-3 py-3">
              <p className="font-medium">{impact.selectedEvent.label}</p>
              <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                {impact.selectedEvent.matchingRuleCount} regla(s) y {impact.selectedEvent.impactedAccountCount} cuenta(s) enlazadas hoy.
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
            <p className="font-semibold">Cuentas afectadas</p>
            <div className="mt-3 space-y-2">
              {impact.impactedAccounts.length > 0 ? impact.impactedAccounts.map((account) => (
                <LoadingLink
                  key={account.id}
                  href={buildHref({
                    organizationSlug,
                    mode,
                    eventId: impact.selectedEvent.id,
                    accountId: account.id,
                    documentId,
                    searchTerm,
                    filter,
                  })}
                  pendingLabel="Abriendo cuenta..."
                  className={`block rounded-2xl border px-3 py-2 ${
                    selectedAccountId === account.id
                      ? "border-[rgba(124,157,255,0.34)] bg-[rgba(124,157,255,0.08)]"
                      : "border-[color:var(--color-border)] bg-white/80"
                  }`}
                >
                  <p className="font-medium text-white">{account.code} - {account.name}</p>
                  <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                    {account.accountType} / {account.usage.directRuleCount} regla(s)
                  </p>
                </LoadingLink>
              )) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-muted)]">
                  Aun no hay cuentas explicitamente impactadas para este evento.
                </div>
              )}
            </div>
          </article>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-8 text-sm text-[color:var(--color-muted)]">
          No encontramos un evento contable para mostrar en esta vista.
        </div>
      )}
    </section>
  );
}
