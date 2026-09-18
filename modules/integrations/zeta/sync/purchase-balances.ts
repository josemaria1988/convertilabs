import "server-only";

import { reportHash, type ReportRow } from "../cache/report-contracts";

const ENDPOINT = "RESTFacturaProveedorV1Compras";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const token = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) ? String(value) : text(value);
const series = (value: unknown) => typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : null;
const number = (value: unknown) => { const s = token(value); return s && /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, "") : null; };
const id = (value: unknown) => { const n = number(value); if (!n || n === "0") throw new Error("El saldo de compras requiere FacturaId estable."); return n; };
function day(value: unknown) {
  const s = text(value)?.slice(0, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s ? s : null;
}
function headerDate(row: ReportRow) {
  const parts = [row.FacturaAnio, row.FacturaMes, row.FacturaDia];
  if (parts.some(value => typeof value !== "number" || !Number.isInteger(value))) throw new Error("El saldo de compras no conserva dia/mes/anio numericos.");
  const date = day(`${String(parts[0]).padStart(4, "0")}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`);
  if (!date) throw new Error("La fecha del saldo de compras no es valida.");
  return date;
}
function monetary(value: unknown) {
  const s = typeof value === "number" && Number.isFinite(value) ? String(value) : text(value);
  return !!s && /^-?\d{1,15}(?:\.\d{1,5})?$/.test(s);
}

/** Refresh every already-known invoice month, including settled ones: a payment,
 * reversal or reallocation today may change an old invoice's balance. No supplier
 * fan-out, new historical detail ingestion, or missing-as-zero inference. */
export function planPurchaseBalanceMonths(rows: ReportRow[], from: string, through: string) {
  if (!day(from) || !day(through) || from > through) throw new Error("Periodo invalido para actualizar saldos de compras.");
  const months = new Set<string>();
  for (const row of rows) {
    const date = day(row.Fecha);
    if (!date || date > through) throw new Error("Una compra previa tiene fecha invalida para actualizar su saldo.");
    months.add(date.slice(0, 7));
  }
  let current = `${from.slice(0, 7)}-01`;
  while (current <= through) {
    months.add(current.slice(0, 7));
    const next = new Date(`${current}T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
    current = next.toISOString().slice(0, 10);
  }
  return [...months].sort();
}

export type PurchaseBalanceMonth = { month: string; dataAsOf: string; rawRows: ReportRow[] };

/** Attach source headers to matching invoices without changing fiscal facts or
 * creating payments. Raw headers retain all source fields and exact currencies.
 * A disappeared header removes the earlier balance; it never proves settlement. */
export function applyPurchaseBalanceMonths(rows: ReportRow[], snapshots: PurchaseBalanceMonth[], through: string) {
  const months = new Set<string>(), indexed = new Map<string, { row: ReportRow; dataAsOf: string; date: string }>();
  for (const snapshot of snapshots) {
    if (!/^\d{4}-\d{2}$/.test(snapshot.month) || !day(`${snapshot.month}-01`) || months.has(snapshot.month)
      || !Number.isFinite(Date.parse(snapshot.dataAsOf))) throw new Error("Cobertura de saldos de compras invalida o repetida.");
    months.add(snapshot.month);
    for (const row of snapshot.rawRows) {
      const date = headerDate(row), key = id(row.FacturaId);
      if (date.slice(0, 7) !== snapshot.month) throw new Error("Zeta devolvio un saldo fuera del mes solicitado.");
      if (date > through) continue;
      if (!text(row.ProveedorCodigo) || !/^[1-9]\d*$/.test(token(row.MonedaCodigo) ?? "")
        || !/^[1-9]\d*$/.test(token(row.ComprobanteCodigo) ?? "") || series(row.FacturaSerie) === null
        || number(row.FacturaNumero) === null || !monetary(row.FacturaTotal) || !monetary(row.FacturaSaldo)) {
        throw new Error("Zeta no suministro proveedor, moneda, total y saldo explicitos para la compra.");
      }
      const previous = indexed.get(key);
      if (previous && reportHash(previous.row) !== reportHash(row)) throw new Error("Dos encabezados de saldo tienen el mismo FacturaId y datos diferentes.");
      indexed.set(key, { row, date, dataAsOf: snapshot.dataAsOf });
    }
  }
  let refreshed = 0, missing = 0;
  const updated = rows.map(row => {
    if (!months.has(String(row.Fecha).slice(0, 7))) return row;
    const output = { ...row }; delete output._balance;
    const found = indexed.get(id(row.RegistroId));
    if (!found) { missing++; return output; }
    const raw = found.row;
    if (text(row.ProveedorCodigo) !== text(raw.ProveedorCodigo) || token(row.MonedaCodigo) !== token(raw.MonedaCodigo)
      || series(row.Serie) !== series(raw.FacturaSerie) || number(row.Numero) !== number(raw.FacturaNumero)
      || day(row.Fecha) !== found.date || token(row.ComprobanteCodigo) !== token(raw.ComprobanteCodigo)) {
      throw new Error("La identidad del saldo no coincide con la compra; se conserva la copia anterior.");
    }
    output._balance = { schemaVersion: 1, endpoint: ENDPOINT, dataAsOf: found.dataAsOf, raw };
    refreshed++;
    return output;
  });
  return { rows: updated, coverage: { mode: "monthly_headers_for_all_cached_invoice_months", endpoint: ENDPOINT,
    months: [...months].sort(), refreshedInvoices: refreshed, missingHeaders: missing, sourceRows: indexed.size,
    unlinkedHeaders: indexed.size - refreshed, historicalNewInvoiceDetailsImported: false,
    source: "explicit_invoice_balance", absentMeansPaid: false, paymentMethodsIncluded: false, paymentDatesIncluded: false,
    receiptApplicationsIncluded: false, interpretation: "Saldo observado; no acredita la causa, fecha o medio de cancelacion." } };
}

/** Source evidence only; consumers must also validate the invoice identity and
 * amount against their local document before using this as a payable balance. */
export function readPurchaseBalanceEvidence(row: ReportRow) {
  const balance = record(row._balance);
  return balance.schemaVersion === 1 && balance.endpoint === ENDPOINT && text(balance.dataAsOf)
    ? { dataAsOf: String(balance.dataAsOf), raw: record(balance.raw) } : null;
}
