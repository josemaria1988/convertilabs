import {
  confirmTreasuryValeRenewalAction,
  recordTreasuryValeClosureAction,
  recordTreasuryValeRenewalAction,
} from "@/app/app/o/[slug]/money/actions";
import { LoadingLink } from "@/components/ui/loading-link";
import type { TreasuryVale } from "@/modules/treasury";
import type { ReactNode } from "react";

type TreasuryValeDetailProps = {
  slug: string;
  vale: TreasuryVale;
  today: string;
};

function formatMoney(value: number, currencyCode = "UYU") {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function riskTone(value: string) {
  if (["critical", "high", "CRITICAL", "RED"].includes(value)) {
    return "danger";
  }

  if (["medium", "YELLOW"].includes(value)) {
    return "warning";
  }

  if (["low", "GREEN"].includes(value)) {
    return "success";
  }

  return "info";
}

function sourceOptions() {
  return (
    <>
      <option value="manual">Manual</option>
      <option value="web_banco">Web banco</option>
      <option value="email_ejecutiva">Email ejecutiva</option>
      <option value="otro">Otro</option>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required = false,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  children?: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm text-[color:var(--color-muted)]">
      <span>{label}</span>
      {children ?? (
        <input
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue ?? ""}
          className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3"
        />
      )}
    </label>
  );
}

function HiddenContext({
  slug,
  valeId,
  valeTermId,
}: {
  slug: string;
  valeId: string;
  valeTermId: string;
}) {
  return (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="valeId" value={valeId} />
      <input type="hidden" name="valeTermId" value={valeTermId} />
    </>
  );
}

export function TreasuryValeDetail({
  slug,
  vale,
  today,
}: TreasuryValeDetailProps) {
  const term = vale.currentTerm;

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold text-white">
              {vale.bankName} {vale.operationNumber ? `/ ${vale.operationNumber}` : ""}
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Vale bancario operativo, sin asientos ni settlements automaticos.
            </p>
          </div>
          <LoadingLink href={`/app/o/${slug}/money?tab=vales`} pendingLabel="Volviendo..." className="ui-button ui-button--secondary">
            Volver a vales
          </LoadingLink>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="metric-card" data-tone={term ? riskTone(term.riskLevel) : undefined}>
            <span className="metric-card__label">Capital actual</span>
            <span className="metric-card__value">{formatMoney(vale.currentPrincipal, vale.currencyCode)}</span>
            <p className="metric-card__hint">Capital vivo operativo.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Vencimiento</span>
            <span className="metric-card__value text-[22px]">{formatDate(term?.dueDate ?? null)}</span>
            <p className="metric-card__hint">{term ? `${term.daysUntilDue} dia(s)` : "Sin periodo pendiente."}</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Accion prevista</span>
            <span className="metric-card__value text-[22px]">{term?.plannedAction ?? vale.status}</span>
            <p className="metric-card__hint">{term?.renewalConfirmed ? "Renovacion confirmada." : "Confirmacion pendiente o no aplica."}</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Interes + gastos</span>
            <span className="metric-card__value">
              {formatMoney((term?.expectedInterestAmount ?? 0) + (term?.expectedFeesAmount ?? 0), vale.currencyCode)}
            </span>
            <p className="metric-card__hint">Costo esperado del periodo actual.</p>
          </article>
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Datos generales</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">Referencia operativa y fuente de la carga.</p>
          </div>
          <span className={`status-pill status-pill--${riskTone(term?.riskLevel ?? vale.status)}`}>{term?.riskLevel ?? vale.status}</span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <div className="ui-subtle-row"><span>Banco</span><span>{vale.bankName}</span></div>
          <div className="ui-subtle-row"><span>Operacion</span><span>{vale.operationNumber ?? "--"}</span></div>
          <div className="ui-subtle-row"><span>Referencia interna</span><span>{vale.internalReference ?? "--"}</span></div>
          <div className="ui-subtle-row"><span>Moneda</span><span>{vale.currencyCode}</span></div>
          <div className="ui-subtle-row"><span>Fuente</span><span>{vale.source}</span></div>
          <div className="ui-subtle-row"><span>Actualizado</span><span>{formatDate(vale.updatedAt)}</span></div>
        </div>
        {vale.notes ? <p className="mt-4 text-sm text-[color:var(--color-muted)]">{vale.notes}</p> : null}
      </section>

      {term ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <details className="ui-panel" open={term.plannedAction === "renew" && !term.renewalConfirmed}>
            <summary className="cursor-pointer font-semibold text-white">Confirmar renovacion futura</summary>
            <form action={confirmTreasuryValeRenewalAction} className="mt-4 grid gap-3">
              <HiddenContext slug={slug} valeId={vale.id} valeTermId={term.id} />
              <Field label="Interes esperado" name="expectedInterestAmount" type="number" defaultValue={term.expectedInterestAmount} />
              <Field label="Gastos esperados" name="expectedFeesAmount" type="number" defaultValue={term.expectedFeesAmount} />
              <Field label="Amortizacion parcial" name="expectedPartialPrincipalPayment" type="number" defaultValue={term.expectedPartialPrincipalPayment} />
              <Field label="Nuevo capital esperado" name="expectedNewPrincipalAmount" type="number" defaultValue={term.expectedNewPrincipalAmount ?? vale.currentPrincipal} />
              <Field label="Nuevo vencimiento" name="expectedNewDueDate" type="date" defaultValue={term.expectedNewDueDate ?? today} required />
              <label className="flex items-center gap-2 text-sm text-white">
                <input type="checkbox" name="renewalConfirmed" defaultChecked={term.renewalConfirmed} /> Confirmada por banco
              </label>
              <Field label="Fuente" name="source">
                <select name="source" defaultValue="manual" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{sourceOptions()}</select>
              </Field>
              <button className="ui-button ui-button--secondary" type="submit">Guardar confirmacion</button>
            </form>
          </details>

          <details className="ui-panel">
            <summary className="cursor-pointer font-semibold text-white">Registrar renovacion ejecutada</summary>
            <form action={recordTreasuryValeRenewalAction} className="mt-4 grid gap-3">
              <HiddenContext slug={slug} valeId={vale.id} valeTermId={term.id} />
              <Field label="Fecha" name="eventDate" type="date" defaultValue={term.dueDate} required />
              <Field label="Interes pagado" name="interestPaidAmount" type="number" defaultValue={term.expectedInterestAmount} />
              <Field label="Gastos pagados" name="feesPaidAmount" type="number" defaultValue={term.expectedFeesAmount} />
              <Field label="Capital amortizado" name="principalPaidAmount" type="number" defaultValue={term.expectedPartialPrincipalPayment} />
              <Field label="Nuevo capital" name="newPrincipalAmount" type="number" defaultValue={term.expectedNewPrincipalAmount ?? vale.currentPrincipal} />
              <Field label="Nuevo vencimiento" name="newDueDate" type="date" defaultValue={term.expectedNewDueDate ?? today} required />
              <Field label="Fuente" name="source">
                <select name="source" defaultValue="manual" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{sourceOptions()}</select>
              </Field>
              <button className="ui-button ui-button--primary" type="submit">Registrar renovacion</button>
            </form>
          </details>

          <details className="ui-panel">
            <summary className="cursor-pointer font-semibold text-white">Registrar cierre</summary>
            <form action={recordTreasuryValeClosureAction} className="mt-4 grid gap-3">
              <HiddenContext slug={slug} valeId={vale.id} valeTermId={term.id} />
              <Field label="Fecha cierre" name="eventDate" type="date" defaultValue={term.dueDate} required />
              <Field label="Capital devuelto" name="principalPaidAmount" type="number" defaultValue={term.principalAmount} required />
              <Field label="Interes pagado" name="interestPaidAmount" type="number" defaultValue={term.expectedInterestAmount} />
              <Field label="Gastos pagados" name="feesPaidAmount" type="number" defaultValue={term.expectedFeesAmount} />
              <Field label="Fuente" name="source">
                <select name="source" defaultValue="manual" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{sourceOptions()}</select>
              </Field>
              <button className="ui-button ui-button--primary" type="submit">Cerrar vale</button>
            </form>
          </details>
        </section>
      ) : null}

      <section className="ui-panel overflow-hidden p-0">
        <div className="ui-panel-header border-b border-[color:var(--color-border)] px-4 py-3">
          <h2 className="text-[16px] font-semibold text-white">Terminos</h2>
          <span className="ui-filter">{vale.terms.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[960px]">
            <thead>
              <tr>
                <th>Secuencia</th>
                <th>Emision</th>
                <th>Vencimiento</th>
                <th>Accion</th>
                <th>Estado</th>
                <th className="text-right">Capital</th>
                <th className="text-right">Interes</th>
                <th className="text-right">Gastos</th>
              </tr>
            </thead>
            <tbody>
              {vale.terms.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.sequence}</td>
                  <td>{formatDate(entry.issueDate)}</td>
                  <td>{formatDate(entry.dueDate)}</td>
                  <td>{entry.plannedAction}{entry.renewalConfirmed ? " confirmado" : ""}</td>
                  <td><span className={`status-pill status-pill--${riskTone(entry.riskLevel)}`}>{entry.status}</span></td>
                  <td className="text-right">{formatMoney(entry.principalAmount, vale.currencyCode)}</td>
                  <td className="text-right">{formatMoney(entry.expectedInterestAmount, vale.currencyCode)}</td>
                  <td className="text-right">{formatMoney(entry.expectedFeesAmount, vale.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <h2 className="text-[16px] font-semibold text-white">Eventos</h2>
          <span className="ui-filter">{vale.events.length}</span>
        </div>
        <div className="mt-4 space-y-2">
          {vale.events.length === 0 ? (
            <div className="text-sm text-[color:var(--color-muted)]">Sin eventos registrados.</div>
          ) : vale.events.map((event) => (
            <div key={event.id} className="ui-subtle-row">
              <span className="min-w-0">
                <span className="block text-white">{event.eventType}</span>
                <span className="block text-[12px] text-[color:var(--color-muted)]">
                  {formatDate(event.eventDate)} / {event.source}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-white">{formatMoney(event.resultingPrincipal ?? 0, vale.currencyCode)}</span>
                <span className="block text-[12px] text-[color:var(--color-muted)]">
                  pagado {formatMoney(event.principalPaidAmount + event.interestPaidAmount + event.feesPaidAmount, vale.currencyCode)}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
