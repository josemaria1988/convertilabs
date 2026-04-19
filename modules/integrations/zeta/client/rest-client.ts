import "server-only";

import {
  buildZetaEndpointUrl,
  getZetaEndpoint,
  type ZetaEndpointKey,
} from "@/modules/integrations/zeta/client/endpoint-registry";
import {
  normalizeZetaErrorPayload,
  ZetaIntegrationError,
} from "@/modules/integrations/zeta/client/errors";
import type {
  ZetaConnectionPayload,
  ZetaJsonRecord,
  ZetaQueryResult,
  ZetaWrappedOutput,
} from "@/modules/integrations/zeta/contracts/shared";

export type ZetaFetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text?: () => Promise<string>;
};

export type ZetaFetch = (
  url: string,
  init: RequestInit,
) => Promise<ZetaFetchResponse>;

export type ZetaRestClient = {
  baseUrl: string;
  credentials: ZetaConnectionPayload;
  fetchImpl: ZetaFetch;
  timeoutMs: number;
};

export type ZetaRestClientOptions = {
  baseUrl: string;
  credentials: ZetaConnectionPayload;
  fetchImpl?: ZetaFetch;
  timeoutMs?: number;
};

function defaultFetch(url: string, init: RequestInit) {
  if (typeof fetch !== "function") {
    throw new ZetaIntegrationError({
      code: "zeta_fetch_unavailable",
      message: "No hay fetch disponible para llamar Zetasoftware desde el servidor.",
    });
  }

  return fetch(url, init) as Promise<ZetaFetchResponse>;
}

function normalizeBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, "");

  if (!normalized) {
    throw new ZetaIntegrationError({
      code: "zeta_base_url_missing",
      message: "Falta ZETASOFTWARE_BASE_URL o base_url en la conexion Zetasoftware.",
    });
  }

  return normalized;
}

function isFalseLike(value: unknown) {
  return value === false || value === "false" || value === "False";
}

function coerceBoolean(value: unknown) {
  if (value === true || value === "true" || value === "True") {
    return true;
  }

  if (isFalseLike(value)) {
    return false;
  }

  return Boolean(value);
}

async function parseResponseJson(response: ZetaFetchResponse, endpointName: string) {
  try {
    return await response.json();
  } catch (error) {
    throw new ZetaIntegrationError({
      code: "zeta_invalid_json",
      endpointName,
      status: response.status,
      message: "Zetasoftware devolvio una respuesta que no es JSON valido.",
      cause: error,
    });
  }
}

export function createZetaRestClient(options: ZetaRestClientOptions): ZetaRestClient {
  return {
    baseUrl: normalizeBaseUrl(options.baseUrl),
    credentials: options.credentials,
    fetchImpl: options.fetchImpl ?? defaultFetch,
    timeoutMs: options.timeoutMs ?? 20000,
  };
}

export async function callZetaEndpoint<TResponse = unknown>(
  client: ZetaRestClient,
  key: ZetaEndpointKey,
  data: ZetaJsonRecord = {},
) {
  const endpoint = getZetaEndpoint(key);
  const url = buildZetaEndpointUrl(client.baseUrl, key);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), client.timeoutMs);
  const body = {
    [endpoint.inputWrapper]: {
      Connection: client.credentials,
      ...data,
    },
  };

  try {
    const response = await client.fetchImpl(url, {
      method: endpoint.httpMethod,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ZetaIntegrationError({
        code: "zeta_http_error",
        endpointName: endpoint.endpointName,
        status: response.status,
        message: `Zetasoftware respondio HTTP ${response.status} ${response.statusText}.`,
      });
    }

    const parsed = await parseResponseJson(response, endpoint.endpointName);
    const wrapped = parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)[endpoint.outputWrapper]
      : null;

    if (!wrapped || typeof wrapped !== "object") {
      throw new ZetaIntegrationError({
        code: "zeta_output_wrapper_missing",
        endpointName: endpoint.endpointName,
        message: `La respuesta de Zetasoftware no contiene ${endpoint.outputWrapper}.`,
      });
    }

    const output = wrapped as ZetaWrappedOutput<TResponse>;

    if (isFalseLike(output.Succeed)) {
      const normalized = normalizeZetaErrorPayload(output.Error);

      throw new ZetaIntegrationError({
        code: normalized.code,
        endpointName: endpoint.endpointName,
        message: normalized.message,
        details: normalized.detail,
      });
    }

    return output;
  } catch (error) {
    if (error instanceof ZetaIntegrationError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ZetaIntegrationError({
        code: "zeta_timeout",
        endpointName: endpoint.endpointName,
        message: `Zetasoftware no respondio antes de ${client.timeoutMs}ms.`,
        cause: error,
      });
    }

    throw new ZetaIntegrationError({
      code: "zeta_network_error",
      endpointName: endpoint.endpointName,
      message: error instanceof Error
        ? error.message
        : "No se pudo llamar Zetasoftware.",
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function queryZetaEndpoint<
  TRecord,
  TFilters extends ZetaJsonRecord = ZetaJsonRecord,
>(
  client: ZetaRestClient,
  key: ZetaEndpointKey,
  input: {
    page?: number;
    filters?: TFilters;
  } = {},
): Promise<ZetaQueryResult<TRecord>> {
  const endpoint = getZetaEndpoint(key);

  if (endpoint.kind !== "query") {
    throw new ZetaIntegrationError({
      code: "zeta_endpoint_not_query",
      endpointName: endpoint.endpointName,
      message: `${endpoint.endpointName} no es un endpoint Query.`,
    });
  }

  const output = await callZetaEndpoint<TRecord[]>(client, key, {
    Data: {
      Page: input.page ?? 1,
      Filters: input.filters ?? ({} as TFilters),
    },
  });

  return {
    rows: Array.isArray(output.Response) ? output.Response : [],
    isLastPage: coerceBoolean(output.IsLastPage),
    raw: output,
  };
}
