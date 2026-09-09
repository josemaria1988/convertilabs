import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildZetaConnection, type ZetaRuntimeConfig } from "../client/auth";
import { getZetaEndpoint, type ZetaEndpointKey } from "../client/endpoint-registry";
import { callZetaEndpoint, createZetaRestClient, type ZetaFetch, type ZetaRestClient } from "../client/rest-client";
import { createDailyZetaRequestPolicy } from "../client/read-policy";
import { runZetaSync } from "../services/sync-service";
import { stageZetaReportSnapshot, validateZetaSnapshotRows, loadZetaInvoiceCacheBase, mergeZetaInvoiceDelta } from "../cache/report-cache";
import { reportHash, type ReportRow } from "../cache/report-contracts";

export type DailyZetaReportKind = "sales" | "purchases" | "articles" | "stock" | "base-prices";
type Scalar = string | number | boolean | null;
export type DailyZetaReportSnapshot = {
  report: DailyZetaReportKind;
  filters: Record<string, Scalar>;
  endpoint: string;
  startedAt: string;
  completedAt: string;
  pages: number;
  columns: string[];
  rows: ReportRow[];
};
export type DailyZetaSyncInput = {
  supabase: SupabaseClient;
  organizationId: string;
  actorProfileId: string;
  maxRequests?: number;
  minIntervalMs?: number;
  maxPages?: number;
  /** Only explicitly configured pairs: never expand this into every article. */
  pricePairs?: Array<{ articleCode: string; priceBaseCode: string }>;
};
type DailyDependencies = {
  runtime?: ZetaRuntimeConfig;
  fetchImpl?: ZetaFetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  stageSnapshot?: typeof stageZetaReportSnapshot;
  runMasters?: typeof runZetaSync;
  loadInvoiceBase?: typeof loadZetaInvoiceCacheBase;
};

function strictBoolean(value: unknown, label: string) {
  if (value === true || value === "true" || value === "True") return true;
  if (value === false || value === "false" || value === "False") return false;
  throw new Error(`Zeta no confirmo ${label}; se conserva la copia anterior.`);
}
function jsonRows(value: unknown): ReportRow[] {
  validateZetaSnapshotRows(value);
  return value;
}
function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}
function validCode(value: string) {
  return typeof value === "string" && value.length > 0 && value.length <= 150
    && value === value.trim() && !/[\u0000-\u001f]/.test(value);
}
function rpcObject(value: unknown): Record<string, unknown> {
  const result = Array.isArray(value) ? value[0] : value;
  if (!result || typeof result !== "object") throw new Error("Supabase no devolvio una respuesta valida del control diario.");
  return result as Record<string, unknown>;
}
async function dailyRpc(supabase: SupabaseClient, name: string, parameters: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, parameters);
  if (error) throw new Error(`No se pudo completar ${name}: ${error.message}`);
  return rpcObject(data);
}

function monthlyQueryFilters(filters: Record<string, Scalar>) {
  const from = String(filters.FechaDesde ?? ""), to = String(filters.FechaHasta ?? "");
  if (!isDate(from) || !isDate(to) || from > to) throw new Error("El reporte documental requiere un rango de fechas valido.");
  const result: Array<Record<string, Scalar>> = [];
  let year = Number(from.slice(0, 4)), month = Number(from.slice(5, 7));
  while (`${year}-${String(month).padStart(2, "0")}-01` <= to) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    result.push({ ...filters, Mes: month, Anio: year, FechaDesde: from > start ? from : start, FechaHasta: to < end ? to : end });
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return result;
}

/** ComprasDetalladas is the documented all-currency supplier source: Moneda is
 * optional and omitted. QueryCompras requires a supplier and is not an all-supplier feed.
 * https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/facturas-de-proveedores/
 */
export function groupZetaPurchaseDetailRows(rows: ReportRow[], requestedMonth: string, to: string): ReportRow[] {
  const grouped = new Map<string, ReportRow>();
  const headerFields = [
    "FacturaId", "FacturaFecha", "FacturaDia", "FacturaMes", "FacturaAnio", "MonedaCodigo", "MonedaSimbolo",
    "Cotizacion", "ComprobanteCodigo", "ComprobanteNombre", "ComprobanteTipo", "FacturaGastos", "FacturaSigno",
    "FacturaSerie", "FacturaNumero", "FacturaSerieNumero", "LocalCodigo", "LocalNombre", "CondicionPagoCodigo",
    "CondicionPagoNombre", "FacturaReferencia", "CentroCostosCodigo", "CentroCostosNombre", "ProveedorCodigo",
    "ProveedorNombre", "ProveedorRazonSocial", "FacturaRegistroFecha", "FacturaRegistroHora",
  ];
  for (const line of rows) {
    const id = line.FacturaId;
    if (!((typeof id === "number" && Number.isSafeInteger(id) && id > 0)
        || (typeof id === "string" && /^[0-9]{1,100}$/.test(id) && !/^0+$/.test(id)))) {
      throw new Error("El detalle de compras no conserva FacturaId estable.");
    }
    const parts = [line.FacturaAnio, line.FacturaMes, line.FacturaDia];
    if (parts.some((part) => typeof part !== "number" || !Number.isInteger(part))) throw new Error("El detalle de compras no conserva dia/mes/anio numericos.");
    const date = `${String(parts[0]).padStart(4, "0")}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`;
    if (!isDate(date) || date.slice(0, 7) !== requestedMonth) throw new Error("Zeta devolvio una compra fuera del mes solicitado.");
    if (date > to) continue;
    const fields = Object.fromEntries(headerFields.filter((key) => Object.hasOwn(line, key)).map((key) => [key, line[key]]));
    const invoice: ReportRow = {
      ...fields, RegistroId: id, Fecha: date, Serie: line.FacturaSerie ?? null, Numero: line.FacturaNumero ?? null,
      Lines: [], _source: {
        grain: "invoice", sourceGrain: "purchase_detail_lines", endpoint: "RESTFacturaProveedorV1ComprasDetalladas",
        mapping: { RegistroId: "FacturaId", Fecha: "FacturaAnio/FacturaMes/FacturaDia", Serie: "FacturaSerie", Numero: "FacturaNumero" },
        invoiceTotals: "not_supplied_by_source", lineAmounts: "preserved_in_Lines", currency: "original_source_currency",
      },
    };
    const prior = grouped.get(String(id));
    if (prior) {
      const priorHeader = { ...prior, Lines: [] };
      if (reportHash(priorHeader) !== reportHash(invoice)) throw new Error("Dos lineas de la misma compra tienen encabezados incompatibles.");
      (prior.Lines as ReportRow[]).push(line);
    } else {
      (invoice.Lines as ReportRow[]).push(line);
      grouped.set(String(id), invoice);
    }
  }
  return [...grouped.values()];
}

async function fetchPurchaseMonth(input: { client: ZetaRestClient; filters: Record<string, Scalar>; now: () => number }): Promise<DailyZetaReportSnapshot> {
  const from = String(input.filters.FechaDesde ?? ""), to = String(input.filters.FechaHasta ?? "");
  if (!isDate(from) || !isDate(to) || from.slice(0, 7) !== to.slice(0, 7) || !from.endsWith("-01") || from > to) {
    throw new Error("Compras requiere una sola consulta del mes actual, desde su primer dia.");
  }
  const startedAt = new Date(input.now()).toISOString();
  const output = await callZetaEndpoint(input.client, "facturaProveedorComprasDetalladas", {
    Data: { Mes: Number(from.slice(5, 7)), Anio: Number(from.slice(0, 4)) },
  });
  const response = output.Response as Record<string, unknown> | null;
  if (!response || typeof response !== "object" || !strictBoolean(response.Succeed, "Response.Succeed=true")) throw new Error("Zeta rechazo el detalle mensual de compras.");
  const rows = groupZetaPurchaseDetailRows(jsonRows(response.ComprasDetalladas), from.slice(0, 7), to);
  return {
    report: "purchases", filters: input.filters, endpoint: getZetaEndpoint("facturaProveedorComprasDetalladas").endpointName,
    startedAt, completedAt: new Date(input.now()).toISOString(), pages: 1,
    columns: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows,
  };
}

/** Read a whole dataset or fail. Every HTTP request passes the common policy. */
export async function fetchDailyZetaReport(input: {
  client: ZetaRestClient;
  report: DailyZetaReportKind;
  filters: Record<string, Scalar>;
  maxPages: number;
  now?: () => number;
}): Promise<DailyZetaReportSnapshot> {
  const keys: Record<DailyZetaReportKind, ZetaEndpointKey> = {
    sales: "salesInvoicesQuery", purchases: "facturaProveedorComprasDetalladas", articles: "articlesQuery",
    stock: "stockActualQuery", "base-prices": "articleBasePricesLoad",
  };
  const key = keys[input.report];
  if (!key) throw new Error("Reporte diario no soportado.");
  const now = input.now ?? Date.now;
  if (input.report === "purchases") return fetchPurchaseMonth({ client: input.client, filters: input.filters, now });
  const startedAt = new Date(now()).toISOString();
  const rows: ReportRow[] = [];
  const hashes = new Set<string>();
  let pages = 0;
  const queryFilters = input.report === "sales"
    ? monthlyQueryFilters(input.filters) : [input.filters];
  for (const filters of queryFilters) {
    let complete = false;
    let queryPage = 0;
    while (!complete && pages < input.maxPages) {
    pages += 1;
    queryPage += 1;
    const output = await callZetaEndpoint(input.client, key, {
      Data: input.report === "base-prices" ? filters : { Page: queryPage, Filters: filters },
    });
    if (!strictBoolean(output.Succeed, "Succeed=true")) throw new Error("Zeta rechazo el reporte.");
    let pageRows: ReportRow[];
    if (input.report === "base-prices") {
      const response = output.Response as Record<string, unknown> | null;
      if (!response || typeof response !== "object" || !strictBoolean(response.Succeed, "Response.Succeed=true")) {
        throw new Error("Zeta rechazo la consulta de precios.");
      }
      pageRows = jsonRows(response.ListaPrecios);
      if (pageRows.some((row) => row.CodigoArticulo !== input.filters.ArticuloCodigo
          || row.CodigoPrecio !== input.filters.PrecioBaseCodigo)) {
        throw new Error("Zeta devolvio precios de un articulo o lista distintos de los codigos solicitados.");
      }
      complete = true;
    } else {
      pageRows = jsonRows(output.Response);
      complete = strictBoolean(output.IsLastPage, "IsLastPage");
    }
    const hash = reportHash(pageRows);
    if (pageRows.length > 0 && hashes.has(hash)) throw new Error("Zeta repitio una pagina; no se publica el reporte.");
    if (!complete && pageRows.length === 0) throw new Error("Zeta devolvio una pagina vacia sin confirmar el final.");
    hashes.add(hash);
    if (input.report === "sales") {
      // The date filter exists in the official contract, but retain a local
      // boundary check so monthly queries cannot overstate the published range.
      pageRows = pageRows.filter((row) => {
        if (typeof row.Fecha !== "string" || !isDate(row.Fecha.slice(0, 10))) throw new Error("Zeta devolvio una fecha documental invalida.");
        const date = row.Fecha.slice(0, 10);
        return date >= String(filters.FechaDesde) && date <= String(filters.FechaHasta);
      });
    }
    rows.push(...pageRows);
    if (rows.length > 100000) throw new Error("El reporte supera el limite interno de 100000 filas.");
    }
    if (!complete) throw new Error(`El reporte supera el limite interno de ${input.maxPages} paginas; no se publica parcialmente.`);
  }
  return {
    report: input.report, filters: input.filters, endpoint: getZetaEndpoint(key).endpointName,
    startedAt, completedAt: new Date(now()).toISOString(), pages,
    columns: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows,
  };
}

/** One organization-wide daily claim, decided by the database clock (18:00 UY).
 * This function never retries a failed request or creates an automatic ERP write. */
export async function runDailyZetaSync(input: DailyZetaSyncInput, deps: DailyDependencies = {}) {
  const maxRequests = input.maxRequests ?? 100;
  const minIntervalMs = input.minIntervalMs ?? 2000;
  const maxPages = input.maxPages ?? 100;
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > 1000
      || !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 200
      || !Number.isSafeInteger(minIntervalMs) || minIntervalMs < 1000 || minIntervalMs > 60000) {
    throw new Error("Los limites internos requieren maxRequests 1..1000, maxPages 1..200 e intervalo 1000..60000 ms.");
  }
  const pairs = input.pricePairs ?? [];
  if (!Array.isArray(pairs) || pairs.length > 50
      || pairs.some((pair) => !pair || !validCode(pair.articleCode) || !validCode(pair.priceBaseCode))) {
    throw new Error("Configura hasta 50 pares explicitos de articulo/precio, conservando sus codigos exactos.");
  }
  const uniquePairs = [...new Map(pairs.map((pair) => [JSON.stringify(pair), pair])).values()];
  const claim = await dailyRpc(input.supabase, "claim_zeta_daily_sync", {
    p_organization_id: input.organizationId, p_actor_user_id: input.actorProfileId,
    p_max_requests: maxRequests,
    p_input: { invoiceMode: "incremental_sales_monthly_purchases", pricePairs: uniquePairs, maxPages, minIntervalMs, timeZone: "America/Montevideo", scheduledHour: 18 },
  });
  if (claim.claimed !== true) {
    return { status: "skipped" as const, runId: claim.runId ?? null, reason: claim.reason ?? "daily_not_due", scheduledDay: claim.scheduledDay ?? null };
  }
  const runId = String(claim.runId ?? "");
  const leaseToken = String(claim.leaseToken ?? "");
  const scheduledDay = String(claim.scheduledDay ?? "");
  const scope = { p_organization_id: input.organizationId, p_run_id: runId, p_lease_token: leaseToken };
  let requestCount = 0;
  try {
    if (!runId || !leaseToken || !isDate(scheduledDay)) throw new Error("Reserva diaria invalida.");
    const loadBase = deps.loadInvoiceBase ?? loadZetaInvoiceCacheBase;
    const salesBase = await loadBase({ supabase: input.supabase, organizationId: input.organizationId, report: "sales" });
    const purchasesBase = await loadBase({ supabase: input.supabase, organizationId: input.organizationId, report: "purchases" });
    const dateFrom = salesBase ? String(salesBase.manifest.filters.FechaHasta) : scheduledDay;
    const purchaseFrom = `${scheduledDay.slice(0, 7)}-01`;
    if (!isDate(dateFrom) || dateFrom > scheduledDay) throw new Error("La copia anterior conserva una fecha de actualizacion invalida.");
    if (purchasesBase) {
      const previousTo = String(purchasesBase.manifest.filters.FechaHasta);
      if (!isDate(previousTo) || previousTo > scheduledDay
          || purchaseFrom > new Date(Date.parse(previousTo) + 86400000).toISOString().slice(0, 10)) {
        throw new Error("Falta cerrar un mes anterior de compras. Se necesita una recuperacion explicita antes de continuar; no se consulto Zeta.");
      }
      if (purchasesBase.manifest.endpoint !== getZetaEndpoint("facturaProveedorComprasDetalladas").endpointName) {
        throw new Error("La copia de compras corresponde a otra fuente y requiere una migracion explicita; no se consulto Zeta.");
      }
    }
    const runtime = deps.runtime ?? await buildZetaConnection({ supabase: input.supabase, organizationId: input.organizationId });
    if (runtime.metadata.credentialSource === "mock" && !deps.fetchImpl) {
      throw new Error("La conexion es mock; no se publican datos simulados como copia real.");
    }
    const requestPolicy = createDailyZetaRequestPolicy({
      organizationId: input.organizationId, minIntervalMs, sleep: deps.sleep, now: deps.now,
      async reserveRequest(endpoint) {
        const result = await dailyRpc(input.supabase, "reserve_zeta_daily_request", { ...scope, p_endpoint: endpoint });
        requestCount = Number(result.requestNumber);
        if (!Number.isSafeInteger(requestCount) || requestCount < 1) throw new Error("Supabase no confirmo la reserva de la consulta.");
      },
    });
    const client = createZetaRestClient({ ...runtime, organizationId: input.organizationId, requestPolicy, fetchImpl: deps.fetchImpl });
    const definitions: Array<{ report: DailyZetaReportKind; filters: Record<string, Scalar> }> = [
      { report: "sales", filters: { FechaDesde: dateFrom, FechaHasta: scheduledDay } },
      { report: "purchases", filters: { FechaDesde: purchaseFrom, FechaHasta: scheduledDay } },
      { report: "articles", filters: {} },
      { report: "stock", filters: {} },
      ...uniquePairs.map((pair) => ({ report: "base-prices" as const, filters: { ArticuloCodigo: pair.articleCode, PrecioBaseCodigo: pair.priceBaseCode } })),
    ];
    const manifests = [];
    for (const definition of definitions) {
      const fetched = await fetchDailyZetaReport({ client, ...definition, maxPages, now: deps.now });
      const snapshot = definition.report === "sales" || definition.report === "purchases"
        ? mergeZetaInvoiceDelta({ previous: definition.report === "sales" ? salesBase : purchasesBase, delta: fetched }) : fetched;
      manifests.push(await (deps.stageSnapshot ?? stageZetaReportSnapshot)({
        supabase: input.supabase, organizationId: input.organizationId,
        connectionId: typeof claim.connectionId === "string" ? claim.connectionId : null, runId, snapshot,
      }));
    }
    const masters = await (deps.runMasters ?? runZetaSync)({
      supabase: input.supabase, organizationId: input.organizationId, actorUserId: input.actorProfileId,
      stream: "masters", runKind: "scheduled", testMode: false, maxPages, requestPolicy, fetchImpl: deps.fetchImpl,
    });
    if (masters.recordsFailed > 0) throw new Error("La actualizacion de maestros tuvo errores; se conserva la copia anterior de reportes.");
    const summary = {
      schemaVersion: 1, reports: manifests, requestsUsed: requestCount, limits: { maxRequests, minIntervalMs, maxPages, officialVendorQuota: false },
      salesCoverage: { mode: "incremental", from: dateFrom, to: scheduledDay, historicalEditsOutsideDeltaCovered: false },
      purchasesCoverage: { mode: "monthly_api_required", from: purchaseFrom, to: scheduledDay, sourceGrain: "detail_lines_grouped_by_invoice", invoiceTotals: "not_supplied_by_source", originalLineAmountsPreserved: true },
      pricesCoverage: { mode: "explicit_pairs", pairs: uniquePairs, allArticlesCovered: false,
        note: "El contrato disponible no documenta valores de precios en un endpoint masivo. Un precio no consultado no equivale a cero ni a ausencia confirmada." },
      mastersRunId: masters.runId, mastersWarnings: masters.warnings,
    };
    try {
      await dailyRpc(input.supabase, "publish_zeta_daily_sync", { ...scope, p_summary: summary });
    } catch {
      // Only the idempotent Supabase publication is retried when its acknowledgement
      // is lost. No Zeta request or snapshot fetch is repeated.
      await dailyRpc(input.supabase, "publish_zeta_daily_sync", { ...scope, p_summary: summary });
    }
    return { status: "completed" as const, runId, scheduledDay, ...summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fallo la actualizacion diaria de Zeta.";
    try {
      await dailyRpc(input.supabase, "fail_zeta_daily_sync", { ...scope, p_error_code: "zeta_daily_sync_failed", p_error_message: message });
    } catch {
      // The fenced lease remains visible if the failure acknowledgement is lost.
    }
    throw new Error(`Actualizacion diaria fallida; los reportes conservan su ultima copia completa. ${message}`, { cause: error });
  }
}
