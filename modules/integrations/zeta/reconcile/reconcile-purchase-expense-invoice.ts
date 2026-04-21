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

export async function reconcilePurchaseExpenseInvoiceExport(input: {
  client: ZetaRestClient;
  movimiento: ZetaFacturaProveedorMovimiento;
  expectedTotal?: number | null;
  ejercicio?: number | null;
}) {
  const queryCompras = await preflightZetaPurchaseInvoiceDuplicate({
    client: input.client,
    movimiento: input.movimiento,
    expectedTotal: input.expectedTotal,
  });
  const warnings: string[] = [];

  if (!queryCompras.found) {
    return {
      status: "sent_not_found",
      registroId: null,
      queryComprasRaw: queryCompras.raw,
      warnings: ["QueryCompras no encontro la factura proveedor exportada."],
    } satisfies ZetaPurchaseExpenseInvoiceReconciliationResult;
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

