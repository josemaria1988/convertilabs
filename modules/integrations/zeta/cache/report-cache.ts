import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalCompanionContext } from "@/modules/local-companion/context";
import { reportHash, validateLocalZetaReportFilters, type LocalZetaReportKind, type ReportCell, type ReportRow, type Scalar } from "./report-contracts";

export const ZETA_DAILY_CACHE_STREAM = "zeta.daily_cache";
const CACHE_ENTITY = "report_snapshot_page";
const PAGE_SIZE = 500;
const MAX_ROWS = 100000;

export class ZetaCacheError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "ZetaCacheError"; }
}

export type ZetaReportSnapshotInput = {
  report: LocalZetaReportKind; filters: Record<string, Scalar>; endpoint: string;
  startedAt: string; completedAt: string; pages: number; columns: string[]; rows: ReportRow[];
  incremental?: ZetaInvoiceIncrementalMetadata;
};
export type ZetaInvoiceIncrementalMetadata = {
  strategy: "replace_queried_window_and_upsert_ids"; sourceDateField: "Fecha";
  previousRunId: string | null; previousDataAsOf: string | null;
  deltaFetchedFrom: string; deltaFetchedTo: string; fetchedFilters: Record<string, Scalar>;
  previousRowCount: number; fetchedRowCount: number; insertedRows: number; updatedRows: number; unchangedRows: number; removedRows: number;
  historicalEditsOutsideDeltaCovered: false;
};
export type ZetaReportSnapshotManifest = Omit<ZetaReportSnapshotInput, "rows"> & {
  snapshotKey: string; cachePages: number; rowCount: number; sha256: string; complete: true;
  priceStatus?: "available" | "no_price_at_source";
  price?: null;
  pricingScope?: "generic_list_without_customer_conditions";
};
export type LocalZetaReport = {
  metadata: {
    schemaVersion: 2; report: LocalZetaReportKind; organizationId: string; organizationSlug: string;
    actorProfileId: string; endpoint: string; filters: Record<string, Scalar>; sourceFilters: Record<string, Scalar>;
    startedAt: string; completedAt: string; pages: number; rowCount: number; complete: true;
    source: "supabase"; originalSource: "zetasoftware"; testMode: false; readOnly: true; sha256: string;
    snapshotRunId: string; snapshotKey: string; dataAsOf: string; cacheAgeSeconds: number; stale: boolean;
    coverage: Record<string, Scalar>; csvTextProtection: string;
    priceStatus?: "available" | "no_price_at_source"; price?: null;
    pricingScope?: "generic_list_without_customer_conditions";
    incremental?: ZetaInvoiceIncrementalMetadata;
    purchasesBalanceCoverage?: unknown;
  };
  columns: string[]; rows: ReportRow[];
};

function fail(code: string, message: string): never { throw new ZetaCacheError(code, message); }
function validInstant(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }

function assertCell(value: unknown, depth = 0): asserts value is ReportCell {
  if (depth > 12) fail("zeta_cache_invalid_rows", "La respuesta tiene una estructura excesivamente profunda.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) { for (const item of value) assertCell(item, depth + 1); return; }
  if (value && typeof value === "object") { for (const item of Object.values(value)) assertCell(item, depth + 1); return; }
  fail("zeta_cache_invalid_rows", "El snapshot contiene un valor que no pertenece al contrato JSON.");
}

export function validateZetaSnapshotRows(value: unknown): asserts value is ReportRow[] {
  if (!Array.isArray(value) || value.length > MAX_ROWS) fail("zeta_cache_invalid_rows", "El snapshot no es una lista valida de hasta 100000 filas.");
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) fail("zeta_cache_invalid_rows", "El snapshot contiene una fila no valida.");
    assertCell(row);
  }
}

/** Staging only: the run remains invisible to readers until the publication RPC succeeds. */
export async function stageZetaReportSnapshot(input: {
  supabase: SupabaseClient; organizationId: string; connectionId?: string | null; runId: string;
  snapshot: ZetaReportSnapshotInput;
}): Promise<ZetaReportSnapshotManifest> {
  const s = input.snapshot;
  const filters = validateLocalZetaReportFilters(s.report, s.filters);
  if (s.report === "sales-prices" && filters.PrecioVentaCodigo === undefined) fail("zeta_cache_invalid_manifest", "El snapshot de precios de venta requiere una lista explicita.");
  validateZetaSnapshotRows(s.rows);
  if (!validInstant(s.startedAt) || !validInstant(s.completedAt) || Date.parse(s.completedAt) < Date.parse(s.startedAt)
    || !Number.isSafeInteger(s.pages) || s.pages < 1 || !/^REST[A-Za-z0-9]+$/.test(s.endpoint)
    || !Array.isArray(s.columns) || s.columns.some((column) => typeof column !== "string")
    || new Set(s.columns).size !== s.columns.length || s.rows.some((row) => Object.keys(row).some((column) => !s.columns.includes(column)))) {
    fail("zeta_cache_invalid_manifest", "El snapshot no tiene evidencia completa de origen y columnas.");
  }
  const snapshotKey = reportHash({ report: s.report, filters }).slice(0, 32);
  const cachePages = Math.max(1, Math.ceil(s.rows.length / PAGE_SIZE));
  const manifest: ZetaReportSnapshotManifest = {
    report: s.report, filters, endpoint: s.endpoint, startedAt: s.startedAt, completedAt: s.completedAt,
    pages: s.pages, columns: s.columns, snapshotKey, cachePages, rowCount: s.rows.length,
    sha256: reportHash({ columns: s.columns, rows: s.rows }), complete: true,
    ...(s.incremental ? { incremental: s.incremental } : {}),
    ...(s.report === "base-prices" || s.report === "sales-prices" ? { priceStatus: s.rows.length ? "available" as const : "no_price_at_source" as const,
      ...(!s.rows.length ? { price: null } : {}) } : {}),
    ...(s.report === "sales-prices" ? { pricingScope: "generic_list_without_customer_conditions" as const } : {}),
  };
  for (let offset = 0; offset < cachePages; offset += 1) {
    const payload = { rows: s.rows.slice(offset * PAGE_SIZE, (offset + 1) * PAGE_SIZE) };
    const { error } = await input.supabase.from("integration_raw_records").insert({
      organization_id: input.organizationId, connection_id: input.connectionId ?? null,
      provider: "zetasoftware", stream: `zeta.reports.${s.report.replaceAll("-", "_")}`, entity_type: CACHE_ENTITY,
      external_key: `${input.runId}:${snapshotKey}:${String(offset + 1).padStart(6, "0")}`,
      external_version_key: input.runId, payload_json: payload, payload_hash: reportHash(payload),
      last_sync_run_id: input.runId, test_mode: false, last_seen_at: s.completedAt,
      metadata_json: { schemaVersion: 1, snapshotKey, page: offset + 1, report: s.report },
    });
    if (error) fail("zeta_cache_stage_failed", "No se pudo preparar el snapshot en Supabase; se conserva la ultima copia completa.");
  }
  return manifest;
}

function readManifest(value: unknown): ZetaReportSnapshotManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("zeta_cache_corrupt", "El manifiesto almacenado no es valido.");
  const m = value as ZetaReportSnapshotManifest;
  if (m.complete !== true || !/^[a-f0-9]{32}$/.test(m.snapshotKey ?? "") || !/^[a-f0-9]{64}$/.test(m.sha256 ?? "")
    || !Number.isSafeInteger(m.cachePages) || m.cachePages < 1 || m.cachePages > 200
    || !Number.isSafeInteger(m.rowCount) || m.rowCount < 0 || m.rowCount > MAX_ROWS
    || m.cachePages !== Math.max(1, Math.ceil(m.rowCount / PAGE_SIZE))
    || !Number.isSafeInteger(m.pages) || m.pages < 1 || !validInstant(m.startedAt) || !validInstant(m.completedAt)
    || !Array.isArray(m.columns) || m.columns.some((column) => typeof column !== "string")
    || new Set(m.columns).size !== m.columns.length) fail("zeta_cache_corrupt", "El snapshot no confirma integridad y cobertura.");
  try { validateLocalZetaReportFilters(m.report, m.filters); }
  catch { fail("zeta_cache_corrupt", "El snapshot tiene filtros de origen no validos."); }
  if (m.report === "sales-prices" && m.filters.PrecioVentaCodigo === undefined) fail("zeta_cache_corrupt", "El snapshot de precios de venta no identifica su lista.");
  if (m.snapshotKey !== reportHash({ report: m.report, filters: m.filters }).slice(0, 32)) fail("zeta_cache_corrupt", "La identidad del snapshot no coincide con sus filtros.");
  return m;
}

function covers(m: ZetaReportSnapshotManifest, filters: Record<string, Scalar>) {
  for (const [key, sourceValue] of Object.entries(m.filters)) {
    const requested = filters[key];
    if (requested === undefined) return false;
    // Price responses do not expose registration dates: date-filtered requests need matching coverage.
    if (m.report !== "base-prices" && /(Desde|Hasta)$/.test(key)) {
      if (sourceValue === null || requested === null) return false;
      if (key.endsWith("Desde") && requested < sourceValue) return false;
      if (key.endsWith("Hasta") && requested > sourceValue) return false;
    } else if (requested !== sourceValue) return false;
  }
  if (m.report === "base-prices" && ["FechaRegistroDesde", "FechaRegistroHasta"].some((key) => filters[key] !== m.filters[key])) return false;
  return true;
}

const filterColumns: Record<string, string> = {
  FechaDesde: "Fecha", FechaHasta: "Fecha", NumeroDesde: "Numero", NumeroHasta: "Numero",
  VencimientoDesde: "Vencimiento", VencimientoHasta: "Vencimiento", CantidadDesde: "StockActual", CantidadHasta: "StockActual",
  CodigoDesde: "Codigo", CodigoHasta: "Codigo", NombreContiene: "Nombre", ArticuloCodigo: "CodigoArticulo", PrecioBaseCodigo: "CodigoPrecio",
  PrecioVentaCodigo: "CodigoPrecioVenta",
};
function filteredRows(m: ZetaReportSnapshotManifest, rows: ReportRow[], filters: Record<string, Scalar>) {
  return rows.filter((row) => Object.entries(filters).every(([key, expected]) => {
    // Exactly matching source filters have already been applied by the ERP.
    if (m.filters[key] === expected) return true;
    const column = m.report === "sales-prices" && key === "MonedaCodigo" ? "CodigoMoneda" : filterColumns[key] ?? key;
    if (!Object.hasOwn(row, column)) fail("zeta_cache_filter_unavailable", `La copia de Supabase no contiene ${column} para aplicar ${key}.`);
    const original = row[column];
    if (original === null || original === "") return false;
    let actual: string | number;
    if (/^(Fecha|Vencimiento)/.test(key)) {
      if (typeof original !== "string" || !/^\d{4}-\d{2}-\d{2}(?:$|T| )/.test(original)) fail("zeta_cache_filter_unavailable", `La fecha ${column} no permite un filtro confiable.`);
      actual = original.slice(0, 10);
    } else if (typeof expected === "number") {
      if ((typeof original !== "number" && typeof original !== "string") || !Number.isFinite(Number(original))) fail("zeta_cache_filter_unavailable", `El campo ${column} no permite un filtro numerico confiable.`);
      actual = Number(original);
    } else {
      if (typeof original !== "string") fail("zeta_cache_filter_unavailable", `El identificador ${column} no esta conservado como texto.`);
      actual = original;
    }
    if (expected === null || typeof expected === "boolean") return false;
    if (key.endsWith("Desde")) return actual >= expected;
    if (key.endsWith("Hasta")) return actual <= expected;
    if (key === "NombreContiene") return String(actual).toLocaleLowerCase("es").includes(String(expected).toLocaleLowerCase("es"));
    return actual === expected;
  }));
}

type CachedRun = { id: string; status: string; started_at: string; finished_at: string | null; summary_json: { schemaVersion?: number; reports?: unknown[]; pricesCoverage?: unknown; purchasesBalanceCoverage?: unknown; mastersRunId?: unknown; mastersWarnings?: unknown }; metadata_json: Record<string, unknown> };

async function completedRuns(supabase: SupabaseClient, organizationId: string): Promise<CachedRun[]> {
  const { data, error } = await supabase.from("integration_sync_runs")
    .select("id,status,started_at,finished_at,summary_json,metadata_json").eq("organization_id", organizationId)
    .eq("provider", "zetasoftware").eq("stream", ZETA_DAILY_CACHE_STREAM).eq("test_mode", false)
    .eq("status", "completed").order("finished_at", { ascending: false }).limit(40);
  if (error) fail("zeta_cache_unavailable", "No se puede consultar la copia de Zeta en Supabase. No se consulta la API como reemplazo.");
  return ((data ?? []) as CachedRun[]).filter((run) => !run.metadata_json?.cachePrunedAt);
}

async function loadSnapshotRows(input: { supabase: SupabaseClient; organizationId: string; runId: string; manifest: ZetaReportSnapshotManifest }) {
  const m = input.manifest;
  const { data, error } = await input.supabase.from("integration_raw_records")
    .select("external_key,payload_json,payload_hash,metadata_json").eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware").eq("entity_type", CACHE_ENTITY).eq("last_sync_run_id", input.runId)
    .eq("metadata_json->>snapshotKey", m.snapshotKey).eq("test_mode", false).order("external_key", { ascending: true }).limit(m.cachePages + 1);
  if (error) fail("zeta_cache_unavailable", "No se pueden leer las paginas del snapshot en Supabase.");
  const pages = data ?? [];
  if (pages.length !== m.cachePages) fail("zeta_cache_incomplete", "La copia no conserva todas las paginas; no se genera un reporte parcial.");
  const rows: ReportRow[] = [];
  pages.forEach((page, index) => {
    const expectedKey = `${input.runId}:${m.snapshotKey}:${String(index + 1).padStart(6, "0")}`;
    if (page.external_key !== expectedKey || page.metadata_json?.page !== index + 1 || reportHash(page.payload_json) !== page.payload_hash) fail("zeta_cache_corrupt", "Una pagina no coincide con la evidencia del snapshot.");
    validateZetaSnapshotRows(page.payload_json?.rows);
    rows.push(...page.payload_json.rows);
  });
  if (rows.length !== m.rowCount || reportHash({ columns: m.columns, rows }) !== m.sha256) fail("zeta_cache_corrupt", "Las filas del snapshot no coinciden con su manifiesto.");
  return rows;
}

/** Historical invoice refreshes retain unrelated datasets with their original
 * timestamps and validated hashes; copying does not claim fresh ERP data. */
export async function loadZetaRetainedNonInvoiceSnapshots(input: { supabase: SupabaseClient; organizationId: string }) {
  const run = (await completedRuns(input.supabase, input.organizationId))[0];
  if (!run) return null;
  if (run.summary_json?.schemaVersion !== 1 || !Array.isArray(run.summary_json.reports)) fail("zeta_cache_corrupt", "La copia anterior no conserva un manifiesto valido.");
  const manifests = run.summary_json.reports.map(readManifest).filter((m) => m.report !== "sales" && m.report !== "purchases");
  if (!["articles", "stock"].every((report) => manifests.some((m) => m.report === report))) fail("zeta_cache_incomplete", "Faltan articulos o stock en la copia anterior; no se publica una copia historica incompleta.");
  const snapshots: ZetaReportSnapshotInput[] = [];
  for (const manifest of manifests) {
    const rows = await loadSnapshotRows({ ...input, runId: run.id, manifest });
    snapshots.push({ report: manifest.report, filters: manifest.filters, endpoint: manifest.endpoint,
      startedAt: manifest.startedAt, completedAt: manifest.completedAt, pages: manifest.pages, columns: manifest.columns, rows });
  }
  return { snapshots, sourceRunId: run.id, pricesCoverage: run.summary_json.pricesCoverage ?? { mode: "not_available", allArticlesCovered: false },
    mastersRunId: run.summary_json.mastersRunId ?? null, mastersWarnings: run.summary_json.mastersWarnings ?? [] };
}

export async function loadCachedZetaReport(input: LocalCompanionContext & {
  report: LocalZetaReportKind; filters: Record<string, Scalar>; now?: Date;
}): Promise<LocalZetaReport> {
  const startedAt = new Date().toISOString();
  let filters = validateLocalZetaReportFilters(input.report, input.filters);
  const runs = await completedRuns(input.supabase, input.organization.id);
  let selected: { run: CachedRun; manifest: ZetaReportSnapshotManifest } | undefined;
  for (const run of runs) {
    if (run.summary_json?.schemaVersion !== 1 || !Array.isArray(run.summary_json.reports)) fail("zeta_cache_corrupt", "La ultima copia publicada no tiene un manifiesto valido.");
    const candidates = run.summary_json.reports.map(readManifest).filter((m) => m.report === input.report);
    if (input.report === "sales-prices" && filters.PrecioVentaCodigo === undefined && candidates.length) {
      const lists = [...new Set(candidates.map((m) => m.filters.PrecioVentaCodigo))];
      if (lists.length !== 1) fail("zeta_cache_price_list_required", "La copia contiene varias listas de precios de venta. Indica --price-list para elegir una sin mezclar importes.");
      filters = { ...filters, PrecioVentaCodigo: lists[0] };
    }
    const manifest = candidates.find((m) => covers(m, filters));
    if (manifest) { selected = { run, manifest }; break; }
  }
  if (!selected) fail("zeta_cache_coverage_missing", "No hay una copia completa en Supabase que cubra este reporte o periodo. Debe incorporarse a la sincronizacion diaria; no se consulta Zeta ahora.");
  const { run, manifest: m } = selected;
  const rows = await loadSnapshotRows({ supabase: input.supabase, organizationId: input.organization.id, runId: run.id, manifest: m });
  const resultRows = filteredRows(m, rows, filters);
  const age = Math.max(0, Math.floor(((input.now ?? new Date()).getTime() - Date.parse(m.completedAt)) / 1000));
  return {
    metadata: {
      schemaVersion: 2, report: input.report, organizationId: input.organization.id, organizationSlug: input.organization.slug,
      actorProfileId: input.actorProfileId, endpoint: m.endpoint, filters, sourceFilters: m.filters, coverage: m.filters,
      startedAt, completedAt: new Date().toISOString(), pages: m.pages, rowCount: resultRows.length, complete: true,
      source: "supabase", originalSource: "zetasoftware", testMode: false, readOnly: true,
      sha256: reportHash({ columns: m.columns, rows: resultRows }), snapshotRunId: run.id, snapshotKey: m.snapshotKey,
      dataAsOf: m.completedAt, cacheAgeSeconds: age, stale: age > 86400,
      ...(m.incremental ? { incremental: m.incremental } : {}),
      ...(m.report === "purchases" ? { purchasesBalanceCoverage: run.summary_json.purchasesBalanceCoverage ?? { mode: "not_available" } } : {}),
      csvTextProtection: "CSV protege identificadores y formulas; campos compuestos contienen JSON. JSON conserva valores originales.",
      ...(m.report === "base-prices" || m.report === "sales-prices" ? { priceStatus: resultRows.length ? "available" as const : "no_price_at_source" as const,
        ...(!resultRows.length ? { price: null } : {}) } : {}),
      ...(m.report === "sales-prices" ? { pricingScope: "generic_list_without_customer_conditions" as const } : {}),
    }, columns: m.columns, rows: resultRows,
  };
}

export async function loadZetaCacheStatus(input: { supabase: SupabaseClient; organizationId: string; now?: Date }) {
  const { data, error } = await input.supabase.from("integration_sync_runs")
    .select("id,status,started_at,finished_at,summary_json,metadata_json,error_code").eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware").eq("stream", ZETA_DAILY_CACHE_STREAM).eq("test_mode", false)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) fail("zeta_cache_unavailable", "No se pudo consultar el estado de la copia diaria en Supabase.");
  const latest = (await completedRuns(input.supabase, input.organizationId))[0];
  const reports = latest?.summary_json.reports?.map(readManifest) ?? [];
  return {
    source: "supabase", apiRequests: 0, timezone: "America/Montevideo", scheduledHour: 18,
    latestAttempt: data ? { runId: data.id, status: data.status, startedAt: data.started_at, completedAt: data.finished_at,
      scheduledDay: data.metadata_json?.scheduledDay, requestsUsed: data.metadata_json?.requestsUsed, maxRequests: data.metadata_json?.maxRequests, errorCode: data.error_code } : null,
    lastCompleteRunId: latest?.id ?? null, dataAsOf: latest?.finished_at ?? null, retainedCopies: 2,
    pricesCoverage: latest?.summary_json.pricesCoverage ?? { mode: "not_available", allArticlesCovered: false },
    purchasesBalanceCoverage: latest?.summary_json.purchasesBalanceCoverage ?? { mode: "not_available" },
    reports: reports.map((m) => ({ report: m.report, filters: m.filters, rows: m.rowCount, dataAsOf: m.completedAt,
      stale: (input.now ?? new Date()).getTime() - Date.parse(m.completedAt) > 86400000,
      ...(m.incremental ? { incremental: m.incremental } : {}),
      ...(m.report === "sales-prices" ? { pricingScope: "generic_list_without_customer_conditions" as const } : {}),
      ...(m.priceStatus ? { priceStatus: m.priceStatus, ...(m.price === null ? { price: null } : {}) } : {}) })),
  };
}

export type ZetaInvoiceCacheBase = {
  runId: string; manifest: ZetaReportSnapshotManifest; rows: ReportRow[];
};

/** Reads the accumulated invoice copy before deciding the next API date range. */
export async function loadZetaInvoiceCacheBase(input: {
  supabase: SupabaseClient; organizationId: string; report: "sales" | "purchases";
}): Promise<ZetaInvoiceCacheBase | null> {
  for (const run of await completedRuns(input.supabase, input.organizationId)) {
    if (run.summary_json?.schemaVersion !== 1 || !Array.isArray(run.summary_json.reports)) fail("zeta_cache_corrupt", "La copia anterior no conserva un manifiesto valido.");
    const manifest = run.summary_json.reports.map(readManifest).find((m) => m.report === input.report);
    if (manifest) return { runId: run.id, manifest, rows: await loadSnapshotRows({ ...input, runId: run.id, manifest }) };
  }
  return null;
}

function invoiceSourceId(row: ReportRow) {
  const value = row.RegistroId;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === "string" && /^[0-9]{1,100}$/.test(value) && !/^0+$/.test(value)) return value;
  fail("zeta_invoice_identity_missing", "Una factura no tiene RegistroId estable; se conserva la copia anterior.");
}

function invoiceDate(row: ReportRow) {
  const value = row.Fecha;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:$|T| )/.test(value)) fail("zeta_invoice_date_missing", "Una factura no conserva su fecha para comprobar la cobertura incremental.");
  const day = value.slice(0, 10);
  try { validateLocalZetaReportFilters("sales", { FechaDesde: day, FechaHasta: day }); }
  catch { fail("zeta_invoice_date_missing", "La fecha de una factura no es valida."); }
  return day;
}

function uniqueInvoices(rows: ReportRow[], filters: Record<string, Scalar>) {
  const result = new Map<string, ReportRow>();
  for (const row of rows) {
    const id = invoiceSourceId(row);
    const day = invoiceDate(row);
    if (day < String(filters.FechaDesde) || day > String(filters.FechaHasta)) fail("zeta_invoice_delta_outside_coverage", "Zeta devolvio una factura fuera del periodo solicitado; no se publica una cobertura incorrecta.");
    const previous = result.get(id);
    if (previous && reportHash(previous) !== reportHash(row)) fail("zeta_invoice_identity_conflict", "Zeta devolvio dos facturas diferentes con el mismo RegistroId en la misma copia.");
    if (!previous) result.set(id, row);
  }
  return result;
}

/** A complete response replaces its date window and upserts matching source IDs.
 * Fecha is the invoice date, not an ERP modification timestamp. Older edits or
 * deletions outside the requested dates require a separately authorized refresh.
 */
export function mergeZetaInvoiceDelta(input: {
  previous: ZetaInvoiceCacheBase | null; delta: ZetaReportSnapshotInput;
}): ZetaReportSnapshotInput {
  const { previous, delta } = input;
  if (delta.report !== "sales" && delta.report !== "purchases") fail("zeta_invoice_report_required", "La acumulacion por RegistroId solo corresponde a facturas de ventas o compras.");
  const fetchedFilters = validateLocalZetaReportFilters(delta.report, delta.filters);
  validateZetaSnapshotRows(delta.rows);
  const from = String(fetchedFilters.FechaDesde); const to = String(fetchedFilters.FechaHasta);
  const incoming = uniqueInvoices(delta.rows, fetchedFilters);
  let accumulated = new Map<string, ReportRow>();
  let coverageFrom = from;
  if (previous) {
    const old = readManifest(previous.manifest);
    if (old.report !== delta.report || old.endpoint !== delta.endpoint) fail("zeta_invoice_source_changed", "La copia anterior corresponde a otra fuente; no se mezcla el historial.");
    validateZetaSnapshotRows(previous.rows);
    if (previous.rows.length !== old.rowCount || reportHash({ columns: old.columns, rows: previous.rows }) !== old.sha256) fail("zeta_cache_corrupt", "La copia anterior no coincide con su evidencia.");
    const withoutDates = (filters: Record<string, Scalar>) => Object.fromEntries(Object.entries(filters).filter(([key]) => !["FechaDesde", "FechaHasta"].includes(key)));
    if (reportHash(withoutDates(old.filters)) !== reportHash(withoutDates(fetchedFilters))) fail("zeta_invoice_source_changed", "Los filtros cambiaron el alcance de las facturas; no se mezcla un historial parcial.");
    const dayAfterPrevious = new Date(`${String(old.filters.FechaHasta)}T00:00:00Z`);
    dayAfterPrevious.setUTCDate(dayAfterPrevious.getUTCDate() + 1);
    if (from > dayAfterPrevious.toISOString().slice(0, 10) || to < String(old.filters.FechaHasta)) fail("zeta_invoice_coverage_gap", "La actualizacion debe continuar el periodo cubierto sin huecos.");
    coverageFrom = String(old.filters.FechaDesde) < from ? String(old.filters.FechaDesde) : from;
    accumulated = uniqueInvoices(previous.rows, old.filters);
  }
  const existing = new Map(accumulated);
  let removedRows = 0;
  for (const [id, row] of accumulated) {
    const day = invoiceDate(row);
    if (day >= from && day <= to && !incoming.has(id)) { accumulated.delete(id); removedRows++; }
  }
  let insertedRows = 0; let updatedRows = 0; let unchangedRows = 0;
  for (const [id, row] of incoming) {
    const old = existing.get(id);
    if (!old) insertedRows++;
    else if (reportHash(old) !== reportHash(row)) updatedRows++;
    else unchangedRows++;
    accumulated.set(id, row);
  }
  const rows = [...accumulated.values()];
  validateZetaSnapshotRows(rows);
  const columns = [...new Set([...(previous?.manifest.columns ?? []), ...delta.columns, ...rows.flatMap(Object.keys)])];
  return {
    ...delta, filters: { ...fetchedFilters, FechaDesde: coverageFrom, FechaHasta: to }, columns, rows,
    incremental: {
      strategy: "replace_queried_window_and_upsert_ids", sourceDateField: "Fecha", previousRunId: previous?.runId ?? null,
      previousDataAsOf: previous?.manifest.completedAt ?? null, deltaFetchedFrom: from, deltaFetchedTo: to,
      fetchedFilters, previousRowCount: previous?.rows.length ?? 0, fetchedRowCount: delta.rows.length,
      insertedRows, updatedRows, unchangedRows, removedRows, historicalEditsOutsideDeltaCovered: false,
    },
  };
}
