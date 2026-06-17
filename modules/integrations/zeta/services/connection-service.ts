import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import {
  integrationTables,
  recordIntegrationAuditEvent,
  upsertOrganizationIntegrationConnection,
} from "@/modules/integrations/repository";
import {
  buildZetaConnection,
  hasZetaRuntimeEnvCredentials,
  type ZetaCredentialSource,
  ZetaConfigurationError,
} from "@/modules/integrations/zeta/client/auth";
import {
  encryptCredentials,
  fingerprintCredentials,
  type ZetaOrgCredentials,
} from "@/modules/integrations/zeta/services/credentials-service";
import { runZetaHealthCheck, type ZetaHealthCheckResult } from "./zeta-health-service";

export const zetaProviderCode = "zetasoftware";

type ZetaConnectionRow = {
  id: string;
  organization_id: string;
  provider: string;
  mode: string;
  status: string;
  test_mode: boolean;
  config_json: Record<string, unknown> | null;
  encrypted_credentials: string | null;
  credentials_fingerprint: string | null;
  credentials_last_rotated_at: string | null;
  last_connection_test_at: string | null;
  last_connection_test_ok: boolean | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ZetaSyncRunListItem = {
  id: string;
  stream: string;
  status: string;
  runKind: string;
  testMode: boolean;
  testRunKey: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  recordsSeen: number;
  recordsUpserted: number;
  recordsSkipped: number;
  recordsFailed: number;
  cleanupStatus: string;
  errorMessage: string | null;
  summary: Record<string, unknown>;
  warnings: unknown[];
  createdAt: string;
};

export type ZetaConnectionStatus = "disconnected" | "connected" | "paused" | "error";

export type ZetaConnectionSettings = {
  id: string | null;
  isConfigured: boolean;
  status: ZetaConnectionStatus;
  statusLabel: string;
  mode: string;
  mockEnabled: boolean;
  credentialSource: ZetaCredentialSource;
  envProfile: string | null;
  companyCode: string | null;
  usuarioCodigo: string | null;
  rolCodigo: string | null;
  baseUrl: string | null;
  credentialsFingerprint: string | null;
  credentialsLastRotatedAt: string | null;
  hasStoredSecret: boolean;
  maskedSecretLabel: string;
  lastConnectionTestAt: string | null;
  lastConnectionTestOk: boolean | null;
  lastError: string | null;
  updatedAt: string | null;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeZetaStatus(value: unknown): ZetaConnectionStatus {
  switch (value) {
    case "connected":
    case "paused":
    case "error":
      return value;
    default:
      return "disconnected";
  }
}

function normalizeCredentialSource(
  value: unknown,
  hasStoredSecret = false,
): ZetaCredentialSource {
  if (value === "server_env") {
    return "server_env";
  }

  if (value === "db_encrypted" || value === "stored" || hasStoredSecret) {
    return "db_encrypted";
  }

  return "db_encrypted";
}

function normalizeEnvProfileValue(value: unknown) {
  const raw = asString(value);

  if (!raw) {
    return null;
  }

  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = asString(value);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function formatZetaConnectionStatusLabel(value: ZetaConnectionStatus) {
  switch (value) {
    case "connected":
      return "Conectada";
    case "paused":
      return "Pausada";
    case "error":
      return "Con error";
    default:
      return "Sin conexion";
  }
}

function formatZetaConfigurationError(error: ZetaConfigurationError) {
  if (error.code === "zeta_integrator_credentials_missing") {
    return "Faltan ZETASOFTWARE_DESARROLLADOR_CODIGO o ZETASOFTWARE_DESARROLLADOR_CLAVE en las variables de entorno del servidor.";
  }

  if (error.code === "zeta_base_url_missing") {
    return "Falta la base URL de Zetasoftware. Usa https://api.zetasoftware.com/rest o define ZETASOFTWARE_BASE_URL.";
  }

  if (error.code === "zeta_credentials_invalid") {
    return "UsuarioCodigo y RolCodigo deben ser numericos segun el contrato REST de Zetasoftware.";
  }

  return "Faltan credenciales o configuracion Zetasoftware del lado servidor.";
}

function mapZetaConnectionRow(row: ZetaConnectionRow | null): ZetaConnectionSettings {
  if (!row) {
    const hasEnvCredentials = hasZetaRuntimeEnvCredentials();

    return {
      id: null,
      isConfigured: false,
      status: "disconnected",
      statusLabel: formatZetaConnectionStatusLabel("disconnected"),
      mode: "read_only",
      mockEnabled: !hasEnvCredentials,
      credentialSource: "server_env",
      envProfile: null,
      companyCode: null,
      usuarioCodigo: null,
      rolCodigo: null,
      baseUrl: null,
      credentialsFingerprint: null,
      credentialsLastRotatedAt: null,
      hasStoredSecret: false,
      maskedSecretLabel: hasEnvCredentials ? "Variables de entorno" : "Sin secreto guardado",
      lastConnectionTestAt: null,
      lastConnectionTestOk: null,
      lastError: null,
      updatedAt: null,
    };
  }

  const config = asRecord(row.config_json);
  const status = normalizeZetaStatus(row.status);
  const hasStoredSecret = Boolean(row.encrypted_credentials || row.credentials_fingerprint);
  const credentialSource = normalizeCredentialSource(config.credential_source, hasStoredSecret);

  return {
    id: row.id,
    isConfigured: true,
    status,
    statusLabel: formatZetaConnectionStatusLabel(status),
    mode: row.mode || "read_only",
    mockEnabled: Boolean(config.mock_enabled ?? row.test_mode),
    credentialSource,
    envProfile: normalizeEnvProfileValue(config.env_profile),
    companyCode: asString(config.company_code),
    usuarioCodigo: firstString(config.usuario_codigo, config.username),
    rolCodigo: asString(config.rol_codigo),
    baseUrl: asString(config.base_url),
    credentialsFingerprint: row.credentials_fingerprint,
    credentialsLastRotatedAt: row.credentials_last_rotated_at,
    hasStoredSecret,
    maskedSecretLabel: credentialSource === "server_env"
      ? "Variables de entorno"
      : hasStoredSecret
        ? `Credenciales configuradas (${row.credentials_fingerprint?.slice(0, 8) ?? "sin hash"})`
        : "Sin secreto guardado",
    lastConnectionTestAt: row.last_connection_test_at,
    lastConnectionTestOk: row.last_connection_test_ok,
    lastError: row.last_error,
    updatedAt: row.updated_at,
  };
}

async function fetchZetaConnectionRow(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from(integrationTables.connections)
    .select(
      "id, organization_id, provider, mode, status, test_mode, config_json, encrypted_credentials, credentials_fingerprint, credentials_last_rotated_at, last_connection_test_at, last_connection_test_ok, last_error, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("provider", zetaProviderCode)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseRelationError(error, integrationTables.connections)) {
      return null;
    }

    throw new Error(error.message);
  }

  return (data as ZetaConnectionRow | null) ?? null;
}

export async function loadZetaConnectionSettings(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const row = await fetchZetaConnectionRow(supabase, organizationId);

  return mapZetaConnectionRow(row);
}

export async function loadZetaSyncRunHistory(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 8,
) {
  const { data, error } = await supabase
    .from(integrationTables.syncRuns)
    .select(
      "id, stream, status, run_kind, test_mode, test_run_key, started_at, finished_at, records_seen, records_upserted, records_skipped, records_failed, cleanup_status, error_message, summary_json, warnings_json, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("provider", zetaProviderCode)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 30)));

  if (error) {
    if (isMissingSupabaseRelationError(error, integrationTables.syncRuns)) {
      return [];
    }

    throw new Error(error.message);
  }

  return (((data as Array<Record<string, unknown>> | null) ?? [])).map((row) => ({
    id: String(row.id),
    stream: String(row.stream ?? ""),
    status: String(row.status ?? ""),
    runKind: String(row.run_kind ?? ""),
    testMode: row.test_mode === true,
    testRunKey: typeof row.test_run_key === "string" ? row.test_run_key : null,
    startedAt: typeof row.started_at === "string" ? row.started_at : null,
    finishedAt: typeof row.finished_at === "string" ? row.finished_at : null,
    recordsSeen: typeof row.records_seen === "number" ? row.records_seen : 0,
    recordsUpserted: typeof row.records_upserted === "number" ? row.records_upserted : 0,
    recordsSkipped: typeof row.records_skipped === "number" ? row.records_skipped : 0,
    recordsFailed: typeof row.records_failed === "number" ? row.records_failed : 0,
    cleanupStatus: String(row.cleanup_status ?? "not_required"),
    errorMessage: typeof row.error_message === "string" ? row.error_message : null,
    summary: asRecord(row.summary_json),
    warnings: Array.isArray(row.warnings_json) ? row.warnings_json : [],
    createdAt: String(row.created_at ?? ""),
  })) satisfies ZetaSyncRunListItem[];
}

export function normalizeZetaConnectionInput(input: {
  envProfile?: string | null;
  companyCode: string;
  companySecret?: string | null;
  usuarioCodigo?: string | null;
  rolCodigo?: string | null;
  baseUrl?: string | null;
  mockEnabled: boolean;
  isActive: boolean;
  allowExistingStoredCredentials?: boolean;
}) {
  const envProfile = normalizeEnvProfileValue(input.envProfile);
  const companyCode = input.companyCode.trim();
  const companySecret = input.companySecret?.trim() || null;
  const usuarioCodigo = input.usuarioCodigo?.trim() || null;
  const rolCodigo = input.rolCodigo?.trim() || null;
  const baseUrl = input.baseUrl?.trim() || null;
  const hasPublicCredentialInput = Boolean(companyCode || usuarioCodigo || rolCodigo);
  const hasSecretCredentialInput = Boolean(companySecret);
  const hasNewCredentials = Boolean(hasPublicCredentialInput || hasSecretCredentialInput);
  const canReuseCredentials = Boolean(input.allowExistingStoredCredentials)
    && !hasNewCredentials;

  if (!input.mockEnabled && !canReuseCredentials && (!companyCode || !companySecret || !usuarioCodigo || !rolCodigo)) {
    throw new Error(
      "Ingresa EmpresaCodigo, EmpresaClave, UsuarioCodigo y RolCodigo para guardar la conexion Zetasoftware.",
    );
  }

  if (companySecret && (!companyCode || !usuarioCodigo || !rolCodigo)) {
    throw new Error(
      "Para actualizar credenciales Zetasoftware completa EmpresaCodigo, EmpresaClave, UsuarioCodigo y RolCodigo.",
    );
  }

  return {
    credentialSource: "db_encrypted" as const,
    envProfile,
    companyCode,
    companySecret,
    usuarioCodigo,
    rolCodigo,
    baseUrl,
    mockEnabled: input.mockEnabled,
    isActive: input.isActive,
    hasNewCredentials,
    canReuseCredentials,
  };
}

export async function saveZetaConnection(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorUserId: string | null;
    envProfile?: string | null;
    companyCode: string;
    companySecret?: string | null;
    usuarioCodigo?: string | null;
    rolCodigo?: string | null;
    baseUrl?: string | null;
    mockEnabled: boolean;
    isActive: boolean;
    encryptionKey?: string | null;
  },
) {
  const current = await loadZetaConnectionSettings(supabase, input.organizationId);
  const normalized = normalizeZetaConnectionInput({
    ...input,
    allowExistingStoredCredentials: current.credentialSource === "db_encrypted" && current.hasStoredSecret,
  });
  const orgCredentials: ZetaOrgCredentials | null = normalized.companySecret
    ? {
      EmpresaCodigo: normalized.companyCode,
      EmpresaClave: normalized.companySecret,
      UsuarioCodigo: normalized.usuarioCodigo ?? "",
      RolCodigo: normalized.rolCodigo ?? "",
    }
    : null;
  const status = normalized.isActive ? "connected" : "paused";
  const beforeJson = current.isConfigured
    ? {
      status: current.status,
      mock_enabled: current.mockEnabled,
      credential_source: current.credentialSource,
      env_profile: current.envProfile,
      base_url: current.baseUrl,
      credentials_fingerprint: current.credentialsFingerprint,
    }
    : null;
  const saved = await upsertOrganizationIntegrationConnection(supabase, {
    organizationId: input.organizationId,
    provider: zetaProviderCode,
    mode: "read_only",
    status,
    testMode: normalized.mockEnabled,
    config: {
      provider_label: "Zetasoftware",
      credential_source: normalized.credentialSource,
      env_profile: normalized.envProfile,
      base_url: normalized.baseUrl,
      mock_enabled: normalized.mockEnabled,
      contract_status: "confirmed_pr_01",
      health_mode: normalized.mockEnabled ? "mock" : "real",
      saved_from: "settings_integrations",
    },
    encryptedCredentials: orgCredentials ? encryptCredentials(orgCredentials) : undefined,
    credentialsFingerprint: orgCredentials ? fingerprintCredentials(orgCredentials) : undefined,
    lastError: null,
    actorUserId: input.actorUserId,
  });

  await recordIntegrationAuditEvent(supabase, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "organization_integration_connection",
    entityId: String(saved.id ?? ""),
    action: "zeta_connection_saved",
    beforeJson,
    afterJson: {
      status,
      mock_enabled: normalized.mockEnabled,
      credential_source: normalized.credentialSource,
      env_profile: normalized.envProfile,
      base_url: normalized.baseUrl,
      credentials_saved: Boolean(orgCredentials),
      credentials_preview: orgCredentials
        ? `Credenciales configuradas (${fingerprintCredentials(orgCredentials).slice(0, 8)})`
        : current.maskedSecretLabel,
    },
    metadata: {
      provider: zetaProviderCode,
      contract_status: "confirmed_pr_01",
    },
  });

  return loadZetaConnectionSettings(supabase, input.organizationId);
}

export async function testZetaConnection(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorUserId: string | null;
  },
  options: {
    healthCheck?: typeof runZetaHealthCheck;
  } = {},
) {
  const current = await loadZetaConnectionSettings(supabase, input.organizationId);
  const healthCheck = options.healthCheck ?? runZetaHealthCheck;
  let result: ZetaHealthCheckResult;

  try {
    const runtime = current.isConfigured && current.status !== "paused" && !current.mockEnabled
      ? await buildZetaConnection({
        supabase,
        organizationId: input.organizationId,
      })
      : undefined;

    result = await healthCheck({
      isConfigured: current.isConfigured,
      isPaused: current.status === "paused",
      mockEnabled: current.mockEnabled,
      requestedMode: current.mockEnabled ? "mock" : "real",
      baseUrl: current.baseUrl,
      envProfile: current.envProfile,
      runtime,
    });
  } catch (error) {
    result = {
      ok: false,
      status: "error",
      code: error instanceof ZetaConfigurationError
        ? error.code
        : "zeta_credentials_unavailable",
      message: error instanceof ZetaConfigurationError
        ? formatZetaConfigurationError(error)
        : error instanceof Error
          ? error.message
          : "No se pudieron preparar las credenciales Zetasoftware.",
      checkedAt: new Date().toISOString(),
      metadata: {
        health_mode: "real",
        contract_status: "confirmed_pr_01",
        credential_source: current.credentialSource,
      },
    };
  }

  if (current.id) {
    const { error } = await supabase
      .from(integrationTables.connections)
      .update({
        status: result.status,
        last_connection_test_at: result.checkedAt,
        last_connection_test_ok: result.ok,
        last_error: result.ok ? null : result.message,
        updated_at: result.checkedAt,
      })
      .eq("id", current.id)
      .eq("organization_id", input.organizationId);

    if (error) {
      throw new Error(error.message);
    }
  }

  await recordIntegrationAuditEvent(supabase, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "organization_integration_connection",
    entityId: current.id,
    action: "zeta_connection_tested",
    afterJson: {
      ok: result.ok,
      status: result.status,
      code: result.code,
      message: result.message,
      checked_at: result.checkedAt,
    },
    metadata: {
      provider: zetaProviderCode,
      credential_source: current.credentialSource,
      env_profile: current.envProfile,
      ...result.metadata,
    },
  });

  return result satisfies ZetaHealthCheckResult;
}
