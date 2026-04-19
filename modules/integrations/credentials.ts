import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export type IntegrationCredentials = Record<string, unknown>;

const encryptionVersion = "v1";
const encryptionAlgorithm = "aes-256-gcm";
const encryptionKeyEnvName = "INTEGRATION_CREDENTIALS_ENCRYPTION_KEY";
const sensitiveCredentialKeyPattern =
  /(api[-_]?key|access[-_]?token|refresh[-_]?token|\btoken\b|secret|password|credential|clave)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sortJsonValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJsonValue(value[key])]),
  );
}

export function stableJsonStringify(value: unknown) {
  return JSON.stringify(sortJsonValue(value)) ?? "null";
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function decodeBase64Key(value: string) {
  const normalized = value.startsWith("base64:")
    ? value.slice("base64:".length)
    : value;

  for (const encoding of ["base64", "base64url"] as const) {
    try {
      const decoded = Buffer.from(normalized, encoding);

      if (decoded.length === 32) {
        return decoded;
      }
    } catch {
      // Fall back to hashing below.
    }
  }

  return null;
}

function resolveEncryptionKey(keyInput?: string | null) {
  const rawKey = keyInput?.trim() || process.env[encryptionKeyEnvName]?.trim();

  if (!rawKey) {
    throw new Error(
      `Missing ${encryptionKeyEnvName}. Define it before storing integration credentials.`,
    );
  }

  return decodeBase64Key(rawKey) ?? createHash("sha256").update(rawKey, "utf8").digest();
}

export function fingerprintIntegrationCredentials(credentials: IntegrationCredentials) {
  return `sha256:${sha256Hex(stableJsonStringify(credentials))}`;
}

export function encryptIntegrationCredentials(
  credentials: IntegrationCredentials,
  keyInput?: string | null,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(encryptionAlgorithm, resolveEncryptionKey(keyInput), iv);
  const encrypted = Buffer.concat([
    cipher.update(stableJsonStringify(credentials), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    encryptionVersion,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptIntegrationCredentials(
  encryptedCredentials: string,
  keyInput?: string | null,
) {
  const [version, encodedIv, encodedAuthTag, encodedPayload] =
    encryptedCredentials.split(":");

  if (
    version !== encryptionVersion
    || !encodedIv
    || !encodedAuthTag
    || !encodedPayload
  ) {
    throw new Error("Unsupported integration credentials payload.");
  }

  const decipher = createDecipheriv(
    encryptionAlgorithm,
    resolveEncryptionKey(keyInput),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedAuthTag, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encodedPayload, "base64url")),
    decipher.final(),
  ]).toString("utf8");

  const parsed = JSON.parse(plaintext);

  if (!isRecord(parsed)) {
    throw new Error("Integration credentials payload must be a JSON object.");
  }

  return parsed;
}

export function isSensitiveCredentialKey(key: string) {
  return sensitiveCredentialKeyPattern.test(key);
}

export function maskIntegrationSecret(value: unknown) {
  if (typeof value !== "string" || value.length <= 4) {
    return "********";
  }

  return `${value.slice(0, 2)}********${value.slice(-2)}`;
}

export function maskIntegrationCredentials(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskIntegrationCredentials);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSensitiveCredentialKey(key)
        ? maskIntegrationSecret(entry)
        : maskIntegrationCredentials(entry),
    ]),
  );
}
