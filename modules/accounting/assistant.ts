import { createHash } from "crypto";
import { getOpenAIModelConfig } from "@/lib/env";
import {
  createStructuredOpenAIResponse,
} from "@/lib/llm/openai-responses";
import {
  formatAccountTypeLabel,
  formatDocumentRoleLabel,
  formatRuleScopeLabel,
} from "@/modules/presentation/labels";
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

function formatPromptValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Sin dato";
  }

  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  if (typeof value === "string") {
    return value.trim() || "Sin dato";
  }

  if (Array.isArray(value)) {
    return value.length > 0
      ? value.map((entry) => formatPromptValue(entry)).join(", ")
      : "Sin dato";
  }

  return JSON.stringify(value) ?? "Sin dato";
}

function formatConfidencePercentage(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Sin dato";
  }

  return `${Math.round(value * 100)}%`;
}

function formatVendorResolutionStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "matched":
      return "Resuelto";
    case "unresolved":
      return "Sin resolver";
    case "ambiguous":
      return "Ambiguo";
    default:
      return value ? value.replace(/_/g, " ") : "Sin dato";
  }
}

function formatVendorMatchStrategyLabel(value: string | null | undefined) {
  switch (value) {
    case "tax_id":
      return "RUT";
    case "alias":
      return "Alias";
    case "name":
      return "Nombre";
    case "none":
      return "Sin match";
    case "ambiguous":
      return "Ambiguo";
    default:
      return value ? value.replace(/_/g, " ") : "Sin dato";
  }
}

function formatDuplicateStatusPromptLabel(value: string | null | undefined) {
  switch (value) {
    case "clear":
      return "Sin duplicado";
    case "suspected_duplicate":
      return "Duplicado sospechoso";
    case "confirmed_duplicate":
      return "Duplicado confirmado";
    case "false_positive":
      return "Falso positivo";
    case "justified_non_duplicate":
      return "Duplicado justificado como no valido";
    default:
      return value ? value.replace(/_/g, " ") : "Sin dato";
  }
}

function formatConceptMatchStrategyLabel(value: string | null | undefined) {
  switch (value) {
    case "vendor_alias_code":
      return "Alias de proveedor por codigo";
    case "vendor_alias_description":
      return "Alias de proveedor por descripcion";
    case "organization_alias_code":
      return "Alias de organizacion por codigo";
    case "organization_alias_description":
      return "Alias de organizacion por descripcion";
    case "semantic_similarity":
      return "Similitud semantica";
    case "fallback_amount_breakdown":
      return "Fallback por desglose de montos";
    case "unmatched":
      return "Sin match";
    default:
      return value ? value.replace(/_/g, " ") : "Sin dato";
  }
}

function formatExtractedFacts(input: AccountingAssistantInput["extractedFacts"]) {
  const entries: Array<[string, unknown]> = [
    ["Emisor", input.issuer_name],
    ["RUT emisor", input.issuer_tax_id],
    ["Direccion emisor", input.issuer_address_raw],
    ["Departamento emisor", input.issuer_department],
    ["Ciudad emisor", input.issuer_city],
    ["Sucursal emisor", input.issuer_branch_code],
    ["Rubros sugeridos", input.merchant_category_hints],
    ["Confianza de ubicacion", formatConfidencePercentage(input.location_extraction_confidence)],
    ["Receptor", input.receiver_name],
    ["RUT receptor", input.receiver_tax_id],
    ["Numero de documento", input.document_number],
    ["Serie", input.series],
    ["Moneda", input.currency_code],
    ["Fecha del documento", input.document_date],
    ["Fecha de vencimiento", input.due_date],
    ["Subtotal", input.subtotal],
    ["Impuestos", input.tax_amount],
    ["Total", input.total_amount],
    ["Categoria sugerida de compra", input.purchase_category_candidate],
    ["Categoria sugerida de venta", input.sale_category_candidate],
  ];

  return entries
    .map(([label, value]) => `- ${label}: ${formatPromptValue(value)}`)
    .join("\n");
}

function formatVendorSummary(input: AccountingAssistantInput["vendor"]) {
  if (!input) {
    return "Sin proveedor resuelto.";
  }

  return [
    `Estado: ${formatVendorResolutionStatusLabel(input.status)}`,
    `Proveedor: ${formatPromptValue(input.vendorName)}`,
    `RUT normalizado: ${formatPromptValue(input.normalizedTaxId)}`,
    `Nombre normalizado: ${formatPromptValue(input.normalizedName)}`,
    `Estrategia de match: ${formatVendorMatchStrategyLabel(input.matchStrategy)}`,
    `Cuenta default: ${formatPromptValue(input.defaultAccountId)}`,
    `Categoria operativa default: ${formatPromptValue(input.defaultOperationCategory)}`,
  ].join(" | ");
}

function formatInvoiceIdentitySummary(input: AccountingAssistantInput["invoiceIdentity"]) {
  if (!input) {
    return "Sin identidad de factura resuelta.";
  }

  return [
    `Clave: ${formatPromptValue(input.invoiceIdentityKey)}`,
    `Documento: ${formatPromptValue(input.documentNumberNormalized)}`,
    `Fecha: ${formatPromptValue(input.documentDate)}`,
    `Moneda: ${formatPromptValue(input.currencyCode)}`,
    `Total: ${formatPromptValue(input.totalAmount)}`,
    `Estado de duplicado: ${formatDuplicateStatusPromptLabel(input.duplicateStatus)}`,
    `Motivo: ${formatPromptValue(input.duplicateReason)}`,
  ].join(" | ");
}

function formatAllowedTargets(input: AccountingAssistantInput) {
  const allowedTargets = ((input.allowedTargets ?? []).length > 0
    ? input.allowedTargets ?? []
    : input.allowedAccounts ?? []);

  if (allowedTargets.length === 0) {
    return "No hay cuentas contables permitidas.";
  }

  return allowedTargets
    .map((account) => (
      `- ${account.id} | ${account.code} | ${account.name} | tipo=${formatAccountTypeLabel(account.account_type)} | provisional=${account.is_provisional ? "Si" : "No"}`
    ))
    .join("\n");
}

function formatAllowedConcepts(input: AccountingAssistantInput) {
  if (input.allowedConcepts.length === 0) {
    return "No hay conceptos permitidos.";
  }

  return input.allowedConcepts
    .map((concept) => (
      `- ${concept.id} | ${concept.code} | ${concept.canonical_name} | rol=${formatDocumentRoleLabel(concept.document_role)} | cuenta default=${formatPromptValue(concept.default_account_id)} | categoria default=${formatPromptValue(concept.default_operation_category)}`
    ))
    .join("\n");
}

function formatCandidateConcepts(input: AccountingAssistantInput) {
  if (input.candidateConcepts.length === 0) {
    return "No hubo conceptos candidatos.";
  }

  return input.candidateConcepts
    .map((concept) => (
      `- ${concept.id} | ${concept.code} | ${concept.canonicalName} | rol=${formatDocumentRoleLabel(concept.documentRole)} | cuenta default=${formatPromptValue(concept.defaultAccountId)} | categoria default=${formatPromptValue(concept.defaultOperationCategory)}`
    ))
    .join("\n");
}

function formatPriorExamples(input: AccountingAssistantInput) {
  if (input.priorApprovedExamples.length === 0) {
    return "No hay ejemplos aprobados previamente.";
  }

  return input.priorApprovedExamples
    .map((example) => (
      `- ${formatRuleScopeLabel(example.scope)} | concepto=${formatPromptValue(example.conceptId)} | cuenta=${formatPromptValue(example.accountCode ?? example.accountId)} | justificacion=${formatPromptValue(example.rationale)}`
    ))
    .join("\n");
}

function formatLineItems(input: AccountingAssistantInput) {
  if (input.lineItems.length === 0) {
    return "No hay lineas del documento disponibles.";
  }

  return input.lineItems
    .map((line) => (
      `- Linea ${line.lineNumber}: ${formatPromptValue(line.rawDescription ?? line.rawCode)} | concepto detectado=${formatPromptValue(line.matchedConceptName)} | estrategia=${formatConceptMatchStrategyLabel(line.matchStrategy)} | confianza=${formatConfidencePercentage(line.matchConfidence)}`
    ))
    .join("\n");
}

function buildSystemPrompt(input: AccountingAssistantInput) {
  return [
    "Sos el asistente de clasificacion contable de Convertilabs.",
    "Usa el contexto del documento solo para sugerir concepto y cuenta cuando las reglas deterministicas no alcancen.",
    "Debes elegir suggestedConceptId y suggestedAccountId unicamente desde las listas permitidas.",
    "Si la confianza no alcanza, devuelve ids nulos, reviewFlags claros en espanol y shouldBlockConfirmation=true.",
    "La rationale debe estar en espanol, ser breve y explicar por que sugeris o bloqueas.",
    "No inventes cuentas, conceptos ni categorias operativas.",
    "",
    `Resumen de organizacion: ${input.fiscalProfileSummary.organizationSummary}`,
    `Resumen de snapshot normativo: ${input.fiscalProfileSummary.ruleSnapshotSummary}`,
  ].join("\n");
}

function buildUserPrompt(input: AccountingAssistantInput) {
  return [
    `Documento: ${input.documentId}`,
    `Proveedor resuelto: ${formatVendorSummary(input.vendor)}`,
    `Identidad de factura: ${formatInvoiceIdentitySummary(input.invoiceIdentity)}`,
    `Contexto del usuario: ${formatPromptValue(input.userContextText)}`,
    "",
    "Hechos extraidos:",
    formatExtractedFacts(input.extractedFacts),
    "",
    "Lineas del documento:",
    formatLineItems(input),
    "",
    "Conceptos candidatos:",
    formatCandidateConcepts(input),
    "",
    "Conceptos permitidos:",
    formatAllowedConcepts(input),
    "",
    "Cuentas permitidas:",
    formatAllowedTargets(input),
    "",
    "Ejemplos aprobados previamente:",
    formatPriorExamples(input),
  ].join("\n");
}

function validateAssistantOutput(
  input: AccountingAssistantInput,
  output: AccountingAssistantOutput,
) {
  const allowedTargets = (input.allowedTargets ?? []).length > 0
    ? input.allowedTargets ?? []
    : input.allowedAccounts ?? [];
  const allowedAccountIds = new Set(allowedTargets.map((account) => account.id));
  const allowedConceptIds = new Set(input.allowedConcepts.map((concept) => concept.id));

  if (output.suggestedAccountId && !allowedAccountIds.has(output.suggestedAccountId)) {
    throw new Error("La IA devolvio una cuenta fuera del set permitido.");
  }

  if (output.suggestedConceptId && !allowedConceptIds.has(output.suggestedConceptId)) {
    throw new Error("La IA devolvio un concepto fuera del set permitido.");
  }
}

function toFailedResult(message: string) {
  const { openAiAccountingModel } = getOpenAIModelConfig();

  return {
    status: "failed",
    shouldBlockConfirmation: true,
    confidence: null,
    rationale: message,
    output: null,
    providerCode: "openai",
    modelCode: openAiAccountingModel,
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

  const allowedTargets = (input.allowedTargets ?? []).length > 0
    ? input.allowedTargets ?? []
    : input.allowedAccounts ?? [];

  if (allowedTargets.length === 0) {
    return toFailedResult("No hay cuentas postables permitidas para ejecutar la segunda IA.");
  }

  if (!process.env.OPENAI_API_KEY) {
    return toFailedResult("La segunda IA no esta disponible porque falta OPENAI_API_KEY.");
  }

  const systemPrompt = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt(input);
  const { openAiAccountingModel } = getOpenAIModelConfig();
  const modelCode = openAiAccountingModel;
  const promptHash = buildPromptHash({
    systemPrompt,
    userPrompt,
    accountIds: allowedTargets.map((account) => account.id),
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
