import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export interface ZetaOrgCredentials {
  EmpresaCodigo: string;
  EmpresaClave: string;
  UsuarioCodigo: string;
  RolCodigo: string;
}

const encryptionKeyEnvName = "INTEGRATION_CREDENTIALS_ENCRYPTION_KEY";
const algorithm = "aes-256-gcm";
const ivLength = 12;
const tagLength = 16;

function nonEmpty(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function readEnv(
  env: NodeJS.ProcessEnv,
  envName: string,
  envProfile: string | null,
) {
  const profiledName = profiledEnvName(envName, envProfile);
  return nonEmpty(profiledName ? env[profiledName] : null) ?? nonEmpty(env[envName]);
}

function resolveEncryptionKey() {
  const rawKey = process.env[encryptionKeyEnvName]?.trim();

  if (!rawKey) {
    throw new Error(`Missing ${encryptionKeyEnvName}.`);
  }

  if (/^[a-f0-9]{64}$/i.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  for (const encoding of ["base64", "base64url"] as const) {
    try {
      const decoded = Buffer.from(rawKey, encoding);

      if (decoded.length === 32) {
        return decoded;
      }
    } catch {
      // Keep trying supported encodings.
    }
  }

  throw new Error(`${encryptionKeyEnvName} must be a 32-byte key encoded as hex or base64.`);
}

function assertCredentialsShape(credentials: ZetaOrgCredentials) {
  const missing = [
    ["EmpresaCodigo", credentials.EmpresaCodigo],
    ["EmpresaClave", credentials.EmpresaClave],
    ["UsuarioCodigo", credentials.UsuarioCodigo],
    ["RolCodigo", credentials.RolCodigo],
  ]
    .filter(([, value]) => !nonEmpty(value))
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing Zetasoftware organization credential fields: ${missing.join(", ")}.`);
  }
}

export function encryptCredentials(credentials: ZetaOrgCredentials) {
  assertCredentialsShape(credentials);

  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, resolveEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptCredentials(blob: string): ZetaOrgCredentials {
  try {
    const payload = Buffer.from(blob, "base64");

    if (payload.length <= ivLength + tagLength) {
      throw new Error("Invalid Zetasoftware credentials payload.");
    }

    const iv = payload.subarray(0, ivLength);
    const tag = payload.subarray(ivLength, ivLength + tagLength);
    const ciphertext = payload.subarray(ivLength + tagLength);
    const decipher = createDecipheriv(algorithm, resolveEncryptionKey(), iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as ZetaOrgCredentials;
    const credentials = {
      EmpresaCodigo: nonEmpty(parsed.EmpresaCodigo) ?? "",
      EmpresaClave: nonEmpty(parsed.EmpresaClave) ?? "",
      UsuarioCodigo: nonEmpty(parsed.UsuarioCodigo) ?? "",
      RolCodigo: nonEmpty(parsed.RolCodigo) ?? "",
    };

    assertCredentialsShape(credentials);

    return credentials;
  } catch {
    throw new Error("No se pudieron descifrar las credenciales Zetasoftware.");
  }
}

export function fingerprintCredentials(credentials: ZetaOrgCredentials) {
  assertCredentialsShape(credentials);

  return createHash("sha256")
    .update(`${credentials.EmpresaCodigo}:${credentials.EmpresaClave}`, "utf8")
    .digest("hex")
    .slice(0, 16);
}

export function loadOrgCredsFromEnv(
  envProfile?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): ZetaOrgCredentials {
  const normalizedProfile = normalizeEnvProfile(envProfile);
  const credentials = {
    EmpresaCodigo: readEnv(env, "ZETASOFTWARE_EMPRESA_CODIGO", normalizedProfile) ?? "",
    EmpresaClave: readEnv(env, "ZETASOFTWARE_EMPRESA_CLAVE", normalizedProfile) ?? "",
    UsuarioCodigo: readEnv(env, "ZETASOFTWARE_USUARIOCODIGO", normalizedProfile) ?? "",
    RolCodigo: readEnv(env, "ZETASOFTWARE_ROLCODIGO", normalizedProfile) ?? "",
  };

  assertCredentialsShape(credentials);

  return credentials;
}
