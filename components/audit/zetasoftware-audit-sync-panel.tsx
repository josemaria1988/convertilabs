import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ZetaSyncRunListItem } from "@/modules/integrations/zeta/services/connection-service";

type ZetaSoftwareAuditSyncPanelProps = {
  slug: string;
  isConfigured: boolean;
  canRun: boolean;
  runs: ZetaSyncRunListItem[];
  syncAction: (formData: FormData) => void | Promise<void>;
};

function defaultPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function formatStream(value: string) {
  switch (value) {
    case "sales_documents":
      return "Ventas";
    case "received_cfes":
      return "Compras";
    default:
      return value || "Corrida";
  }
}

function formatStatus(value: string) {
  switch (value) {
    case "queued":
      return "En cola";
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function documentRunHistory(runs: ZetaSyncRunListItem[]) {
  return runs
    .filter((run) => run.stream === "sales_documents" || run.stream === "received_cfes")
    .slice(0, 6);
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function materializedCount(run: ZetaSyncRunListItem) {
  return asNumber(run.summary.documents_materialized) ?? 0;
}

export function ZetaSoftwareAuditSyncPanel({
  slug,
  isConfigured,
  canRun,
  runs,
  syncAction,
}: ZetaSoftwareAuditSyncPanelProps) {
  const disabled = !isConfigured || !canRun;
  const period = defaultPeriod();
  const history = documentRunHistory(runs);

  return (
    <section className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[18px] font-semibold text-white">Zetasoftware</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Trae comprobantes estructurados por mes, sin OCR y sin escribir nada en Zeta.
          </p>
        </div>
        <span className={isConfigured ? "status-pill status-pill--success" : "status-pill status-pill--warning"}>
          {isConfigured ? "Conexion lista" : "Conexion pendiente"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <form action={syncAction} className="rounded-lg border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] p-4">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="stream" value="received_cfes" />
          <input type="hidden" name="maxPages" value="200" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-semibold text-white">Compras</h3>
              <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                CFEs Recibidos / CFERECIBIDOS y CFERECIBIDODETALLE.
              </p>
            </div>
            <span className="status-pill status-pill--info">API compras</span>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-[13px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Mes IVA
            </span>
            <input
              type="month"
              name="period"
              defaultValue={period}
              className="min-h-[48px] w-full rounded-lg border border-[color:var(--color-border)] bg-[rgba(8,15,32,0.72)] px-4 text-[15px] text-white outline-none transition focus:border-[color:var(--color-accent)]"
            />
          </label>

          <SubmitButton
            disabled={disabled}
            pendingLabel="Trayendo compras..."
            className="ui-button ui-button--primary mt-4 w-full"
          >
            Traer facturas de compra
          </SubmitButton>
        </form>

        <form action={syncAction} className="rounded-lg border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] p-4">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="stream" value="sales_documents" />
          <input type="hidden" name="maxPages" value="200" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-semibold text-white">Ventas</h3>
              <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                Facturas de Clientes / QueryVentas y VentaDetallada.
              </p>
            </div>
            <span className="status-pill status-pill--info">API ventas</span>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-[13px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Mes IVA
            </span>
            <input
              type="month"
              name="period"
              defaultValue={period}
              className="min-h-[48px] w-full rounded-lg border border-[color:var(--color-border)] bg-[rgba(8,15,32,0.72)] px-4 text-[15px] text-white outline-none transition focus:border-[color:var(--color-accent)]"
            />
          </label>

          <SubmitButton
            disabled={disabled}
            pendingLabel="Trayendo ventas..."
            className="ui-button ui-button--primary mt-4 w-full"
          >
            Traer facturas de venta
          </SubmitButton>
        </form>
      </div>

      {!isConfigured || !canRun ? (
        <div className="mt-4 rounded-lg border border-[color:var(--color-border)] bg-white/6 px-4 py-3 text-[14px] text-[color:var(--color-muted)]">
          {!isConfigured ? (
            <>
              Primero deja activa la conexion Zetasoftware en{" "}
              <LoadingLink
                href={`/app/o/${slug}/settings?tab=integrations`}
                pendingLabel="Abriendo..."
                className="font-semibold text-white underline underline-offset-4"
              >
                Integraciones
              </LoadingLink>
              .
            </>
          ) : (
            "Tu rol puede auditar, pero no iniciar sincronizaciones documentales."
          )}
        </div>
      ) : null}

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-white">Ultimas sincronizaciones Zeta</h3>
          <span className="ui-filter">{history.length} corrida(s)</span>
        </div>

        <div className="mt-3 space-y-2">
          {history.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[color:var(--color-border)] bg-white/6 px-4 py-3 text-[14px] text-[color:var(--color-muted)]">
              Todavia no hay corridas documentales de Zetasoftware.
            </div>
          ) : (
            history.map((run) => (
              <div key={run.id} className="rounded-lg border border-[color:var(--color-border)] bg-white/6 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{formatStream(run.stream)}</p>
                    <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                      {formatDateTime(run.startedAt ?? run.createdAt)} - {formatStatus(run.status)}
                    </p>
                  </div>
                  <span className={run.status === "failed" ? "status-pill status-pill--danger" : "status-pill status-pill--info"}>
                    {run.testMode ? "mock/test" : "read-only"}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-[13px] text-[color:var(--color-muted)] md:grid-cols-4">
                  <div className="ui-subtle-row">
                    <span>Vistos</span>
                    <span>{run.recordsSeen}</span>
                  </div>
                  <div className="ui-subtle-row">
                    <span>Guardados</span>
                    <span>{run.recordsUpserted}</span>
                  </div>
                  <div className="ui-subtle-row">
                    <span>Documentos</span>
                    <span>{materializedCount(run)}</span>
                  </div>
                  <div className="ui-subtle-row">
                    <span>Fallidos</span>
                    <span>{run.recordsFailed}</span>
                  </div>
                </div>

                {run.errorMessage ? (
                  <p className="mt-3 text-[13px] text-amber-200">{run.errorMessage}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
