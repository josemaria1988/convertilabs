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
  fingerprintIntegrationPayload,
  integrationTables,
  markIntegrationSyncRunRunning,
  recordIntegrationAuditEvent,
  upsertIntegrationRawRecord,
} from "@/modules/integrations/repository";
import {
  readZetaSyncCursor,
  writeZetaSyncCursor,
} from "@/modules/integrations/zeta/sync/cursors";
import {
  normalizeZetaReceivedCfe,
} from "@/modules/integrations/zeta/normalizers/received-cfe";
import {
  normalizeZetaSalesInvoice,
} from "@/modules/integrations/zeta/normalizers/sales";
import { normalizeZetaChartAccount } from "@/modules/integrations/zeta/normalizers/chart-account-normalizer";
import type {
  ZetaChartAccountRaw,
  ZetaConceptoRaw,
  ZetaJournalTypeRaw,
} from "@/modules/integrations/zeta/contracts/plan-de-cuentas";
import { materializeZetaChartAccounts } from "@/modules/integrations/zeta/services/materialize-chart-accounts";
import {
  materializeZetaContacts,
  type ZetaContactMaterializationProgress,
} from "@/modules/integrations/zeta/services/materialize-zeta-contacts";
import { materializeZetaConcepts } from "@/modules/integrations/zeta/services/materialize-zeta-concepts";
import { materializeZetaJournalTypes } from "@/modules/integrations/zeta/services/materialize-journal-types";
import {
  asArray,
  asRecord,
  firstString,
  type JsonRecord,
  type ZetaCanonicalDocument,
} from "@/modules/integrations/zeta/normalizers/common";
import { materializeZetaDocument } from "@/modules/integrations/zeta/services/materialization-service";

export type ZetaSyncStream =
  | "contacts"
  | "masters"
  | "accounting_masters"
  | "sales_documents"
  | "received_cfes";

export type ZetaSyncInput = {
  supabase: SupabaseClient;
  organizationId: string;
  actorUserId?: string | null;
  stream: ZetaSyncStream;
  period?: string | null;
  maxPages?: number | null;
  runId?: string | null;
  runKind?: string;
  testMode?: boolean;
  testRunKey?: string | null;
  fetchImpl?: ZetaFetch;
  progressEvery?: number | null;
  onProgress?: (progress: ZetaSyncProgress) => void | Promise<void>;
};

export type ZetaSyncProgress =
  | {
    stage: "zeta_master_query_fetched";
    runId: string;
    stream: ZetaSyncStream;
    queryKey: ZetaEndpointKey;
    entityType: string;
    rows: number;
    recordsSeen: number;
    recordsUpserted: number;
  }
  | (ZetaContactMaterializationProgress & {
    runId: string;
    stream: ZetaSyncStream;
  });

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
  testRunKey: string | null;
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
  masterMaterialization: JsonRecord;
  warnings: string[];
};

type MasterQueryDefinition = {
  key: ZetaEndpointKey;
  entityType: string;
  externalKeyFields: string[];
  stream?: string;
};

const masterQueries: MasterQueryDefinition[] = [
  { key: "contactsQuery", entityType: "contact", externalKeyFields: ["Codigo"], stream: "zeta.masters.contacts" },
  { key: "customerCommercialDataQuery", entityType: "customer_commercial_data", externalKeyFields: ["Codigo"] },
  { key: "supplierCommercialDataQuery", entityType: "supplier_commercial_data", externalKeyFields: ["Codigo"] },
  { key: "currenciesQuery", entityType: "currency", externalKeyFields: ["Codigo", "CodigoISO"] },
  { key: "currencyRatesQuery", entityType: "currency_rate", externalKeyFields: ["MonedaCodigo", "Fecha"] },
  { key: "chartAccountsQuery", entityType: "chart_account", externalKeyFields: ["Codigo"] },
  { key: "conceptsQuery", entityType: "concept", externalKeyFields: ["Codigo"] },
  { key: "taxRatesQuery", entityType: "vat_rate", externalKeyFields: ["Codigo"] },
  { key: "paymentTermsQuery", entityType: "payment_term", externalKeyFields: ["Codigo"] },
  { key: "paymentMethodsQuery", entityType: "payment_method", externalKeyFields: ["Codigo"] },
  { key: "cashboxesQuery", entityType: "cashbox", externalKeyFields: ["Codigo"] },
  { key: "businessLocationsQuery", entityType: "business_location", externalKeyFields: ["Codigo"] },
  { key: "salesDocumentTypesQuery", entityType: "document_type", externalKeyFields: ["Codigo", "LocalCodigo"] },
  { key: "documentTypesQuery", entityType: "cfe_type", externalKeyFields: ["Codigo", "Etapa"] },
  { key: "costCentersQuery", entityType: "cost_center", externalKeyFields: ["Codigo"] },
  { key: "referencesQuery", entityType: "reference", externalKeyFields: ["Codigo"] },
  { key: "rutNumbersQuery", entityType: "rut_number", externalKeyFields: ["RUT"] },
  { key: "journalTypesQuery", entityType: "journal_type", externalKeyFields: ["Codigo"] },
];

const accountingMasterQueries: MasterQueryDefinition[] = [
  { key: "chartAccountsQuery", entityType: "chart_account", externalKeyFields: ["Codigo"] },
  { key: "conceptsQuery", entityType: "concept", externalKeyFields: ["Codigo"] },
  { key: "journalTypesQuery", entityType: "journal_type", externalKeyFields: ["Codigo"] },
];

const contactMasterQueries: MasterQueryDefinition[] = [
  { key: "contactsQuery", entityType: "contact", externalKeyFields: ["Codigo"], stream: "zeta.masters.contacts" },
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

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

async function upsertMasterRawRecords(input: {
  supabase: SupabaseClient;
  organizationId: string;
  connectionId: string;
  runId: string;
  testMode: boolean;
  query: MasterQueryDefinition;
  rows: JsonRecord[];
  testRunKey?: string | null;
}) {
  if (input.rows.length === 0) {
    return;
  }

  const timestamp = nowIso();
  const payloads = input.rows.map((row) => {
    const payload = {
      endpoint_key: input.query.key,
      row,
    };

    return {
      organization_id: input.organizationId,
      connection_id: input.connectionId,
      provider: "zetasoftware",
      stream: input.query.stream ?? `zeta.masters.${input.query.entityType}`,
      entity_type: input.query.entityType,
      external_key: buildMasterExternalKey(
        row,
        input.query.externalKeyFields,
        input.query.entityType,
      ),
      external_version_key: null,
      payload_json: payload,
      payload_hash: fingerprintIntegrationPayload(payload),
      last_seen_at: timestamp,
      last_sync_run_id: input.runId,
      test_mode: input.testMode,
      test_run_key: input.testRunKey ?? null,
      source_monetary_json: {},
      metadata_json: {
        endpoint_key: input.query.key,
      },
      updated_at: timestamp,
    };
  });

  for (const chunk of chunkRows(payloads, 500)) {
    const { error } = await input.supabase
      .from(integrationTables.rawRecords)
      .upsert(chunk, {
        onConflict: "organization_id,provider,entity_type,external_key",
      });

    if (error) {
      throw new Error(error.message);
    }
  }
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
  actorUserId?: string | null;
  runId: string;
  maxPages: number;
  counters: SyncCounters;
  testMode: boolean;
  testRunKey?: string | null;
  queries: MasterQueryDefinition[];
  stream: ZetaSyncStream;
  progressEvery?: number | null;
  onProgress?: (progress: ZetaSyncProgress) => void | Promise<void>;
}) {
  const contactRows: JsonRecord[] = [];
  const chartAccountRows: JsonRecord[] = [];
  const conceptRows: JsonRecord[] = [];
  const journalTypeRows: JsonRecord[] = [];

  for (const query of input.queries) {
    const rows = await fetchAllQueryRows(input.client, {
      key: query.key,
      maxPages: input.maxPages,
    });

    input.counters.seen += rows.length;
    await upsertMasterRawRecords({
      supabase: input.supabase,
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      runId: input.runId,
      testMode: input.testMode,
      testRunKey: input.testRunKey,
      query,
      rows,
    });
    input.counters.upserted += rows.length;
    await input.onProgress?.({
      stage: "zeta_master_query_fetched",
      runId: input.runId,
      stream: input.stream,
      queryKey: query.key,
      entityType: query.entityType,
      rows: rows.length,
      recordsSeen: input.counters.seen,
      recordsUpserted: input.counters.upserted,
    });

    if (query.entityType === "contact") {
      contactRows.push(...rows);
    } else if (query.entityType === "chart_account") {
      chartAccountRows.push(...rows);
    } else if (query.entityType === "concept") {
      conceptRows.push(...rows);
    } else if (query.entityType === "journal_type") {
      journalTypeRows.push(...rows);
    }
  }

  if (contactRows.length > 0) {
    const contactSummary = await materializeZetaContacts(input.supabase, {
      organizationId: input.organizationId,
      contacts: contactRows,
      runId: input.runId,
      actorUserId: input.actorUserId ?? null,
      progressEvery: input.progressEvery,
      onProgress: (progress) =>
        input.onProgress?.({
          ...progress,
          runId: input.runId,
          stream: input.stream,
        }),
    });

    input.counters.masterMaterialization.contacts = contactSummary;
    input.counters.failed += contactSummary.failed;
    input.counters.warnings.push(...contactSummary.warnings);
  }

  if (chartAccountRows.length > 0) {
    const chartSummary = await materializeZetaChartAccounts(input.supabase, {
      organizationId: input.organizationId,
      candidates: chartAccountRows.map((row) =>
        normalizeZetaChartAccount(row as unknown as ZetaChartAccountRaw)),
      runId: input.runId,
    });

    input.counters.masterMaterialization.chart_accounts = chartSummary;
    input.counters.failed += chartSummary.failed;
    input.counters.warnings.push(...chartSummary.warnings);
  }

  if (conceptRows.length > 0) {
    const conceptSummary = await materializeZetaConcepts(input.supabase, {
      organizationId: input.organizationId,
      concepts: conceptRows as unknown as ZetaConceptoRaw[],
      runId: input.runId,
    });

    input.counters.masterMaterialization.concepts = conceptSummary;
    input.counters.failed += conceptSummary.failed;
    input.counters.warnings.push(...conceptSummary.warnings);
  }

  if (journalTypeRows.length > 0) {
    try {
      input.counters.masterMaterialization.journal_types =
        await materializeZetaJournalTypes(input.supabase, {
          organizationId: input.organizationId,
          connectionId: input.connectionId,
          journalTypes: journalTypeRows as unknown as ZetaJournalTypeRaw[],
        });
    } catch (error) {
      input.counters.failed += 1;
      input.counters.warnings.push(
        error instanceof Error
          ? `Tipos de asiento Zeta: ${error.message}`
          : "No se pudieron materializar los tipos de asiento Zeta.",
      );
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
    testRunKey?: string | null;
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
    testRunKey: input.testRunKey ?? null,
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
  testRunKey?: string | null;
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
          testRunKey: input.testRunKey,
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
  testRunKey?: string | null;
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
          testRunKey: input.testRunKey,
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

async function markInterruptedRunningSyncs(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from(integrationTables.syncRuns)
    .update({
      status: "failed",
      finished_at: nowIso(),
      records_failed: 1,
      error_code: "zeta_sync_interrupted",
      error_message: "La corrida quedo interrumpida antes de completar. Reintenta la sincronizacion.",
      updated_at: nowIso(),
    })
    .eq("organization_id", organizationId)
    .eq("provider", "zetasoftware")
    .eq("status", "running")
    .lt("started_at", cutoff);

  if (error) {
    throw new Error(error.message);
  }
}

export async function runZetaSync(input: ZetaSyncInput): Promise<ZetaSyncSummary> {
  const isMasterStream = input.stream === "masters"
    || input.stream === "accounting_masters"
    || input.stream === "contacts";
  const period = isMasterStream ? null : parsePeriod(input.period);
  const maxPages = clampMaxPages(
    input.maxPages,
    input.stream === "contacts" ? 200 : isMasterStream ? 5 : 25,
  );
  let runId = input.runId ?? null;
  let testMode = input.testMode ?? true;
  let testRunKey = input.testRunKey ?? null;
  const counters: SyncCounters = {
    seen: 0,
    upserted: 0,
    skipped: 0,
    failed: 0,
    documentsMaterialized: 0,
    documentsSkipped: 0,
    masterMaterialization: {},
    warnings: [],
  };

  try {
    await markInterruptedRunningSyncs(input.supabase, input.organizationId);

    const cursor = await readZetaSyncCursor(input.supabase, {
      organizationId: input.organizationId,
      stream: input.stream,
      period: period?.period ?? null,
    });
    const cursorFrom = typeof cursor?.cursor_value === "string"
      ? cursor.cursor_value
      : null;
    const connection = await loadConnection(input.supabase, input.organizationId);

    testMode = input.testMode ?? connection.test_mode;
    testRunKey = input.testRunKey ?? null;

    if (runId) {
      await markIntegrationSyncRunRunning(input.supabase, {
        organizationId: input.organizationId,
        runId,
        cursorFrom,
        metadata: {
          provider: "zetasoftware",
          runner: "zeta_sync_runner",
          claimed_from: "inngest",
        },
      });
    } else {
      const run = await createIntegrationSyncRun(input.supabase, {
        organizationId: input.organizationId,
        connectionId: connection.id,
        provider: "zetasoftware",
        stream: input.stream,
        runKind: input.runKind ?? "manual",
        status: "running",
        testMode,
        testRunKey,
        initiatedByUserId: input.actorUserId ?? null,
        cursorFrom,
        input: {
          period: period?.period ?? null,
          max_pages: maxPages,
          execution: testMode ? "mock_or_test" : "real_read_only",
        },
        metadata: {
          provider: "zetasoftware",
          runner: "zeta_sync_runner",
          started_from: "direct_call",
        },
      });

      runId = String(run.id);
    }

    await recordIntegrationAuditEvent(input.supabase, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      entityType: "integration_sync_run",
      entityId: runId,
      action: "zeta_sync_started",
      metadata: {
        stream: input.stream,
        period: period?.period ?? null,
        test_run_key: testRunKey,
      },
    });

    const client = await buildClient({
      supabase: input.supabase,
      organizationId: input.organizationId,
      fetchImpl: input.fetchImpl,
    });

    if (
      input.stream === "masters"
      || input.stream === "accounting_masters"
      || input.stream === "contacts"
    ) {
      await syncMasters({
        supabase: input.supabase,
        client,
        organizationId: input.organizationId,
        connectionId: connection.id,
        actorUserId: input.actorUserId,
        runId,
        maxPages,
        counters,
        testMode,
        testRunKey,
        queries: input.stream === "accounting_masters"
          ? accountingMasterQueries
          : input.stream === "contacts"
            ? contactMasterQueries
            : masterQueries,
        stream: input.stream,
        progressEvery: input.progressEvery,
        onProgress: input.onProgress,
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
        testMode,
        testRunKey,
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
        testMode,
        testRunKey,
      });
    }

    const finishedAt = nowIso();

    await writeZetaSyncCursor(input.supabase, {
      organizationId: input.organizationId,
      connectionId: connection.id,
      stream: input.stream,
      period: period?.period ?? null,
      cursorValue: finishedAt,
      cursor: {
        period: period?.period ?? null,
        records_seen: counters.seen,
        records_upserted: counters.upserted,
        test_run_key: testRunKey,
      },
      lastSuccessRunId: runId,
      lastSyncedAt: finishedAt,
    });

    await finishIntegrationSyncRun(input.supabase, {
      organizationId: input.organizationId,
      runId,
      status: counters.failed > 0 ? "completed_with_warnings" : "completed",
      recordsSeen: counters.seen,
      recordsUpserted: counters.upserted,
      recordsSkipped: counters.skipped + counters.documentsSkipped,
      recordsFailed: counters.failed,
      cursorTo: finishedAt,
      summary: {
        period: period?.period ?? null,
        documents_materialized: counters.documentsMaterialized,
        documents_skipped: counters.documentsSkipped,
        master_materialization: counters.masterMaterialization,
        warnings_count: counters.warnings.length,
        test_run_key: testRunKey,
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
        test_run_key: testRunKey,
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
      testRunKey,
      warnings: Array.from(new Set(counters.warnings)),
    };
  } catch (error) {
    if (runId) {
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
          test_run_key: testRunKey,
          error_message: error instanceof Error ? error.message : null,
        },
      });
    }

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
