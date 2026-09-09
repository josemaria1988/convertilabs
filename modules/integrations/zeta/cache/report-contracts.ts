import { createHash } from "node:crypto";
import { stableJsonStringify } from "@/modules/integrations/credentials";

export type LocalZetaReportKind = "sales" | "purchases" | "articles" | "stock" | "base-prices";
export type Scalar = string | number | boolean | null;
export type ReportCell = Scalar | ReportCell[] | { [key: string]: ReportCell };
export type ReportRow = Record<string, ReportCell>;

export function reportHash(value: unknown) { return createHash("sha256").update(stableJsonStringify(value)).digest("hex"); }

function isDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function validateLocalZetaReportFilters(report: LocalZetaReportKind, filters: Record<string, unknown>): Record<string, Scalar> {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) throw new Error("filters debe ser un objeto.");
  const allowed: Record<LocalZetaReportKind, Record<string, "date" | "text" | "integer" | "number">> = {
    sales: { FechaDesde: "date", FechaHasta: "date", Serie: "text", NumeroDesde: "integer", NumeroHasta: "integer", ClienteCodigo: "text", ComprobanteCodigo: "integer", MonedaCodigo: "integer", LocalCodigo: "integer" },
    purchases: { FechaDesde: "date", FechaHasta: "date", ProveedorCodigo: "text", ComprobanteCodigo: "integer", MonedaCodigo: "integer", LocalCodigo: "integer" },
    articles: { CodigoDesde: "text", CodigoHasta: "text", NombreContiene: "text" },
    stock: { VencimientoDesde: "date", VencimientoHasta: "date", DepositoCodigo: "integer", LocalCodigo: "integer", CantidadDesde: "number", CantidadHasta: "number" },
    "base-prices": { ArticuloCodigo: "text", PrecioBaseCodigo: "text", FechaRegistroDesde: "date", FechaRegistroHasta: "date" },
  };
  if (!Object.hasOwn(allowed, report)) throw new Error("Reporte no soportado: sales, purchases, articles, stock o base-prices.");
  const output: Record<string, Scalar> = {};
  for (const [key, value] of Object.entries(filters)) {
    const type = Object.hasOwn(allowed[report], key) ? allowed[report][key] : null;
    if (!type) throw new Error(`Filtro no permitido para ${report}: ${key}.`);
    if (type === "date" && !isDate(value)) throw new Error(`${key} debe ser una fecha real YYYY-MM-DD.`);
    if (type === "text" && (typeof value !== "string" || !value.trim() || value.length > 150 || /[\u0000-\u001f]/.test(value))) {
      throw new Error(`${key} debe ser texto; conserva los ceros iniciales.`);
    }
    if ((type === "integer" || type === "number") && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`${key} debe ser numerico.`);
    }
    if (type === "integer" && (!Number.isSafeInteger(value) || (value as number) < 0)) throw new Error(`${key} debe ser un entero no negativo.`);
    output[key] = value as Scalar;
  }
  if ((report === "sales" || report === "purchases") && (!output.FechaDesde || !output.FechaHasta)) throw new Error("Ventas/compras requiere FechaDesde y FechaHasta.");
  if (report === "base-prices" && (!output.ArticuloCodigo || !output.PrecioBaseCodigo)) throw new Error("Precios base requiere ArticuloCodigo y PrecioBaseCodigo explicitos.");
  for (const [from, to] of [["FechaDesde", "FechaHasta"], ["VencimientoDesde", "VencimientoHasta"], ["FechaRegistroDesde", "FechaRegistroHasta"], ["NumeroDesde", "NumeroHasta"], ["CantidadDesde", "CantidadHasta"], ["CodigoDesde", "CodigoHasta"]]) {
    if (output[from] !== undefined && output[to] !== undefined && output[from]! > output[to]!) throw new Error(`${from} no puede superar ${to}.`);
  }
  return output;
}
