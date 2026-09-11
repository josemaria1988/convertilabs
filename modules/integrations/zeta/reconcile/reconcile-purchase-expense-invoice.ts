import { callZetaEndpoint, type ZetaRestClient } from "@/modules/integrations/zeta/client/rest-client";
import type { ZetaFacturaProveedorMovimiento } from "@/modules/integrations/zeta/contracts/factura-proveedor";
import { preflightZetaPurchaseInvoiceDuplicate } from "@/modules/integrations/zeta/export/duplicate-preflight";
import type { ZetaPurchaseExportStatus } from "@/modules/integrations/zeta/export/types";

export type ZetaPurchaseExpenseInvoiceReconciliationResult = {
  status: ZetaPurchaseExportStatus | "sent_not_found";
  registroId: string | number | null;
  queryComprasRaw: unknown;
  asientoListaRaw?: unknown;
  warnings: string[];
};

function amountInCents(value: unknown) {
  const normalized = typeof value === "string" && /^-?\d+(?:[.,]\d+)?$/.test(value.trim())
    ? Number(value.trim().replace(",", "."))
    : value;
  if (typeof normalized !== "number" || !Number.isFinite(normalized)) return null;
  const cents = Math.round(normalized * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function sourceAmountInCents(row: object, field: string, signedField: string) {
  const values = row as Record<string, unknown>;
  // A present but invalid canonical amount is not repaired using another field.
  return amountInCents(Object.hasOwn(values, field) ? values[field] : values[signedField]);
}

export async function reconcilePurchaseExpenseInvoiceExport(input: {
  client: ZetaRestClient;
  movimiento: ZetaFacturaProveedorMovimiento;
  expectedTotal?: number | null;
  expectedNetAmount?: number | null;
  expectedTaxAmount?: number | null;
  ejercicio?: number | null;
}) {
  const verifyBreakdown = input.expectedNetAmount !== undefined || input.expectedTaxAmount !== undefined;
  const expectedNet = amountInCents(input.expectedNetAmount);
  const expectedTax = amountInCents(input.expectedTaxAmount);
  const expectedTotal = amountInCents(input.expectedTotal);
  if (verifyBreakdown && (expectedNet === null || expectedTax === null || expectedTotal === null
    || Math.abs(expectedNet + expectedTax - expectedTotal) > 1)) {
    throw new Error("La conciliacion de IVA requiere neto, IVA y total esperados validos y consistentes.");
  }

  const queryCompras = await preflightZetaPurchaseInvoiceDuplicate({
    client: input.client,
    movimiento: input.movimiento,
    expectedTotal: input.expectedTotal,
  });
  const warnings: string[] = [];

  if (!queryCompras.found) {
    return {
      status: "sent_not_found",
      registroId: verifyBreakdown ? queryCompras.registroId : null,
      queryComprasRaw: queryCompras.raw,
      warnings: [queryCompras.fiscalConflict
        ? "QueryCompras encontro una posible coincidencia fiscal con diferencias. La reconciliacion sigue pendiente y no se reenvia."
        : "QueryCompras no encontro la factura proveedor exportada."],
    } satisfies ZetaPurchaseExpenseInvoiceReconciliationResult;
  }

  if (verifyBreakdown) {
    const row = queryCompras.row;
    const actualNet = row ? sourceAmountInCents(row, "Subtotal", "SubtotalSigno") : null;
    const actualTax = row ? sourceAmountInCents(row, "IVA", "IVASigno") : null;
    const actualTotal = row ? sourceAmountInCents(row, "Total", "TotalSigno") : null;
    if (actualNet === null || actualTax === null || actualTotal === null
      || Math.abs(actualNet - expectedNet!) > 1
      || Math.abs(actualTax - expectedTax!) > 1
      || Math.abs(actualTotal - expectedTotal!) > 1
      || Math.abs(actualNet + actualTax - actualTotal) > 1) {
      return {
        status: "amount_mismatch",
        registroId: queryCompras.registroId,
        queryComprasRaw: queryCompras.raw,
        warnings: ["QueryCompras encontro la factura, pero su neto, IVA y total faltan o difieren de los importes revisados. La conciliacion sigue pendiente; no se reenvia."],
      } satisfies ZetaPurchaseExpenseInvoiceReconciliationResult;
    }
  }

  if (!input.ejercicio) {
    return {
      status: "found_in_zeta",
      registroId: queryCompras.registroId,
      queryComprasRaw: queryCompras.raw,
      warnings: ["Factura encontrada en Zeta; Consulta de Asientos queda pendiente por falta de ejercicio contable."],
    } satisfies ZetaPurchaseExpenseInvoiceReconciliationResult;
  }

  const asientoListaRaw = await callZetaEndpoint(input.client, "asientoLista", {
    Ejercicio: input.ejercicio,
    FechaInicio: input.movimiento.Fecha,
    FechaFin: input.movimiento.Fecha,
    TipoAsiento: "",
  });

  warnings.push("Factura encontrada en Zeta. La comparacion contable detallada queda como segunda etapa no bloqueante.");

  return {
    status: "found_in_zeta",
    registroId: queryCompras.registroId,
    queryComprasRaw: queryCompras.raw,
    asientoListaRaw,
    warnings,
  } satisfies ZetaPurchaseExpenseInvoiceReconciliationResult;
}

