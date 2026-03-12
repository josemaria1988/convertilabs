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

export type OpenAIStructuredResponseUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type OpenAIStructuredResponseResult<T> = {
  responseId: string | null;
  output: T;
  rawText: string;
  usage: OpenAIStructuredResponseUsage;
  rawResponse: Record<string, unknown>;
};

function buildOpenAIHeaders() {
  const { openAiApiKey } = getOpenAIEnv();

  return {
    Authorization: `Bearer ${openAiApiKey}`,
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

async function parseJsonResponse(response: Response) {
  const payload = (await response.json()) as Record<string, unknown>;

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

    const content = Array.isArray(item.content) ? item.content : [];

    for (const entry of content) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      if (typeof entry.text === "string" && entry.text.trim()) {
        fragments.push(entry.text.trim());
      }
    }
  }

  return fragments.join("\n").trim();
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
  };
}

export async function uploadOpenAIUserDataFile(input: {
  filename: string;
  mimeType: string;
  bytes: ArrayBuffer | Uint8Array;
}) {
  const formData = new FormData();
  formData.set("purpose", "user_data");
  formData.set(
    "file",
    new File([toBlobPart(input.bytes, input.mimeType)], input.filename, {
      type: input.mimeType,
    }),
  );

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: buildOpenAIHeaders(),
    body: formData,
    cache: "no-store",
  });
  const payload = await parseJsonResponse(response);
  const fileId = payload.id;

  if (typeof fileId !== "string" || !fileId) {
    throw new Error("OpenAI file upload did not return a valid file id.");
  }

  return {
    fileId,
    rawResponse: payload,
  };
}

export async function deleteOpenAIFile(fileId: string) {
  const response = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
    method: "DELETE",
    headers: buildOpenAIHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `OpenAI file delete failed (${response.status}): ${text || "Unknown error"}`,
    );
  }
}

export async function createStructuredOpenAIResponse<T>(input: {
  model?: string;
  schemaName: string;
  schema: JsonSchemaDefinition;
  systemPrompt: string;
  userPrompt: string;
  fileInput: OpenAIFileInput;
}) {
  const { openAiDocumentModel } = getOpenAIEnv();

  const userContent: Array<Record<string, unknown>> = [];

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

  userContent.push({
    type: "input_text",
    text: input.userPrompt,
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      ...buildOpenAIHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? openAiDocumentModel,
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
    }),
    cache: "no-store",
  });

  const payload = await parseJsonResponse(response);
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
  } satisfies OpenAIStructuredResponseResult<T>;
}
