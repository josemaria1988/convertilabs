import { SubmitButton } from "@/components/ui/submit-button";
import type {
  ZetaOperationalCatalogOption,
  ZetaPurchaseExpenseConfiguration,
} from "@/modules/integrations/zeta/export/configuration-service";

type ZetaSoftwarePurchaseExpenseConfigProps = {
  slug: string;
  isConfigured: boolean;
  mockEnabled: boolean;
  canManage: boolean;
  configuration: ZetaPurchaseExpenseConfiguration;
  saveAction: (formData: FormData) => void | Promise<void>;
};

const selectClassName = "input-surface-dark w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm text-[color:var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-60";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function suggestedValue(input: {
  configured: string;
  options: ZetaOperationalCatalogOption[];
  nameIncludes?: string[];
}) {
  if (input.configured) {
    return input.configured;
  }

  if (input.options.length === 1) {
    return input.options[0]?.code ?? "";
  }

  for (const search of input.nameIncludes ?? []) {
    const matches = input.options.filter((option) =>
      normalizeSearch(option.label).includes(normalizeSearch(search)));

    if (matches.length === 1) {
      return matches[0]?.code ?? "";
    }
  }

  return "";
}

function CatalogSelect({
  name,
  label,
  configured,
  options,
  disabled,
  optional = false,
  nameIncludes,
}: {
  name: string;
  label: string;
  configured: string;
  options: ZetaOperationalCatalogOption[];
  disabled: boolean;
  optional?: boolean;
  nameIncludes?: string[];
}) {
  const defaultValue = suggestedValue({ configured, options, nameIncludes });

  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        required={!optional}
        className={selectClassName}
      >
        <option value="">{optional ? "No configurar por ahora" : "Seleccionar codigo Zeta"}</option>
        {options.map((option) => (
          <option key={`${name}-${option.code}`} value={option.code}>
            {option.label}{option.detail ? ` · ${option.detail}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ZetaSoftwarePurchaseExpenseConfig({
  slug,
  isConfigured,
  mockEnabled,
  canManage,
  configuration,
  saveAction,
}: ZetaSoftwarePurchaseExpenseConfigProps) {
  const catalogs = configuration.catalogs;
  const current = configuration.current;
  const requiredCatalogsReady = [
    catalogs.creditDocumentTypes,
    catalogs.cashDocumentTypes,
    catalogs.creditNoteDocumentTypes,
    catalogs.concepts,
    catalogs.paymentTerms,
    catalogs.paymentMethods,
    catalogs.uyuCurrencies,
    catalogs.businessLocations,
    catalogs.users,
    catalogs.cashboxes,
  ].every((options) => options.length > 0);
  const disabled = !isConfigured || !canManage || !requiredCatalogsReady;
  const statusLabel = configuration.status === "ready"
    ? "Lista para envio real"
    : configuration.status === "ready_to_enable"
      ? "Configurada; escritura apagada"
      : "Configuracion pendiente";

  return (
    <section className="space-y-4 rounded-lg border border-[color:var(--color-border)] bg-[rgba(37,46,63,0.76)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold">Salida de facturas de gasto</p>
          <p className="mt-1 max-w-3xl text-sm text-[color:var(--color-muted)]">
            Elegi una vez los codigos reales de esta empresa. Convertilabs los valida contra los maestros sincronizados antes de guardarlos.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${
          configuration.status === "ready" ? "badge-dark-success" : "badge-dark-warning"
        }`}>
          {statusLabel}
        </span>
      </div>

      {!requiredCatalogsReady ? (
        <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Faltan maestros requeridos. Ejecuta <strong>Sincronizar maestros</strong> antes de guardar esta configuracion.
          {!catalogs.users.length ? " La nueva sincronizacion tambien trae el usuario/rol operativo." : ""}
        </div>
      ) : null}

      <form action={saveAction} className="space-y-5">
        <input type="hidden" name="slug" value={slug} />

        <div className="grid gap-3 md:grid-cols-3">
          <CatalogSelect
            name="purchaseExpenseCreditDocumentCode"
            label="Comprobante gasto a credito"
            configured={current.purchaseExpenseCreditDocumentCode}
            options={catalogs.creditDocumentTypes}
            disabled={disabled}
          />
          <CatalogSelect
            name="purchaseExpenseCashDocumentCode"
            label="Comprobante gasto contado"
            configured={current.purchaseExpenseCashDocumentCode}
            options={catalogs.cashDocumentTypes}
            disabled={disabled}
          />
          <CatalogSelect
            name="supplierCreditNoteExpenseDocumentCode"
            label="Nota de credito de gasto"
            configured={current.supplierCreditNoteExpenseDocumentCode}
            options={catalogs.creditNoteDocumentTypes}
            disabled={disabled}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <CatalogSelect
            name="defaultConceptCode"
            label="Concepto fallback para dry-run (opcional)"
            configured={current.defaultConceptCode}
            options={catalogs.concepts}
            disabled={disabled}
            optional
          />
          <CatalogSelect
            name="creditPaymentTermCode"
            label="Condicion de pago a credito"
            configured={current.creditPaymentTermCode}
            options={catalogs.paymentTerms}
            disabled={disabled}
            nameIncludes={["credito"]}
          />
          <CatalogSelect
            name="cashPaymentTermCode"
            label="Condicion de pago contado"
            configured={current.cashPaymentTermCode}
            options={catalogs.paymentTerms}
            disabled={disabled}
            nameIncludes={["contado"]}
          />
          <CatalogSelect
            name="cashPaymentMethodCode"
            label="Forma de pago: efectivo"
            configured={current.cashPaymentMethodCode}
            options={catalogs.paymentMethods}
            disabled={disabled}
            nameIncludes={["efectivo", "contado"]}
          />
          <CatalogSelect
            name="bankTransferPaymentMethodCode"
            label="Forma de pago: transferencia (opcional)"
            configured={current.bankTransferPaymentMethodCode}
            options={catalogs.paymentMethods}
            disabled={disabled}
            optional
            nameIncludes={["transferencia", "banco"]}
          />
          <CatalogSelect
            name="cardPaymentMethodCode"
            label="Forma de pago: tarjeta (opcional)"
            configured={current.cardPaymentMethodCode}
            options={catalogs.paymentMethods}
            disabled={disabled}
            optional
            nameIncludes={["tarjeta"]}
          />
          <CatalogSelect
            name="checkPaymentMethodCode"
            label="Forma de pago: cheque (opcional)"
            configured={current.checkPaymentMethodCode}
            options={catalogs.paymentMethods}
            disabled={disabled}
            optional
            nameIncludes={["cheque"]}
          />
          <CatalogSelect
            name="paidByPartnerPaymentTermCode"
            label="Condicion: socio a reintegrar (opcional)"
            configured={current.paidByPartnerPaymentTermCode}
            options={catalogs.paymentTerms}
            disabled={disabled}
            optional
            nameIncludes={["reintegro", "socio"]}
          />
          <CatalogSelect
            name="paidByPartnerPaymentMethodCode"
            label="Forma de pago: socio a reintegrar (opcional)"
            configured={current.paidByPartnerPaymentMethodCode}
            options={catalogs.paymentMethods}
            disabled={disabled}
            optional
            nameIncludes={["reintegro", "socio"]}
          />
          <CatalogSelect
            name="uyuCurrencyCode"
            label="Moneda UYU"
            configured={current.uyuCurrencyCode}
            options={catalogs.uyuCurrencies}
            disabled={disabled}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <CatalogSelect
            name="localCode"
            label="Local operativo"
            configured={current.localCode}
            options={catalogs.businessLocations}
            disabled={disabled}
          />
          <CatalogSelect
            name="userCode"
            label="Codigo de usuario operativo (CodigoUsuario)"
            configured={current.userCode}
            options={catalogs.users}
            disabled={disabled}
          />
          <CatalogSelect
            name="cashboxCode"
            label="Caja operativa"
            configured={current.cashboxCode}
            options={catalogs.cashboxes}
            disabled={disabled}
          />
        </div>

        <div className={`rounded-lg border px-4 py-3 ${
          configuration.writeEnabled
            ? "border-red-300/30 bg-red-500/10"
            : "border-[color:var(--color-border)] bg-[rgba(17,25,40,0.45)]"
        }`}>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="writeEnabled"
              defaultChecked={configuration.writeEnabled}
              disabled={disabled || mockEnabled}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent disabled:opacity-50"
            />
            <span>
              <strong>Habilitar escritura real de facturas en Zeta</strong>
              <span className="mt-1 block text-[color:var(--color-muted)]">
                Apagado, Convertilabs solo valida y muestra la vista previa. Encendido, el boton final del documento puede crear una compra real que no tiene borrado automatico.
              </span>
              {mockEnabled ? (
                <span className="mt-1 block text-amber-100">
                  Desactiva el modo mock y vuelve a probar la conexion antes de habilitar escritura.
                </span>
              ) : null}
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[color:var(--color-muted)]">
            {configuration.configuredCount}/{configuration.requiredCount} campos obligatorios guardados. El fallback y las formas de pago adicionales son opcionales.
          </p>
          <SubmitButton
            disabled={disabled}
            pendingLabel="Validando y guardando..."
            className="rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)] disabled:cursor-not-allowed disabled:bg-[rgba(72,82,102,0.5)] disabled:text-[color:var(--color-muted)]"
          >
            Guardar configuracion de gastos
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}
