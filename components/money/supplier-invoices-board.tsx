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

function DueLabel({ invoice, confirmed }: { invoice: SupplierInvoiceItem; confirmed: boolean }) {
  const labels = {
    overdue: confirmed ? "Vencida" : "Fecha informada vencida",
    due_soon: "Vence en los próximos 7 días", future: "A vencer", no_due_date: "Sin vencimiento informado",
  };
  const color = confirmed && invoice.dueState === "overdue" ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-muted)]";
  return <span className={`text-xs ${color}`}>{labels[invoice.dueState]}</span>;
}

function InvoiceRow({ invoice, confirmed, humanStatus }: { invoice: SupplierInvoiceItem; confirmed: boolean; humanStatus?: "paid" | "unpaid" }) {
  const href = safeInternalHref(invoice.reviewHref);
  const review = invoice.administrativeReview;
  return (
    <li className="min-w-0 border-t border-[color:var(--color-border)] py-3 first:border-0">
      <div className="grid min-w-0 grid-cols-2 items-start gap-x-4 gap-y-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] lg:items-center">
        <p className="col-span-2 break-words text-sm font-semibold lg:col-span-1">{invoice.number ? `Factura ${invoice.number}` : "Número por confirmar"}</p>
        <div className="text-sm"><p className="text-xs text-[color:var(--color-muted)] lg:sr-only">Emisión</p><p>{formatDate(invoice.issuedAt)}</p></div>
        <div className="min-w-0 text-sm"><p className="text-xs text-[color:var(--color-muted)] lg:sr-only">Vencimiento</p><p>{invoice.dueAt ? formatDate(invoice.dueAt) : "Sin informar"}</p><DueLabel invoice={invoice} confirmed={confirmed} /></div>
        <div className="min-w-0 lg:text-right"><p className="text-xs text-[color:var(--color-muted)] lg:sr-only">{humanStatus ? "Importe del comprobante" : confirmed ? "Saldo pendiente" : "Importe por verificar"}</p><p className="break-words text-sm font-semibold tabular-nums">{formatAmount(invoice.amount, invoice.currency)}</p></div>
        {href ? <a href={href} className="inline-flex min-h-11 items-center justify-end text-sm font-medium text-[color:var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Revisar factura ${invoice.number ?? "sin número"}`}>Revisar factura <span aria-hidden="true" className="ml-1">↗</span></a> : <span className="text-right text-xs text-[color:var(--color-muted)]">Revisión no disponible</span>}
      </div>
      {invoice.reason ? <p className="mt-1 break-words text-xs leading-relaxed text-[color:var(--color-muted)]">{invoice.reason}</p> : null}
      {review ? <div className="mt-2 space-y-1 rounded-md bg-[color:var(--color-surface)] p-2 text-xs leading-relaxed">
        <p className="font-medium">Revisión humana · {formatDate(review.reviewedAt)}{review.valid ? "" : " · necesita reconfirmación"}</p>
        <p className="whitespace-pre-wrap break-words">{review.comment || "Sin comentario adicional."}</p>
        <p>Estado declarado: {review.paymentStatus === "paid" ? "pagada" : review.paymentStatus === "unpaid" ? "pendiente de pago" : "por confirmar"}. {review.method ? `Medio: ${review.method}. ` : ""}{review.paymentDate ? `Fecha de pago: ${formatDate(review.paymentDate)}. ` : ""}{review.paidAmount ? `Importe pagado informado: ${formatAmount(review.paidAmount, review.paidCurrency)}.` : ""}</p>
        {review.paymentStatus === "paid" && (!review.paymentDate || review.paidAmount === null) ? <p>La declaración no incluye todos los datos del pago; el importe del comprobante no se usa como importe pagado.</p> : null}
        {review.classificationStatus === "needs_review" ? <p>La clasificación todavía necesita revisión.</p> : null}
      </div> : null}
    </li>
  );
}

function SupplierCard({ supplier, confirmed, humanStatus }: { supplier: SupplierInvoiceGroup; confirmed: boolean; humanStatus?: "paid" | "unpaid" }) {
  const overdue = supplier.invoices.filter((invoice) => invoice.dueState === "overdue").length;
  const soon = supplier.invoices.filter((invoice) => invoice.dueState === "due_soon").length;
  const noDue = supplier.invoices.filter((invoice) => invoice.dueState === "no_due_date").length;
  return (
    <details className="group min-w-0 border-t border-[color:var(--color-border)] first:border-0" data-supplier-id={supplier.id}>
      <summary className="cursor-pointer list-none px-3 py-3 outline-offset-2 transition hover:bg-[color:var(--color-surface-strong)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] [&::-webkit-details-marker]:hidden">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_110px_16px]">
          <div className="min-w-0"><h4 className="break-words text-sm font-semibold">{supplier.name.trim() || "Proveedor por identificar"}</h4><p className="mt-0.5 text-xs text-[color:var(--color-muted)]">{supplier.taxId ? `RUT ${supplier.taxId}` : "RUT por confirmar"}</p>
            {confirmed && (overdue > 0 || soon > 0 || noDue > 0) ? <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-[color:var(--color-muted)]">{overdue > 0 ? <span className="text-[color:var(--color-danger)]">{overdue} {overdue === 1 ? "vencida" : "vencidas"}</span> : null}{soon > 0 ? <span>{soon} {soon === 1 ? "próxima" : "próximas"}</span> : null}{noDue > 0 ? <span>{noDue} sin vencimiento</span> : null}</p> : null}
          </div>
          <div className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1 sm:text-right"><p className="text-xs text-[color:var(--color-muted)]">{humanStatus ? "Importes de los comprobantes" : confirmed ? "Saldo pendiente" : "Importes por confirmar"}</p>{supplier.totals.length ? supplier.totals.map((total) => <p key={total.currency} className="break-words text-sm font-semibold tabular-nums">{formatAmount(total.amount, total.currency)}</p>) : <p className="text-sm text-[color:var(--color-muted)]">Importe por confirmar</p>}</div>
          <span className="col-start-2 row-start-2 text-right text-xs text-[color:var(--color-muted)] sm:col-start-3 sm:row-start-1">Ver {supplier.invoices.length} {supplier.invoices.length === 1 ? "factura" : "facturas"}</span>
          <span aria-hidden="true" className="col-start-2 row-start-1 justify-self-end text-[color:var(--color-muted)] transition-transform group-open:rotate-180 sm:col-start-4">⌄</span>
        </div>
      </summary>
      <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-strong)] px-3 py-2 sm:px-4">
        {!confirmed && !humanStatus ? <p className="mb-3 text-xs leading-relaxed text-[color:var(--color-muted)]">Revisá el comprobante y cómo se pagó para confirmar si queda un saldo pendiente.</p> : null}
        <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] gap-4 text-xs text-[color:var(--color-muted)] lg:grid"><span>Comprobante</span><span>Emisión</span><span>Vencimiento</span><span className="text-right">{humanStatus ? "Importe del comprobante" : confirmed ? "Saldo pendiente" : "Importe por verificar"}</span><span className="invisible">Revisar factura ↗</span></div>
        <ul>{supplier.invoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} confirmed={confirmed} humanStatus={humanStatus} />)}</ul>
      </div>
    </details>
  );
}

function BoardSection({ groups, confirmed, emptyMessage, id, unavailable, humanStatus }: { groups: SupplierInvoiceGroup[]; confirmed: boolean; emptyMessage: string; id: string; unavailable: boolean; humanStatus?: "paid" | "unpaid" }) {
  const invoiceCount = groups.reduce((sum, group) => sum + group.invoices.length, 0);
  return (
    <section aria-labelledby={id} className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="text-base font-semibold">{humanStatus === "paid" ? "Pagadas según tu revisión" : humanStatus === "unpaid" ? "Pendientes según tu revisión" : confirmed ? "Pendientes de pago" : "Por confirmar"}</h3>
        <span className="text-xs text-[color:var(--color-muted)]">{unavailable && !groups.length ? "Sin datos" : `${invoiceCount} ${invoiceCount === 1 ? "factura" : "facturas"}`}</span>
      </div>
      {groups.length > 0 ? <p className="text-xs leading-relaxed text-[color:var(--color-muted)]">{humanStatus ? "Estado informado por vos. Los importes son referencias del comprobante; no se generaron pagos contables ni cambios en Zeta." : confirmed ? "Saldos pendientes respaldados por los registros disponibles." : "Facturas recibidas cuyo pago o saldo todavía necesita revisión."}</p> : null}
      {groups.length ? <div className="min-w-0 overflow-hidden rounded-lg border border-[color:var(--color-border)]">{groups.map((supplier) => <SupplierCard key={supplier.id} supplier={supplier} confirmed={confirmed} humanStatus={humanStatus} />)}</div> : <p className="rounded-md bg-[color:var(--color-surface-strong)] px-3 py-2 text-sm leading-relaxed text-[color:var(--color-muted)]">{emptyMessage}</p>}
    </section>
  );
}

export function SupplierInvoicesBoard(props: SupplierInvoicesBoardProps) {
  const [query, setQuery] = useState("");
  const id = useId();
  const confirmed = filterSupplierInvoiceGroups(props.confirmed, query);
  const unconfirmed = filterSupplierInvoiceGroups(props.unconfirmed, query);
  const humanPaid = filterSupplierInvoiceGroups(props.humanPaid ?? [], query);
  const humanUnpaid = filterSupplierInvoiceGroups(props.humanUnpaid ?? [], query);
  const searching = query.trim().length > 0;
  const unavailable = props.coverage.status === "unavailable";
  const hasData = props.confirmed.length + props.unconfirmed.length + (props.humanPaid?.length ?? 0) + (props.humanUnpaid?.length ?? 0) > 0;
  const empty = searching ? "Ningún proveedor coincide con la búsqueda." : unavailable || props.error
    ? "No hay información suficiente para mostrar este bloque." : "No hay facturas en este grupo entre los registros disponibles.";
  const pendingHref = safeInternalHref(props.inboxPendingHref);
  return (
    <section aria-labelledby={`${id}-title`} className="ui-panel min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">Facturas de proveedores</h2>
          <p className="mt-1 text-xs text-[color:var(--color-muted)]">Facturas recibidas en Convertilabs, agrupadas por proveedor.</p>
        </div>
        <p className="text-xs leading-relaxed text-[color:var(--color-muted)]">{updatedLabel(props.updatedAt)}</p>
      </div>
      {props.error ? <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No pudimos cargar toda la información. Volvé a abrir Inicio en unos momentos.</div> : null}
      {props.coverage.status !== "complete" ? <p role="status" className="text-xs leading-relaxed text-[color:var(--color-muted)]"><span className="font-medium">{unavailable ? "Información no disponible. " : "Información parcial. "}</span>{props.coverage.message ?? (unavailable ? "Todavía no podemos confirmar el estado de las facturas." : "Puede haber facturas o pagos que aún no estén incorporados.")}</p> : null}
      {props.inboxPendingCount !== undefined && props.inboxPendingCount > 0 ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[color:var(--color-accent-soft)] px-3 py-2 text-sm"><p>{props.inboxPendingCount} {props.inboxPendingCount === 1 ? "comprobante recibido necesita" : "comprobantes recibidos necesitan"} revisión antes de aparecer aquí.</p>{pendingHref ? <a href={pendingHref} className="inline-flex min-h-11 items-center font-medium text-[color:var(--color-accent)] hover:underline">Revisar recibidos</a> : null}</div> : null}
      {hasData ? <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm"><label htmlFor={`${id}-search`} className="sr-only">Buscar proveedor</label><input id={`${id}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proveedor por nombre o RUT" className="min-h-11 min-w-0 flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-base text-[color:var(--color-foreground)] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]" />{searching ? <button type="button" onClick={() => setQuery("")} className="ui-button ui-button--secondary min-h-11">Limpiar</button> : null}</div><p aria-live="polite" className="text-xs text-[color:var(--color-muted)]">{confirmed.length + unconfirmed.length + humanPaid.length + humanUnpaid.length} {confirmed.length + unconfirmed.length + humanPaid.length + humanUnpaid.length === 1 ? "grupo de proveedor" : "grupos de proveedores"}{searching ? " en la búsqueda" : " disponibles"}</p></div> : null}
      <div className="grid min-w-0 gap-5">
        <BoardSection groups={confirmed} confirmed emptyMessage={empty} id={`${id}-confirmed`} unavailable={unavailable || Boolean(props.error)} />
        {!!props.humanUnpaid?.length && <BoardSection groups={humanUnpaid} confirmed={false} humanStatus="unpaid" emptyMessage={empty} id={`${id}-human-unpaid`} unavailable={unavailable || Boolean(props.error)} />}
        <BoardSection groups={unconfirmed} confirmed={false} emptyMessage={empty} id={`${id}-unconfirmed`} unavailable={unavailable || Boolean(props.error)} />
        {!!props.humanPaid?.length && <BoardSection groups={humanPaid} confirmed={false} humanStatus="paid" emptyMessage={empty} id={`${id}-human-paid`} unavailable={unavailable || Boolean(props.error)} />}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[color:var(--color-border)] pt-3 text-xs leading-relaxed text-[color:var(--color-muted)]">
        <p>Los importes se muestran por moneda.</p>
        {props.excludedPaidCount !== undefined ? <p>{props.excludedPaidCount} {props.excludedPaidCount === 1 ? "factura sin saldo observado queda fuera" : "facturas sin saldo observado quedan fuera"} de los pendientes.</p> : null}
      </div>
    </section>
  );
}
