import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import {
  integrationTables,
  recordIntegrationAuditEvent,
  upsertOrganizationIntegrationConnection,
} from "@/modules/integrations/repository";
import { maskIntegrationSecret } from "@/modules/integrations/credentials";
import { hasZetaRuntimeEnvCredentials } from "@/modules/integrations/zeta/client/auth";
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

export type ZetaConnectionStatus = "disconnected" | "connected" | "paused" | "error";

export type ZetaConnectionSettings = {
  id: string | null;
  isConfigured: boolean;
  status: ZetaConnectionStatus;
  statusLabel: string;
  mode: string;
  mockEnabled: boolean;
  companyCode: string | null;
  username: string | null;
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

function mapZetaConnectionRow(row: ZetaConnectionRow | null): ZetaConnectionSettings {
  if (!row) {
    return {
      id: null,
      isConfigured: false,
      status: "disconnected",
      statusLabel: formatZetaConnectionStatusLabel("disconnected"),
      mode: "read_only",
      mockEnabled: true,
      companyCode: null,
      username: null,
      baseUrl: null,
      credentialsFingerprint: null,
      credentialsLastRotatedAt: null,
      hasStoredSecret: false,
      maskedSecretLabel: "Sin secreto guardado",
      lastConnectionTestAt: null,
      lastConnectionTestOk: null,
      lastError: null,
      updatedAt: null,
    };
  }

  const config = asRecord(row.config_json);
  const status = normalizeZetaStatus(row.status);
  const hasStoredSecret = Boolean(row.encrypted_credentials || row.credentials_fingerprint);

  return {
    id: row.id,
    isConfigured: true,
    status,
    statusLabel: formatZetaConnectionStatusLabel(status),
    mode: row.mode || "read_only",
    mockEnabled: Boolean(config.mock_enabled ?? row.test_mode),
    companyCode: asString(config.company_code),
    username: asString(config.username),
    baseUrl: asString(config.base_url),
    credentialsFingerprint: row.credentials_fingerprint,
    credentialsLastRotatedAt: row.credentials_last_rotated_at,
    hasStoredSecret,
    maskedSecretLabel: hasStoredSecret ? "********" : "Sin secreto guardado",
    lastConnectionTestAt: row.last_connection_test_at,
    lastConnectionTestOk: row.last_connection_test_ok,
    lastError: row.last_error,
    updatedAt: row.updated_at,
  };
}

export async function loadZetaConnectionSettings(
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
      return mapZetaConnectionRow(null);
    }

    throw new Error(error.message);
  }

  return mapZetaConnectionRow((data as ZetaConnectionRow | null) ?? null);
}

export function normalizeZetaConnectionInput(input: {
  companyCode: string;
  username?: string | null;
  baseUrl?: string | null;
  secret?: string | null;
  mockEnabled: boolean;
  isActive: boolean;
}) {
  const companyCode = input.companyCode.trim();
  const username = input.username?.trim() || null;
  const baseUrl = input.baseUrl?.trim() || null;
  const secret = input.secret?.trim() || null;

  if (
    !companyCode
    && !input.mockEnabled
    && !hasZetaRuntimeEnvCredentials({
      overrides: {
        baseUrl,
      },
    })
  ) {
    throw new Error(
      "Ingresa el codigo de empresa Zeta, configura las variables ZETASOFTWARE_* o activa el modo mock.",
    );
  }

  if (
    !secret
    && !input.mockEnabled
    && !hasZetaRuntimeEnvCredentials({
      overrides: {
        baseUrl,
        empresaCodigo: companyCode,
      },
    })
  ) {
    throw new Error(
      "Ingresa la clave/API key de Zeta, configura las variables ZETASOFTWARE_* o activa el modo mock.",
    );
  }

  return {
    companyCode,
    username,
    baseUrl,
    secret,
    mockEnabled: input.mockEnabled,
    isActive: input.isActive,
  };
}

export async function saveZetaConnection(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorUserId: string | null;
    companyCode: string;
    username?: string | null;
    baseUrl?: string | null;
    secret?: string | null;
    mockEnabled: boolean;
    isActive: boolean;
    encryptionKey?: string | null;
  },
) {
  const current = await loadZetaConnectionSettings(supabase, input.organizationId);
  const normalized = normalizeZetaConnectionInput(input);
  const credentials = normalized.secret
    ? {
      EmpresaCodigo: normalized.companyCode,
      Usuario: normalized.username,
      EmpresaClave: normalized.secret,
    }
    : undefined;
  const status = normalized.isActive ? "connected" : "paused";
  const beforeJson = current.isConfigured
    ? {
      status: current.status,
      mock_enabled: current.mockEnabled,
      company_code: current.companyCode,
      username: current.username,
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
      company_code: normalized.companyCode || null,
      username: normalized.username,
      base_url: normalized.baseUrl,
      mock_enabled: normalized.mockEnabled,
      contract_status: "confirmed_pr_01",
      health_mode: normalized.mockEnabled ? "mock" : "real",
      saved_from: "settings_integrations",
    },
    credentials,
    encryptionKey: input.encryptionKey,
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
      company_code: normalized.companyCode || null,
      username: normalized.username,
      base_url: normalized.baseUrl,
      credentials_saved: Boolean(normalized.secret),
      credentials_preview: normalized.secret
        ? maskIntegrationSecret(normalized.secret)
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
  const result = await healthCheck({
    isConfigured: current.isConfigured,
    isPaused: current.status === "paused",
    mockEnabled: current.mockEnabled,
    requestedMode: current.mockEnabled ? "mock" : "real",
    baseUrl: current.baseUrl,
  });

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
      ...result.metadata,
    },
  });

  return result satisfies ZetaHealthCheckResult;
}
