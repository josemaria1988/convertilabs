import "server-only";
import { createHash } from "node:crypto";
import { buildZetaConnection, type ZetaRuntimeConfig } from "@/modules/integrations/zeta/client/auth";
import { getZetaEndpoint, type ZetaEndpointKey } from "@/modules/integrations/zeta/client/endpoint-registry";
import { callZetaEndpoint, createZetaRestClient, type ZetaRestClient } from "@/modules/integrations/zeta/client/rest-client";
import { resolveLocalCompanionContext, type LocalCompanionDependencies, type LocalCompanionIdentity } from "./context";

export type LocalZetaReportKind = "sales" | "stock" | "base-prices";
type Scalar = string | number | boolean | null;
type ReportRow = Record<string, Scalar>;
export type LocalZetaReportInput = LocalCompanionIdentity & {
  report: LocalZetaReportKind;
  filters: Record<string, unknown>;
  maxPages?: number;
};
export type LocalZetaReport = {
  metadata: {
    schemaVersion: 1; report: LocalZetaReportKind; organizationId: string; organizationSlug: string;
    actorProfileId: string; endpoint: string; filters: Record<string, Scalar>;
    startedAt: string; completedAt: string; pages: number; rowCount: number; complete: true;
    source: "zetasoftware"; testMode: boolean; readOnly: true; sha256: string;
    csvTextProtection: string;
  };
  columns: string[];
  rows: ReportRow[];
};
type ReportDependencies = LocalCompanionDependencies & {
  runtime?: ZetaRuntimeConfig;
  client?: ZetaRestClient;
};

function isDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function validateLocalZetaReportFilters(report: LocalZetaReportKind, filters: Record<string, unknown>): Record<string, Scalar> {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) throw new Error("filters debe ser un objeto.");
  const allowed: Record<LocalZetaReportKind, Record<string, "date" | "text" | "integer" | "number">> = {
    sales: { FechaDesde: "date", FechaHasta: "date", Serie: "text", NumeroDesde: "integer", NumeroHasta: "integer", ClienteCodigo: "text", ComprobanteCodigo: "integer", MonedaCodigo: "integer", LocalCodigo: "integer" },
    stock: { VencimientoDesde: "date", VencimientoHasta: "date", DepositoCodigo: "integer", LocalCodigo: "integer", CantidadDesde: "number", CantidadHasta: "number" },
    "base-prices": { ArticuloCodigo: "text", PrecioBaseCodigo: "text", FechaRegistroDesde: "date", FechaRegistroHasta: "date" },
  };
  if (!Object.hasOwn(allowed, report)) throw new Error("Reporte no soportado: sales, stock o base-prices.");
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
  if (report === "sales" && (!output.FechaDesde || !output.FechaHasta)) throw new Error("Ventas requiere FechaDesde y FechaHasta.");
  if (report === "base-prices" && (!output.ArticuloCodigo || !output.PrecioBaseCodigo)) throw new Error("Precios base requiere ArticuloCodigo y PrecioBaseCodigo explicitos.");
  for (const [from, to] of [["FechaDesde", "FechaHasta"], ["VencimientoDesde", "VencimientoHasta"], ["FechaRegistroDesde", "FechaRegistroHasta"], ["NumeroDesde", "NumeroHasta"], ["CantidadDesde", "CantidadHasta"]]) {
    if (output[from] !== undefined && output[to] !== undefined && output[from]! > output[to]!) throw new Error(`${from} no puede superar ${to}.`);
  }
  return output;
}

function requireSuccess(value: unknown) {
  if (value !== true && value !== "true" && value !== "True") throw new Error("Zeta no confirmo Succeed=true para el reporte; no se genera una exportacion incompleta.");
}

function requireRows(value: unknown): ReportRow[] {
  if (!Array.isArray(value)) throw new Error("Zeta no devolvio una lista de filas valida.");
  return value.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Fila Zeta no valida.");
    const result: ReportRow = {};
    for (const [key, cell] of Object.entries(row)) {
      if (cell !== null && !["string", "number", "boolean"].includes(typeof cell)) throw new Error("El reporte contiene un campo compuesto no contemplado por el contrato.");
      if (typeof cell === "number" && !Number.isFinite(cell)) throw new Error("El reporte contiene un numero no valido.");
      Object.defineProperty(result, key, { value: cell, enumerable: true, configurable: true, writable: true });
    }
    return result;
  });
}

export async function exportZetaReport(input: LocalZetaReportInput, deps: ReportDependencies = {}): Promise<LocalZetaReport> {
  const filters = validateLocalZetaReportFilters(input.report, input.filters);
  const maxPages = input.maxPages ?? 200;
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 1000) throw new Error("maxPages debe ser un entero entre 1 y 1000.");
  const context = await resolveLocalCompanionContext(input, deps);
  const runtime = deps.runtime ?? await buildZetaConnection({ supabase: context.supabase, organizationId: context.organization.id });
  if (runtime.metadata.credentialSource === "mock" && !deps.client) throw new Error("La conexion es mock. No se consulta Zeta ni se simula un reporte real.");
  const client = deps.client ?? createZetaRestClient(runtime);
  const key: ZetaEndpointKey = input.report === "sales" ? "salesInvoicesQuery" : input.report === "stock" ? "stockActualQuery" : "articleBasePricesLoad";
  const endpoint = getZetaEndpoint(key);
  if (endpoint.kind !== "query" && endpoint.kind !== "load") throw new Error("El companion solo permite reportes de lectura.");
  const startedAt = new Date().toISOString();
  const rows: ReportRow[] = [];
  const pageHashes = new Set<string>();
  let pages = 0;
  let complete = false;
  while (!complete && pages < maxPages) {
    pages += 1;
    const output = await callZetaEndpoint<unknown>(client, key, {
      Data: input.report === "base-prices" ? filters : { Page: pages, Filters: filters },
    });
    requireSuccess(output.Succeed);
    let pageRows: ReportRow[];
    if (input.report === "base-prices") {
      const response = output.Response as Record<string, unknown> | null;
      if (!response || typeof response !== "object") throw new Error("Zeta no devolvio Response de precios base.");
      requireSuccess(response.Succeed);
      pageRows = requireRows(response.ListaPrecios);
      complete = true;
    } else {
      pageRows = requireRows(output.Response);
      if (![true, false, "true", "false", "True", "False"].includes(output.IsLastPage as boolean)) throw new Error("Zeta no informo IsLastPage; no se puede afirmar que el reporte este completo.");
      complete = output.IsLastPage === true || output.IsLastPage === "true" || output.IsLastPage === "True";
    }
    const pageHash = createHash("sha256").update(JSON.stringify(pageRows)).digest("hex");
    if (pageRows.length && pageHashes.has(pageHash)) throw new Error("Zeta repitio una pagina; se interrumpio el reporte para evitar duplicados.");
    pageHashes.add(pageHash);
    rows.push(...pageRows);
    if (rows.length > 100000) throw new Error("El reporte supera 100000 filas. Acota los filtros; no se exportaron resultados parciales.");
  }
  if (!complete) throw new Error(`Se alcanzo maxPages=${maxPages} sin IsLastPage=true. Acota filtros o amplia el limite; no se genera un reporte truncado.`);
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return {
    metadata: {
      schemaVersion: 1, report: input.report, organizationId: context.organization.id, organizationSlug: context.organization.slug,
      actorProfileId: context.actorProfileId, endpoint: endpoint.endpointName, filters, startedAt, completedAt: new Date().toISOString(),
      pages, rowCount: rows.length, complete: true, source: "zetasoftware", testMode: runtime.metadata.credentialSource === "mock",
      readOnly: true, sha256: createHash("sha256").update(JSON.stringify({ columns, rows })).digest("hex"),
      csvTextProtection: "CSV antepone apostrofo a identificadores de texto y formulas; JSON conserva valores originales.",
    }, columns, rows,
  };
}

export function serializeZetaReportCsv(report: LocalZetaReport): string {
  const cell = (value: Scalar | undefined, column: string) => {
    let text = value === undefined || value === null ? "" : String(value);
    if (typeof value === "string" && (/^[\s]*[=+\-@\t\r\n]/.test(value) || /(^0\d+$)/.test(value) || /codigo|(^|_)id$|numero|serie|rut|documento/i.test(column))) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + [report.columns.map((column) => cell(column, "")).join(","), ...report.rows.map((row) => report.columns.map((column) => cell(row[column], column)).join(","))].join("\r\n") + "\r\n";
}
