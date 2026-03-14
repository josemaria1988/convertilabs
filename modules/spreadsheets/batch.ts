import "server-only";

import {
  createOpenAIBatchPipelineRun,
  uploadOpenAIBatchFile,
  buildStructuredOpenAIRequestPayload,
} from "@/lib/llm/openai-responses";
import { getOpenAIModelConfig } from "@/lib/env";
import {
  SPREADSHEET_PROMPT_VERSION,
  SPREADSHEET_SCHEMA_VERSION,
  spreadsheetInterpretationJsonSchema,
} from "@/modules/spreadsheets/interpreter";
import type { SpreadsheetParseResult } from "@/modules/spreadsheets/types";

const UTF8_ENCODER = new TextEncoder();

function summarizePreviewForPrompt(preview: SpreadsheetParseResult) {
  return {
    fileName: preview.fileName,
    fileKind: preview.fileKind,
    totalSheets: preview.totalSheets,
    totalRows: preview.totalRows,
    warnings: preview.warnings,
    sheets: preview.sheets.map((sheet) => ({
      sheetName: sheet.sheetName,
      rowCount: sheet.rowCount,
      headers: sheet.headers,
      previewRows: sheet.previewRows.slice(0, 6),
      usedRange: sheet.usedRange,
    })),
  };
}

function buildSystemPrompt() {
  return [
    "You interpret accounting spreadsheets for Convertilabs.",
    "Infer intention from sheet names, headers, repeated patterns, totals, dates, tax rates, and accounting vocabulary.",
    "Do not assume rigid column positions.",
    "Return only supported intents: historical VAT liquidation, journal templates, chart of accounts, mixed, or unsupported.",
  ].join("\n");
}

function buildUserPrompt(preview: SpreadsheetParseResult) {
  return JSON.stringify(summarizePreviewForPrompt(preview), null, 2);
}

export function buildSpreadsheetBatchJsonl(input: {
  previews: Array<{
    customId: string;
    preview: SpreadsheetParseResult;
  }>;
}) {
  const modelCode = getOpenAIModelConfig().openAiDocumentModel;
  const lines = input.previews.map((entry) => JSON.stringify({
    custom_id: entry.customId,
    method: "POST",
    url: "/v1/responses",
    body: buildStructuredOpenAIRequestPayload({
      model: modelCode,
      schemaName: "convertilabs_spreadsheet_intent",
      schema: spreadsheetInterpretationJsonSchema,
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(entry.preview),
      metadata: {
        prompt_version: SPREADSHEET_PROMPT_VERSION,
        schema_version: SPREADSHEET_SCHEMA_VERSION,
        custom_id: entry.customId,
      },
    }),
  }));

  return UTF8_ENCODER.encode(lines.join("\n"));
}

export function estimateSpreadsheetBatchCostUsd(input: {
  previews: Array<{
    preview: SpreadsheetParseResult;
  }>;
}) {
  const approximateInputTokens = input.previews.reduce((sum, entry) => (
    sum + Math.ceil(JSON.stringify(summarizePreviewForPrompt(entry.preview)).length / 4)
  ), 0);
  const approximateOutputTokens = input.previews.length * 600;
  const {
    openAiUsageCostInputUsdPer1M,
    openAiUsageCostOutputUsdPer1M,
  } = getOpenAIModelConfig();

  if (
    openAiUsageCostInputUsdPer1M === null
    || openAiUsageCostOutputUsdPer1M === null
  ) {
    return null;
  }

  const estimate =
    ((approximateInputTokens / 1_000_000) * openAiUsageCostInputUsdPer1M)
    + ((approximateOutputTokens / 1_000_000) * openAiUsageCostOutputUsdPer1M);

  return Math.round(estimate * 1_000_000) / 1_000_000;
}

export async function createSpreadsheetBatchSubmission(input: {
  previews: Array<{
    customId: string;
    preview: SpreadsheetParseResult;
  }>;
  metadata?: Record<string, unknown>;
}) {
  const jsonlBytes = buildSpreadsheetBatchJsonl({
    previews: input.previews,
  });
  const uploadedFile = await uploadOpenAIBatchFile({
    filename: "spreadsheet-imports.jsonl",
    mimeType: "application/jsonl",
    bytes: jsonlBytes,
  });
  const batchRun = await createOpenAIBatchPipelineRun({
    inputFileId: uploadedFile.fileId,
    metadata: input.metadata,
  });

  return {
    batchId: batchRun.batchId,
    status: batchRun.status,
    inputFileId: uploadedFile.fileId,
    estimatedCostUsd: estimateSpreadsheetBatchCostUsd({
      previews: input.previews,
    }),
  };
}
