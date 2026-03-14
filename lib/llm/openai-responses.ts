import "server-only";

import { getOpenAIEnv } from "@/lib/env";

type JsonSchemaDefinition = {
  type: "object";
  properties: Record<string, unknown>;
  required?: readonly string[];
  additionalProperties?: boolean;
};

type OpenAIFileInput =
  | {
      kind: "pdf";
      fileId: string;
      filename?: string;
    }
  | {
      kind: "image";
      fileId: string;
      detail?: "low" | "high" | "auto";
    };

type OpenAIFileUploadPurpose = "user_data" | "batch";

export type OpenAIStructuredResponseUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
};

export type AIPipelineRunMode = "sync" | "background" | "batch";

export type AIPipelineRun<T> = {
  providerCode: "openai";
  modelCode: string | null;
  mode: AIPipelineRunMode;
  responseId: string | null;
  batchId: string | null;
  status: string | null;
  output: T | null;
  rawText: string;
  usage: OpenAIStructuredResponseUsage;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
};

export type OpenAIStructuredResponseResult<T> = {
  responseId: string | null;
  output: T;
  rawText: string;
  usage: OpenAIStructuredResponseUsage;
  rawResponse: Record<string, unknown>;
};

export type OpenAIBackgroundStructuredResponseResult = {
  responseId: string;
  status: string | null;
  rawResponse: Record<string, unknown>;
};

export type OpenAIRetrievedResponseResult = {
  responseId: string | null;
  status: string | null;
  usage: OpenAIStructuredResponseUsage;
  rawResponse: Record<string, unknown>;
};

export type OpenAIBatchPipelineRun = AIPipelineRun<null> & {
  batchId: string;
};

export type OpenAIFileUploadResult = {
  fileId: string;
  purpose: OpenAIFileUploadPurpose;
  rawResponse: Record<string, unknown>;
};

function buildOpenAIHeaders(extraHeaders?: Record<string, string>) {
  const { openAiApiKey } = getOpenAIEnv();

  return {
    Authorization: `Bearer ${openAiApiKey}`,
    ...extraHeaders,
  };
}

function toBlobPart(
  bytes: ArrayBuffer | Uint8Array,
  mimeType: string,
) {
  const normalizedBytes = bytes instanceof Uint8Array
    ? bytes
    : new Uint8Array(bytes);
  const copiedBytes = new Uint8Array(normalizedBytes);

  return new Blob([copiedBytes], {
    type: mimeType,
  });
}

function buildMetadataRecord(
  metadata: Record<string, unknown> | undefined,
) {
  if (!metadata) {
    return undefined;
  }

  const normalizedEntries = Object.entries(metadata)
    .flatMap(([key, value]) => {
      if (value === null || value === undefined) {
        return [];
      }

      if (typeof value === "string") {
        const trimmedValue = value.trim();
        return trimmedValue ? [[key, trimmedValue] as const] : [];
      }

      if (typeof value === "number" || typeof value === "boolean") {
        return [[key, String(value)] as const];
      }

      return [[key, JSON.stringify(value)] as const];
    });

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(normalizedEntries);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parseJsonResponse(response: Response) {
  let payload: Record<string, unknown>;

  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    const fallbackText =
      typeof response.text === "function"
        ? await response.text()
        : "";

    payload = fallbackText
      ? {
          message: fallbackText,
        }
      : {};
  }

  if (!response.ok) {
    const maybeError =
      typeof payload.error === "object" && payload.error
        ? (payload.error as Record<string, unknown>)
        : payload;
    const message =
      typeof maybeError.message === "string"
        ? maybeError.message
        : `OpenAI request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload;
}

function shouldRetryOpenAIResponse(response: Response | null, error: unknown) {
  if (response) {
    return response.status === 429 || response.status >= 500;
  }

  return error instanceof Error;
}

async function runOpenAIJsonRequest(input: {
  url: string;
  method: "GET" | "POST";
  body?: BodyInit;
  contentType?: string;
}) {
  const {
    openAiHttpMaxRetries,
    openAiHttpRetryDelayMs,
  } = getOpenAIEnv();
  const maxAttempts = Math.max(1, openAiHttpMaxRetries);
  let attempt = 0;

  while (attempt < maxAttempts) {
    let response: Response | null = null;

    try {
      response = await fetch(input.url, {
        method: input.method,
        headers: buildOpenAIHeaders(
          input.contentType
            ? {
                "Content-Type": input.contentType,
              }
            : undefined,
        ),
        body: input.body,
        cache: "no-store",
      });

      if (!response.ok && shouldRetryOpenAIResponse(response, null) && attempt < maxAttempts - 1) {
        await sleep(openAiHttpRetryDelayMs * (attempt + 1));
        attempt += 1;
        continue;
      }

      return parseJsonResponse(response);
    } catch (error) {
      if (!shouldRetryOpenAIResponse(response, error) || attempt >= maxAttempts - 1) {
        throw error;
      }

      await sleep(openAiHttpRetryDelayMs * (attempt + 1));
      attempt += 1;
    }
  }

  throw new Error("OpenAI request exhausted all retry attempts.");
}

function extractResponseText(payload: Record<string, unknown>) {
  const directOutputText = payload.output_text;

  if (typeof directOutputText === "string" && directOutputText.trim()) {
    return directOutputText.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const fragments: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];

    for (const entry of content) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      if (typeof (entry as Record<string, unknown>).text === "string") {
        const text = ((entry as Record<string, unknown>).text as string).trim();

        if (text) {
          fragments.push(text);
        }
      }
    }
  }

  return fragments.join("\n").trim();
}

function estimateCostUsd(
  usage: Omit<OpenAIStructuredResponseUsage, "estimatedCostUsd">,
) {
  const {
    openAiUsageCostInputUsdPer1M,
    openAiUsageCostOutputUsdPer1M,
  } = getOpenAIEnv();

  if (
    usage.inputTokens === null
    || usage.outputTokens === null
    || openAiUsageCostInputUsdPer1M === null
    || openAiUsageCostOutputUsdPer1M === null
  ) {
    return null;
  }

  const inputCost = (usage.inputTokens / 1_000_000) * openAiUsageCostInputUsdPer1M;
  const outputCost = (usage.outputTokens / 1_000_000) * openAiUsageCostOutputUsdPer1M;

  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

function extractUsage(payload: Record<string, unknown>): OpenAIStructuredResponseUsage {
  const usage =
    payload.usage && typeof payload.usage === "object"
      ? (payload.usage as Record<string, unknown>)
      : {};

  const inputTokens =
    typeof usage.input_tokens === "number"
      ? usage.input_tokens
      : typeof usage.prompt_tokens === "number"
        ? usage.prompt_tokens
        : null;
  const outputTokens =
    typeof usage.output_tokens === "number"
      ? usage.output_tokens
      : typeof usage.completion_tokens === "number"
        ? usage.completion_tokens
        : null;
  const totalTokens =
    typeof usage.total_tokens === "number"
      ? usage.total_tokens
      : inputTokens !== null && outputTokens !== null
        ? inputTokens + outputTokens
        : null;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: estimateCostUsd({
      inputTokens,
      outputTokens,
      totalTokens,
    }),
  };
}

function buildStructuredResponseBody(input: {
  model?: string;
  schemaName: string;
  schema: JsonSchemaDefinition;
  systemPrompt: string;
  userPrompt: string;
  fileInput?: OpenAIFileInput;
  background?: boolean;
  store?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const { openAiDocumentModel } = getOpenAIEnv();
  const userContent: Array<Record<string, unknown>> = [];

  if (input.fileInput) {
    if (input.fileInput.kind === "pdf") {
      userContent.push({
        type: "input_file",
        file_id: input.fileInput.fileId,
        filename: input.fileInput.filename,
      });
    } else {
      userContent.push({
        type: "input_image",
        file_id: input.fileInput.fileId,
        detail: input.fileInput.detail ?? "high",
      });
    }
  }

  userContent.push({
    type: "input_text",
    text: input.userPrompt,
  });

  const metadata = buildMetadataRecord(input.metadata);

  return {
    model: input.model ?? openAiDocumentModel,
    background: input.background ?? false,
    store: input.store ?? true,
    metadata,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: input.systemPrompt,
          },
        ],
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: input.schemaName,
        schema: input.schema,
        strict: true,
      },
    },
  };
}

function ensureResponseId(payload: Record<string, unknown>) {
  const responseId = payload.id;

  if (typeof responseId !== "string" || !responseId) {
    throw new Error("OpenAI response did not return a valid response id.");
  }

  return responseId;
}

export async function uploadOpenAIFile(input: {
  filename: string;
  mimeType: string;
  bytes: ArrayBuffer | Uint8Array;
  purpose: OpenAIFileUploadPurpose;
}) {
  const formData = new FormData();
  formData.set("purpose", input.purpose);
  formData.set(
    "file",
    new File([toBlobPart(input.bytes, input.mimeType)], input.filename, {
      type: input.mimeType,
    }),
  );

  const payload = await runOpenAIJsonRequest({
    url: "https://api.openai.com/v1/files",
    method: "POST",
    body: formData,
  });
  const fileId = payload.id;

  if (typeof fileId !== "string" || !fileId) {
    throw new Error("OpenAI file upload did not return a valid file id.");
  }

  return {
    fileId,
    purpose: input.purpose,
    rawResponse: payload,
  } satisfies OpenAIFileUploadResult;
}

export async function uploadOpenAIUserDataFile(input: {
  filename: string;
  mimeType: string;
  bytes: ArrayBuffer | Uint8Array;
}) {
  return uploadOpenAIFile({
    ...input,
    purpose: "user_data",
  });
}

export async function uploadOpenAIBatchFile(input: {
  filename: string;
  mimeType: string;
  bytes: ArrayBuffer | Uint8Array;
}) {
  return uploadOpenAIFile({
    ...input,
    purpose: "batch",
  });
}

export async function deleteOpenAIFile(fileId: string) {
  const response = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
    method: "DELETE",
    headers: buildOpenAIHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = typeof response.text === "function"
      ? await response.text()
      : "";
    throw new Error(
      `OpenAI file delete failed (${response.status}): ${text || "Unknown error"}`,
    );
  }
}

export function extractStructuredOutputFromOpenAIResponse<T>(
  payload: Record<string, unknown>,
): OpenAIStructuredResponseResult<T> {
  const rawText = extractResponseText(payload);

  if (!rawText) {
    throw new Error("OpenAI response did not contain structured output text.");
  }

  let parsedOutput: T;

  try {
    parsedOutput = JSON.parse(rawText) as T;
  } catch (error) {
    throw new Error(
      `OpenAI returned non-JSON structured output: ${
        error instanceof Error ? error.message : "Unknown parse error"
      }`,
    );
  }

  return {
    responseId: typeof payload.id === "string" ? payload.id : null,
    output: parsedOutput,
    rawText,
    usage: extractUsage(payload),
    rawResponse: payload,
  };
}

export async function createStructuredOpenAIPipelineRun<T>(input: {
  mode?: "sync" | "background";
  model?: string;
  schemaName: string;
  schema: JsonSchemaDefinition;
  systemPrompt: string;
  userPrompt: string;
  fileInput?: OpenAIFileInput;
  store?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const requestPayload = buildStructuredResponseBody({
    ...input,
    background: input.mode === "background",
    store: input.store ?? true,
  });
  const payload = await runOpenAIJsonRequest({
    url: "https://api.openai.com/v1/responses",
    method: "POST",
    body: JSON.stringify(requestPayload),
    contentType: "application/json",
  });
  const modelCode =
    typeof requestPayload.model === "string"
      ? requestPayload.model
      : null;
  const baseRun: AIPipelineRun<T> = {
    providerCode: "openai",
    modelCode,
    mode: input.mode ?? "sync",
    responseId: typeof payload.id === "string" ? payload.id : null,
    batchId: null,
    status: typeof payload.status === "string" ? payload.status : null,
    output: null,
    rawText: "",
    usage: extractUsage(payload),
    requestPayload: requestPayload as Record<string, unknown>,
    responsePayload: payload,
  };

  if (input.mode === "background") {
    return baseRun;
  }

  const extracted = extractStructuredOutputFromOpenAIResponse<T>(payload);

  return {
    ...baseRun,
    output: extracted.output,
    rawText: extracted.rawText,
    usage: extracted.usage,
  } satisfies AIPipelineRun<T>;
}

export async function retrieveOpenAIPipelineRun(responseId: string) {
  const payload = await runOpenAIJsonRequest({
    url: `https://api.openai.com/v1/responses/${responseId}`,
    method: "GET",
  });

  return {
    providerCode: "openai",
    modelCode: typeof payload.model === "string" ? payload.model : null,
    mode: "background",
    responseId: typeof payload.id === "string" ? payload.id : null,
    batchId: null,
    status: typeof payload.status === "string" ? payload.status : null,
    output: null,
    rawText: extractResponseText(payload),
    usage: extractUsage(payload),
    requestPayload: {},
    responsePayload: payload,
  } satisfies AIPipelineRun<null>;
}

export async function createOpenAIBatchPipelineRun(input: {
  inputFileId: string;
  endpoint?: string;
  completionWindow?: "24h";
  metadata?: Record<string, unknown>;
}) {
  const requestPayload = {
    input_file_id: input.inputFileId,
    endpoint: input.endpoint ?? "/v1/responses",
    completion_window: input.completionWindow ?? "24h",
    metadata: buildMetadataRecord(input.metadata),
  };
  const payload = await runOpenAIJsonRequest({
    url: "https://api.openai.com/v1/batches",
    method: "POST",
    body: JSON.stringify(requestPayload),
    contentType: "application/json",
  });
  const batchId = payload.id;

  if (typeof batchId !== "string" || !batchId) {
    throw new Error("OpenAI batch creation did not return a valid batch id.");
  }

  return {
    providerCode: "openai",
    modelCode: null,
    mode: "batch",
    responseId: null,
    batchId,
    status: typeof payload.status === "string" ? payload.status : null,
    output: null,
    rawText: "",
    usage: {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      estimatedCostUsd: null,
    },
    requestPayload,
    responsePayload: payload,
  } satisfies OpenAIBatchPipelineRun;
}

export async function retrieveOpenAIBatchPipelineRun(batchId: string) {
  const payload = await runOpenAIJsonRequest({
    url: `https://api.openai.com/v1/batches/${batchId}`,
    method: "GET",
  });

  return {
    providerCode: "openai",
    modelCode: null,
    mode: "batch",
    responseId: null,
    batchId,
    status: typeof payload.status === "string" ? payload.status : null,
    output: null,
    rawText: "",
    usage: {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      estimatedCostUsd: null,
    },
    requestPayload: {},
    responsePayload: payload,
  } satisfies OpenAIBatchPipelineRun;
}

export async function createStructuredOpenAIResponse<T>(input: {
  model?: string;
  schemaName: string;
  schema: JsonSchemaDefinition;
  systemPrompt: string;
  userPrompt: string;
  fileInput?: OpenAIFileInput;
  metadata?: Record<string, unknown>;
}) {
  const run = await createStructuredOpenAIPipelineRun<T>({
    ...input,
    mode: "sync",
  });

  if (run.output === null) {
    throw new Error("OpenAI sync pipeline run did not return parsed output.");
  }

  return {
    responseId: run.responseId,
    output: run.output,
    rawText: run.rawText,
    usage: run.usage,
    rawResponse: run.responsePayload,
  } satisfies OpenAIStructuredResponseResult<T>;
}

export async function createBackgroundStructuredOpenAIResponse(input: {
  model?: string;
  schemaName: string;
  schema: JsonSchemaDefinition;
  systemPrompt: string;
  userPrompt: string;
  fileInput?: OpenAIFileInput;
  metadata?: Record<string, unknown>;
}) {
  const run = await createStructuredOpenAIPipelineRun<null>({
    ...input,
    mode: "background",
    store: true,
  });

  return {
    responseId: ensureResponseId(run.responsePayload),
    status: run.status,
    rawResponse: run.responsePayload,
  } satisfies OpenAIBackgroundStructuredResponseResult;
}

export async function retrieveOpenAIResponse(responseId: string) {
  const run = await retrieveOpenAIPipelineRun(responseId);

  return {
    responseId: run.responseId,
    status: run.status,
    usage: run.usage,
    rawResponse: run.responsePayload,
  } satisfies OpenAIRetrievedResponseResult;
}

export function isOpenAIBackgroundResponsePending(status: string | null) {
  return status === "queued" || status === "in_progress";
}

export function getOpenAIBackgroundResponseError(payload: Record<string, unknown>) {
  const error =
    payload.error && typeof payload.error === "object"
      ? (payload.error as Record<string, unknown>)
      : null;

  if (typeof error?.message === "string" && error.message) {
    return error.message;
  }

  const incompleteDetails =
    payload.incomplete_details && typeof payload.incomplete_details === "object"
      ? (payload.incomplete_details as Record<string, unknown>)
      : null;

  if (typeof incompleteDetails?.reason === "string" && incompleteDetails.reason) {
    return incompleteDetails.reason;
  }

  const status = typeof payload.status === "string" ? payload.status : "unknown";

  return `OpenAI background response finished with status ${status}.`;
}
