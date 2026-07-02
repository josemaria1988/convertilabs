import { MoneyDashboard } from "@/components/money/money-dashboard";
import { LoadingLink } from "@/components/ui/loading-link";
import type { ReactNode } from "react";
import {
  confirmTreasuryValeRenewalAction,
  createTreasuryBankAccountAction,
  createTreasuryManualReceivableAction,
  createTreasuryValeAction,
  markTreasuryManualReceivableCollectedAction,
  recordTreasuryValeClosureAction,
  recordTreasuryValeRenewalAction,
  updateTreasuryBankBalanceAction,
  updateTreasuryManualReceivableAction,
  updateTreasuryReserveRuleAction,
} from "@/app/app/o/[slug]/money/actions";
import {
  simulateWithdrawal,
  treasuryMinorToDisplay,
  type TreasuryDashboardData,
  type TreasuryManualReceivable,
  type TreasuryVale,
} from "@/modules/treasury";
import type { MoneyDashboardData } from "@/modules/money";

type TreasuryTab = "summary" | "banks" | "vales" | "receivables" | "open-items" | "subledger";

type TreasuryWorkspaceProps = {
  slug: string;
  data: TreasuryDashboardData;
  moneyData: MoneyDashboardData;
  activeTab: TreasuryTab;
  withdrawalCurrency?: string | null;
  withdrawalAmount?: string | null;
};

const tabs: Array<{ key: TreasuryTab; label: string }> = [
  { key: "summary", label: "Resumen" },
  { key: "banks", label: "Bancos" },
  { key: "vales", label: "Vales" },
  { key: "receivables", label: "Por cobrar" },
  { key: "open-items", label: "Deudores/Acreedores" },
  { key: "subledger", label: "Subledger" },
];
const ZERO_MINOR = BigInt(0);

function parseAmount(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function toMinor(value: number) {
  return BigInt(Math.round(value * 100));
}

function formatMoneyMinor(value: bigint, currencyCode = "UYU") {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(treasuryMinorToDisplay(value));
}

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
  if (["CRITICAL", "critical", "RED", "high"].includes(value)) {
    return "danger";
  }

  if (["YELLOW", "medium"].includes(value)) {
    return "warning";
  }

  if (["GREEN", "low"].includes(value)) {
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

function currencyOptions() {
  return (
    <>
      <option value="UYU">UYU</option>
      <option value="USD">USD</option>
      <option value="EUR">EUR</option>
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

function HiddenContext({ slug }: { slug: string }) {
  return <input type="hidden" name="slug" value={slug} />;
}

function Tabs({ slug, activeTab }: { slug: string; activeTab: TreasuryTab }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Secciones de tesoreria">
      {tabs.map((tab) => (
        <LoadingLink
          key={tab.key}
          href={`/app/o/${slug}/money?tab=${tab.key}`}
          pendingLabel="Abriendo..."
          className="ui-tab"
          data-current={tab.key === activeTab ? "true" : undefined}
        >
          {tab.label}
        </LoadingLink>
      ))}
    </nav>
  );
}

function UnavailableState({ slug, moneyData }: { slug: string; moneyData: MoneyDashboardData }) {
  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold text-white">Tesoreria</h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              El schema de tesoreria todavia no esta disponible en esta base. Se mantiene la vista actual de deudores y acreedores.
            </p>
          </div>
          <span className="status-pill status-pill--warning">Schema pendiente</span>
        </div>
      </section>
      <MoneyDashboard slug={slug} data={moneyData} />
    </div>
  );
}

function SummaryTab({
  data,
  withdrawalCurrency,
  withdrawalAmount,
}: {
  data: TreasuryDashboardData;
  withdrawalCurrency?: string | null;
  withdrawalAmount?: string | null;
}) {
  const selectedCurrency = withdrawalCurrency ?? data.currencies[0]?.currencyCode ?? "UYU";
  const selectedSummary = data.currencies.find((summary) => summary.currencyCode === selectedCurrency)
    ?? data.currencies[0]
    ?? null;
  const requestedWithdrawal = parseAmount(withdrawalAmount);
  const withdrawalResult = selectedSummary && requestedWithdrawal > 0
    ? simulateWithdrawal({
      conservativeAvailableCashMinor: selectedSummary.conservativeAvailableCashMinor,
      withdrawalAmountMinor: toMinor(requestedWithdrawal),
    })
    : null;

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Caja disponible real</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Disponible real = saldo bancario - vencimientos - pagos inevitables - colchon minimo.
            </p>
          </div>
          <span className="ui-filter">{data.today}</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.currencies.length === 0 ? (
            <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
              Crea una cuenta bancaria o un colchon para empezar a calcular tesoreria.
            </div>
          ) : data.currencies.map((summary) => (
            <article key={summary.currencyCode} className="metric-card" data-tone={riskTone(summary.status)}>
              <span className="metric-card__label">Caja libre {summary.currencyCode}</span>
              <span className="metric-card__value">
                {formatMoneyMinor(summary.conservativeAvailableCashMinor, summary.currencyCode)}
              </span>
              <p className="metric-card__hint">{summary.message}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ui-panel">
        <div className="grid gap-3 xl:grid-cols-3">
          {data.currencies.map((summary) => (
            <div key={summary.currencyCode} className="rounded-[6px] border border-[color:var(--color-border)] bg-white/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-white">{summary.currencyCode}</h3>
                <span className={`status-pill status-pill--${riskTone(summary.status)}`}>{summary.status}</span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="ui-subtle-row"><span>Saldo bancos</span><span>{formatMoneyMinor(summary.bankBalanceMinor, summary.currencyCode)}</span></div>
                <div className="ui-subtle-row"><span>Comprometido 7 dias</span><span>{formatMoneyMinor(summary.conservativeOutflow7Minor, summary.currencyCode)}</span></div>
                <div className="ui-subtle-row"><span>Comprometido 30 dias</span><span>{formatMoneyMinor(summary.conservativeOutflow30Minor, summary.currencyCode)}</span></div>
                <div className="ui-subtle-row"><span>Comprometido 45 dias</span><span>{formatMoneyMinor(summary.conservativeOutflow45Minor, summary.currencyCode)}</span></div>
                <div className="ui-subtle-row"><span>Caja planificada</span><span>{formatMoneyMinor(summary.plannedAvailableCashMinor, summary.currencyCode)}</span></div>
                <div className="ui-subtle-row"><span>Colchon minimo</span><span>{formatMoneyMinor(summary.minBufferMinor, summary.currencyCode)}</span></div>
                <div className="ui-subtle-row"><span>Por cobrar confirmado 30d</span><span>{formatMoneyMinor(summary.confirmedReceivables30Minor, summary.currencyCode)}</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Alertas</h2>
            <span className="ui-filter">{data.alerts.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {data.alerts.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">Sin alertas de tesoreria.</div>
            ) : data.alerts.slice(0, 8).map((alert) => (
              <div key={alert.key} className={`alert-dark-${riskTone(alert.riskLevel)} rounded-[6px] p-3`}>
                <p className="font-semibold">{alert.title}</p>
                <p className="mt-1 text-sm opacity-85">{alert.message}</p>
                {alert.dueDate ? <p className="mt-2 text-xs opacity-75">Vence {formatDate(alert.dueDate)}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Simulador</h2>
            <span className="ui-filter">Retiro</span>
          </div>
          <form className="mt-4 grid gap-3" method="get">
            <input type="hidden" name="tab" value="summary" />
            <Field label="Moneda" name="withdrawalCurrency">
              <select name="withdrawalCurrency" defaultValue={selectedCurrency} className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">
                {data.currencies.map((summary) => (
                  <option key={summary.currencyCode} value={summary.currencyCode}>{summary.currencyCode}</option>
                ))}
              </select>
            </Field>
            <Field label="Monto a retirar/gastar" name="withdrawalAmount" type="number" defaultValue={withdrawalAmount ?? ""} />
            <button className="ui-button ui-button--primary" type="submit">Simular</button>
          </form>
          {withdrawalResult && selectedSummary ? (
            <div className={`mt-4 alert-dark-${withdrawalResult.allowed ? riskTone(withdrawalResult.risk === "LOW" ? "low" : "medium") : "danger"} rounded-[6px] p-3`}>
              <p className="font-semibold">{withdrawalResult.allowed ? "Posible con cuidado" : "No recomendado"}</p>
              <p className="mt-1 text-sm">{withdrawalResult.message}</p>
              <p className="mt-2 text-sm">
                Despues: {formatMoneyMinor(withdrawalResult.afterWithdrawalMinor, selectedSummary.currencyCode)}
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <h2 className="text-[16px] font-semibold text-white">Proyeccion 45 dias</h2>
          <span className="ui-filter">{data.projections.length}</span>
        </div>
        <div className="mt-4 space-y-2">
          {data.projections.slice(0, 16).map((event) => (
            <div key={event.id} className="ui-subtle-row">
              <span className="min-w-0">
                <span className="block truncate text-white">{event.label}</span>
                <span className="block text-[12px] text-[color:var(--color-muted)]">
                  {formatDate(event.date)} / {event.scenario} / {event.currencyCode}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-white">
                  {event.inflowMinor > ZERO_MINOR ? "+" : event.outflowMinor > ZERO_MINOR ? "-" : ""}
                  {formatMoneyMinor(event.inflowMinor > ZERO_MINOR ? event.inflowMinor : event.outflowMinor, event.currencyCode)}
                </span>
                <span className="block text-[12px] text-[color:var(--color-muted)]">
                  saldo {formatMoneyMinor(event.projectedBalanceMinor, event.currencyCode)}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function BanksTab({ slug, data }: { slug: string; data: TreasuryDashboardData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <h2 className="text-[16px] font-semibold text-white">Cuentas bancarias</h2>
          <span className="ui-filter">{data.bankAccounts.length}</span>
        </div>
        <div className="mt-4 space-y-3">
          {data.bankAccounts.length === 0 ? (
            <div className="text-sm text-[color:var(--color-muted)]">No hay cuentas bancarias cargadas.</div>
          ) : data.bankAccounts.map((account) => (
            <article key={account.id} className="rounded-[6px] border border-[color:var(--color-border)] bg-white/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">{account.bankName} / {account.name}</h3>
                  <p className="mt-1 text-sm text-[color:var(--color-muted)]">{account.accountNumber ?? "Sin referencia"} / {account.currencyCode}</p>
                </div>
                <span className="status-pill status-pill--info">{formatMoney(account.currentBalance, account.currencyCode)}</span>
              </div>
              <form action={updateTreasuryBankBalanceAction} className="mt-4 grid gap-3 md:grid-cols-4">
                <HiddenContext slug={slug} />
                <input type="hidden" name="bankAccountId" value={account.id} />
                <input type="hidden" name="currencyCode" value={account.currencyCode} />
                <Field label="Nuevo saldo" name="balance" type="number" defaultValue={account.currentBalance} />
                <Field label="Fecha saldo" name="snapshotDate" type="date" defaultValue={account.balanceDate ?? data.today} />
                <Field label="Fuente" name="source">
                  <select name="source" defaultValue="manual" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{sourceOptions()}</select>
                </Field>
                <button className="ui-button ui-button--primary self-end" type="submit">Actualizar</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <h2 className="text-[16px] font-semibold text-white">Alta y colchon</h2>
        </div>
        <form action={createTreasuryBankAccountAction} className="mt-4 grid gap-3">
          <HiddenContext slug={slug} />
          <Field label="Banco" name="bankName" required />
          <Field label="Nombre cuenta" name="name" required />
          <Field label="Numero/referencia" name="accountNumber" />
          <Field label="Moneda" name="currencyCode">
            <select name="currencyCode" defaultValue="USD" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{currencyOptions()}</select>
          </Field>
          <Field label="Tipo" name="accountType">
            <select name="accountType" defaultValue="checking" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">
              <option value="checking">Cuenta corriente</option>
              <option value="savings">Caja ahorro</option>
              <option value="credit_line">Linea credito</option>
              <option value="other">Otra</option>
            </select>
          </Field>
          <Field label="Saldo actual" name="currentBalance" type="number" defaultValue={0} />
          <Field label="Fecha saldo" name="balanceDate" type="date" defaultValue={data.today} />
          <Field label="Notas" name="notes" />
          <button className="ui-button ui-button--primary" type="submit">Crear cuenta</button>
        </form>

        <form action={updateTreasuryReserveRuleAction} className="mt-6 grid gap-3 border-t border-[color:var(--color-border)] pt-4">
          <HiddenContext slug={slug} />
          <Field label="Moneda colchon" name="currencyCode">
            <select name="currencyCode" defaultValue="USD" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{currencyOptions()}</select>
          </Field>
          <Field label="Colchon minimo" name="minBufferAmount" type="number" defaultValue={0} />
          <Field label="Horizonte dias" name="horizonDays" type="number" defaultValue={45} />
          <button className="ui-button ui-button--secondary" type="submit">Guardar colchon</button>
        </form>

        <div className="mt-6 border-t border-[color:var(--color-border)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-white">Snapshots</h3>
            <span className="ui-filter">{data.balanceSnapshots.length}</span>
          </div>
          <div className="mt-3 space-y-2">
            {data.balanceSnapshots.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">Todavia no hay snapshots de saldo.</div>
            ) : data.balanceSnapshots.slice(0, 8).map((snapshot) => (
              <div key={snapshot.id} className="ui-subtle-row">
                <span>{formatDate(snapshot.snapshotDate)}</span>
                <span>{formatMoney(snapshot.balance, snapshot.currencyCode)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ValeCard({ slug, vale, today }: { slug: string; vale: TreasuryVale; today: string }) {
  const term = vale.currentTerm;

  return (
    <article className="rounded-[6px] border border-[color:var(--color-border)] bg-white/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-white">{vale.bankName} {vale.operationNumber ? `/ ${vale.operationNumber}` : ""}</h3>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            Capital {formatMoney(vale.currentPrincipal, vale.currencyCode)} / {term ? `vence ${formatDate(term.dueDate)}` : "sin periodo activo"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`status-pill status-pill--${term ? riskTone(term.riskLevel) : "info"}`}>{term?.riskLevel ?? vale.status}</span>
          <LoadingLink href={`/app/o/${slug}/money/vales/${vale.id}`} pendingLabel="Abriendo..." className="ui-button ui-button--secondary">Detalle</LoadingLink>
        </div>
      </div>

      {term ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <details className="rounded-[6px] border border-[color:var(--color-border)] p-3">
            <summary className="cursor-pointer font-semibold text-white">Confirmar renovacion</summary>
            <form action={confirmTreasuryValeRenewalAction} className="mt-3 grid gap-2">
              <HiddenContext slug={slug} />
              <input type="hidden" name="valeId" value={vale.id} />
              <input type="hidden" name="valeTermId" value={term.id} />
              <Field label="Interes esperado" name="expectedInterestAmount" type="number" defaultValue={term.expectedInterestAmount} />
              <Field label="Gastos esperados" name="expectedFeesAmount" type="number" defaultValue={term.expectedFeesAmount} />
              <Field label="Amortizacion parcial" name="expectedPartialPrincipalPayment" type="number" defaultValue={term.expectedPartialPrincipalPayment} />
              <Field label="Nuevo capital esperado" name="expectedNewPrincipalAmount" type="number" defaultValue={term.expectedNewPrincipalAmount ?? vale.currentPrincipal} />
              <Field label="Nuevo vencimiento" name="expectedNewDueDate" type="date" defaultValue={term.expectedNewDueDate ?? today} required />
              <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" name="renewalConfirmed" defaultChecked={term.renewalConfirmed} /> Confirmada por banco</label>
              <Field label="Fuente" name="source"><select name="source" defaultValue="manual" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{sourceOptions()}</select></Field>
              <button className="ui-button ui-button--secondary" type="submit">Guardar</button>
            </form>
          </details>

          <details className="rounded-[6px] border border-[color:var(--color-border)] p-3">
            <summary className="cursor-pointer font-semibold text-white">Registrar renovacion</summary>
            <form action={recordTreasuryValeRenewalAction} className="mt-3 grid gap-2">
              <HiddenContext slug={slug} />
              <input type="hidden" name="valeId" value={vale.id} />
              <input type="hidden" name="valeTermId" value={term.id} />
              <Field label="Fecha" name="eventDate" type="date" defaultValue={term.dueDate} required />
              <Field label="Interes pagado" name="interestPaidAmount" type="number" defaultValue={term.expectedInterestAmount} />
              <Field label="Gastos pagados" name="feesPaidAmount" type="number" defaultValue={term.expectedFeesAmount} />
              <Field label="Capital amortizado" name="principalPaidAmount" type="number" defaultValue={term.expectedPartialPrincipalPayment} />
              <Field label="Nuevo capital" name="newPrincipalAmount" type="number" defaultValue={term.expectedNewPrincipalAmount ?? vale.currentPrincipal} />
              <Field label="Nuevo vencimiento" name="newDueDate" type="date" defaultValue={term.expectedNewDueDate ?? today} required />
              <Field label="Fuente" name="source"><select name="source" defaultValue="manual" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{sourceOptions()}</select></Field>
              <button className="ui-button ui-button--primary" type="submit">Registrar</button>
            </form>
          </details>

          <details className="rounded-[6px] border border-[color:var(--color-border)] p-3">
            <summary className="cursor-pointer font-semibold text-white">Registrar cierre</summary>
            <form action={recordTreasuryValeClosureAction} className="mt-3 grid gap-2">
              <HiddenContext slug={slug} />
              <input type="hidden" name="valeId" value={vale.id} />
              <input type="hidden" name="valeTermId" value={term.id} />
              <Field label="Fecha cierre" name="eventDate" type="date" defaultValue={term.dueDate} required />
              <Field label="Capital devuelto" name="principalPaidAmount" type="number" defaultValue={term.principalAmount} required />
              <Field label="Interes pagado" name="interestPaidAmount" type="number" defaultValue={term.expectedInterestAmount} />
              <Field label="Gastos pagados" name="feesPaidAmount" type="number" defaultValue={term.expectedFeesAmount} />
              <Field label="Fuente" name="source"><select name="source" defaultValue="manual" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{sourceOptions()}</select></Field>
              <button className="ui-button ui-button--primary" type="submit">Cerrar vale</button>
            </form>
          </details>
        </div>
      ) : null}
    </article>
  );
}

function ValesTab({ slug, data }: { slug: string; data: TreasuryDashboardData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <h2 className="text-[16px] font-semibold text-white">Vales bancarios</h2>
          <span className="ui-filter">{data.vales.length}</span>
        </div>
        <div className="mt-4 space-y-3">
          {data.vales.length === 0 ? (
            <div className="text-sm text-[color:var(--color-muted)]">No hay vales cargados.</div>
          ) : data.vales.map((vale) => <ValeCard key={vale.id} slug={slug} vale={vale} today={data.today} />)}
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <h2 className="text-[16px] font-semibold text-white">Crear vale</h2>
        </div>
        <form action={createTreasuryValeAction} className="mt-4 grid gap-3">
          <HiddenContext slug={slug} />
          <Field label="Cuenta bancaria" name="bankAccountId">
            <select name="bankAccountId" defaultValue="" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">
              <option value="">Sin asociar</option>
              {data.bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>{account.bankName} / {account.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Banco" name="bankName" required />
          <Field label="Operacion" name="operationNumber" />
          <Field label="Referencia interna" name="internalReference" />
          <Field label="Moneda" name="currencyCode"><select name="currencyCode" defaultValue="USD" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{currencyOptions()}</select></Field>
          <Field label="Capital" name="originalPrincipal" type="number" required />
          <Field label="Fecha emision" name="issueDate" type="date" />
          <Field label="Vencimiento" name="dueDate" type="date" defaultValue={data.today} required />
          <Field label="Interes esperado" name="expectedInterestAmount" type="number" defaultValue={0} />
          <Field label="Gastos esperados" name="expectedFeesAmount" type="number" defaultValue={0} />
          <Field label="Accion prevista" name="plannedAction"><select name="plannedAction" defaultValue="undecided" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3"><option value="undecided">Sin definir</option><option value="renew">Renovar</option><option value="close">Cerrar</option></select></Field>
          <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" name="renewalConfirmed" /> Renovacion confirmada</label>
          <Field label="Fuente" name="source"><select name="source" defaultValue="manual" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{sourceOptions()}</select></Field>
          <Field label="Texto fuente" name="sourceText" />
          <button className="ui-button ui-button--primary" type="submit">Crear vale</button>
        </form>
      </section>
    </div>
  );
}

function ReceivableRow({ slug, receivable, today }: { slug: string; receivable: TreasuryManualReceivable; today: string }) {
  return (
    <article className="rounded-[6px] border border-[color:var(--color-border)] bg-white/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{receivable.customerName}</h3>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            {receivable.documentNumber ?? "Sin documento"} / esperado {formatDate(receivable.expectedDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="status-pill status-pill--info">{formatMoney(receivable.amount, receivable.currencyCode)}</span>
          <span className={`status-pill status-pill--${receivable.daysOverdue > 0 ? "warning" : "success"}`}>{receivable.status}</span>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <form action={updateTreasuryManualReceivableAction} className="contents">
          <HiddenContext slug={slug} />
          <input type="hidden" name="receivableId" value={receivable.id} />
          <Field label="Fecha esperada" name="expectedDate" type="date" defaultValue={receivable.expectedDate} />
          <Field label="Confianza" name="confidence"><select name="confidence" defaultValue={receivable.confidence} className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3"><option value="confirmed">Confirmado</option><option value="probable">Probable</option><option value="doubtful">Dudoso</option></select></Field>
          <Field label="Estado" name="status"><select name="status" defaultValue={receivable.status} className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3"><option value="pending">Pendiente</option><option value="collected">Cobrado</option><option value="overdue">Atrasado</option><option value="cancelled">Cancelado</option></select></Field>
          <button className="ui-button ui-button--secondary self-end" type="submit">Guardar</button>
        </form>
      </div>
      {receivable.status !== "collected" ? (
        <form action={markTreasuryManualReceivableCollectedAction} className="mt-3 flex flex-wrap gap-2">
          <HiddenContext slug={slug} />
          <input type="hidden" name="receivableId" value={receivable.id} />
          <input type="date" name="collectedAt" defaultValue={today} className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3" />
          <button className="ui-button ui-button--primary" type="submit">Marcar cobrado</button>
        </form>
      ) : null}
    </article>
  );
}

function ReceivablesTab({ slug, data }: { slug: string; data: TreasuryDashboardData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <h2 className="text-[16px] font-semibold text-white">Por cobrar manual</h2>
          <span className="ui-filter">{data.manualReceivables.length}</span>
        </div>
        <div className="mt-4 space-y-3">
          {data.manualReceivables.length === 0 ? (
            <div className="text-sm text-[color:var(--color-muted)]">No hay cobros manuales cargados.</div>
          ) : data.manualReceivables.map((receivable) => (
            <ReceivableRow key={receivable.id} slug={slug} receivable={receivable} today={data.today} />
          ))}
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <h2 className="text-[16px] font-semibold text-white">Nuevo cobro esperado</h2>
        </div>
        <form action={createTreasuryManualReceivableAction} className="mt-4 grid gap-3">
          <HiddenContext slug={slug} />
          <Field label="Cliente" name="customerName" required />
          <Field label="Documento/factura" name="documentNumber" />
          <Field label="Descripcion" name="description" />
          <Field label="Moneda" name="currencyCode"><select name="currencyCode" defaultValue="USD" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{currencyOptions()}</select></Field>
          <Field label="Importe" name="amount" type="number" required />
          <Field label="Fecha emision" name="issueDate" type="date" />
          <Field label="Fecha esperada" name="expectedDate" type="date" defaultValue={data.today} required />
          <Field label="Confianza" name="confidence"><select name="confidence" defaultValue="probable" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3"><option value="confirmed">Confirmado</option><option value="probable">Probable</option><option value="doubtful">Dudoso</option></select></Field>
          <Field label="Fuente" name="source"><select name="source" defaultValue="manual" className="input-surface-dark min-h-10 rounded-[5px] border border-[color:var(--color-border)] px-3">{sourceOptions()}</select></Field>
          <Field label="Texto fuente" name="sourceText" />
          <button className="ui-button ui-button--primary" type="submit">Crear cobro</button>
        </form>
      </section>
    </div>
  );
}

export function TreasuryWorkspace({
  slug,
  data,
  moneyData,
  activeTab,
  withdrawalCurrency,
  withdrawalAmount,
}: TreasuryWorkspaceProps) {
  if (!data.isAvailable) {
    return <UnavailableState slug={slug} moneyData={moneyData} />;
  }

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold text-white">Tesoreria</h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Banco, caja libre real, vales, vencimientos y cobros proyectados.
            </p>
          </div>
          <LoadingLink href={`/app/o/${slug}/open-items`} pendingLabel="Abriendo..." className="ui-button ui-button--secondary">
            Subledger
          </LoadingLink>
        </div>
        <div className="mt-4">
          <Tabs slug={slug} activeTab={activeTab} />
        </div>
      </section>

      {activeTab === "summary" ? (
        <SummaryTab
          data={data}
          withdrawalCurrency={withdrawalCurrency}
          withdrawalAmount={withdrawalAmount}
        />
      ) : null}
      {activeTab === "banks" ? <BanksTab slug={slug} data={data} /> : null}
      {activeTab === "vales" ? <ValesTab slug={slug} data={data} /> : null}
      {activeTab === "receivables" ? <ReceivablesTab slug={slug} data={data} /> : null}
      {activeTab === "open-items" ? <MoneyDashboard slug={slug} data={moneyData} /> : null}
      {activeTab === "subledger" ? (
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Subledger contable</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Open items tecnicos para deudores, acreedores y settlements.
              </p>
            </div>
            <LoadingLink href={`/app/o/${slug}/open-items`} pendingLabel="Abriendo..." className="ui-button ui-button--primary">
              Abrir open items
            </LoadingLink>
          </div>
        </section>
      ) : null}
    </div>
  );
}
