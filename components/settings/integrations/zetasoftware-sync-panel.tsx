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

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold">Sincronizacion</p>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Corridas read-only por mes. Ventas usa Facturas de Clientes y compras usa CFEs recibidos.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <form action={syncAction} className="space-y-3 rounded-lg border border-[color:var(--color-border)] bg-white/70 p-3 text-sm">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="stream" value="masters" />
          <input type="hidden" name="maxPages" value="5" />
          <p className="font-semibold">Maestros</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            Contactos, monedas, IVA, plan, locales, comprobantes, tipos CFE y referencias.
          </p>
          <button
            type="submit"
            disabled={disabled}
            className="rounded-lg border border-[color:var(--color-border)] bg-white px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sincronizar maestros
          </button>
        </form>

        <form action={syncAction} className="space-y-3 rounded-lg border border-[color:var(--color-border)] bg-white/70 p-3 text-sm">
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
              className="w-full rounded-lg border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={disabled}
            className="rounded-lg border border-[color:var(--color-border)] bg-white px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Traer ventas del mes
          </button>
        </form>

        <form action={syncAction} className="space-y-3 rounded-lg border border-[color:var(--color-border)] bg-white/70 p-3 text-sm">
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
              className="w-full rounded-lg border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={disabled}
            className="rounded-lg border border-[color:var(--color-border)] bg-white px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Traer compras del mes
          </button>
        </form>
      </div>

      <form action={syncAction} className="flex flex-col gap-3 rounded-lg border border-[color:var(--color-border)] bg-white/65 px-4 py-3 text-sm md:flex-row md:items-end md:justify-between">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="stream" value="monthly_documents" />
        <input type="hidden" name="maxPages" value="25" />
        <label className="space-y-1">
          <span className="block text-xs text-[color:var(--color-muted)]">Ventas + compras por mes</span>
          <input
            type="month"
            name="period"
            defaultValue={currentPeriod}
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm md:w-56"
          />
        </label>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Traer mes completo
        </button>
      </form>

      <div className="rounded-lg border border-[color:var(--color-border)] bg-white/65 px-4 py-3 text-sm text-[color:var(--color-muted)]">
        {!isConfigured
          ? "Guarda la conexion antes de ejecutar corridas."
          : canManage
            ? "Los documentos estructurados se guardan con trazabilidad de origen y quedan disponibles para IVA cuando pasan los guardrails."
            : "Tu rol puede ver el estado, pero no ejecutar corridas de integracion."}
      </div>
    </div>
  );
}
