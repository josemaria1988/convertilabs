import type { ZetaConnectionSettings } from "@/modules/integrations/zeta/services/connection-service";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { SubmitButton } from "@/components/ui/submit-button";

type ZetaSoftwareConnectionCardProps = {
  slug: string;
  connection: ZetaConnectionSettings;
  canManage: boolean;
  saveAction: (formData: FormData) => Promise<void>;
  testAction: (formData: FormData) => Promise<void>;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Nunca";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClassName(status: ZetaConnectionSettings["status"]) {
  switch (status) {
    case "connected":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
    case "paused":
      return "border-amber-500/30 bg-amber-500/10 text-amber-100";
    case "error":
      return "border-red-500/30 bg-red-500/10 text-red-100";
    default:
      return "border-white/15 bg-white/10 text-[color:var(--color-muted)]";
  }
}

export function ZetaSoftwareConnectionCard({
  slug,
  connection,
  canManage,
  saveAction,
  testAction,
}: ZetaSoftwareConnectionCardProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-base font-semibold">Zetasoftware</p>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            Conexion de lectura para traer datos estructurados cuando el contrato REST este confirmado.
          </p>
        </div>
        <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName(connection.status)}`}>
          {connection.statusLabel}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-3 text-sm">
          <p className="font-semibold">Modo</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {connection.mockEnabled ? "Mock controlado" : "Real pendiente de PR-01"}
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-3 text-sm">
          <p className="font-semibold">Ultima prueba</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {formatDateTime(connection.lastConnectionTestAt)}
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-3 text-sm">
          <p className="font-semibold">Secreto</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {connection.hasStoredSecret ? connection.maskedSecretLabel : "No guardado"}
          </p>
        </div>
      </div>

      {connection.lastError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {connection.lastError}
        </div>
      ) : null}

      {!canManage ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 px-4 py-3 text-sm text-[color:var(--color-muted)]">
          Tu rol actual puede consultar el estado, pero no administrar credenciales externas.
        </div>
      ) : null}

      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="slug" value={slug} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Codigo de empresa Zeta</span>
            <input
              name="companyCode"
              defaultValue={connection.companyCode ?? ""}
              disabled={!canManage}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 disabled:opacity-60"
              placeholder="Ej: RONTIL"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Usuario o API key</span>
            <input
              name="username"
              defaultValue={connection.username ?? ""}
              disabled={!canManage}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 disabled:opacity-60"
              placeholder="Usuario autorizado"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Clave o secreto</span>
            <input
              type="password"
              name="secret"
              disabled={!canManage}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 disabled:opacity-60"
              placeholder={connection.hasStoredSecret ? "Dejar vacio para conservar" : "Disponible cuando PR-01 confirme el contrato"}
              autoComplete="new-password"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Base URL aprobada</span>
            <input
              name="baseUrl"
              defaultValue={connection.baseUrl ?? ""}
              disabled={!canManage}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 disabled:opacity-60"
              placeholder="Pendiente de Postman/PR-01"
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="inline-flex items-center gap-3 text-sm text-[color:var(--color-muted)]">
            <input
              type="checkbox"
              name="mockEnabled"
              defaultChecked={connection.mockEnabled}
              disabled={!canManage}
              className="h-4 w-4 rounded border-white/20 bg-transparent disabled:opacity-60"
            />
            <span>Usar modo mock hasta confirmar el health oficial</span>
          </label>

          <label className="inline-flex items-center gap-3 text-sm text-[color:var(--color-muted)]">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={connection.status !== "paused"}
              disabled={!canManage}
              className="h-4 w-4 rounded border-white/20 bg-transparent disabled:opacity-60"
            />
            <span>Mantener conexion activa</span>
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <SubmitButton
            pendingLabel="Guardando Zeta..."
            disabled={!canManage}
            className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-5 py-3 text-sm`}
          >
            Guardar conexion Zeta
          </SubmitButton>
        </div>
      </form>

      <form action={testAction}>
        <input type="hidden" name="slug" value={slug} />
        <SubmitButton
          pendingLabel="Probando conexion..."
          disabled={!canManage || !connection.isConfigured}
          className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-5 py-3 text-sm`}
        >
          Probar conexion
        </SubmitButton>
      </form>
    </div>
  );
}
