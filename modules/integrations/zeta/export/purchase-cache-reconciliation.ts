import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDocumentNumber, roundCurrency } from "@/modules/accounting/normalization";
import type { ZetaFacturaProveedorMovimiento } from "@/modules/integrations/zeta/contracts/factura-proveedor";
import { loadZetaInvoiceCacheBase, type ZetaInvoiceCacheBase } from "@/modules/integrations/zeta/cache/report-cache";
import { reportHash, type ReportRow, type Scalar } from "@/modules/integrations/zeta/cache/report-contracts";

export type PurchaseCacheReconciliationStatus = "waiting_for_sync" | "already_in_erp" | "differences" | "ambiguous" | "missing_from_erp";
export type PurchaseCacheFiscalKey = { supplierCode: string; comprobanteCode: number; serie: string | null; numero: string };
export type PurchaseCacheDifference = { field: "comprobante" | "total" | "currency" | "date"; expected: Scalar; actual: Scalar; message: string };
export type PurchaseCacheMatch = {
  registroId: string | number | null; invoiceDate: string | null; currencyCode: number | null;
  total: number | null; totalSource: "header" | "monthly_lines_with_explicit_sign" | "unavailable";
  differences: PurchaseCacheDifference[]; uncertainties: string[];
};
export type PurchaseCacheReconciliation = {
  status: PurchaseCacheReconciliationStatus; eligibleForHumanExport: boolean; source: "supabase"; apiRequests: 0;
  message: string; reasons: string[]; fiscalKey: PurchaseCacheFiscalKey | null; matches: PurchaseCacheMatch[];
  snapshot: {
    runId: string; dataAsOf: string; startedAt: string; ageSeconds: number; coverage: Record<string, Scalar>;
    fetchedCoverage: Record<string, Scalar>; incremental: ZetaInvoiceCacheBase["manifest"]["incremental"] | null;
  } | null;
};
export type PurchaseInvoiceCacheReconciliation = PurchaseCacheReconciliation;
type Input = {
  organizationId: string; documentCreatedAt: string; movimiento: ZetaFacturaProveedorMovimiento;
  expectedTotal: number | null; now?: Date;
};
type ScopedSnapshot = ZetaInvoiceCacheBase & { organizationId: string };

function numeric(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    const result = Number(value); return Number.isFinite(result) ? result : null;
  }
  return null;
}
function integer(value: unknown) {
  const result = numeric(value); return result !== null && Number.isSafeInteger(result) && result >= 0 ? result : null;
}
function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function numberToken(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return normalizeDocumentNumber(String(value));
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return normalizeDocumentNumber(value);
  return null;
}
function isoDate(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-?(\d{2})-?(\d{2})(?:$|T| )/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  return Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0, 10) === iso ? iso : null;
}
function covered(filters: Record<string, Scalar>, date: string) {
  const from = isoDate(filters.FechaDesde), to = isoDate(filters.FechaHasta);
  return from !== null && to !== null && date >= from && date <= to;
}
function series(row: ReportRow) {
  const value = Object.hasOwn(row, "Serie") ? row.Serie : row.FacturaSerie;
  return { known: typeof value === "string", value: typeof value === "string" ? normalizeDocumentNumber(value) : null };
}

function readTotal(row: ReportRow): Pick<PurchaseCacheMatch, "total" | "totalSource"> {
  for (const key of ["TotalSigno", "Total", "FacturaTotal"]) {
    if (Object.hasOwn(row, key)) {
      const value = numeric(row[key]);
      return value === null ? { total: null, totalSource: "unavailable" } : { total: roundCurrency(value), totalSource: "header" };
    }
  }
  // The existing Zeta normalizers apply FacturaSigno to unsigned line amounts.
  // Require the sign explicitly here; never infer it from a document label.
  const sign = numeric(row.FacturaSigno);
  if ((sign !== 1 && sign !== -1) || !Array.isArray(row.Lines) || row.Lines.length === 0) return { total: null, totalSource: "unavailable" };
  const currency = integer(row.MonedaCodigo);
  if (currency === null) return { total: null, totalSource: "unavailable" };
  let total = 0;
  for (const value of row.Lines) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { total: null, totalSource: "unavailable" };
    const line = value as ReportRow;
    const amount = numeric(line.LineaTotal), net = numeric(line.LineaSubtotal), tax = numeric(line.LineaIVA);
    if (amount === null || net === null || tax === null || amount < 0 || net < 0 || tax < 0
      || numeric(line.FacturaSigno) !== sign || integer(line.MonedaCodigo) !== currency
      || String(line.FacturaId) !== String(row.RegistroId ?? row.FacturaId)
      || Math.abs(roundCurrency(net + tax) - roundCurrency(amount)) > 0.05) return { total: null, totalSource: "unavailable" };
    total += amount;
  }
  if (!Number.isFinite(total)) return { total: null, totalSource: "unavailable" };
  return { total: roundCurrency(total * sign), totalSource: "monthly_lines_with_explicit_sign" };
}

/** Classifies presence before any human-confirmed ERP export. No API is called. */
export function classifyPurchaseInvoiceAgainstCache(input: Input & { snapshot: ScopedSnapshot | null }): PurchaseCacheReconciliation {
  const now = input.now ?? new Date();
  const m = input.snapshot?.manifest;
  const result: PurchaseCacheReconciliation = {
    status: "waiting_for_sync", eligibleForHumanExport: false, source: "supabase", apiRequests: 0,
    message: "La factura queda guardada hasta contar con una actualizacion de Zeta posterior a su carga.",
    reasons: [], fiscalKey: null, matches: [], snapshot: m ? {
      runId: input.snapshot!.runId, dataAsOf: m.completedAt, startedAt: m.startedAt,
      ageSeconds: Math.max(0, Math.floor((now.getTime() - Date.parse(m.completedAt)) / 1000)),
      coverage: m.filters, fetchedCoverage: m.incremental?.fetchedFilters ?? m.filters, incremental: m.incremental ?? null,
    } : null,
  };
  const wait = (reason: string, message: string) => ({ ...result, reasons: [reason], message });
  if (!input.snapshot || !m) return wait("cache_not_available", "La factura esta guardada. Falta una copia mensual de compras en Supabase para compararla.");
  if (input.snapshot.organizationId !== input.organizationId) return wait("organization_mismatch", "La copia disponible no corresponde a esta organizacion.");
  const fetchedCoverage = m.incremental?.fetchedFilters ?? m.filters;
  const hasOnlyDateFilters = (filters: Record<string, Scalar>) => filters && typeof filters === "object"
    && Object.keys(filters).length === 2 && Object.keys(filters).every((key) => ["FechaDesde", "FechaHasta"].includes(key));
  if (m.endpoint !== "RESTFacturaProveedorV1ComprasDetalladas" || !hasOnlyDateFilters(m.filters) || !hasOnlyDateFilters(fetchedCoverage)) {
    return wait("cache_scope_not_global_monthly", "La copia no confirma una consulta mensual completa de todos los proveedores. No se puede afirmar que esta factura falte.");
  }
  const createdAt = Date.parse(input.documentCreatedAt), startedAt = Date.parse(m.startedAt), completedAt = Date.parse(m.completedAt);
  if (m.report !== "purchases" || m.complete !== true || ![createdAt, startedAt, completedAt, now.getTime()].every(Number.isFinite)
    || completedAt < startedAt || completedAt > now.getTime() + 60000) return wait("cache_metadata_invalid", "La copia disponible no permite confirmar fecha, origen y completitud.");
  if (startedAt < createdAt) return wait("snapshot_before_document", "La factura se cargo despues de iniciarse la ultima consulta de compras. Espera la proxima actualizacion para compararla.");
  if (now.getTime() - completedAt > 86400000) return wait("cache_stale", "La copia de compras tiene mas de 24 horas. La factura espera una actualizacion antes de habilitar el envio.");
  const date = isoDate(input.movimiento.Fecha);
  if (!date || !covered(m.filters, date)) return wait("document_date_not_covered", "La copia de compras no cubre la fecha de esta factura.");
  if (!covered(m.incremental?.fetchedFilters ?? m.filters, date)) return wait("document_period_not_refreshed", "El historial conserva ese periodo, pero la ultima descarga no lo actualizo. Hace falta consultar el mes de esta factura antes de afirmar que falta.");
  const expected: PurchaseCacheFiscalKey | null = text(input.movimiento.CodigoProveedor) !== null
    && integer(input.movimiento.CodigoComprobante) !== null && numberToken(input.movimiento.Numero) !== null
    ? { supplierCode: text(input.movimiento.CodigoProveedor)!, comprobanteCode: input.movimiento.CodigoComprobante,
      serie: normalizeDocumentNumber(input.movimiento.Serie ?? null), numero: numberToken(input.movimiento.Numero)! } : null;
  result.fiscalKey = expected;
  if (!expected || integer(input.movimiento.CodigoMoneda) === null || input.expectedTotal === null || !Number.isFinite(input.expectedTotal)) {
    return { ...result, status: "ambiguous", reasons: ["prepared_invoice_incomplete"], message: "Faltan datos confiables de proveedor, comprobante, numero, moneda o total para comparar esta factura." };
  }
  const candidates: ReportRow[] = []; let uncertainIdentity = false;
  for (const row of input.snapshot.rows) {
    const supplier = text(row.ProveedorCodigo), comprobante = integer(row.ComprobanteCodigo);
    const serie = series(row), numero = numberToken(row.Numero ?? row.FacturaNumero);
    if (supplier !== null && supplier !== expected.supplierCode) continue;
    if (serie.known && serie.value !== expected.serie) continue;
    if (numero !== null && numero !== expected.numero) {
      // Leading-zero differences remain distinct identities, but never justify a blind resend.
      if (numero.replace(/^0+(?=\d)/, "") === expected.numero.replace(/^0+(?=\d)/, "")) uncertainIdentity = true;
      continue;
    }
    if (supplier === null || comprobante === null || !serie.known || numero === null) { uncertainIdentity = true; continue; }
    candidates.push(row);
  }
  const distinct = [...new Map(candidates.map((row) => [reportHash(row), row])).values()];
  const expectedTotal = roundCurrency(input.expectedTotal);
  for (const row of distinct) {
    const amount = readTotal(row), currency = integer(row.MonedaCodigo), invoiceDate = isoDate(row.Fecha ?? row.FacturaFecha);
    const differences: PurchaseCacheDifference[] = []; const uncertainties: string[] = [];
    const comprobante = integer(row.ComprobanteCodigo);
    if (comprobante !== expected.comprobanteCode) differences.push({ field: "comprobante", expected: expected.comprobanteCode,
      actual: comprobante, message: "El tipo interno de comprobante Zeta es distinto; podria ser la misma factura registrada como contado o credito." });
    if (currency === null) uncertainties.push("La coincidencia fiscal no conserva una moneda confiable.");
    else if (currency !== input.movimiento.CodigoMoneda) differences.push({ field: "currency", expected: input.movimiento.CodigoMoneda, actual: currency, message: "La moneda no coincide." });
    if (amount.total === null) uncertainties.push("La coincidencia fiscal no permite comprobar el total; no se presume que la factura falte.");
    else if (Math.abs(amount.total - expectedTotal) > 0.05) differences.push({ field: "total", expected: expectedTotal, actual: amount.total, message: "El importe total no coincide." });
    if (invoiceDate === null) uncertainties.push("La coincidencia fiscal no conserva una fecha confiable.");
    else if (invoiceDate !== date) differences.push({ field: "date", expected: date, actual: invoiceDate, message: "La fecha del comprobante no coincide." });
    const id = row.RegistroId ?? row.FacturaId;
    const registroId = (typeof id === "number" && Number.isSafeInteger(id) && id > 0)
      || (typeof id === "string" && /^\d{1,100}$/.test(id) && !/^0+$/.test(id)) ? id : null;
    if (registroId === null) uncertainties.push("La coincidencia fiscal no conserva el identificador de Zeta.");
    result.matches.push({ registroId, invoiceDate, currencyCode: currency, ...amount, differences, uncertainties });
  }
  if (uncertainIdentity || distinct.length > 1) return { ...result, status: "ambiguous", reasons: ["fiscal_identity_ambiguous"], message: "Hay una coincidencia posible o mas de un registro para esta identidad fiscal. Revisa las diferencias antes de enviar." };
  if (result.matches.length === 1) {
    const match = result.matches[0];
    if (match.differences.length) return { ...result, status: "differences", reasons: ["fiscal_match_with_differences"], message: "Hay una factura con el mismo proveedor, serie y numero, pero difieren el comprobante interno, la fecha, moneda o importe. El envio queda bloqueado." };
    if (match.uncertainties.length) return { ...result, status: "ambiguous", reasons: ["fiscal_match_unverified_amount"], message: "La factura aparece por su identidad fiscal, pero faltan datos para confirmar todos sus importes. El envio queda bloqueado." };
    return { ...result, status: "already_in_erp", reasons: ["fiscal_identity_and_amount_match"], message: "La factura ya figura en la copia de Zeta con los mismos datos. No corresponde volver a enviarla." };
  }
  return { ...result, status: "missing_from_erp", eligibleForHumanExport: true, reasons: ["absent_from_recent_complete_snapshot"],
    message: "La factura no aparece en la copia de compras actualizada despues de su carga. Queda disponible para revision, confirmacion y comprobacion final antes del envio." };
}

/** Tenant-scoped cache lookup. Errors remain a blocked waiting state, never a live ERP fallback. */
export async function reconcilePurchaseInvoiceAgainstCache(input: Input & { supabase: SupabaseClient }): Promise<PurchaseCacheReconciliation> {
  try {
    const snapshot = await loadZetaInvoiceCacheBase({ supabase: input.supabase, organizationId: input.organizationId, report: "purchases" });
    return classifyPurchaseInvoiceAgainstCache({ ...input, snapshot: snapshot ? { ...snapshot, organizationId: input.organizationId } : null });
  } catch {
    return { ...classifyPurchaseInvoiceAgainstCache({ ...input, snapshot: null }), reasons: ["cache_read_failed"],
      message: "No se pudo verificar la copia de compras en Supabase. La factura sigue guardada y su envio espera una actualizacion comprobable." };
  }
}
