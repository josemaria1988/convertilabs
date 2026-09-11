"use client";

import { useId, useState } from "react";
import type { SupplierInvoiceGroup, SupplierInvoiceItem, SupplierInvoicesBoardProps } from "@/modules/money/supplier-invoice-types";

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-UY").trim();
}

export function filterSupplierInvoiceGroups(groups: SupplierInvoiceGroup[], query: string) {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return groups;
  return groups.filter((group) => {
    const name = normalizeSearch(group.name);
    const rut = (group.taxId ?? "").replace(/\D/g, "");
    return words.every((word) => {
      const digits = word.replace(/\D/g, "");
      return name.includes(word) || (/^[\d.\-/]+$/.test(word) && digits.length > 0 && rut.includes(digits));
    });
  });
}

/** Decimal strings are formatted without converting currencies or losing precision through Number. */
function formatAmount(value: string | null, currency: string | null) {
  if (value === null || !/^-?\d+(?:\.\d+)?$/.test(value)) return "Importe por confirmar";
  const [integer, fraction = ""] = value.split(".");
  const negative = integer.startsWith("-");
  const digits = integer.replace(/^-/, "").replace(/^0+(?=\d)/, "");
  const number = `${negative ? "−" : ""}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction.padEnd(2, "0")}`;
  return currency?.trim() ? `${currency.trim()} ${number}` : `${number} · Moneda por confirmar`;
}

function formatDate(value: string | null) {
  if (!value) return "Por confirmar";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (!match) return "Por confirmar";
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  if (!Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return "Por confirmar";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function updatedLabel(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Fecha de actualización no disponible";
  return `Actualizado ${new Intl.DateTimeFormat("es-UY", {
    timeZone: "America/Montevideo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value))}`;
}

function safeInternalHref(value: string | undefined) {
  return value?.startsWith("/app/") && !value.includes("\\") ? value : null;
}

function DueBadge({ invoice, confirmed }: { invoice: SupplierInvoiceItem; confirmed: boolean }) {
  const labels = {
    overdue: confirmed ? "Vencida" : "Fecha informada vencida",
    due_soon: "Vence en los próximos 7 días", future: "A vencer", no_due_date: "Sin vencimiento informado",
  };
  const tone = confirmed && invoice.dueState === "overdue" ? "danger" : invoice.dueState === "due_soon" ? "warning" : "info";
  return <span className={`status-pill status-pill--${tone}`}>{labels[invoice.dueState]}</span>;
}

function InvoiceRow({ invoice, confirmed }: { invoice: SupplierInvoiceItem; confirmed: boolean }) {
  const href = safeInternalHref(invoice.reviewHref);
  return (
    <li className="min-w-0 rounded-md border border-[color:var(--color-border)] bg-white/[0.025] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold text-[color:var(--color-foreground)]">{invoice.number ? `Factura ${invoice.number}` : "Número por confirmar"}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div><dt className="text-[color:var(--color-muted)]">Emisión</dt><dd className="mt-0.5">{formatDate(invoice.issuedAt)}</dd></div>
            <div><dt className="text-[color:var(--color-muted)]">Vencimiento</dt><dd className="mt-0.5">{invoice.dueAt ? formatDate(invoice.dueAt) : "Sin informar"}</dd></div>
          </dl>
        </div>
        <div className="min-w-0 sm:text-right">
          <p className="text-xs text-[color:var(--color-muted)]">{confirmed ? "Saldo pendiente" : "Importe por verificar"}</p>
          <p className="mt-0.5 break-words text-base font-semibold tabular-nums">{formatAmount(invoice.amount, invoice.currency)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <DueBadge invoice={invoice} confirmed={confirmed} />
        {href ? <a href={href} className="ui-button ui-button--secondary min-h-11 w-full sm:w-auto" aria-label={`Revisar factura ${invoice.number ?? "sin número"}`}>Revisar factura</a> : <span className="text-xs text-[color:var(--color-muted)]">Revisión no disponible</span>}
      </div>
      {invoice.reason ? <p className="mt-2 break-words text-xs leading-relaxed text-[color:var(--color-muted)]">{invoice.reason}</p> : null}
    </li>
  );
}

function SupplierCard({ supplier, confirmed }: { supplier: SupplierInvoiceGroup; confirmed: boolean }) {
  const overdue = supplier.invoices.filter((invoice) => invoice.dueState === "overdue").length;
  const soon = supplier.invoices.filter((invoice) => invoice.dueState === "due_soon").length;
  const noDue = supplier.invoices.filter((invoice) => invoice.dueState === "no_due_date").length;
  return (
    <details className="group min-w-0 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)]" data-supplier-id={supplier.id}>
      <summary className="cursor-pointer list-none rounded-md p-4 outline-offset-4 transition hover:bg-white/[0.025] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="break-words text-base font-semibold text-[color:var(--color-foreground)]">{supplier.name.trim() || "Proveedor por identificar"}</h4>
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">{supplier.taxId ? `RUT ${supplier.taxId}` : "RUT por confirmar"}</p>
          </div>
          <span aria-hidden="true" className="mt-1 shrink-0 text-[color:var(--color-muted)] transition-transform group-open:rotate-180">⌄</span>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-[color:var(--color-muted)]">{confirmed ? "Saldo pendiente" : "Importes por confirmar"}</p>
            {supplier.totals.length ? supplier.totals.map((total) => <p key={total.currency} className="break-words text-lg font-semibold tabular-nums">{formatAmount(total.amount, total.currency)}</p>) : <p className="text-sm text-[color:var(--color-muted)]">Importe por confirmar</p>}
          </div>
          <span className="text-xs font-medium text-[color:var(--color-muted)]">Ver {supplier.invoices.length} {supplier.invoices.length === 1 ? "factura" : "facturas"}</span>
        </div>
        {confirmed && (overdue > 0 || soon > 0 || noDue > 0) ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {overdue > 0 ? <span className="status-pill status-pill--danger">{overdue} {overdue === 1 ? "vencida" : "vencidas"}</span> : null}
            {soon > 0 ? <span className="status-pill status-pill--warning">{soon} {soon === 1 ? "próxima" : "próximas"}</span> : null}
            {noDue > 0 ? <span className="status-pill status-pill--info">{noDue} sin vencimiento</span> : null}
          </div>
        ) : null}
      </summary>
      <div className="border-t border-[color:var(--color-border)] px-3 py-3">
        {!confirmed ? <p className="mb-3 text-xs leading-relaxed text-[color:var(--color-muted)]">Revisá el comprobante y cómo se pagó para confirmar si queda un saldo pendiente.</p> : null}
        <ul className="space-y-2">{supplier.invoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} confirmed={confirmed} />)}</ul>
      </div>
    </details>
  );
}

function BoardSection({ groups, confirmed, emptyMessage, id, unavailable, wide }: { groups: SupplierInvoiceGroup[]; confirmed: boolean; emptyMessage: string; id: string; unavailable: boolean; wide: boolean }) {
  const invoiceCount = groups.reduce((sum, group) => sum + group.invoices.length, 0);
  return (
    <section aria-labelledby={id} className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="text-base font-semibold">{confirmed ? "Pendientes de pago" : "Por confirmar"}</h3>
        <span className={`status-pill status-pill--${confirmed ? "info" : "warning"}`}>{unavailable && !groups.length ? "Sin datos" : `${invoiceCount} ${invoiceCount === 1 ? "factura" : "facturas"}`}</span>
      </div>
      {groups.length > 0 ? <p className="text-sm leading-relaxed text-[color:var(--color-muted)]">{confirmed ? "Saldos pendientes respaldados por los registros disponibles." : "Facturas recibidas cuyo pago o saldo todavía necesita revisión."}</p> : null}
      {groups.length ? <div className={`grid min-w-0 items-start gap-3 ${wide && groups.length > 1 ? "md:grid-cols-2" : ""}`}>{groups.map((supplier) => <SupplierCard key={supplier.id} supplier={supplier} confirmed={confirmed} />)}</div> : <p className="rounded-md border border-dashed border-[color:var(--color-border)] px-3 py-2 text-sm leading-relaxed text-[color:var(--color-muted)]">{emptyMessage}</p>}
    </section>
  );
}

export function SupplierInvoicesBoard(props: SupplierInvoicesBoardProps) {
  const [query, setQuery] = useState("");
  const id = useId();
  const confirmed = filterSupplierInvoiceGroups(props.confirmed, query);
  const unconfirmed = filterSupplierInvoiceGroups(props.unconfirmed, query);
  const bothSectionsHaveData = confirmed.length > 0 && unconfirmed.length > 0;
  const searching = query.trim().length > 0;
  const unavailable = props.coverage.status === "unavailable";
  const hasData = props.confirmed.length + props.unconfirmed.length > 0;
  const empty = searching ? "Ningún proveedor coincide con la búsqueda." : unavailable || props.error
    ? "No hay información suficiente para mostrar este bloque." : "No hay facturas en este grupo entre los registros disponibles.";
  const pendingHref = safeInternalHref(props.inboxPendingHref);
  return (
    <section aria-labelledby={`${id}-title`} className="ui-panel min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight">Facturas de proveedores</h2>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">Facturas recibidas en Convertilabs, agrupadas por proveedor.</p>
        </div>
        <p className="text-xs leading-relaxed text-[color:var(--color-muted)]">{updatedLabel(props.updatedAt)}</p>
      </div>
      {props.error ? <div role="alert" className="rounded-md border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">No pudimos cargar toda la información. Volvé a abrir Inicio en unos momentos.</div> : null}
      {props.coverage.status !== "complete" ? <div role="status" className="rounded-md border border-[color:var(--color-border)] bg-white/[0.025] p-3 text-sm leading-relaxed text-[color:var(--color-muted)]"><span className="font-semibold text-[color:var(--color-foreground)]">{unavailable ? "Información no disponible. " : "Información parcial. "}</span>{props.coverage.message ?? (unavailable ? "Todavía no podemos confirmar el estado de las facturas." : "Puede haber facturas o pagos que aún no estén incorporados.")}</div> : null}
      {props.inboxPendingCount !== undefined && props.inboxPendingCount > 0 ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300/20 bg-amber-400/5 p-3 text-sm"><p>{props.inboxPendingCount} {props.inboxPendingCount === 1 ? "comprobante recibido necesita" : "comprobantes recibidos necesitan"} revisión antes de aparecer aquí.</p>{pendingHref ? <a href={pendingHref} className="ui-button ui-button--secondary min-h-11">Revisar recibidos</a> : null}</div> : null}
      {hasData ? <div className="space-y-2"><label htmlFor={`${id}-search`} className="block text-sm font-medium">Buscar proveedor</label><div className="flex flex-wrap gap-2"><input id={`${id}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o RUT" className="min-h-11 min-w-0 flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-strong)] px-3 text-base text-[color:var(--color-foreground)] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]" />{searching ? <button type="button" onClick={() => setQuery("")} className="ui-button ui-button--secondary min-h-11">Limpiar</button> : null}</div><p aria-live="polite" className="text-xs text-[color:var(--color-muted)]">{confirmed.length + unconfirmed.length} {confirmed.length + unconfirmed.length === 1 ? "grupo de proveedor" : "grupos de proveedores"}{searching ? " en la búsqueda" : " disponibles"}</p></div> : null}
      <div className={`grid min-w-0 gap-6 ${bothSectionsHaveData ? "lg:grid-cols-2" : ""}`}>
        <BoardSection groups={confirmed} confirmed emptyMessage={empty} id={`${id}-confirmed`} unavailable={unavailable || Boolean(props.error)} wide={!bothSectionsHaveData} />
        <BoardSection groups={unconfirmed} confirmed={false} emptyMessage={empty} id={`${id}-unconfirmed`} unavailable={unavailable || Boolean(props.error)} wide={!bothSectionsHaveData} />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[color:var(--color-border)] pt-3 text-xs leading-relaxed text-[color:var(--color-muted)]">
        <p>Los importes se muestran por moneda.</p>
        {props.excludedPaidCount !== undefined ? <p>{props.excludedPaidCount} {props.excludedPaidCount === 1 ? "factura con pago registrado queda fuera" : "facturas con pago registrado quedan fuera"} de los pendientes.</p> : null}
      </div>
    </section>
  );
}
