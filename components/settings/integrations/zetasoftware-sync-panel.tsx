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
  const disabled = !isConfigured || !canManage;
  const cardClassName = "space-y-3 rounded-lg border border-[color:var(--color-border)] bg-[rgba(37,46,63,0.76)] p-3 text-sm";
  const secondaryButtonClassName = "rounded-lg border border-[color:var(--color-border)] bg-[rgba(72,82,102,0.4)] px-3 py-2 text-xs font-semibold text-[color:var(--color-foreground)] transition hover:bg-[rgba(82,95,120,0.6)] disabled:cursor-not-allowed disabled:text-[color:var(--color-muted)] disabled:opacity-70 disabled:hover:bg-[rgba(72,82,102,0.4)]";
  const selectClassName = "input-surface-dark w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-xs text-[color:var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold">Sincronizacion</p>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Copia diaria compartida, con fecha de actualización y cobertura explícitas.
        </p>
      </div>

      <form action={syncAction} className={cardClassName}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="stream" value="contacts" />
        <p>La actualización desde Zeta está prevista diariamente a las 18:00, hora de Montevideo, con Convertilabs Local encendido. Las consultas habituales usan Supabase.</p>
        <SubmitButton disabled={disabled} pendingLabel="Consultando copia..." className={secondaryButtonClassName}>
          Actualizar estado de la copia
        </SubmitButton>
      </form>
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
