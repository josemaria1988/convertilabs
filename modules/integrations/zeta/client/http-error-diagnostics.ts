import type { ZetaConnectionPayload } from "../contracts/shared";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_DIAGNOSTIC_CHARS = 8 * 1024;
const REDACTED = "[REDACTED]";
const SENSITIVE_KEY = /connection|clave|password|secret|token|authorization|cookie|api[_-]?key|credential/i;

type DiagnosticResponse = {
  headers?: { get: (name: string) => string | null };
  body?: ReadableStream<Uint8Array> | null;
  text?: () => Promise<string>;
  json: () => Promise<unknown>;
};

function credentialVariants(credentials: ZetaConnectionPayload) {
  return [...new Set(Object.values(credentials)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .flatMap((value) => [
      value,
      JSON.stringify(value).slice(1, -1),
      encodeURIComponent(value),
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"),
    ]))].sort((left, right) => right.length - left.length);
}

function redactText(value: string, secrets: string[], truncated = false) {
  let result = value;
  // A capped response can end halfway through an echoed credential.
  if (truncated) {
    for (const secret of secrets) {
      for (let length = Math.min(secret.length - 1, result.length); length > 0; length -= 1) {
        if (result.endsWith(secret.slice(0, length))) {
          result = `${result.slice(0, -length)}${REDACTED}`;
          break;
        }
      }
    }
  }
  for (const secret of secrets) result = result.split(secret).join(REDACTED);
  return result
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_=.-]+/gi, `$1 ${REDACTED}`)
    .replace(/(["']?[\w-]*(?:clave|password|secret|token|authorization|cookie|api[_-]?key|credential)[\w-]*["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;<>]+)/gi, `$1${REDACTED}`)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

function sanitizeJson(value: unknown, secrets: string[], depth = 0): unknown {
  if (depth > 12) return "[DEPTH LIMIT]";
  if (typeof value === "string") return redactText(value, secrets);
  if (Array.isArray(value)) return value.slice(0, 100).map((entry) => sanitizeJson(entry, secrets, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, entry]) => [
    redactText(key, secrets),
    SENSITIVE_KEY.test(key) ? REDACTED : sanitizeJson(entry, secrets, depth + 1),
  ]));
}

async function readBoundedBody(response: DiagnosticResponse) {
  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let remaining = MAX_BODY_BYTES;
    let text = "";
    try {
      while (remaining > 0) {
        const part = await reader.read();
        if (part.done) return { text: text + decoder.decode(), truncated: false };
        const kept = part.value.subarray(0, remaining);
        text += decoder.decode(kept, { stream: true });
        remaining -= kept.byteLength;
      }
      // Do not consume an unbounded error response or wait on cancellation.
      void reader.cancel().catch(() => {});
      return { text: text + decoder.decode(), truncated: true };
    } finally {
      reader.releaseLock();
    }
  }
  // Compatibility with injected fetch implementations without a body stream.
  const text = response.text ? await response.text() : JSON.stringify(await response.json());
  const bytes = new TextEncoder().encode(text ?? "");
  return {
    text: new TextDecoder().decode(bytes.subarray(0, MAX_BODY_BYTES)),
    truncated: bytes.byteLength > MAX_BODY_BYTES,
  };
}

export async function readZetaHttpErrorDiagnostic(
  response: DiagnosticResponse,
  credentials: ZetaConnectionPayload,
) {
  const secrets = credentialVariants(credentials);
  let contentType: string | null = null;
  try {
    contentType = redactText(response.headers?.get("content-type") ?? "", secrets).slice(0, 160) || null;
    const body = await readBoundedBody(response);
    let sanitized: string;
    try {
      sanitized = JSON.stringify(sanitizeJson(JSON.parse(body.text), secrets));
    } catch {
      sanitized = redactText(body.text, secrets, body.truncated);
    }
    return {
      contentType,
      body: sanitized.slice(0, MAX_DIAGNOSTIC_CHARS),
      bodyTruncated: body.truncated || sanitized.length > MAX_DIAGNOSTIC_CHARS,
      bodyReadFailed: false,
    };
  } catch {
    // Preserve the HTTP status even if reading the diagnostic body fails.
    return { contentType, body: null, bodyTruncated: false, bodyReadFailed: true };
  }
}
