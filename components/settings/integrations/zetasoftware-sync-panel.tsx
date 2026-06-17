import { SubmitButton } from "@/components/ui/submit-button";
import type { AccountRoleMapSettings } from "@/modules/accounting/account-role-map-service";
import type { ZetaPurchaseExpenseExportReadiness } from "@/modules/integrations/zeta/export/readiness";

type ZetaSoftwareSyncPanelProps = {
  slug: string;
  isConfigured: boolean;
  canManage: boolean;
  syncAction: (formData: FormData) => void | Promise<void>;
  roleMap: AccountRoleMapSettings;
  roleMapAction: (formData: FormData) => void | Promise<void>;
  purchaseExpenseReadiness: ZetaPurchaseExpenseExportReadiness;
};

export function ZetaSoftwareSyncPanel({
  slug,
  isConfigured,
  canManage,
  syncAction,
  roleMap,
  roleMapAction,
  purchaseExpenseReadiness,
}: ZetaSoftwareSyncPanelProps) {
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const disabled = !isConfigured || !canManage;
  const cardClassName = "space-y-3 rounded-lg border border-[color:var(--color-border)] bg-[rgba(37,46,63,0.76)] p-3 text-sm";
  const inputClassName = "input-surface-dark w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm text-[color:var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-70";
  const secondaryButtonClassName = "rounded-lg border border-[color:var(--color-border)] bg-[rgba(72,82,102,0.4)] px-3 py-2 text-xs font-semibold text-[color:var(--color-foreground)] transition hover:bg-[rgba(82,95,120,0.6)] disabled:cursor-not-allowed disabled:text-[color:var(--color-muted)] disabled:opacity-70 disabled:hover:bg-[rgba(72,82,102,0.4)]";
  const selectClassName = "input-surface-dark w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-xs text-[color:var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold">Sincronizacion</p>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Corridas read-only por mes. Ventas usa Facturas de Clientes y compras usa CFEs recibidos.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <form action={syncAction} className={cardClassName}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="stream" value="contacts" />
          <input type="hidden" name="maxPages" value="200" />
          <p className="font-semibold">Contactos</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            Clientes y proveedores desde Zeta al directorio de Convertilabs.
          </p>
          <SubmitButton
            disabled={disabled}
            pendingLabel="Trayendo contactos..."
            className={secondaryButtonClassName}
          >
            Traer contactos
          </SubmitButton>
        </form>

        <form action={syncAction} className={cardClassName}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="stream" value="masters" />
          <input type="hidden" name="maxPages" value="5" />
          <p className="font-semibold">Maestros</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            Contactos, monedas, IVA, plan, locales, comprobantes, condiciones, formas de pago, cajas, tipos CFE y referencias.
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

      <section className="rounded-lg border border-[color:var(--color-border)] bg-[rgba(37,46,63,0.76)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">Exportacion de gastos a Zeta</p>
            <p className="mt-1 text-sm text-[color:var(--color-muted)]">
              Facturas de proveedor para compras de gasto. Mercaderia queda pendiente hasta resolver articulos.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${
            purchaseExpenseReadiness.status === "ready"
              ? "badge-dark-success"
              : "badge-dark-warning"
          }`}>
            {purchaseExpenseReadiness.readyCount}/{purchaseExpenseReadiness.totalCount} listo
          </span>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {purchaseExpenseReadiness.items.map((item) => (
            <div
              key={item.code}
              className="rounded-lg border border-[color:var(--color-border)] bg-[rgba(17,25,40,0.45)] px-3 py-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{item.label}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                  item.ready ? "badge-dark-success" : "badge-dark-warning"
                }`}>
                  {item.ready ? "Listo" : "Pendiente"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[color:var(--color-muted)]">
                {item.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border border-dashed border-[color:var(--color-border)] bg-[rgba(17,25,40,0.35)] px-3 py-2 text-sm text-[color:var(--color-muted)]">
          <p className="font-semibold text-[color:var(--color-foreground)]">Compras de mercaderia</p>
          <p className="mt-1">{purchaseExpenseReadiness.merchandiseDetail}</p>
        </div>
      </section>

      <section className="rounded-lg border border-[color:var(--color-border)] bg-[rgba(37,46,63,0.76)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">Mapa contable Zeta</p>
            <p className="mt-1 text-sm text-[color:var(--color-muted)]">
              Roles contables internos vinculados a cuentas imputables del plan Zeta.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${
            roleMap.status === "complete"
              ? "badge-dark-success"
              : "badge-dark-warning"
          }`}>
            {roleMap.mappedCount}/{roleMap.requiredCount} mapeados
          </span>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {roleMap.roles.map((mapping) => {
            const suggestedAccountIds = roleMap.suggestions
              .filter((suggestion) => suggestion.accountRoleCode === mapping.accountRoleCode)
              .map((suggestion) => suggestion.account.id);
            const sortedAccounts = [...roleMap.accounts].sort((left, right) => {
              const leftSuggested = suggestedAccountIds.includes(left.id) ? 0 : 1;
              const rightSuggested = suggestedAccountIds.includes(right.id) ? 0 : 1;

              if (leftSuggested !== rightSuggested) {
                return leftSuggested - rightSuggested;
              }

              const leftCode = left.external_code ?? left.code;
              const rightCode = right.external_code ?? right.code;

              return leftCode.localeCompare(rightCode);
            });

            return (
              <form
                key={mapping.accountRoleCode}
                action={roleMapAction}
                className="rounded-lg border border-[color:var(--color-border)] bg-[rgba(17,25,40,0.45)] p-3 text-sm"
              >
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="accountRoleCode" value={mapping.accountRoleCode} />

                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{mapping.role.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--color-muted)]">
                      {mapping.role.description}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${
                    mapping.account
                      ? "badge-dark-success"
                      : "badge-dark-warning"
                  }`}>
                    {mapping.account ? "Mapeado" : "Pendiente"}
                  </span>
                </div>

                {mapping.warnings.includes("local_account_not_bridge_ready") ? (
                  <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    La cuenta elegida es local; para exportar a Zeta conviene usar una cuenta del espejo Zeta.
                  </p>
                ) : null}

                <label className="mt-3 block space-y-1">
                  <span className="text-xs text-[color:var(--color-muted)]">Cuenta Zeta asignada</span>
                  <select
                    name="chartAccountId"
                    defaultValue={mapping.account?.id ?? ""}
                    disabled={!canManage}
                    className={selectClassName}
                  >
                    <option value="">Seleccionar cuenta imputable</option>
                    {sortedAccounts.map((account) => {
                      const code = account.external_code ?? account.code;
                      const isSuggested = suggestedAccountIds.includes(account.id);

                      return (
                        <option key={`${mapping.accountRoleCode}-${account.id}`} value={account.id}>
                          {code} - {account.name}{account.source_provider === "zetasoftware" ? " [Zeta]" : ""}{isSuggested ? " (sugerida)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[color:var(--color-muted)]">
                    {mapping.account
                      ? `${mapping.account.external_code ?? mapping.account.code} - ${mapping.account.name}`
                      : "Cuenta pendiente de mapear"}
                  </p>
                  <SubmitButton
                    disabled={!canManage}
                    pendingLabel="Guardando..."
                    className={secondaryButtonClassName}
                  >
                    Guardar mapping
                  </SubmitButton>
                </div>
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}
