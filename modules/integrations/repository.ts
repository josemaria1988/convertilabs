import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  encryptIntegrationCredentials,
  fingerprintIntegrationCredentials,
  stableJsonStringify,
  type IntegrationCredentials,
} from "@/modules/integrations/credentials";

type JsonRecord = Record<string, unknown>;

export const integrationTables = {
  connections: "organization_integration_connections",
  syncRuns: "integration_sync_runs",
  syncCursors: "integration_sync_cursors",
  rawRecords: "integration_raw_records",
  documentSourceRefs: "document_source_refs",
  entityLinks: "integration_entity_links",
} as const;

function nowIso() {
  return new Date().toISOString();
}

function compactRecord(input: JsonRecord) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

function payloadHash(value: unknown) {
  return `sha256:${createHash("sha256").update(stableJsonStringify(value), "utf8").digest("hex")}`;
}

function throwSupabaseError(error: { message?: string | null } | null | undefined, fallback: string) {
  if (error) {
    throw new Error(error.message ?? fallback);
  }
}

export function fingerprintIntegrationPayload(payload: unknown) {
  return payloadHash(payload);
}

export async function recordIntegrationAuditEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorUserId?: string | null;
    entityType: string;
    entityId?: string | null;
    action: string;
    beforeJson?: JsonRecord | null;
    afterJson?: JsonRecord | null;
    metadata?: JsonRecord;
  },
) {
  const { error } = await supabase
    .from("audit_log")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
      before_json: input.beforeJson ?? null,
      after_json: input.afterJson ?? null,
      metadata: input.metadata ?? {},
    });

  throwSupabaseError(error, "No se pudo registrar el evento de auditoria de integracion.");
}

export async function upsertOrganizationIntegrationConnection(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    provider: string;
    mode?: string;
    status?: string;
    testMode?: boolean;
    config?: JsonRecord;
    credentials?: IntegrationCredentials;
    encryptedCredentials?: string | null;
    credentialsFingerprint?: string | null;
    encryptionKey?: string | null;
    lastConnectionTestAt?: string | null;
    lastConnectionTestOk?: boolean | null;
    lastError?: string | null;
    actorUserId?: string | null;
  },
) {
  const encryptedCredentials = input.credentials
    ? encryptIntegrationCredentials(input.credentials, input.encryptionKey)
    : input.encryptedCredentials;
  const credentialsFingerprint = input.credentials
    ? fingerprintIntegrationCredentials(input.credentials)
    : input.credentialsFingerprint;
  const payload = compactRecord({
    organization_id: input.organizationId,
    provider: input.provider,
    mode: input.mode ?? "read_only",
    status: input.status ?? "configured",
    test_mode: input.testMode ?? true,
    config_json: input.config ?? {},
    encrypted_credentials: encryptedCredentials,
    credentials_fingerprint: credentialsFingerprint,
    credentials_last_rotated_at: input.credentials ? nowIso() : undefined,
    last_connection_test_at: input.lastConnectionTestAt,
    last_connection_test_ok: input.lastConnectionTestOk,
    last_error: input.lastError,
    created_by: input.actorUserId ?? null,
    updated_by: input.actorUserId ?? null,
    updated_at: nowIso(),
  });

  const { data, error } = await supabase
    .from(integrationTables.connections)
    .upsert(payload, { onConflict: "organization_id,provider" })
    .select("*")
    .limit(1)
    .single();

  throwSupabaseError(error, "No se pudo guardar la conexion de integracion.");

  return data as JsonRecord;
}

export async function createIntegrationSyncRun(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    connectionId?: string | null;
    provider: string;
    stream: string;
    runKind?: string;
    status?: string;
    testMode?: boolean;
    testRunKey?: string | null;
    initiatedByUserId?: string | null;
    cursorFrom?: string | null;
    input?: JsonRecord;
    metadata?: JsonRecord;
  },
) {
  const { data, error } = await supabase
    .from(integrationTables.syncRuns)
    .insert({
      organization_id: input.organizationId,
      connection_id: input.connectionId ?? null,
      provider: input.provider,
      stream: input.stream,
      run_kind: input.runKind ?? "manual",
      status: input.status ?? "queued",
      test_mode: input.testMode ?? true,
      test_run_key: input.testRunKey ?? null,
      initiated_by_user_id: input.initiatedByUserId ?? null,
      started_at: input.status === "running" ? nowIso() : null,
      cursor_from: input.cursorFrom ?? null,
      input_json: input.input ?? {},
      metadata_json: input.metadata ?? {},
    })
    .select("*")
    .limit(1)
    .single();

  throwSupabaseError(error, "No se pudo crear el sync run de integracion.");

  return data as JsonRecord;
}

export async function finishIntegrationSyncRun(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    runId: string;
    status: string;
    recordsSeen?: number;
    recordsUpserted?: number;
    recordsSkipped?: number;
    recordsFailed?: number;
    cursorTo?: string | null;
    summary?: JsonRecord;
    warnings?: unknown[];
    errorCode?: string | null;
    errorMessage?: string | null;
    cleanupStatus?: string;
    cleanupRequiredBy?: string | null;
    cleanupVerifiedAt?: string | null;
    cleanupVerifiedByUserId?: string | null;
    cleanupEvidence?: JsonRecord;
    metadata?: JsonRecord;
  },
) {
  const payload = compactRecord({
    status: input.status,
    finished_at: nowIso(),
    records_seen: input.recordsSeen,
    records_upserted: input.recordsUpserted,
    records_skipped: input.recordsSkipped,
    records_failed: input.recordsFailed,
    cursor_to: input.cursorTo,
    summary_json: input.summary,
    warnings_json: input.warnings,
    error_code: input.errorCode,
    error_message: input.errorMessage,
    cleanup_status: input.cleanupStatus,
    cleanup_required_by: input.cleanupRequiredBy,
    cleanup_verified_at: input.cleanupVerifiedAt,
    cleanup_verified_by_user_id: input.cleanupVerifiedByUserId,
    cleanup_evidence_json: input.cleanupEvidence,
    metadata_json: input.metadata,
    updated_at: nowIso(),
  });

  const { data, error } = await supabase
    .from(integrationTables.syncRuns)
    .update(payload)
    .eq("id", input.runId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .limit(1)
    .single();

  throwSupabaseError(error, "No se pudo cerrar el sync run de integracion.");

  return data as JsonRecord;
}

export async function upsertIntegrationCursor(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    connectionId?: string | null;
    provider: string;
    stream: string;
    cursorKey: string;
    cursorValue?: string | null;
    cursor?: JsonRecord;
    lastSuccessRunId?: string | null;
    lastSyncedAt?: string | null;
  },
) {
  const { data, error } = await supabase
    .from(integrationTables.syncCursors)
    .upsert(
      {
        organization_id: input.organizationId,
        connection_id: input.connectionId ?? null,
        provider: input.provider,
        stream: input.stream,
        cursor_key: input.cursorKey,
        cursor_value: input.cursorValue ?? null,
        cursor_json: input.cursor ?? {},
        last_success_run_id: input.lastSuccessRunId ?? null,
        last_synced_at: input.lastSyncedAt ?? nowIso(),
        updated_at: nowIso(),
      },
      { onConflict: "organization_id,provider,stream,cursor_key" },
    )
    .select("*")
    .limit(1)
    .single();

  throwSupabaseError(error, "No se pudo guardar el cursor de integracion.");

  return data as JsonRecord;
}

export async function upsertIntegrationRawRecord(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    connectionId?: string | null;
    provider: string;
    stream: string;
    entityType: string;
    externalKey: string;
    externalVersionKey?: string | null;
    payload: JsonRecord;
    payloadHash?: string;
    lastSyncRunId?: string | null;
    testMode?: boolean;
    testRunKey?: string | null;
    documentDate?: string | null;
    currencyCode?: string | null;
    sourceExchangeRate?: number | null;
    sourceExchangeRateDate?: string | null;
    sourceExchangeRateKind?: string | null;
    sourceTotalAmount?: number | null;
    sourceNetAmount?: number | null;
    sourceTaxAmount?: number | null;
    sourceMonetary?: JsonRecord;
    metadata?: JsonRecord;
  },
) {
  const { data, error } = await supabase
    .from(integrationTables.rawRecords)
    .upsert(
      {
        organization_id: input.organizationId,
        connection_id: input.connectionId ?? null,
        provider: input.provider,
        stream: input.stream,
        entity_type: input.entityType,
        external_key: input.externalKey,
        external_version_key: input.externalVersionKey ?? null,
        payload_json: input.payload,
        payload_hash: input.payloadHash ?? payloadHash(input.payload),
        last_seen_at: nowIso(),
        last_sync_run_id: input.lastSyncRunId ?? null,
        test_mode: input.testMode ?? false,
        test_run_key: input.testRunKey ?? null,
        document_date: input.documentDate ?? null,
        currency_code: input.currencyCode ?? null,
        source_exchange_rate: input.sourceExchangeRate ?? null,
        source_exchange_rate_date: input.sourceExchangeRateDate ?? null,
        source_exchange_rate_kind: input.sourceExchangeRateKind ?? null,
        source_total_amount: input.sourceTotalAmount ?? null,
        source_net_amount: input.sourceNetAmount ?? null,
        source_tax_amount: input.sourceTaxAmount ?? null,
        source_monetary_json: input.sourceMonetary ?? {},
        metadata_json: input.metadata ?? {},
        updated_at: nowIso(),
      },
      { onConflict: "organization_id,provider,entity_type,external_key" },
    )
    .select("*")
    .limit(1)
    .single();

  throwSupabaseError(error, "No se pudo guardar el raw record de integracion.");

  return data as JsonRecord;
}

export async function linkDocumentSourceRef(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
    provider: string;
    sourceKind: string;
    externalKey: string;
    rawRecordId?: string | null;
    syncRunId?: string | null;
    externalVersionKey?: string | null;
    payloadHashAtMaterialization?: string | null;
    currentPayloadHash?: string | null;
    driftStatus?: string;
    factualTrustMode?: string;
    sourcePdfUrl?: string | null;
    sourcePdfUrlExpiresAt?: string | null;
    bandejaCompatibility?: JsonRecord;
    metadata?: JsonRecord;
  },
) {
  const { data, error } = await supabase
    .from(integrationTables.documentSourceRefs)
    .upsert(
      {
        organization_id: input.organizationId,
        document_id: input.documentId,
        provider: input.provider,
        source_kind: input.sourceKind,
        raw_record_id: input.rawRecordId ?? null,
        sync_run_id: input.syncRunId ?? null,
        external_key: input.externalKey,
        external_version_key: input.externalVersionKey ?? null,
        payload_hash_at_materialization: input.payloadHashAtMaterialization ?? null,
        current_payload_hash: input.currentPayloadHash ?? null,
        drift_status: input.driftStatus ?? "none",
        factual_trust_mode: input.factualTrustMode ?? "external_deterministic",
        source_pdf_url: input.sourcePdfUrl ?? null,
        source_pdf_url_expires_at: input.sourcePdfUrlExpiresAt ?? null,
        bandeja_compatibility_json: input.bandejaCompatibility ?? {},
        metadata_json: input.metadata ?? {},
        updated_at: nowIso(),
      },
      { onConflict: "organization_id,provider,source_kind,external_key" },
    )
    .select("*")
    .limit(1)
    .single();

  throwSupabaseError(error, "No se pudo vincular el documento con su fuente externa.");

  return data as JsonRecord;
}

export async function upsertIntegrationEntityLink(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    provider: string;
    externalEntityType: string;
    externalKey: string;
    localEntityType: string;
    localEntityId: string;
    matchMethod: string;
    confidence?: number | null;
    status?: string;
    createdByRunId?: string | null;
    reviewedByUserId?: string | null;
    reviewedAt?: string | null;
    metadata?: JsonRecord;
  },
) {
  const { data, error } = await supabase
    .from(integrationTables.entityLinks)
    .upsert(
      {
        organization_id: input.organizationId,
        provider: input.provider,
        external_entity_type: input.externalEntityType,
        external_key: input.externalKey,
        local_entity_type: input.localEntityType,
        local_entity_id: input.localEntityId,
        match_method: input.matchMethod,
        confidence: input.confidence ?? null,
        status: input.status ?? "active",
        created_by_run_id: input.createdByRunId ?? null,
        reviewed_by_user_id: input.reviewedByUserId ?? null,
        reviewed_at: input.reviewedAt ?? null,
        metadata_json: input.metadata ?? {},
        updated_at: nowIso(),
      },
      { onConflict: "organization_id,provider,external_entity_type,external_key" },
    )
    .select("*")
    .limit(1)
    .single();

  throwSupabaseError(error, "No se pudo guardar el link de entidad externa.");

  return data as JsonRecord;
}
