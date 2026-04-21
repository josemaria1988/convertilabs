import { normalizeDocumentNumber, roundCurrency } from "@/modules/accounting";
import { queryZetaEndpoint, type ZetaRestClient } from "@/modules/integrations/zeta/client/rest-client";
import type { ZetaFacturaProveedorCompraQueryRow, ZetaFacturaProveedorMovimiento } from "@/modules/integrations/zeta/contracts/factura-proveedor";

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseFloat(value.replace(",", "."));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function parseDateParts(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    startDate: `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-01`,
    endDate: new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10),
  };
}

export function findDuplicateZetaPurchaseInvoice(input: {
  rows: ZetaFacturaProveedorCompraQueryRow[];
  movimiento: ZetaFacturaProveedorMovimiento;
  expectedTotal?: number | null;
}) {
  const expectedSerie = normalizeDocumentNumber(input.movimiento.Serie ?? null);
  const expectedNumero = normalizeDocumentNumber(
    input.movimiento.Numero === undefined ? null : String(input.movimiento.Numero),
  );
  const expectedTotal = typeof input.expectedTotal === "number"
    ? roundCurrency(input.expectedTotal)
    : null;

  for (const row of input.rows) {
    const sameSupplier = firstText(row.ProveedorCodigo) === input.movimiento.CodigoProveedor;
    const sameComprobante = firstNumber(row.ComprobanteCodigo) === input.movimiento.CodigoComprobante;
    const sameCurrency = firstNumber(row.MonedaCodigo) === input.movimiento.CodigoMoneda;
    const sameSerie = normalizeDocumentNumber(firstText(row.Serie)) === expectedSerie;
    const sameNumber = normalizeDocumentNumber(firstText(row.Numero)) === expectedNumero;
    const rowTotal = firstNumber(row.Total, row.TotalSigno);
    const sameTotal = expectedTotal === null
      || (
        typeof rowTotal === "number"
        && Math.abs(roundCurrency(rowTotal) - expectedTotal) <= 0.05
      );

    if (sameSupplier && sameComprobante && sameCurrency && sameSerie && sameNumber && sameTotal) {
      return {
        found: true,
        registroId: row.RegistroId ?? null,
        row,
      };
    }
  }

  return {
    found: false,
    registroId: null,
    row: null,
  };
}

export async function preflightZetaPurchaseInvoiceDuplicate(input: {
  client: ZetaRestClient;
  movimiento: ZetaFacturaProveedorMovimiento;
  expectedTotal?: number | null;
}) {
  const dateParts = parseDateParts(input.movimiento.Fecha);
  const result = await queryZetaEndpoint<ZetaFacturaProveedorCompraQueryRow>(
    input.client,
    "facturaProveedorQueryCompras",
    {
      page: 1,
      filters: {
        Mes: dateParts?.month ?? 0,
        Anio: dateParts?.year ?? 0,
        FechaDesde: dateParts?.startDate ?? "",
        FechaHasta: dateParts?.endDate ?? "",
        ProveedorCodigo: input.movimiento.CodigoProveedor,
        ComprobanteCodigo: input.movimiento.CodigoComprobante,
        MonedaCodigo: input.movimiento.CodigoMoneda,
        LocalCodigo: input.movimiento.CodigoLocal ?? 0,
      },
    },
  );
  const duplicate = findDuplicateZetaPurchaseInvoice({
    rows: result.rows,
    movimiento: input.movimiento,
    expectedTotal: input.expectedTotal,
  });

  return {
    ...duplicate,
    raw: result.raw,
  };
}

