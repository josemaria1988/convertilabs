import "server-only";

import type { ZetaConnectionPayload } from "@/modules/integrations/zeta/contracts/shared";

export const zetaEnvironmentVariables = {
  baseUrl: "ZETASOFTWARE_BASE_URL",
  desarrolladorCodigo: "ZETASOFTWARE_DESARROLLADOR_CODIGO",
  desarrolladorClave: "ZETASOFTWARE_DESARROLLADOR_CLAVE",
  empresaCodigo: "ZETASOFTWARE_EMPRESA_CODIGO",
  empresaClave: "ZETASOFTWARE_EMPRESA_CLAVE",
  usuarioCodigo: "ZETASOFTWARE_USUARIOCODIGO",
  usuarioClave: "ZETASOFTWARE_USUARIOCLAVE",
  usuarioClaveAlt: "ZETASOFTWARE_USUARIO_CLAVE",
  rolCodigo: "ZETASOFTWARE_ROLCODIGO",
} as const;

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
    hasUsuarioClave: boolean;
    source: "env";
  };
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

function parseIntegerCredential(value: string | null, envName: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new ZetaConfigurationError(
      "zeta_credentials_invalid",
      `La variable ${envName} debe ser un entero.`,
      [envName],
    );
  }

  return parsed;
}

function readRequired(
  env: NodeJS.ProcessEnv,
  overrides: ZetaCredentialOverrides,
  key: keyof ZetaCredentialOverrides,
  envName: string,
  missing: string[],
) {
  const value = firstValue(overrides[key], env[envName]);

  if (!value) {
    missing.push(envName);
  }

  return value;
}

export function loadZetaRuntimeConfig(input: {
  env?: NodeJS.ProcessEnv;
  overrides?: ZetaCredentialOverrides;
} = {}): ZetaRuntimeConfig {
  const env = input.env ?? process.env;
  const overrides = input.overrides ?? {};
  const missing: string[] = [];
  const baseUrl = firstValue(overrides.baseUrl, env[zetaEnvironmentVariables.baseUrl]);
  const desarrolladorCodigo = readRequired(
    env,
    overrides,
    "desarrolladorCodigo",
    zetaEnvironmentVariables.desarrolladorCodigo,
    missing,
  );
  const desarrolladorClave = readRequired(
    env,
    overrides,
    "desarrolladorClave",
    zetaEnvironmentVariables.desarrolladorClave,
    missing,
  );
  const empresaCodigo = readRequired(
    env,
    overrides,
    "empresaCodigo",
    zetaEnvironmentVariables.empresaCodigo,
    missing,
  );
  const empresaClave = readRequired(
    env,
    overrides,
    "empresaClave",
    zetaEnvironmentVariables.empresaClave,
    missing,
  );
  const usuarioCodigoRaw = readRequired(
    env,
    overrides,
    "usuarioCodigo",
    zetaEnvironmentVariables.usuarioCodigo,
    missing,
  );
  const rolCodigoRaw = readRequired(
    env,
    overrides,
    "rolCodigo",
    zetaEnvironmentVariables.rolCodigo,
    missing,
  );
  const usuarioClave = firstValue(
    overrides.usuarioClave,
    env[zetaEnvironmentVariables.usuarioClave],
    env[zetaEnvironmentVariables.usuarioClaveAlt],
  );

  if (!baseUrl) {
    missing.push(zetaEnvironmentVariables.baseUrl);
  }

  if (missing.length > 0) {
    const code = missing.includes(zetaEnvironmentVariables.baseUrl)
      && missing.length === 1
      ? "zeta_base_url_missing"
      : "zeta_credentials_missing";

    throw new ZetaConfigurationError(
      code,
      `Faltan variables de entorno Zetasoftware: ${missing.join(", ")}.`,
      missing,
    );
  }

  return {
    baseUrl: baseUrl as string,
    credentials: {
      DesarrolladorCodigo: desarrolladorCodigo as string,
      DesarrolladorClave: desarrolladorClave as string,
      EmpresaCodigo: empresaCodigo as string,
      EmpresaClave: empresaClave as string,
      UsuarioCodigo: parseIntegerCredential(
        usuarioCodigoRaw,
        zetaEnvironmentVariables.usuarioCodigo,
      ),
      UsuarioClave: usuarioClave ?? "",
      RolCodigo: parseIntegerCredential(rolCodigoRaw, zetaEnvironmentVariables.rolCodigo),
    },
    metadata: {
      hasUsuarioClave: Boolean(usuarioClave),
      source: "env",
    },
  };
}

export function hasZetaRuntimeEnvCredentials(input: {
  env?: NodeJS.ProcessEnv;
  overrides?: ZetaCredentialOverrides;
} = {}) {
  try {
    loadZetaRuntimeConfig(input);
    return true;
  } catch {
    return false;
  }
}
