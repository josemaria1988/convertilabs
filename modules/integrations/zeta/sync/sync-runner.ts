import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getInngestConfigStatus } from "@/lib/env";
import { inngest } from "@/lib/inngest/client";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  createIntegrationSyncRun,
  findActiveIntegrationSyncRun,
  finishIntegrationSyncRun,
  integrationTables,
  loadIntegrationSyncRun,
  recordIntegrationAuditEvent,
} from "@/modules/integrations/repository";
import { buildIntegrationTestRunKey } from "@/modules/integrations/test-run-key";
import {
  runZetaSync,
  type ZetaSyncStream,
  type ZetaSyncSummary,
} from "@/modules/integrations/zeta/services/sync-service";
import type { ZetaFetch } from "@/modules/integrations/zeta/client/rest-client";

type JsonRecord = Record<string, unknown>;

export type { ZetaSyncStream };

export type ZetaSyncRunMode = "manual" | "backfill" | "test" | "scheduled";

export type ZetaSyncEnqueueResult = {
  runId: string;
  stream: ZetaSyncStream;
  status: string;
  enqueued: boolean;
  testMode: boolean;
  testRunKey: string | null;
};

export type ZetaQueuedSyncResult =
  | ZetaSyncSummary
  | {
    runId: string;
    stream: ZetaSyncStream;
    status: string;
    skipped: true;
    reason: string;
  };

type ZetaConnectionForSync = {
  id: string;
  status: string;
  test_mode: boolean;
};

const zetaSyncStreams: ZetaSyncStream[] = [
  "contacts",
  "masters",
  "accounting_masters",
  "sales_documents",
  "received_cfes",
];

function isZetaSyncStream(value: string): value is ZetaSyncStream {
  return zetaSyncStreams.includes(value as ZetaSyncStream);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampMaxPages(value: number | null | undefined, fallback: number) {
  if (!Number.isFinite(value ?? NaN)) {
    return fallback;
  }

  return Math.max(1, Math.min(Math.trunc(value as number), 200));
}

function isMasterStream(stream: ZetaSyncStream) {
  return stream === "contacts" || stream === "masters" || stream === "accounting_masters";
}

function normalizePeriod(stream: ZetaSyncStream, value: string | null | undefined) {
  if (isMasterStream(stream)) {
    return null;
  }

  const period = value?.trim() ?? "";

  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error("Indica el periodo en formato YYYY-MM para sincronizar documentos Zeta.");
  }

  const month = Number(period.slice(5, 7));

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("El periodo Zeta debe tener un mes valido.");
  }

  return period;
}

async function loadConnectionForSync(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from(integrationTables.connections)
    .select("id, status, test_mode")
    .eq("organization_id", organizationId)
    .eq("provider", "zetasoftware")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = (data as ZetaConnectionForSync | null) ?? null;

  if (!row) {
    throw new Error("Guarda la conexion Zetasoftware antes de ejecutar sincronizaciones.");
  }

  if (row.status === "paused") {
    throw new Error("La conexion Zetasoftware esta pausada.");
  }

  return row;
}

function resultFromActiveRun(activeRun: JsonRecord, stream: ZetaSyncStream): ZetaSyncEnqueueResult {
  return {
    runId: String(activeRun.id),
    stream,
    status: String(activeRun.status ?? "queued"),
    enqueued: false,
    testMode: activeRun.test_mode === true,
    testRunKey: stringOrNull(activeRun.test_run_key),
  };
}

export async function enqueueZetaSyncRun(input: {
  supabase: SupabaseClient;
  organizationId: string;
  actorUserId?: string | null;
  stream: ZetaSyncStream;
  period?: string | null;
  maxPages?: number | null;
  mode?: ZetaSyncRunMode;
  testMode?: boolean;
  testRunKey?: string | null;
  testRunKeySuffix?: string | null;
  requestSource?: string;
}): Promise<ZetaSyncEnqueueResult> {
  const period = normalizePeriod(input.stream, input.period);
  const maxPages = clampMaxPages(
    input.maxPages,
    input.stream === "contacts" ? 200 : isMasterStream(input.stream) ? 5 : 25,
  );
  const activeRun = await findActiveIntegrationSyncRun(input.supabase, {
    organizationId: input.organizationId,
    provider: "zetasoftware",
    stream: input.stream,
  });

  if (activeRun) {
    return resultFromActiveRun(activeRun, input.stream);
  }

  const inngestStatus = getInngestConfigStatus();

  if (!inngestStatus.configured) {
    throw new Error("Inngest no esta configurado en este entorno.");
  }

  const connection = await loadConnectionForSync(input.supabase, input.organizationId);
  const runKind = input.mode ?? "manual";
  const testMode = input.testMode ?? (runKind === "test" ? true : connection.test_mode);
  const testRunKey = testMode
    ? input.testRunKey ?? buildIntegrationTestRunKey({
      provider: "zetasoftware",
      suffix: input.testRunKeySuffix,
    })
    : null;

  let runId: string | null = null;

  try {
    const run = await createIntegrationSyncRun(input.supabase, {
      organizationId: input.organizationId,
      connectionId: connection.id,
      provider: "zetasoftware",
      stream: input.stream,
      runKind,
      status: "queued",
      testMode,
      testRunKey,
      initiatedByUserId: input.actorUserId ?? null,
      input: {
        period,
        max_pages: maxPages,
        execution: testMode ? "mock_or_test" : "real_read_only",
        requested_via: "inngest",
      },
      metadata: {
        provider: "zetasoftware",
        runner: "zeta_sync_runner",
        queued_from: input.requestSource ?? "settings_integrations",
      },
    });

    runId = String(run.id);

    await recordIntegrationAuditEvent(input.supabase, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      entityType: "integration_sync_run",
      entityId: runId,
      action: "zeta_sync_queued",
      metadata: {
        stream: input.stream,
        period,
        test_run_key: testRunKey,
      },
    });

    await inngest.send({
      name: "integrations/zeta.sync.requested",
      data: {
        runId,
        organizationId: input.organizationId,
        stream: input.stream,
        requestedBy: input.actorUserId ?? null,
      },
    });

    return {
      runId,
      stream: input.stream,
      status: "queued",
      enqueued: true,
      testMode,
      testRunKey,
    };
  } catch (error) {
    const activeAfterError = await findActiveIntegrationSyncRun(input.supabase, {
      organizationId: input.organizationId,
      provider: "zetasoftware",
      stream: input.stream,
    });

    if (activeAfterError && String(activeAfterError.id) !== runId) {
      return resultFromActiveRun(activeAfterError, input.stream);
    }

    if (runId) {
      await finishIntegrationSyncRun(input.supabase, {
        organizationId: input.organizationId,
        runId,
        status: "failed",
        recordsFailed: 1,
        errorCode: "zeta_sync_enqueue_failed",
        errorMessage: error instanceof Error
          ? error.message
          : "No se pudo encolar la sincronizacion Zetasoftware.",
        cleanupStatus: "not_required",
      });

      await recordIntegrationAuditEvent(input.supabase, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId ?? null,
        entityType: "integration_sync_run",
        entityId: runId,
        action: "zeta_sync_enqueue_failed",
        metadata: {
          stream: input.stream,
          period,
          test_run_key: testRunKey,
          error_message: error instanceof Error ? error.message : null,
        },
      });
    }

    throw error;
  }
}

export async function enqueueZetaMonthlyDocumentSyncRun(
  input: Omit<Parameters<typeof enqueueZetaSyncRun>[0], "stream">,
) {
  const sales = await enqueueZetaSyncRun({
    ...input,
    stream: "sales_documents",
  });
  const purchases = await enqueueZetaSyncRun({
    ...input,
    stream: "received_cfes",
  });

  return {
    sales,
    purchases,
  };
}

export async function runQueuedZetaSyncRun(input: {
  runId: string;
  organizationId: string;
  actorUserId?: string | null;
  supabase?: SupabaseClient;
  fetchImpl?: ZetaFetch;
}): Promise<ZetaQueuedSyncResult> {
  const supabase = input.supabase ?? getSupabaseServiceRoleClient();
  const run = await loadIntegrationSyncRun(supabase, {
    organizationId: input.organizationId,
    runId: input.runId,
  });
  const stream = String(run.stream ?? "");
  const status = String(run.status ?? "");

  if (!isZetaSyncStream(stream)) {
    throw new Error("Stream Zetasoftware no soportado.");
  }

  if (String(run.provider ?? "") !== "zetasoftware") {
    throw new Error("El sync run solicitado no pertenece a Zetasoftware.");
  }

  if (status !== "queued" && status !== "running") {
    return {
      runId: input.runId,
      stream,
      status,
      skipped: true,
      reason: "run_not_active",
    };
  }

  const runInput = asRecord(run.input_json);
  const maxPages = clampMaxPages(
    numberOrNull(runInput.max_pages),
    stream === "contacts" ? 200 : isMasterStream(stream) ? 5 : 25,
  );

  return runZetaSync({
    supabase,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? stringOrNull(run.initiated_by_user_id),
    stream,
    period: stringOrNull(runInput.period),
    maxPages,
    runId: input.runId,
    runKind: String(run.run_kind ?? "manual"),
    testMode: run.test_mode === true,
    testRunKey: stringOrNull(run.test_run_key),
    fetchImpl: input.fetchImpl,
  });
}
