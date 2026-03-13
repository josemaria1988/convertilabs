import { createHash } from "crypto";
import {
  createStructuredOpenAIResponse,
} from "@/lib/llm/openai-responses";
import type {
  AccountingAssistantInput,
  AccountingAssistantOutput,
  AccountingAssistantResult,
} from "@/modules/accounting/types";

const accountingAssistantJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "suggestedConceptId",
    "suggestedAccountId",
    "suggestedOperationCategory",
    "linkedOperationType",
    "vatContextHint",
    "confidence",
    "rationale",
    "reviewFlags",
    "shouldBlockConfirmation",
  ],
  properties: {
    suggestedConceptId: {
      type: ["string", "null"],
    },
    suggestedAccountId: {
      type: ["string", "null"],
    },
    suggestedOperationCategory: {
      type: ["string", "null"],
    },
    linkedOperationType: {
      type: ["string", "null"],
    },
    vatContextHint: {
      type: ["string", "null"],
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    rationale: {
      type: "string",
    },
    reviewFlags: {
      type: "array",
      items: {
        type: "string",
      },
    },
    shouldBlockConfirmation: {
      type: "boolean",
    },
  },
} as const;

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isAccountingAssistantOutput(value: unknown): value is AccountingAssistantOutput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const output = value as Record<string, unknown>;

  return (
    isNullableString(output.suggestedConceptId)
    && isNullableString(output.suggestedAccountId)
    && isNullableString(output.suggestedOperationCategory)
    && isNullableString(output.linkedOperationType)
    && isNullableString(output.vatContextHint)
    && typeof output.confidence === "number"
    && typeof output.rationale === "string"
    && Array.isArray(output.reviewFlags)
    && output.reviewFlags.every((flag) => typeof flag === "string")
    && typeof output.shouldBlockConfirmation === "boolean"
  );
}

function buildPromptHash(payload: {
  systemPrompt: string;
  userPrompt: string;
  accountIds: string[];
  conceptIds: string[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        systemPrompt: payload.systemPrompt,
        userPrompt: payload.userPrompt,
        accountIds: payload.accountIds,
        conceptIds: payload.conceptIds,
      }),
    )
    .digest("hex");
}

function buildSystemPrompt(input: AccountingAssistantInput) {
  return [
    "You are the Convertilabs accounting classification assistant.",
    "Use the provided user context to suggest an accounting concept/account only when deterministic rules were insufficient.",
    "You must only choose concept ids and account ids from the allowed lists.",
    "If you are not confident enough, return null ids, review flags, and shouldBlockConfirmation=true.",
    "",
    `Organization: ${input.fiscalProfileSummary.organizationSummary}`,
    `Rule snapshot: ${input.fiscalProfileSummary.ruleSnapshotSummary}`,
  ].join("\n");
}

function buildUserPrompt(input: AccountingAssistantInput) {
  const allowedAccounts = input.allowedAccounts
    .map((account) => `${account.id} | ${account.code} | ${account.name}`)
    .join("\n");
  const allowedConcepts = input.allowedConcepts
    .map((concept) => `${concept.id} | ${concept.code} | ${concept.canonical_name}`)
    .join("\n");
  const priorExamples = input.priorApprovedExamples.length > 0
    ? input.priorApprovedExamples
        .map((example) =>
          `${example.scope} | concept=${example.conceptId ?? "null"} | account=${example.accountCode ?? example.accountId} | ${example.rationale ?? "sin rationale"}`)
        .join("\n")
    : "No prior approved examples.";
  const candidateConcepts = input.candidateConcepts.length > 0
    ? input.candidateConcepts
        .map((concept) => `${concept.id} | ${concept.code} | ${concept.canonicalName}`)
        .join("\n")
    : "No matched concepts.";
  const lineSummary = input.lineItems.length > 0
    ? input.lineItems
        .map((line) =>
          `line ${line.lineNumber}: ${line.rawDescription ?? line.rawCode ?? "sin descripcion"} | matched=${line.matchedConceptName ?? "null"} | confidence=${line.matchConfidence}`)
        .join("\n")
    : "No line items available.";

  return [
    `Document id: ${input.documentId}`,
    `Vendor: ${input.vendor?.vendorName ?? "unresolved"}`,
    `Invoice identity: ${input.invoiceIdentity?.invoiceIdentityKey ?? "none"}`,
    `User context: ${input.userContextText}`,
    `Facts: ${JSON.stringify(input.extractedFacts)}`,
    "Line items:",
    lineSummary,
    "Candidate concepts:",
    candidateConcepts,
    "Allowed concepts:",
    allowedConcepts || "None.",
    "Allowed accounts:",
    allowedAccounts || "None.",
    "Prior approved examples:",
    priorExamples,
  ].join("\n");
}

function validateAssistantOutput(
  input: AccountingAssistantInput,
  output: AccountingAssistantOutput,
) {
  const allowedAccountIds = new Set(input.allowedAccounts.map((account) => account.id));
  const allowedConceptIds = new Set(input.allowedConcepts.map((concept) => concept.id));

  if (output.suggestedAccountId && !allowedAccountIds.has(output.suggestedAccountId)) {
    throw new Error("La IA devolvio una cuenta fuera del set permitido.");
  }

  if (output.suggestedConceptId && !allowedConceptIds.has(output.suggestedConceptId)) {
    throw new Error("La IA devolvio un concepto fuera del set permitido.");
  }
}

function toFailedResult(message: string) {
  return {
    status: "failed",
    shouldBlockConfirmation: true,
    confidence: null,
    rationale: message,
    output: null,
    providerCode: "openai",
    modelCode: process.env.OPENAI_ACCOUNTING_MODEL ?? process.env.OPENAI_DOCUMENT_MODEL ?? "gpt-4o-mini",
    promptHash: null,
    latencyMs: null,
    requestPayload: {},
    responsePayload: {},
    reviewFlags: [message],
  } satisfies AccountingAssistantResult;
}

export async function resolveAccountingAssistantSuggestion(
  input: AccountingAssistantInput | null,
): Promise<AccountingAssistantResult> {
  if (!input || !input.userContextText.trim()) {
    return {
      status: "not_requested",
      shouldBlockConfirmation: false,
      confidence: null,
      rationale: null,
      output: null,
      providerCode: null,
      modelCode: null,
      promptHash: null,
      latencyMs: null,
      requestPayload: {},
      responsePayload: {},
      reviewFlags: [],
    } satisfies AccountingAssistantResult;
  }

  if (input.allowedAccounts.length === 0) {
    return toFailedResult("No hay cuentas postables permitidas para ejecutar la segunda IA.");
  }

  if (!process.env.OPENAI_API_KEY) {
    return toFailedResult("La segunda IA no esta disponible porque falta OPENAI_API_KEY.");
  }

  const systemPrompt = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt(input);
  const modelCode = process.env.OPENAI_ACCOUNTING_MODEL ?? process.env.OPENAI_DOCUMENT_MODEL ?? "gpt-4o-mini";
  const promptHash = buildPromptHash({
    systemPrompt,
    userPrompt,
    accountIds: input.allowedAccounts.map((account) => account.id),
    conceptIds: input.allowedConcepts.map((concept) => concept.id),
  });
  const startedAt = Date.now();

  try {
    const response = await createStructuredOpenAIResponse<AccountingAssistantOutput>({
      model: modelCode,
      schemaName: "convertilabs_accounting_assistant",
      schema: accountingAssistantJsonSchema,
      systemPrompt,
      userPrompt,
    });

    const latencyMs = Date.now() - startedAt;

    if (!isAccountingAssistantOutput(response.output)) {
      throw new Error("La salida estructurada de la segunda IA no coincide con el contrato esperado.");
    }

    validateAssistantOutput(input, response.output);

    return {
      status: "completed",
      shouldBlockConfirmation: response.output.shouldBlockConfirmation,
      confidence: response.output.confidence,
      rationale: response.output.rationale,
      output: response.output,
      providerCode: "openai",
      modelCode,
      promptHash,
      latencyMs,
      requestPayload: {
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
      },
      responsePayload: {
        response_id: response.responseId,
        usage: response.usage,
        raw_text: response.rawText,
        raw_response: response.rawResponse,
      },
      reviewFlags: response.output.reviewFlags,
    } satisfies AccountingAssistantResult;
  } catch (error) {
    return {
      ...toFailedResult(error instanceof Error ? error.message : "La segunda IA fallo."),
      promptHash,
      latencyMs: Date.now() - startedAt,
      requestPayload: {
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
      },
      responsePayload: {},
    } satisfies AccountingAssistantResult;
  }
}
