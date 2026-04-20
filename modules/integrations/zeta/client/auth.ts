import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { integrationTables } from "@/modules/integrations/repository";
import type { ZetaConnectionPayload } from "@/modules/integrations/zeta/contracts/shared";
import {
  decryptCredentials,
  loadOrgCredsFromEnv,
  type ZetaOrgCredentials,
} from "@/modules/integrations/zeta/services/credentials-service";

export const zetaEnvironmentVariables = {
  baseUrl: "ZETASOFTWARE_BASE_URL",
  baseUrlFallbackStock: "ZETASOFTWARE_API_STOCK",
  baseUrlFallbackPrice: "ZETASOFTWARE_API_PRECIO",
  baseUrlFallbackArticles: "ZETASOFTWARE_API_ARTICULOS",
  desarrolladorCodigo: "ZETASOFTWARE_DESARROLLADOR_CODIGO",
  desarrolladorClave: "ZETASOFTWARE_DESARROLLADOR_CLAVE",
  empresaCodigo: "ZETASOFTWARE_EMPRESA_CODIGO",
  empresaClave: "ZETASOFTWARE_EMPRESA_CLAVE",
  usuarioCodigo: "ZETASOFTWARE_USUARIOCODIGO",
  usuarioClave: "ZETASOFTWARE_USUARIOCLAVE",
  usuarioClaveAlt: "ZETASOFTWARE_USUARIO_CLAVE",
  rolCodigo: "ZETASOFTWARE_ROLCODIGO",
} as const;

export type ZetaCredentialSource = "db_encrypted" | "server_env";

export type ZetaCredentialOverrides = {
  baseUrl?: string | null;
  desarrolladorCodigo?: string | null;
  desarrolladorClave?: string | null;
  empresaCodigo?: string | null;
  empresaClave?: string | null;
  usuarioCodigo?: string | number | null;
  usuarioClave?: string | null;
  rolCodigo?: string | number | null;
};

export type ZetaRuntimeConfig = {
  baseUrl: string;
  credentials: ZetaConnectionPayload;
  metadata: {
    credentialSource: ZetaCredentialSource | "mock" | "overrides";
    envProfile: string | null;
    hasUsuarioClave: boolean;
  };
};

type ZetaConnectionRow = {
  id: string;
  status: string;
  test_mode: boolean;
  config_json: Record<string, unknown> | null;
  encrypted_credentials: string | null;
};

export class ZetaConfigurationError extends Error {
  code: string;
  missing: string[];

  constructor(code: string, message: string, missing: string[]) {
    super(message);
    this.name = "ZetaConfigurationError";
    this.code = code;
    this.missing = missing;
  }
}

function trimmed(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstValue(...values: unknown[]) {
  for (const value of values) {
    const normalized = trimmed(value);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeEnvProfile(value: string | null | undefined) {
  const normalized = value
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || null;
}

function profiledEnvName(envName: string, envProfile: string | null) {
  if (!envProfile || !envName.startsWith("ZETASOFTWARE_")) {
    return null;
  }

  return `ZETASOFTWARE_${envProfile}_${envName.slice("ZETASOFTWARE_".length)}`;
}

function readEnvValue(
  env: NodeJS.ProcessEnv,
  envName: string,
  envProfile: string | null,
) {
  const profiledName = profiledEnvName(envName, envProfile);
  return firstValue(profiledName ? env[profiledName] : null, env[envName]);
}

function deriveBaseUrlFromEndpointUrl(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\/+$/, "");
  const marker = "/APIs/";
  const markerIndex = normalized.toLowerCase().indexOf(marker.toLowerCase());

  if (markerIndex > 0) {
    return normalized.slice(0, markerIndex);
  }

  return normalized;
}

function resolveBaseUrl(input: {
  env: NodeJS.ProcessEnv;
  envProfile?: string | null;
  override?: string | null;
}) {
  const envProfile = normalizeEnvProfile(input.envProfile ?? null);

  return firstValue(
    input.override,
    readEnvValue(input.env, zetaEnvironmentVariables.baseUrl, envProfile),
    deriveBaseUrlFromEndpointUrl(readEnvValue(input.env, zetaEnvironmentVariables.baseUrlFallbackStock, envProfile)),
    deriveBaseUrlFromEndpointUrl(readEnvValue(input.env, zetaEnvironmentVariables.baseUrlFallbackPrice, envProfile)),
    deriveBaseUrlFromEndpointUrl(readEnvValue(input.env, zetaEnvironmentVariables.baseUrlFallbackArticles, envProfile)),
  );
}

function parseIntegerCredential(value: string | number | null | undefined, label: string) {
  const raw = trimmed(value);
  const parsed = Number(raw);

  if (!Number.isInteger(parsed)) {
    throw new ZetaConfigurationError(
      "zeta_credentials_invalid",
      `${label} debe ser un entero.`,
      [label],
    );
  }

  return parsed;
}

function readIntegratorCredentials(env: NodeJS.ProcessEnv, overrides: ZetaCredentialOverrides = {}) {
  const desarrolladorCodigo = firstValue(
    overrides.desarrolladorCodigo,
    env[zetaEnvironmentVariables.desarrolladorCodigo],
  );
  const desarrolladorClave = firstValue(
    overrides.desarrolladorClave,
    env[zetaEnvironmentVariables.desarrolladorClave],
  );
  const missing: string[] = [];

  if (!desarrolladorCodigo) {
    missing.push(zetaEnvironmentVariables.desarrolladorCodigo);
  }

  if (!desarrolladorClave) {
    missing.push(zetaEnvironmentVariables.desarrolladorClave);
  }

  if (missing.length > 0) {
    throw new ZetaConfigurationError(
      "zeta_integrator_credentials_missing",
      `Faltan credenciales del integrador Zetasoftware: ${missing.join(", ")}.`,
      missing,
    );
  }

  return {
    DesarrolladorCodigo: desarrolladorCodigo as string,
    DesarrolladorClave: desarrolladorClave as string,
  };
}

function buildPayload(input: {
  integrator: {
    DesarrolladorCodigo: string;
    DesarrolladorClave: string;
  };
  org: ZetaOrgCredentials;
}): ZetaConnectionPayload {
  return {
    DesarrolladorCodigo: input.integrator.DesarrolladorCodigo,
    DesarrolladorClave: input.integrator.DesarrolladorClave,
    EmpresaCodigo: input.org.EmpresaCodigo,
    EmpresaClave: input.org.EmpresaClave,
    UsuarioCodigo: parseIntegerCredential(input.org.UsuarioCodigo, "UsuarioCodigo"),
    UsuarioClave: input.org.UsuarioClave ?? "",
    RolCodigo: parseIntegerCredential(input.org.RolCodigo, "RolCodigo"),
  };
}

function mockRuntime(baseUrl?: string | null): ZetaRuntimeConfig {
  return {
    baseUrl: baseUrl ?? "https://mock.zetasoftware.local",
    credentials: {
      DesarrolladorCodigo: "mock",
      DesarrolladorClave: "mock",
      EmpresaCodigo: "mock",
      EmpresaClave: "mock",
      UsuarioCodigo: 1,
      UsuarioClave: "mock",
      RolCodigo: 1,
    },
    metadata: {
      credentialSource: "mock",
      envProfile: null,
      hasUsuarioClave: false,
    },
  };
}

function normalizeCredentialSource(value: unknown): ZetaCredentialSource {
  if (value === "server_env") {
    return "server_env";
  }

  return "db_encrypted";
}

export function zetaCredentialOverridesFromRecord(
  value: Record<string, unknown>,
): ZetaCredentialOverrides {
  return {
    baseUrl: firstValue(value.BaseUrl, value.BaseURL, value.baseUrl, value.base_url),
    empresaCodigo: firstValue(
      value.EmpresaCodigo,
      value.empresaCodigo,
      value.companyCode,
      value.company_code,
    ),
    empresaClave: firstValue(
      value.EmpresaClave,
      value.empresaClave,
      value.companySecret,
      value.company_secret,
    ),
    usuarioCodigo: firstValue(
      value.UsuarioCodigo,
      value.usuarioCodigo,
      value.userCode,
      value.user_code,
    ),
    usuarioClave: firstValue(
      value.UsuarioClave,
      value.usuarioClave,
      value.userSecret,
      value.user_secret,
    ),
    rolCodigo: firstValue(
      value.RolCodigo,
      value.rolCodigo,
      value.roleCode,
      value.role_code,
    ),
  };
}

export function loadZetaRuntimeConfig(input: {
  env?: NodeJS.ProcessEnv;
  envProfile?: string | null;
  overrides?: ZetaCredentialOverrides;
} = {}): ZetaRuntimeConfig {
  const env = input.env ?? process.env;
  const overrides = input.overrides ?? {};
  const envProfile = normalizeEnvProfile(input.envProfile ?? null);
  const baseUrl = resolveBaseUrl({
    env,
    envProfile,
    override: overrides.baseUrl,
  });

  if (!baseUrl) {
    throw new ZetaConfigurationError(
      "zeta_base_url_missing",
      "Falta la base URL de Zetasoftware.",
      [zetaEnvironmentVariables.baseUrl],
    );
  }

  const integrator = readIntegratorCredentials(env, overrides);
  const org = overrides.empresaCodigo
    || overrides.empresaClave
    || overrides.usuarioCodigo
    || overrides.usuarioClave
    || overrides.rolCodigo
    ? {
      EmpresaCodigo: firstValue(overrides.empresaCodigo) ?? "",
      EmpresaClave: firstValue(overrides.empresaClave) ?? "",
      UsuarioCodigo: firstValue(overrides.usuarioCodigo) ?? "",
      UsuarioClave: firstValue(
        overrides.usuarioClave,
        readEnvValue(env, zetaEnvironmentVariables.usuarioClave, envProfile),
        readEnvValue(env, zetaEnvironmentVariables.usuarioClaveAlt, envProfile),
      ) ?? undefined,
      RolCodigo: firstValue(overrides.rolCodigo) ?? "",
    }
    : loadOrgCredsFromEnv(envProfile, env);

  return {
    baseUrl,
    credentials: buildPayload({ integrator, org }),
    metadata: {
      credentialSource: overrides.empresaCodigo ? "overrides" : "server_env",
      envProfile,
      hasUsuarioClave: Boolean(org.UsuarioClave),
    },
  };
}

export function hasZetaRuntimeEnvCredentials(input: {
  env?: NodeJS.ProcessEnv;
  envProfile?: string | null;
  overrides?: ZetaCredentialOverrides;
} = {}) {
  try {
    loadZetaRuntimeConfig(input);
    return true;
  } catch {
    return false;
  }
}

async function loadConnectionRow(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from(integrationTables.connections)
    .select("id, status, test_mode, config_json, encrypted_credentials")
    .eq("organization_id", organizationId)
    .eq("provider", "zetasoftware")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ZetaConnectionRow | null) ?? null;
}

export async function buildZetaConnection(input: {
  supabase: SupabaseClient;
  organizationId: string;
  env?: NodeJS.ProcessEnv;
}): Promise<ZetaRuntimeConfig> {
  const env = input.env ?? process.env;

  if (env.ZETA_INTEGRATION_MOCK === "1") {
    return mockRuntime(resolveBaseUrl({ env }));
  }

  const row = await loadConnectionRow(input.supabase, input.organizationId);

  if (!row) {
    throw new Error("Guarda la conexion Zetasoftware antes de usar la API.");
  }

  const config = asRecord(row.config_json);
  const envProfile = normalizeEnvProfile(firstValue(config.env_profile));
  const baseUrl = resolveBaseUrl({
    env,
    envProfile,
    override: firstValue(config.base_url),
  });

  if (row.test_mode || config.mock_enabled === true) {
    return mockRuntime(baseUrl);
  }

  if (!baseUrl) {
    throw new ZetaConfigurationError(
      "zeta_base_url_missing",
      "Falta la base URL de Zetasoftware.",
      [zetaEnvironmentVariables.baseUrl],
    );
  }

  const credentialSource = normalizeCredentialSource(config.credential_source);
  const integrator = readIntegratorCredentials(env);
  const org = credentialSource === "server_env"
    ? loadOrgCredsFromEnv(envProfile, env)
    : (() => {
      if (!row.encrypted_credentials) {
        throw new Error("No hay credenciales cifradas guardadas para Zetasoftware.");
      }

      return decryptCredentials(row.encrypted_credentials);
    })();

  return {
    baseUrl,
    credentials: buildPayload({ integrator, org }),
    metadata: {
      credentialSource,
      envProfile,
      hasUsuarioClave: Boolean(org.UsuarioClave),
    },
  };
}
