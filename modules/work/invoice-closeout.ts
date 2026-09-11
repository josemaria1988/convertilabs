export type WorkInvoiceCloseout = {
  confirmedAt: string | null;
  number: string | null;
  date: string | null;
  currency: string | null;
  total: string | null;
  customerName: string | null;
  reviewNotes: string[];
};

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

/** A human closeout is an operational fact, never a substitute for an invoice or collection. */
export function readWorkInvoiceCloseout(metadata: unknown): WorkInvoiceCloseout | null {
  const closeout = record(record(metadata).invoice_closeout);
  if (closeout.version !== 1 || closeout.status !== "source_not_cached" || closeout.confirmed_by_user !== true || closeout.source !== "user_instruction") return null;
  const reference = record(closeout.invoice_reference);
  const rawDate = text(reference.date);
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && Number.isFinite(Date.parse(rawDate)) && new Date(rawDate).toISOString().slice(0, 10) === rawDate ? rawDate : null;
  const rawTotal = text(reference.total);
  const total = rawTotal && /^\d{1,12}\.\d{2}$/.test(rawTotal) ? rawTotal : null;
  const rawCurrency = text(reference.currency);
  const confirmedAt = text(closeout.confirmed_at);
  return {
    confirmedAt: confirmedAt && Number.isFinite(Date.parse(confirmedAt)) ? confirmedAt : null,
    number: text(reference.number), date, total,
    currency: rawCurrency && /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : null,
    customerName: text(reference.customer_name),
    reviewNotes: Array.isArray(closeout.review_notes) ? closeout.review_notes.map(text).filter((value): value is string => !!value) : [],
  };
}

export function formatCloseoutReference(closeout: WorkInvoiceCloseout) {
  const parts = [closeout.number ? `Factura ${closeout.number}` : "Número de factura pendiente"];
  if (closeout.date) parts.push(closeout.date.split("-").reverse().join("/"));
  if (closeout.total) {
    const [integer, decimal] = closeout.total.split(".");
    parts.push(`${closeout.currency ?? "Moneda pendiente"} ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimal}`);
  }
  return parts.join(" · ");
}
