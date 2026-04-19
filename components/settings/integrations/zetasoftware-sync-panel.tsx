type ZetaSoftwareSyncPanelProps = {
  isConfigured: boolean;
};

export function ZetaSoftwareSyncPanel({
  isConfigured,
}: ZetaSoftwareSyncPanelProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4">
      <div>
        <p className="text-base font-semibold">Sincronizacion</p>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Maestros, ventas y CFE recibidos se activan despues del runner base y del contrato REST oficial.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-3 text-sm">
          <p className="font-semibold">Maestros</p>
          <p className="mt-1 text-[color:var(--color-muted)]">Pendiente de PR-04/PR-05</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-3 text-sm">
          <p className="font-semibold">Ventas</p>
          <p className="mt-1 text-[color:var(--color-muted)]">Pendiente de PR-06</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-3 text-sm">
          <p className="font-semibold">CFE recibidos</p>
          <p className="mt-1 text-[color:var(--color-muted)]">Pendiente de PR-10</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 px-4 py-3 text-sm text-[color:var(--color-muted)]">
        {isConfigured
          ? "La conexion ya puede participar de pruebas mock. No se ejecutan syncs reales todavia."
          : "Guarda la conexion antes de preparar corridas mock."}
      </div>
    </div>
  );
}
