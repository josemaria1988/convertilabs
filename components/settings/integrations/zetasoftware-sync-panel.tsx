import { SubmitButton } from "@/components/ui/submit-button";

type ZetaSoftwareSyncPanelProps = {
  slug: string;
  isConfigured: boolean;
  canManage: boolean;
  syncAction: (formData: FormData) => void | Promise<void>;
};

export function ZetaSoftwareSyncPanel({
  slug,
  isConfigured,
  canManage,
  syncAction,
}: ZetaSoftwareSyncPanelProps) {
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const disabled = !isConfigured || !canManage;
  const cardClassName = "space-y-3 rounded-lg border border-[color:var(--color-border)] bg-[rgba(37,46,63,0.76)] p-3 text-sm";
  const inputClassName = "input-surface-dark w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm text-[color:var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-70";
  const secondaryButtonClassName = "rounded-lg border border-[color:var(--color-border)] bg-[rgba(72,82,102,0.4)] px-3 py-2 text-xs font-semibold text-[color:var(--color-foreground)] transition hover:bg-[rgba(82,95,120,0.6)] disabled:cursor-not-allowed disabled:text-[color:var(--color-muted)] disabled:opacity-70 disabled:hover:bg-[rgba(72,82,102,0.4)]";

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold">Sincronizacion</p>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Corridas read-only por mes. Ventas usa Facturas de Clientes y compras usa CFEs recibidos.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <form action={syncAction} className={cardClassName}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="stream" value="masters" />
          <input type="hidden" name="maxPages" value="5" />
          <p className="font-semibold">Maestros</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            Contactos, monedas, IVA, plan, locales, comprobantes, tipos CFE y referencias.
          </p>
          <SubmitButton
            disabled={disabled}
            pendingLabel="Sincronizando maestros..."
            className={secondaryButtonClassName}
          >
            Sincronizar maestros
          </SubmitButton>
        </form>

        <form action={syncAction} className={cardClassName}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="stream" value="accounting_masters" />
          <input type="hidden" name="maxPages" value="20" />
          <p className="font-semibold">Plan Zeta</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            Cuentas, conceptos y tipos de asiento para clasificar con el mismo mapa del contador.
          </p>
          <SubmitButton
            disabled={disabled}
            pendingLabel="Sincronizando plan..."
            className={secondaryButtonClassName}
          >
            Sincronizar plan de cuentas
          </SubmitButton>
        </form>

        <form action={syncAction} className={cardClassName}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="stream" value="sales_documents" />
          <input type="hidden" name="maxPages" value="25" />
          <p className="font-semibold">Ventas</p>
          <label className="block space-y-1">
            <span className="text-xs text-[color:var(--color-muted)]">Periodo IVA</span>
            <input
              type="month"
              name="period"
              defaultValue={currentPeriod}
              disabled={disabled}
              className={inputClassName}
            />
          </label>
          <SubmitButton
            disabled={disabled}
            pendingLabel="Trayendo ventas..."
            className={secondaryButtonClassName}
          >
            Traer ventas del mes
          </SubmitButton>
        </form>

        <form action={syncAction} className={cardClassName}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="stream" value="received_cfes" />
          <input type="hidden" name="maxPages" value="25" />
          <p className="font-semibold">CFE recibidos</p>
          <label className="block space-y-1">
            <span className="text-xs text-[color:var(--color-muted)]">Periodo IVA</span>
            <input
              type="month"
              name="period"
              defaultValue={currentPeriod}
              disabled={disabled}
              className={inputClassName}
            />
          </label>
          <SubmitButton
            disabled={disabled}
            pendingLabel="Trayendo compras..."
            className={secondaryButtonClassName}
          >
            Traer compras del mes
          </SubmitButton>
        </form>
      </div>

      <form action={syncAction} className="flex flex-col gap-3 rounded-lg border border-[color:var(--color-border)] bg-[rgba(37,46,63,0.76)] px-4 py-3 text-sm md:flex-row md:items-end md:justify-between">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="stream" value="monthly_documents" />
        <input type="hidden" name="maxPages" value="25" />
        <label className="space-y-1">
          <span className="block text-xs text-[color:var(--color-muted)]">Ventas + compras por mes</span>
          <input
            type="month"
            name="period"
            defaultValue={currentPeriod}
            disabled={disabled}
            className={`${inputClassName} md:w-56`}
          />
        </label>
        <SubmitButton
          disabled={disabled}
          pendingLabel="Trayendo mes..."
          className="rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)] disabled:cursor-not-allowed disabled:bg-[rgba(72,82,102,0.5)] disabled:text-[color:var(--color-muted)] disabled:opacity-80 disabled:hover:bg-[rgba(72,82,102,0.5)]"
        >
          Traer mes completo
        </SubmitButton>
      </form>

      <div className="rounded-lg border border-[color:var(--color-border)] bg-[rgba(37,46,63,0.76)] px-4 py-3 text-sm text-[color:var(--color-muted)]">
        {!isConfigured
          ? "Guarda la conexion antes de ejecutar corridas."
          : canManage
            ? "Los documentos estructurados se guardan con trazabilidad de origen y quedan disponibles para IVA cuando pasan los guardrails."
            : "Tu rol puede ver el estado, pero no ejecutar corridas de integracion."}
      </div>
    </div>
  );
}
