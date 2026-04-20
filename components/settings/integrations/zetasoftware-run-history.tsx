import type { ZetaSyncRunListItem } from "@/modules/integrations/zeta/services/connection-service";

type ZetaSoftwareRunHistoryProps = {
  runs: ZetaSyncRunListItem[];
};

function formatStream(value: string) {
  switch (value) {
    case "masters":
      return "Maestros";
    case "accounting_masters":
      return "Plan Zeta";
    case "sales_documents":
      return "Ventas";
    case "received_cfes":
      return "CFE recibidos";
    default:
      return value || "Corrida";
  }
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatMaterializationSummary(summary: Record<string, unknown>) {
  const materialization = asRecord(summary.master_materialization);
  const chartAccounts = asRecord(materialization.chart_accounts);
  const concepts = asRecord(materialization.concepts);
  const journalTypes = asRecord(materialization.journal_types);
  const parts = [];

  if (Object.keys(chartAccounts).length > 0) {
    parts.push(
      `Cuentas: ${asNumber(chartAccounts.upserted)} actualizadas, ${asNumber(chartAccounts.unchanged)} sin cambios, ${asNumber(chartAccounts.conflict)} conflictos`,
    );
  }

  if (Object.keys(concepts).length > 0) {
    parts.push(
      `Conceptos: ${asNumber(concepts.linked)} vinculados, ${asNumber(concepts.missingAccount)} sin cuenta`,
    );
  }

  if (Object.keys(journalTypes).length > 0) {
    parts.push(`Tipos de asiento: ${asNumber(journalTypes.available)} disponibles`);
  }

  return parts;
}

function formatStatus(value: string) {
  switch (value) {
    case "completed":
      return "Completada";
    case "completed_with_warnings":
      return "Completada con avisos";
    case "running":
      return "En curso";
    case "failed":
      return "Fallida";
    default:
      return value || "Sin estado";
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ZetaSoftwareRunHistory({
  runs,
}: ZetaSoftwareRunHistoryProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold">Historial de corridas</p>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Ultimas lecturas read-only de Zetasoftware con contadores y avisos de materializacion.
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--color-border)] bg-[rgba(37,46,63,0.76)] px-4 py-6 text-sm text-[color:var(--color-muted)]">
          Todavia no hay corridas Zetasoftware para esta organizacion.
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <article
              key={run.id}
              className="rounded-lg border border-[color:var(--color-border)] bg-[rgba(37,46,63,0.76)] p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{formatStream(run.stream)}</p>
                  <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                    {formatDate(run.startedAt ?? run.createdAt)} - {formatStatus(run.status)}
                  </p>
                </div>
                <span className="rounded-full border border-[color:var(--color-border)] bg-[rgba(72,82,102,0.4)] px-2.5 py-1 text-xs text-[color:var(--color-muted)]">
                  {run.testMode ? "test/mock" : "real read-only"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <div>
                  <span className="text-[color:var(--color-muted)]">Vistos</span>
                  <p className="font-semibold">{run.recordsSeen}</p>
                </div>
                <div>
                  <span className="text-[color:var(--color-muted)]">Guardados</span>
                  <p className="font-semibold">{run.recordsUpserted}</p>
                </div>
                <div>
                  <span className="text-[color:var(--color-muted)]">Omitidos</span>
                  <p className="font-semibold">{run.recordsSkipped}</p>
                </div>
                <div>
                  <span className="text-[color:var(--color-muted)]">Fallidos</span>
                  <p className="font-semibold">{run.recordsFailed}</p>
                </div>
              </div>

              {run.errorMessage ? (
                <p className="mt-3 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {run.errorMessage}
                </p>
              ) : null}

              {formatMaterializationSummary(run.summary).map((line) => (
                <p key={line} className="mt-2 text-xs text-[color:var(--color-muted)]">
                  {line}
                </p>
              ))}

              {run.warnings.length > 0 ? (
                <p className="mt-3 text-xs text-[color:var(--color-muted)]">
                  Avisos: {run.warnings.length}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
