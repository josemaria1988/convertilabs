import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  callZetaEndpoint,
  createZetaRestClient,
  queryZetaEndpoint,
  type ZetaFetch,
  type ZetaRestClient,
} from "@/modules/integrations/zeta/client/rest-client";
import { buildZetaConnection } from "@/modules/integrations/zeta/client/auth";
import type { ZetaEndpointKey } from "@/modules/integrations/zeta/client/endpoint-registry";
import type { ZetaJsonRecord } from "@/modules/integrations/zeta/contracts/shared";
import {
  createIntegrationSyncRun,
  finishIntegrationSyncRun,
  integrationTables,
  recordIntegrationAuditEvent,
  upsertIntegrationCursor,
  upsertIntegrationRawRecord,
} from "@/modules/integrations/repository";
import {
  normalizeZetaReceivedCfe,
} from "@/modules/integrations/zeta/normalizers/received-cfe";
import {
  normalizeZetaSalesInvoice,
} from "@/modules/integrations/zeta/normalizers/sales";
import {
  asArray,
  asRecord,
  firstString,
  type JsonRecord,
  type ZetaCanonicalDocument,
} from "@/modules/integrations/zeta/normalizers/common";
import { materializeZetaDocument } from "@/modules/integrations/zeta/services/materialization-service";

export type ZetaSyncStream = "masters" | "sales_documents" | "received_cfes";

export type ZetaSyncInput = {
  supabase: SupabaseClient;
  organizationId: string;
  actorUserId?: string | null;
  stream: ZetaSyncStream;
  period?: string | null;
  maxPages?: number | null;
  fetchImpl?: ZetaFetch;
};

export type ZetaSyncSummary = {
  runId: string;
  stream: ZetaSyncStream;
  period: string | null;
  recordsSeen: number;
  recordsUpserted: number;
  recordsSkipped: number;
  recordsFailed: number;
  documentsMaterialized: number;
  documentsSkipped: number;
  warnings: string[];
};

type ZetaConnectionRow = {
  id: string;
  status: string;
  test_mode: boolean;
  config_json: JsonRecord | null;
};

type SyncCounters = {
  seen: number;
  upserted: number;
  skipped: number;
  failed: number;
  documentsMaterialized: number;
  documentsSkipped: number;
  warnings: string[];
};

const masterQueries: Array<{
  key: ZetaEndpointKey;
  entityType: string;
  externalKeyFields: string[];
}> = [
  { key: "contactsQuery", entityType: "contact", externalKeyFields: ["Codigo", "RUT", "Documento"] },
  { key: "customerCommercialDataQuery", entityType: "customer_commercial_data", externalKeyFields: ["Codigo"] },
  { key: "supplierCommercialDataQuery", entityType: "supplier_commercial_data", externalKeyFields: ["Codigo"] },
  { key: "currenciesQuery", entityType: "currency", externalKeyFields: ["Codigo", "CodigoISO"] },
  { key: "currencyRatesQuery", entityType: "currency_rate", externalKeyFields: ["MonedaCodigo", "Fecha"] },
  { key: "chartAccountsQuery", entityType: "chart_account", externalKeyFields: ["Codigo"] },
  { key: "taxRatesQuery", entityType: "vat_rate", externalKeyFields: ["Codigo"] },
  { key: "businessLocationsQuery", entityType: "business_location", externalKeyFields: ["Codigo"] },
  { key: "salesDocumentTypesQuery", entityType: "document_type", externalKeyFields: ["Codigo", "LocalCodigo"] },
  { key: "documentTypesQuery", entityType: "cfe_type", externalKeyFields: ["Codigo", "Etapa"] },
  { key: "costCentersQuery", entityType: "cost_center", externalKeyFields: ["Codigo"] },
  { key: "referencesQuery", entityType: "reference", externalKeyFields: ["Codigo"] },
  { key: "rutNumbersQuery", entityType: "rut_number", externalKeyFields: ["RUT"] },
];

function nowIso() {
  return new Date().toISOString();
}

function clampMaxPages(value: number | null | undefined, fallback: number) {
  if (!Number.isFinite(value ?? NaN)) {
    return fallback;
  }

  return Math.max(1, Math.min(Math.trunc(value as number), 200));
}

function parsePeriod(value: string | null | undefined) {
  const raw = value?.trim();
  const match = raw?.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    throw new Error("Indica el periodo en formato YYYY-MM para sincronizar documentos Zeta.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("El periodo Zeta debe tener un mes valido.");
  }

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, month, 0));
  const endDate = end.toISOString().slice(0, 10);

  return {
    period: `${year}-${String(month).padStart(2, "0")}`,
    year,
    month,
    startDate,
    endDate,
  };
}

function makeMockFetch(): ZetaFetch {
  return async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      QueryOut: {
        Succeed: true,
        Response: [],
        IsLastPage: true,
        Error: null,
      },
      QueryVentasOut: {
        Succeed: true,
        Response: [],
        IsLastPage: true,
        Error: null,
      },
      CFEsRecibidosOut: {
        Succeed: true,
        Response: {
          ListaCFEs: [],
          Succeed: true,
          Mensaje: "",
        },
        Error: null,
      },
    }),
  });
}

async function loadConnection(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from(integrationTables.connections)
    .select("id, status, test_mode, config_json")
    .eq("organization_id", organizationId)
    .eq("provider", "zetasoftware")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = (data as ZetaConnectionRow | null) ?? null;

  if (!row) {
    throw new Error("Guarda la conexion Zetasoftware antes de ejecutar sincronizaciones.");
  }

  if (row.status === "paused") {
    throw new Error("La conexion Zetasoftware esta pausada.");
  }

  return row;
}

async function buildClient(input: {
  supabase: SupabaseClient;
  organizationId: string;
  fetchImpl?: ZetaFetch;
}) {
  const runtime = await buildZetaConnection({
    supabase: input.supabase,
    organizationId: input.organizationId,
  });

  return createZetaRestClient({
    baseUrl: runtime.baseUrl,
    credentials: runtime.credentials,
    fetchImpl: input.fetchImpl ?? (
      runtime.metadata.credentialSource === "mock" ? makeMockFetch() : undefined
    ),
  });
}

function buildMasterExternalKey(row: JsonRecord, fields: string[], fallbackPrefix: string) {
  const parts = fields
    .map((field) => firstString(row[field]))
    .filter((value): value is string => Boolean(value));

  if (parts.length > 0) {
    return parts.join(":");
  }

  return `${fallbackPrefix}:${JSON.stringify(row).slice(0, 160)}`;
}

async function fetchAllQueryRows(
  client: ZetaRestClient,
  input: {
    key: ZetaEndpointKey;
    filters?: ZetaJsonRecord;
    maxPages: number;
  },
) {
  const rows: JsonRecord[] = [];

  for (let page = 1; page <= input.maxPages; page += 1) {
    const result = await queryZetaEndpoint<JsonRecord>(client, input.key, {
      page,
      filters: input.filters ?? {},
    });

    rows.push(...result.rows.map(asRecord));

    if (result.isLastPage || result.rows.length === 0) {
      break;
    }
  }

  return rows;
}

async function syncMasters(input: {
  supabase: SupabaseClient;
  client: ZetaRestClient;
  organizationId: string;
  connectionId: string;
  runId: string;
  maxPages: number;
  counters: SyncCounters;
  testMode: boolean;
}) {
  for (const query of masterQueries) {
    const rows = await fetchAllQueryRows(input.client, {
      key: query.key,
      maxPages: input.maxPages,
    });

    for (const row of rows) {
      input.counters.seen += 1;
      const externalKey = buildMasterExternalKey(row, query.externalKeyFields, query.entityType);
      await upsertIntegrationRawRecord(input.supabase, {
        organizationId: input.organizationId,
        connectionId: input.connectionId,
        provider: "zetasoftware",
        stream: `zeta.masters.${query.entityType}`,
        entityType: query.entityType,
        externalKey,
        payload: {
          endpoint_key: query.key,
          row,
        },
        lastSyncRunId: input.runId,
        testMode: input.testMode,
        metadata: {
          endpoint_key: query.key,
        },
      });
      input.counters.upserted += 1;
    }
  }
}

async function fetchSalesDetail(client: ZetaRestClient, summary: JsonRecord) {
  const facturaId = firstString(summary.RegistroId);

  if (!facturaId) {
    return null;
  }

  try {
    return await callZetaEndpoint(client, "salesInvoiceDetail", {
      Data: {
        FacturaId: Number(facturaId),
      },
    });
  } catch (error) {
    return {
      Response: {
        VentasDetalladas: [],
      },
      Error: {
        Message: error instanceof Error ? error.message : "No se pudo obtener VentaDetallada.",
      },
    };
  }
}

async function upsertAndMaterialize(
  input: {
    supabase: SupabaseClient;
    organizationId: string;
    connectionId: string;
    actorUserId?: string | null;
    runId: string;
    testMode: boolean;
    document: ZetaCanonicalDocument;
    counters: SyncCounters;
  },
) {
  const raw = await upsertIntegrationRawRecord(input.supabase, {
    organizationId: input.organizationId,
    connectionId: input.connectionId,
    provider: "zetasoftware",
    stream: input.document.stream,
    entityType: input.document.entityType,
    externalKey: input.document.externalKey,
    externalVersionKey: input.document.payloadHash,
    payload: input.document.raw,
    payloadHash: input.document.payloadHash,
    lastSyncRunId: input.runId,
    testMode: input.testMode,
    documentDate: input.document.issueDate,
    currencyCode: input.document.currency.currencyCode,
    sourceExchangeRate: input.document.currency.sourceRate,
    sourceExchangeRateDate: input.document.currency.sourceRateDate,
    sourceExchangeRateKind: input.document.currency.sourceRateKind,
    sourceTotalAmount: input.document.amounts.total,
    sourceNetAmount: input.document.amounts.net,
    sourceTaxAmount: input.document.amounts.tax,
    sourceMonetary: {
      currency_code: input.document.currency.currencyCode,
      zeta_currency_code: input.document.currency.zetaCurrencyCode,
      source_rate: input.document.currency.sourceRate,
      net: input.document.amounts.net,
      tax: input.document.amounts.tax,
      total: input.document.amounts.total,
    },
    metadata: {
      source_kind: input.document.sourceKind,
      human_key: input.document.humanKey,
      warnings: input.document.warnings,
    },
  });
  input.counters.upserted += 1;

  const result = await materializeZetaDocument(input.supabase, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? null,
    syncRunId: input.runId,
    rawRecordId: String(raw.id),
    document: input.document,
  });

  if (result.status === "materialized") {
    input.counters.documentsMaterialized += 1;
  } else {
    input.counters.documentsSkipped += 1;
  }

  input.counters.warnings.push(...result.warnings);

  return result;
}

async function syncSalesDocuments(input: {
  supabase: SupabaseClient;
  client: ZetaRestClient;
  organizationId: string;
  connectionId: string;
  actorUserId?: string | null;
  runId: string;
  period: ReturnType<typeof parsePeriod>;
  maxPages: number;
  counters: SyncCounters;
  testMode: boolean;
}) {
  for (let page = 1; page <= input.maxPages; page += 1) {
    const result = await queryZetaEndpoint<JsonRecord>(input.client, "salesInvoicesQuery", {
      page,
      filters: {
        Mes: input.period.month,
        Anio: input.period.year,
        FechaDesde: input.period.startDate,
        FechaHasta: input.period.endDate,
      },
    });

    for (const summary of result.rows.map(asRecord)) {
      input.counters.seen += 1;

      try {
        const detailPayload = await fetchSalesDetail(input.client, summary);
        const normalized = normalizeZetaSalesInvoice({
          summary,
          detailPayload,
        });
        await upsertAndMaterialize({
          supabase: input.supabase,
          organizationId: input.organizationId,
          connectionId: input.connectionId,
          actorUserId: input.actorUserId,
          runId: input.runId,
          testMode: input.testMode,
          document: normalized,
          counters: input.counters,
        });
      } catch (error) {
        input.counters.failed += 1;
        input.counters.warnings.push(
          error instanceof Error
            ? error.message
            : "No se pudo normalizar una venta Zetasoftware.",
        );
      }
    }

    if (result.isLastPage || result.rows.length === 0) {
      break;
    }
  }
}

function receivedCfeDetailInput(summary: JsonRecord) {
  return {
    Data: {
      EmisorRUT: firstString(summary.RUT) ?? "",
      CFETipo: firstString(summary.EmisorCFETipo, summary.CFETipo) ?? "",
      CFESerie: firstString(summary.Serie, summary.CFESerie) ?? "",
      CFENumero: Number(firstString(summary.Numero, summary.CFENumero) ?? 0),
    },
  };
}

async function fetchReceivedCfeDetail(client: ZetaRestClient, summary: JsonRecord) {
  try {
    return await callZetaEndpoint(client, "receivedCfeDetail", receivedCfeDetailInput(summary));
  } catch (error) {
    return {
      Response: {
        CFEDetalle: {
          Detalle: [],
        },
      },
      Error: {
        Message: error instanceof Error ? error.message : "No se pudo obtener CFERECIBIDODETALLE.",
      },
    };
  }
}

async function syncReceivedCfes(input: {
  supabase: SupabaseClient;
  client: ZetaRestClient;
  organizationId: string;
  connectionId: string;
  actorUserId?: string | null;
  runId: string;
  period: ReturnType<typeof parsePeriod>;
  maxPages: number;
  counters: SyncCounters;
  testMode: boolean;
}) {
  for (let page = 1; page <= input.maxPages; page += 1) {
    const output = await callZetaEndpoint(input.client, "receivedCfesQuery", {
      Data: {
        LocalCodigo: 0,
        FechaDesde: input.period.startDate,
        FechaHasta: input.period.endDate,
        TipoCFECodigo: 0,
        Pagina: page,
      },
    });
    const response = asRecord(output.Response);
    const rows = asArray(response.ListaCFEs).map(asRecord);

    for (const summary of rows) {
      input.counters.seen += 1;

      try {
        const detailPayload = await fetchReceivedCfeDetail(input.client, summary);
        const normalized = normalizeZetaReceivedCfe({
          summary,
          detailPayload,
        });
        await upsertAndMaterialize({
          supabase: input.supabase,
          organizationId: input.organizationId,
          connectionId: input.connectionId,
          actorUserId: input.actorUserId,
          runId: input.runId,
          testMode: input.testMode,
          document: normalized,
          counters: input.counters,
        });
      } catch (error) {
        input.counters.failed += 1;
        input.counters.warnings.push(
          error instanceof Error
            ? error.message
            : "No se pudo normalizar un CFE recibido Zetasoftware.",
        );
      }
    }

    if (rows.length === 0) {
      break;
    }
  }
}

function cursorKey(input: {
  stream: ZetaSyncStream;
  period: string | null;
}) {
  return input.period ? `${input.stream}:${input.period}` : input.stream;
}

export async function runZetaSync(input: ZetaSyncInput): Promise<ZetaSyncSummary> {
  const connection = await loadConnection(input.supabase, input.organizationId);
  const client = await buildClient({
    supabase: input.supabase,
    organizationId: input.organizationId,
    fetchImpl: input.fetchImpl,
  });
  const period = input.stream === "masters" ? null : parsePeriod(input.period);
  const maxPages = clampMaxPages(input.maxPages, input.stream === "masters" ? 5 : 25);
  const run = await createIntegrationSyncRun(input.supabase, {
    organizationId: input.organizationId,
    connectionId: connection.id,
    provider: "zetasoftware",
    stream: input.stream,
    runKind: "manual",
    status: "running",
    testMode: connection.test_mode,
    initiatedByUserId: input.actorUserId ?? null,
    cursorFrom: null,
    input: {
      period: period?.period ?? null,
      max_pages: maxPages,
      execution: connection.test_mode ? "mock_or_test" : "real_read_only",
    },
    metadata: {
      provider: "zetasoftware",
      started_from: "settings_integrations",
    },
  });
  const runId = String(run.id);
  const counters: SyncCounters = {
    seen: 0,
    upserted: 0,
    skipped: 0,
    failed: 0,
    documentsMaterialized: 0,
    documentsSkipped: 0,
    warnings: [],
  };

  await recordIntegrationAuditEvent(input.supabase, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? null,
    entityType: "integration_sync_run",
    entityId: runId,
    action: "zeta_sync_started",
    metadata: {
      stream: input.stream,
      period: period?.period ?? null,
    },
  });

  try {
    if (input.stream === "masters") {
      await syncMasters({
        supabase: input.supabase,
        client,
        organizationId: input.organizationId,
        connectionId: connection.id,
        runId,
        maxPages,
        counters,
        testMode: connection.test_mode,
      });
    } else if (input.stream === "sales_documents" && period) {
      await syncSalesDocuments({
        supabase: input.supabase,
        client,
        organizationId: input.organizationId,
        connectionId: connection.id,
        actorUserId: input.actorUserId,
        runId,
        period,
        maxPages,
        counters,
        testMode: connection.test_mode,
      });
    } else if (input.stream === "received_cfes" && period) {
      await syncReceivedCfes({
        supabase: input.supabase,
        client,
        organizationId: input.organizationId,
        connectionId: connection.id,
        actorUserId: input.actorUserId,
        runId,
        period,
        maxPages,
        counters,
        testMode: connection.test_mode,
      });
    }

    await upsertIntegrationCursor(input.supabase, {
      organizationId: input.organizationId,
      connectionId: connection.id,
      provider: "zetasoftware",
      stream: input.stream,
      cursorKey: cursorKey({
        stream: input.stream,
        period: period?.period ?? null,
      }),
      cursorValue: nowIso(),
      cursor: {
        period: period?.period ?? null,
        records_seen: counters.seen,
        records_upserted: counters.upserted,
      },
      lastSuccessRunId: runId,
      lastSyncedAt: nowIso(),
    });

    await finishIntegrationSyncRun(input.supabase, {
      organizationId: input.organizationId,
      runId,
      status: counters.failed > 0 ? "completed_with_warnings" : "completed",
      recordsSeen: counters.seen,
      recordsUpserted: counters.upserted,
      recordsSkipped: counters.skipped + counters.documentsSkipped,
      recordsFailed: counters.failed,
      cursorTo: nowIso(),
      summary: {
        period: period?.period ?? null,
        documents_materialized: counters.documentsMaterialized,
        documents_skipped: counters.documentsSkipped,
        warnings_count: counters.warnings.length,
      },
      warnings: Array.from(new Set(counters.warnings)).slice(0, 200),
      cleanupStatus: "not_required",
      cleanupEvidence: {
        reason: "read_only_sync",
      },
    });

    await recordIntegrationAuditEvent(input.supabase, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      entityType: "integration_sync_run",
      entityId: runId,
      action: "zeta_sync_completed",
      metadata: {
        stream: input.stream,
        period: period?.period ?? null,
        records_seen: counters.seen,
        records_upserted: counters.upserted,
        documents_materialized: counters.documentsMaterialized,
      },
    });

    return {
      runId,
      stream: input.stream,
      period: period?.period ?? null,
      recordsSeen: counters.seen,
      recordsUpserted: counters.upserted,
      recordsSkipped: counters.skipped + counters.documentsSkipped,
      recordsFailed: counters.failed,
      documentsMaterialized: counters.documentsMaterialized,
      documentsSkipped: counters.documentsSkipped,
      warnings: Array.from(new Set(counters.warnings)),
    };
  } catch (error) {
    await finishIntegrationSyncRun(input.supabase, {
      organizationId: input.organizationId,
      runId,
      status: "failed",
      recordsSeen: counters.seen,
      recordsUpserted: counters.upserted,
      recordsSkipped: counters.skipped + counters.documentsSkipped,
      recordsFailed: counters.failed + 1,
      errorCode: "zeta_sync_failed",
      errorMessage: error instanceof Error ? error.message : "No se pudo ejecutar la sincronizacion Zeta.",
      warnings: counters.warnings,
      cleanupStatus: "not_required",
    });

    await recordIntegrationAuditEvent(input.supabase, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      entityType: "integration_sync_run",
      entityId: runId,
      action: "zeta_sync_failed",
      metadata: {
        stream: input.stream,
        period: period?.period ?? null,
        error_message: error instanceof Error ? error.message : null,
      },
    });

    throw error;
  }
}

export async function runZetaMonthlyDocumentSync(input: Omit<ZetaSyncInput, "stream">) {
  const sales = await runZetaSync({
    ...input,
    stream: "sales_documents",
  });
  const purchases = await runZetaSync({
    ...input,
    stream: "received_cfes",
  });

  return {
    sales,
    purchases,
  };
}

export async function resolveZetaSalesInvoicePdfUrl(input: {
  client: ZetaRestClient;
  facturaId: number;
}) {
  const output = await callZetaEndpoint(input.client, "salesInvoicePdfUrl", {
    Data: {
      FacturaId: input.facturaId,
    },
  });
  const response = asRecord(output.Response);

  return firstString(response.URLComprobante);
}
