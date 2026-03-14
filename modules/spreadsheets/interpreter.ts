import { getOpenAIModelConfig } from "@/lib/env";
import { createStructuredOpenAIResponse } from "@/lib/llm/openai-responses";
import {
  normalizeTextToken,
} from "@/modules/accounting/normalization";
import type {
  ChartOfAccountsImportCanonical,
  HistoricalVatLiquidationCanonical,
  JournalTemplateImportCanonical,
  SpreadsheetCanonicalPayload,
  SpreadsheetImportType,
  SpreadsheetInterpretationResult,
  SpreadsheetParseResult,
  SpreadsheetSheetIntent,
  SpreadsheetSheetPreview,
  SupportedSpreadsheetSheetImportType,
} from "@/modules/spreadsheets/types";

const SPREADSHEET_PROMPT_VERSION = "spreadsheet_interpreter_v1";
const SPREADSHEET_SCHEMA_VERSION = "spreadsheet_intent_schema_v1";

const spreadsheetInterpretationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["importType", "confidence", "warnings", "sheetIntents"],
  properties: {
    importType: {
      type: "string",
      enum: [
        "historical_vat_liquidation",
        "journal_template_import",
        "chart_of_accounts_import",
        "mixed",
        "unsupported",
      ],
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    warnings: {
      type: "array",
      items: {
        type: "string",
      },
    },
    sheetIntents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sheetName", "intent", "confidence", "reasons", "headerMap"],
        properties: {
          sheetName: {
            type: "string",
          },
          intent: {
            type: "string",
            enum: [
              "historical_vat_liquidation",
              "journal_template_import",
              "chart_of_accounts_import",
              "irrelevant",
            ],
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          reasons: {
            type: "array",
            items: {
              type: "string",
            },
          },
          headerMap: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["sourceHeader", "targetField"],
              properties: {
                sourceHeader: {
                  type: "string",
                },
                targetField: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

const vatFieldMatchers: Record<string, string[]> = {
  periodLabel: ["periodo", "mes", "month", "fecha"],
  documentCount: ["cantidad", "documentos", "docs"],
  purchaseTaxableBase: ["compras", "base compras", "neto compras", "purchase"],
  saleTaxableBase: ["ventas", "base ventas", "neto ventas", "sale"],
  outputVat: ["debito", "iva debito", "output vat"],
  inputVatCreditable: ["credito", "iva compras", "input vat", "credito fiscal"],
  inputVatNonDeductible: ["no deducible", "no descontable"],
  importVat: ["iva importacion", "importacion", "import vat"],
  importVatAdvance: ["anticipo", "anticipos", "iva anticipo"],
  netVatPayable: ["saldo", "neto", "a pagar", "net vat"],
  notes: ["nota", "observacion", "comentario"],
};

const journalFieldMatchers: Record<string, string[]> = {
  templateName: ["plantilla", "template", "nombre"],
  documentRole: ["rol", "tipo documento", "document role"],
  documentSubtype: ["subtipo", "subtype"],
  operationCategory: ["categoria", "operation category"],
  conceptName: ["concepto", "descripcion", "detalle"],
  mainAccountCode: ["cuenta", "account", "cta principal"],
  vatAccountCode: ["cuenta iva", "vat account"],
  counterpartyAccountCode: ["contrapartida", "proveedor", "cliente"],
  notes: ["nota", "comentario", "observacion"],
};

const chartFieldMatchers: Record<string, string[]> = {
  code: ["codigo", "cuenta", "code"],
  name: ["nombre", "descripcion", "name"],
  accountType: ["tipo", "account type", "clase"],
  normalSide: ["saldo normal", "normal side", "naturaleza"],
  isPostable: ["postable", "postable?", "movimiento", "acepta asiento"],
};

function normalizeText(value: string | null | undefined) {
  return normalizeTextToken(value) ?? "";
}

function scoreKeywords(source: string, keywords: string[]) {
  if (!source) {
    return 0;
  }

  return keywords.reduce((score, keyword) => (
    source.includes(normalizeText(keyword))
      ? score + 1
      : score
  ), 0);
}

function parseLocalizedNumber(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const normalized = value
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,(?=\d{2}(?:\D|$))/g, ".")
    .replace(/[^0-9.\-]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBooleanLike(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return ["si", "yes", "true", "1", "x"].includes(normalized);
}

function isSupportedSheetIntent(
  value: SpreadsheetSheetIntent["intent"],
): value is SupportedSpreadsheetSheetImportType {
  return value !== "irrelevant";
}

function isSupportedIntentEntry(
  intent: SpreadsheetSheetIntent,
): intent is SpreadsheetSheetIntent & { intent: SupportedSpreadsheetSheetImportType } {
  return isSupportedSheetIntent(intent.intent);
}

function mapHeaders(headers: string[], matchers: Record<string, string[]>) {
  return headers.flatMap((header) => {
    const normalizedHeader = normalizeText(header);
    const field = Object.entries(matchers).find(([, keywords]) =>
      keywords.some((keyword) => normalizedHeader.includes(normalizeText(keyword))));

    return field
      ? [{
          sourceHeader: header,
          targetField: field[0],
        }]
      : [];
  });
}

function sheetNarrative(sheet: SpreadsheetSheetPreview) {
  const headerText = sheet.headers.map((header) => normalizeText(header)).join(" ");
  const sampleText = sheet.previewRows
    .flat()
    .map((value) => normalizeText(value))
    .join(" ");
  const titleText = normalizeText(sheet.sheetName);

  return [titleText, headerText, sampleText].join(" ").trim();
}

function inferSheetIntent(sheet: SpreadsheetSheetPreview): SpreadsheetSheetIntent {
  const narrative = sheetNarrative(sheet);
  const vatScore = scoreKeywords(narrative, [
    "iva",
    "debito",
    "credito",
    "periodo",
    "ventas",
    "compras",
    "importacion",
    "anticipo",
  ]);
  const journalScore = scoreKeywords(narrative, [
    "asiento",
    "plantilla",
    "debe",
    "haber",
    "concepto",
    "cuenta",
    "categoria",
  ]);
  const chartScore = scoreKeywords(narrative, [
    "plan de cuentas",
    "codigo",
    "cuenta",
    "saldo normal",
    "postable",
    "account type",
  ]);
  const winner = [
    {
      intent: "historical_vat_liquidation" as const,
      score: vatScore,
      headerMap: mapHeaders(sheet.headers, vatFieldMatchers),
      reasons: ["Coinciden headers y vocabulario fiscal de IVA."],
    },
    {
      intent: "journal_template_import" as const,
      score: journalScore,
      headerMap: mapHeaders(sheet.headers, journalFieldMatchers),
      reasons: ["La sheet parece una estructura o plantilla de asientos."],
    },
    {
      intent: "chart_of_accounts_import" as const,
      score: chartScore,
      headerMap: mapHeaders(sheet.headers, chartFieldMatchers),
      reasons: ["La sheet se parece a un plan de cuentas."],
    },
  ].sort((a, b) => b.score - a.score)[0];

  if (winner.score < 2) {
    return {
      sheetName: sheet.sheetName,
      intent: "irrelevant",
      confidence: 0.32,
      reasons: ["La sheet no tiene suficiente vocabulario contable confiable para importarla."],
      headerMap: [],
    };
  }

  return {
    sheetName: sheet.sheetName,
    intent: winner.intent,
    confidence: Math.min(0.97, 0.45 + (winner.score * 0.08)),
    reasons: winner.reasons,
    headerMap: winner.headerMap,
  };
}

function rowsAsObjects(sheet: SpreadsheetSheetPreview) {
  const headerRowIndex = sheet.headerRowIndex ?? 0;
  const headers = sheet.headers;

  return sheet.rows
    .slice(headerRowIndex + (sheet.headers.length > 0 ? 1 : 0))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));
}

function remapRowObject(
  row: Record<string, string | null>,
  headerMap: SpreadsheetSheetIntent["headerMap"],
) {
  return Object.fromEntries(headerMap.map((entry) => [
    entry.targetField,
    row[entry.sourceHeader] ?? null,
  ]));
}

function buildHistoricalVatCanonical(input: {
  organizationId?: string | null;
  sheets: SpreadsheetSheetPreview[];
  intents: SpreadsheetSheetIntent[];
  warnings: string[];
}) {
  const periods = input.intents
    .filter((intent) => intent.intent === "historical_vat_liquidation")
    .flatMap((intent) => {
      const sheet = input.sheets.find((candidate) => candidate.sheetName === intent.sheetName);

      if (!sheet) {
        return [];
      }

      return rowsAsObjects(sheet)
        .map((row) => remapRowObject(row, intent.headerMap))
        .filter((row) => Boolean(row.periodLabel))
        .map((row) => ({
          periodLabel: String(row.periodLabel ?? ""),
          documentCount: Math.round(parseLocalizedNumber(String(row.documentCount ?? "0"))),
          purchaseTaxableBase: parseLocalizedNumber(String(row.purchaseTaxableBase ?? "0")),
          saleTaxableBase: parseLocalizedNumber(String(row.saleTaxableBase ?? "0")),
          outputVat: parseLocalizedNumber(String(row.outputVat ?? "0")),
          inputVatCreditable: parseLocalizedNumber(String(row.inputVatCreditable ?? "0")),
          inputVatNonDeductible: parseLocalizedNumber(String(row.inputVatNonDeductible ?? "0")),
          importVat: parseLocalizedNumber(String(row.importVat ?? "0")),
          importVatAdvance: parseLocalizedNumber(String(row.importVatAdvance ?? "0")),
          netVatPayable: parseLocalizedNumber(String(row.netVatPayable ?? "0")),
          notes: String(row.notes ?? ""),
          sourceType: "imported_from_spreadsheet" as const,
        }));
    });

  return {
    importType: "historical_vat_liquidation",
    organizationId: input.organizationId ?? null,
    sourceType: "imported_from_spreadsheet",
    periods,
    warnings: periods.length === 0
      ? [...input.warnings, "No se detectaron periodos IVA persistibles en la planilla."]
      : input.warnings,
  } satisfies SpreadsheetCanonicalPayload;
}

function buildJournalTemplateCanonical(input: {
  organizationId?: string | null;
  sheets: SpreadsheetSheetPreview[];
  intents: SpreadsheetSheetIntent[];
  warnings: string[];
}) {
  const templates = input.intents
    .filter((intent) => intent.intent === "journal_template_import")
    .flatMap((intent) => {
      const sheet = input.sheets.find((candidate) => candidate.sheetName === intent.sheetName);

      if (!sheet) {
        return [];
      }

      return rowsAsObjects(sheet)
        .map((row) => remapRowObject(row, intent.headerMap))
        .filter((row) => Boolean(row.templateName || row.mainAccountCode || row.conceptName))
        .map((row) => ({
          templateName: String(row.templateName ?? row.conceptName ?? "Plantilla importada"),
          documentRole: String(row.documentRole ?? "purchase"),
          documentSubtype: row.documentSubtype ? String(row.documentSubtype) : null,
          operationCategory: row.operationCategory ? String(row.operationCategory) : null,
          conceptName: row.conceptName ? String(row.conceptName) : null,
          mainAccountCode: row.mainAccountCode ? String(row.mainAccountCode) : null,
          vatAccountCode: row.vatAccountCode ? String(row.vatAccountCode) : null,
          counterpartyAccountCode:
            row.counterpartyAccountCode ? String(row.counterpartyAccountCode) : null,
          notes: row.notes ? String(row.notes) : null,
        }));
    });

  return {
    importType: "journal_template_import",
    organizationId: input.organizationId ?? null,
    sourceType: "imported_from_spreadsheet",
    templates,
    warnings: templates.length === 0
      ? [...input.warnings, "No se detectaron plantillas de asiento persistibles."]
      : input.warnings,
  } satisfies SpreadsheetCanonicalPayload;
}

function buildChartCanonical(input: {
  organizationId?: string | null;
  sheets: SpreadsheetSheetPreview[];
  intents: SpreadsheetSheetIntent[];
  warnings: string[];
}) {
  const accounts = input.intents
    .filter((intent) => intent.intent === "chart_of_accounts_import")
    .flatMap((intent) => {
      const sheet = input.sheets.find((candidate) => candidate.sheetName === intent.sheetName);

      if (!sheet) {
        return [];
      }

      return rowsAsObjects(sheet)
        .map((row) => remapRowObject(row, intent.headerMap))
        .filter((row) => Boolean(row.code || row.name))
        .map((row) => ({
          code: String(row.code ?? ""),
          name: String(row.name ?? "Cuenta importada"),
          accountType: row.accountType ? String(row.accountType) : null,
          normalSide: row.normalSide ? String(row.normalSide) : null,
          isPostable: parseBooleanLike(String(row.isPostable ?? "")),
        }));
    });

  return {
    importType: "chart_of_accounts_import",
    organizationId: input.organizationId ?? null,
    sourceType: "imported_from_spreadsheet",
    accounts,
    warnings: accounts.length === 0
      ? [...input.warnings, "No se detectaron cuentas persistibles en la planilla."]
      : input.warnings,
  } satisfies SpreadsheetCanonicalPayload;
}

function buildCanonicalPayload(input: {
  organizationId?: string | null;
  preview: SpreadsheetParseResult;
  sheetIntents: SpreadsheetSheetIntent[];
  warnings: string[];
  importType: SpreadsheetImportType;
}) {
  if (input.importType === "historical_vat_liquidation") {
    return buildHistoricalVatCanonical({
      organizationId: input.organizationId,
      sheets: input.preview.sheets,
      intents: input.sheetIntents,
      warnings: input.warnings,
    });
  }

  if (input.importType === "journal_template_import") {
    return buildJournalTemplateCanonical({
      organizationId: input.organizationId,
      sheets: input.preview.sheets,
      intents: input.sheetIntents,
      warnings: input.warnings,
    });
  }

  if (input.importType === "chart_of_accounts_import") {
    return buildChartCanonical({
      organizationId: input.organizationId,
      sheets: input.preview.sheets,
      intents: input.sheetIntents,
      warnings: input.warnings,
    });
  }

  if (input.importType === "mixed") {
    return {
      importType: "mixed",
      organizationId: input.organizationId ?? null,
      sourceType: "imported_from_spreadsheet",
      sheets: input.sheetIntents
        .filter(isSupportedIntentEntry)
        .map((intent) => ({
          sheetName: intent.sheetName,
          importType: intent.intent,
        })),
      warnings: input.warnings,
    } satisfies SpreadsheetCanonicalPayload;
  }

  return {
    importType: "unsupported",
    organizationId: input.organizationId ?? null,
    sourceType: "imported_from_spreadsheet",
    warnings: input.warnings,
  } satisfies SpreadsheetCanonicalPayload;
}

export function buildSpreadsheetCanonicalSections(input: {
  organizationId?: string | null;
  preview: SpreadsheetParseResult;
  sheetIntents: SpreadsheetSheetIntent[];
  warnings: string[];
}) {
  const historicalVat = buildHistoricalVatCanonical({
    organizationId: input.organizationId,
    sheets: input.preview.sheets,
    intents: input.sheetIntents,
    warnings: input.warnings,
  });
  const journalTemplates = buildJournalTemplateCanonical({
    organizationId: input.organizationId,
    sheets: input.preview.sheets,
    intents: input.sheetIntents,
    warnings: input.warnings,
  });
  const chartOfAccounts = buildChartCanonical({
    organizationId: input.organizationId,
    sheets: input.preview.sheets,
    intents: input.sheetIntents,
    warnings: input.warnings,
  });

  return {
    historicalVat:
      historicalVat.periods.length > 0
        ? historicalVat
        : null,
    journalTemplates:
      journalTemplates.templates.length > 0
        ? journalTemplates
        : null,
    chartOfAccounts:
      chartOfAccounts.accounts.length > 0
        ? chartOfAccounts
        : null,
  } satisfies {
    historicalVat: HistoricalVatLiquidationCanonical | null;
    journalTemplates: JournalTemplateImportCanonical | null;
    chartOfAccounts: ChartOfAccountsImportCanonical | null;
  };
}

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

function buildHeuristicInterpretation(input: {
  organizationId?: string | null;
  preview: SpreadsheetParseResult;
}) {
  const sheetIntents = input.preview.sheets.map((sheet) => inferSheetIntent(sheet));
  const supportedIntents = sheetIntents.filter(isSupportedIntentEntry);
  const distinctTypes = Array.from(
    new Set(supportedIntents.map((intent) => intent.intent)),
  );
  const warnings = [
    ...input.preview.warnings,
    ...sheetIntents
      .filter((intent) => intent.intent === "irrelevant")
      .map((intent) => `La sheet ${intent.sheetName} se ignoro por baja relevancia.`),
  ];
  const importType: SpreadsheetImportType =
    distinctTypes.length === 0
      ? "unsupported"
      : distinctTypes.length === 1
        ? distinctTypes[0] as SupportedSpreadsheetSheetImportType
        : "mixed";
  const confidence =
    supportedIntents.length === 0
      ? 0.34
      : Math.round(
          (supportedIntents.reduce((sum, intent) => sum + intent.confidence, 0) / supportedIntents.length)
          * 100,
        ) / 100;

  return {
    importType,
    confidence,
    warnings,
    sheetIntents,
    mappingDetected: {
      sheets: sheetIntents.map((intent) => ({
        sheetName: intent.sheetName,
        intent: intent.intent,
        confidence: intent.confidence,
        headerMap: intent.headerMap,
      })),
    },
    canonical: buildCanonicalPayload({
      organizationId: input.organizationId,
      preview: input.preview,
      sheetIntents,
      warnings,
      importType,
    }),
  };
}

function isValidAiInterpretation(value: unknown): value is {
  importType: SpreadsheetImportType;
  confidence: number;
  warnings: string[];
  sheetIntents: SpreadsheetSheetIntent[];
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.importType === "string"
    && typeof candidate.confidence === "number"
    && Array.isArray(candidate.warnings)
    && candidate.warnings.every((warning) => typeof warning === "string")
    && Array.isArray(candidate.sheetIntents)
  );
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

export async function interpretSpreadsheetPreview(input: {
  organizationId?: string | null;
  preview: SpreadsheetParseResult;
  provider?: "auto" | "heuristic" | "openai";
}) {
  const heuristic = buildHeuristicInterpretation({
    organizationId: input.organizationId,
    preview: input.preview,
  });
  const provider = input.provider ?? "auto";

  if (
    provider === "heuristic"
    || !process.env.OPENAI_API_KEY
    || input.preview.sheets.length === 0
  ) {
    return {
      ...heuristic,
      providerCode: "heuristic",
      modelCode: null,
      promptVersion: SPREADSHEET_PROMPT_VERSION,
      schemaVersion: SPREADSHEET_SCHEMA_VERSION,
      responseId: null,
      requestPayload: {
        preview: summarizePreviewForPrompt(input.preview),
      },
      responsePayload: {
        heuristic,
      },
      estimatedCostUsd: null,
    } satisfies SpreadsheetInterpretationResult;
  }

  try {
    const response = await createStructuredOpenAIResponse<{
      importType: SpreadsheetImportType;
      confidence: number;
      warnings: string[];
      sheetIntents: SpreadsheetSheetIntent[];
    }>({
      model: getOpenAIModelConfig().openAiDocumentModel,
      schemaName: "convertilabs_spreadsheet_intent",
      schema: spreadsheetInterpretationJsonSchema,
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(input.preview),
      metadata: {
        prompt_version: SPREADSHEET_PROMPT_VERSION,
        schema_version: SPREADSHEET_SCHEMA_VERSION,
      },
    });

    if (!isValidAiInterpretation(response.output)) {
      throw new Error("La respuesta AI de planillas no coincide con el contrato esperado.");
    }

    const warnings = [
      ...heuristic.warnings,
      ...response.output.warnings,
    ].filter((value, index, array) => value && array.indexOf(value) === index);
    const sheetIntents = response.output.sheetIntents.length > 0
      ? response.output.sheetIntents
      : heuristic.sheetIntents;
    const importType = response.output.importType ?? heuristic.importType;

    return {
      importType,
      confidence: response.output.confidence,
      warnings,
      mappingDetected: {
        sheets: sheetIntents.map((intent) => ({
          sheetName: intent.sheetName,
          intent: intent.intent,
          confidence: intent.confidence,
          headerMap: intent.headerMap,
        })),
      },
      sheetIntents,
      canonical: buildCanonicalPayload({
        organizationId: input.organizationId,
        preview: input.preview,
        sheetIntents,
        warnings,
        importType,
      }),
      providerCode: "openai",
      modelCode: getOpenAIModelConfig().openAiDocumentModel,
      promptVersion: SPREADSHEET_PROMPT_VERSION,
      schemaVersion: SPREADSHEET_SCHEMA_VERSION,
      responseId: response.responseId,
      requestPayload: {
        systemPrompt: buildSystemPrompt(),
        userPrompt: buildUserPrompt(input.preview),
      },
      responsePayload: response.rawResponse,
      estimatedCostUsd: response.usage.estimatedCostUsd,
    } satisfies SpreadsheetInterpretationResult;
  } catch (error) {
    return {
      ...heuristic,
      warnings: [
        ...heuristic.warnings,
        error instanceof Error
          ? `Fallback heuristico: ${error.message}`
          : "Fallback heuristico por error de interpretacion AI.",
      ],
      providerCode: "heuristic",
      modelCode: null,
      promptVersion: SPREADSHEET_PROMPT_VERSION,
      schemaVersion: SPREADSHEET_SCHEMA_VERSION,
      responseId: null,
      requestPayload: {
        preview: summarizePreviewForPrompt(input.preview),
      },
      responsePayload: {
        heuristic,
      },
      estimatedCostUsd: null,
    } satisfies SpreadsheetInterpretationResult;
  }
}

export {
  SPREADSHEET_PROMPT_VERSION,
  SPREADSHEET_SCHEMA_VERSION,
  spreadsheetInterpretationJsonSchema,
};
