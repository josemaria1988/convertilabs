import { LoadingLink } from "@/components/ui/loading-link";
import type {
  MoneyDashboardData,
  MoneyGroup,
  MoneyItem,
} from "@/modules/money";

type MoneyDashboardProps = {
  slug: string;
  data: MoneyDashboardData;
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

function directionLabel(value: MoneyItem["direction"]) {
  return value === "receivable" ? "Cobro" : "Pago";
}

function directionPill(value: MoneyItem["direction"]) {
  return value === "receivable"
    ? "status-pill status-pill--success"
    : "status-pill status-pill--warning";
}

function itemHref(slug: string, item: MoneyItem) {
  if (item.sourceDocumentId) {
    return `/app/o/${slug}/documents/${item.sourceDocumentId}`;
  }

  if (item.workUnitId) {
    return `/app/o/${slug}/work/${item.workUnitId}`;
  }

  return `/app/o/${slug}/open-items?item=${item.id}`;
}

function MoneyItemList({
  slug,
  items,
  emptyLabel,
}: {
  slug: string;
  items: MoneyItem[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 8).map((item) => (
        <LoadingLink
          key={item.id}
          href={itemHref(slug, item)}
          pendingLabel="Abriendo..."
          className="block rounded-[6px] border border-[color:var(--color-border)] bg-white/70 p-4 transition hover:bg-white/85"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{item.partyName}</p>
              <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                {item.workUnitName ?? "Sin trabajo"} / {formatDate(item.dueDate)}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <span className={directionPill(item.direction)}>{directionLabel(item.direction)}</span>
              <span className="status-pill status-pill--info">
                {formatMoney(item.displayAmount, item.currencyCode)}
              </span>
              {item.daysOverdue > 0 ? (
                <span className="status-pill status-pill--danger">{item.daysOverdue} dia(s)</span>
              ) : null}
            </div>
          </div>
        </LoadingLink>
      ))}
    </div>
  );
}

function MoneyGroupList({
  groups,
  emptyLabel,
}: {
  groups: MoneyGroup[];
  emptyLabel: string;
}) {
  if (groups.length === 0) {
    return <div className="text-sm text-[color:var(--color-muted)]">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-2">
      {groups.slice(0, 8).map((group) => {
        const content = (
          <>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-white">{group.label}</span>
              <span className="block text-[12px] text-[color:var(--color-muted)]">
                {group.secondaryLabel ?? `${group.count} partida(s)`}
              </span>
            </span>
            <span className="text-right">
              <span className="block font-semibold text-white">{formatMoney(group.outstandingAmount)}</span>
              <span className="block text-[12px] text-[color:var(--color-muted)]">
                {group.overdueCount} vencido(s) / {group.dueSoonCount} semana
              </span>
            </span>
          </>
        );

        return group.href ? (
          <LoadingLink
            key={group.key}
            href={group.href}
            pendingLabel="Abriendo..."
            className="ui-subtle-row"
          >
            {content}
          </LoadingLink>
        ) : (
          <div key={group.key} className="ui-subtle-row">
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function MoneyDashboard({
  slug,
  data,
}: MoneyDashboardProps) {
  if (!data.isAvailable) {
    return (
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Deudores/Acreedores
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              La vista de open items todavia no esta disponible en esta base.
            </p>
          </div>
          <span className="status-pill status-pill--warning">Schema pendiente</span>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Deudores/Acreedores
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Deudores, acreedores, vencimientos y saldos vivos conectados a parties, documentos y trabajos.
            </p>
          </div>
          <LoadingLink
            href={`/app/o/${slug}/open-items`}
            pendingLabel="Abriendo..."
            className="ui-button ui-button--secondary"
          >
            Subledger
          </LoadingLink>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <article className="metric-card" data-tone={data.summary.receivableAmount > 0 ? "success" : undefined}>
            <span className="metric-card__label">Deudores</span>
            <span className="metric-card__value">{formatMoney(data.summary.receivableAmount)}</span>
            <p className="metric-card__hint">{data.summary.receivableCount} cobro(s) pendiente(s).</p>
          </article>
          <article className="metric-card" data-tone={data.summary.payableAmount > 0 ? "warning" : undefined}>
            <span className="metric-card__label">Acreedores</span>
            <span className="metric-card__value">{formatMoney(data.summary.payableAmount)}</span>
            <p className="metric-card__hint">{data.summary.payableCount} pago(s) pendiente(s).</p>
          </article>
          <article className="metric-card" data-tone={data.summary.overdueCount > 0 ? "danger" : undefined}>
            <span className="metric-card__label">Vencidos</span>
            <span className="metric-card__value">{data.summary.overdueCount}</span>
            <p className="metric-card__hint">{formatMoney(data.summary.overdueAmount)} en saldos vencidos.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Esta semana</span>
            <span className="metric-card__value">{data.summary.dueSoonCount}</span>
            <p className="metric-card__hint">{formatMoney(data.summary.dueSoonAmount)} por vencer.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Neto visible</span>
            <span className="metric-card__value">{formatMoney(data.summary.netPosition)}</span>
            <p className="metric-card__hint">Deudores menos acreedores visibles.</p>
          </article>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Cobros pendientes</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Cuentas a cobrar asociadas a clientes y ventas.
              </p>
            </div>
            <span className="ui-filter">{data.receivables.length}</span>
          </div>
          <div className="mt-4">
            <MoneyItemList slug={slug} items={data.receivables} emptyLabel="No hay cobros pendientes." />
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Pagos pendientes</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Cuentas a pagar asociadas a proveedores y gastos.
              </p>
            </div>
            <span className="ui-filter">{data.payables.length}</span>
          </div>
          <div className="mt-4">
            <MoneyItemList slug={slug} items={data.payables} emptyLabel="No hay pagos pendientes." />
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Vencidos</h2>
            <span className="ui-filter">{data.overdue.length}</span>
          </div>
          <div className="mt-4">
            <MoneyItemList slug={slug} items={data.overdue} emptyLabel="No hay saldos vencidos." />
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Vencen esta semana</h2>
            <span className="ui-filter">{data.dueSoon.length}</span>
          </div>
          <div className="mt-4">
            <MoneyItemList slug={slug} items={data.dueSoon} emptyLabel="No hay vencimientos en los proximos 7 dias." />
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Por cliente/proveedor</h2>
            <span className="ui-filter">{data.summary.partiesWithBalance}</span>
          </div>
          <div className="mt-4">
            <MoneyGroupList groups={data.byParty} emptyLabel="Sin parties con saldo vivo." />
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Por trabajo</h2>
            <span className="ui-filter">{data.summary.workUnitsWithBalance}</span>
          </div>
          <div className="mt-4">
            <MoneyGroupList groups={data.byWorkUnit} emptyLabel="Sin trabajos con saldo vivo." />
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Caja/Bancos basico</h2>
            <span className="ui-filter">MVP</span>
          </div>
          <div className="mt-4 space-y-3">
            <div className="ui-subtle-row">
              <span>Fuente actual</span>
              <span>Open items</span>
            </div>
            <div className="ui-subtle-row">
              <span>Settlements visibles</span>
              <span>{data.items.reduce((sum, item) => sum + item.settlementCount, 0)}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Conciliacion bancaria</span>
              <span>Posterior</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
