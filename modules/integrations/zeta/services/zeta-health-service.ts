import "server-only";

import {
  loadZetaRuntimeConfig,
  type ZetaCredentialOverrides,
  type ZetaRuntimeConfig,
  ZetaConfigurationError,
} from "@/modules/integrations/zeta/client/auth";
import { normalizeZetaException } from "@/modules/integrations/zeta/client/errors";
import {
  createZetaRestClient,
  queryZetaEndpoint,
  type ZetaRestClientOptions,
} from "@/modules/integrations/zeta/client/rest-client";

export type ZetaHealthMode = "mock" | "real";

export type ZetaHealthCheckResult = {
  ok: boolean;
  status: "connected" | "paused" | "error" | "disconnected";
  code: string;
  message: string;
  checkedAt: string;
  metadata: Record<string, unknown>;
};

export function resolveZetaHealthMode(input: {
  mockEnabled: boolean;
  requestedMode?: string | null;
}) {
  if (
    input.mockEnabled
    || input.requestedMode === "mock"
    || process.env.ZETA_INTEGRATION_MOCK === "1"
  ) {
    return "mock" satisfies ZetaHealthMode;
  }

  return "real" satisfies ZetaHealthMode;
}

function formatConfigurationErrorMessage(error: ZetaConfigurationError, usesStoredCredentials: boolean) {
  if (error.code === "zeta_base_url_missing") {
    return "Falta ZETASOFTWARE_BASE_URL o la base URL de Zetasoftware en la conexion.";
  }

  if (error.code === "zeta_integrator_credentials_missing") {
    return "Faltan ZETASOFTWARE_DESARROLLADOR_CODIGO o ZETASOFTWARE_DESARROLLADOR_CLAVE en las variables de entorno del servidor.";
  }

  if (error.code === "zeta_credentials_invalid") {
    return "UsuarioCodigo y RolCodigo deben ser numericos segun el contrato REST de Zetasoftware.";
  }

  return usesStoredCredentials
    ? "Faltan campos en las credenciales cifradas de Zetasoftware."
    : "Faltan credenciales Zetasoftware en variables de entorno del servidor.";
}

export async function runZetaHealthCheck(input: {
  isConfigured: boolean;
  isPaused: boolean;
  mockEnabled: boolean;
  requestedMode?: string | null;
  baseUrl?: string | null;
  envProfile?: string | null;
  credentialOverrides?: ZetaCredentialOverrides;
  runtime?: ZetaRuntimeConfig;
  fetchImpl?: ZetaRestClientOptions["fetchImpl"];
}) {
  const checkedAt = new Date().toISOString();

  if (!input.isConfigured) {
    return {
      ok: false,
      status: "disconnected",
      code: "zeta_connection_missing",
      message: "Guarda una conexion Zetasoftware antes de probarla.",
      checkedAt,
      metadata: {
        health_mode: "not_configured",
      },
    } satisfies ZetaHealthCheckResult;
  }

  if (input.isPaused) {
    return {
      ok: false,
      status: "paused",
      code: "zeta_connection_paused",
      message: "La conexion Zetasoftware esta pausada.",
      checkedAt,
      metadata: {
        health_mode: "paused",
      },
    } satisfies ZetaHealthCheckResult;
  }

  const healthMode = resolveZetaHealthMode(input);

  if (healthMode === "mock") {
    return {
      ok: true,
      status: "connected",
      code: "zeta_mock_health_ok",
      message: "Conexion Zetasoftware validada en modo mock.",
      checkedAt,
      metadata: {
        health_mode: "mock",
        contract_status: "confirmed_pr_01",
      },
    } satisfies ZetaHealthCheckResult;
  }

  try {
    const runtime = input.runtime ?? loadZetaRuntimeConfig({
      envProfile: input.envProfile,
      overrides: {
        ...(input.credentialOverrides ?? {}),
        baseUrl: input.baseUrl ?? input.credentialOverrides?.baseUrl,
      },
    });
    const client = createZetaRestClient({
      baseUrl: runtime.baseUrl,
      credentials: runtime.credentials,
      fetchImpl: input.fetchImpl,
    });
    const probe = await queryZetaEndpoint<{
      Codigo?: number;
      Nombre?: string;
      UsuarioNombre?: string;
      UsuarioEmail?: string;
    }>(
      client,
      "userRolesQuery",
      {
        page: 1,
        filters: {
          CodigoDesde: runtime.credentials.RolCodigo,
          CodigoHasta: runtime.credentials.RolCodigo,
        },
      },
    );

    return {
      ok: true,
      status: "connected",
      code: "zeta_real_health_ok",
      message: "Conexion Zetasoftware validada con RESTUsuariosEmpresaV1Query.",
      checkedAt,
      metadata: {
        health_mode: "real",
        contract_status: "confirmed_pr_01",
        endpoint: "RESTUsuariosEmpresaV1Query",
        rows_seen: probe.rows.length,
        is_last_page: probe.isLastPage,
        has_usuario_clave: runtime.metadata.hasUsuarioClave,
        credential_source: runtime.metadata.credentialSource,
      },
    } satisfies ZetaHealthCheckResult;
  } catch (error) {
    if (error instanceof ZetaConfigurationError) {
      const usesStoredCredentials = Boolean(input.credentialOverrides);

      return {
        ok: false,
        status: "error",
        code: error.code,
        message: formatConfigurationErrorMessage(error, usesStoredCredentials),
        checkedAt,
        metadata: {
          health_mode: "real",
          contract_status: "confirmed_pr_01",
          credential_source: usesStoredCredentials ? "db_encrypted" : "server_env",
          missing: error.missing,
        },
      } satisfies ZetaHealthCheckResult;
    }

    const normalized = normalizeZetaException(error);

    return {
      ok: false,
      status: "error",
      code: normalized.code,
      message: normalized.message,
      checkedAt,
      metadata: {
        health_mode: "real",
        contract_status: "confirmed_pr_01",
        endpoint: normalized.endpointName ?? "RESTUsuariosEmpresaV1Query",
        http_status: normalized.status ?? null,
      },
    } satisfies ZetaHealthCheckResult;
  }
}
