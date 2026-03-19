import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAIModelConfig } from "@/lib/env";
import { createStructuredOpenAIResponse } from "@/lib/llm/openai-responses";
import {
  buildDraftFieldsPayload,
  normalizeTextToken,
  roundCurrency,
  upsertDocumentAccountingContext,
  type AccountingContextResolution,
} from "@/modules/accounting";
import type {
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentIntakeLineItem,
  DocumentRoleCandidate,
} from "@/modules/ai/document-intake-contract";
import {
  parseSpreadsheetFile,
  type SpreadsheetParseResult,
  type SpreadsheetSheetPreview,
} from "@/modules/spreadsheets";
import {
  isZetaPurchaseLayout,
  normalizeZetaPurchaseRows,
} from "@/modules/documents/zeta-purchase-import";

export type DocumentSpreadsheetLedgerKind = "purchase" | "sale";
export type DocumentSpreadsheetInterpreterProvider = "auto" | "heuristic" | "openai";

export type DocumentSpreadsheetImportRow = {
  rowNumber: number;
  sheetName: string;
  documentRole: DocumentRoleCandidate;
  documentType: string;
  operationCategory: string | null;
  paymentTerms: "cash" | "credit" | "unknown";
  settlementMethod: "cash" | "bank_transfer" | "card" | "check" | "unknown";
  balanceAmount: number | null;
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  lineItems: DocumentIntakeLineItem[];
  extractedText: string;
  warnings: string[];
  sourceReference: string;
  displayLabel: string;
  confidence: number;
  documentFxRate: number | null;
  documentFxRateSource: "document_import" | "bcu" | null;
  documentFxRateDate: string | null;
  sourceRows: Array<{
    rowNumber: number;
    originalRow: Record<string, string | null>;
  }>;
  sourceRowNumbers: number[];
  consolidationKey: string;
  isCreditNote: boolean;
  originalRow: Record<string, string | null>;
};

export type DocumentSpreadsheetExtractionResult = {
  fileName: string;
  ledgerKind: DocumentSpreadsheetLedgerKind;
  sheetName: string;
  rows: DocumentSpreadsheetImportRow[];
  skippedRows: Array<{
    rowNumber: number;
    reason: string;
  }>;
  warnings: string[];
  detectedHeaders: Record<string, string>;
  rawRowsDetected: number;
  consolidatedDocumentsDetected: number;
  duplicateGroupsDetected: number;
  ignoredResidualRows: number;
  blockedGroupsDetected: number;
  usdMissingFxCount: number;
  creditNotesDetected: number;
  minDate: string | null;
  maxDate: string | null;
};

export type DocumentSpreadsheetBatchImportResult = DocumentSpreadsheetExtractionResult & {
  importedCount: number;
  failedRows: Array<{
    rowNumber: number;
    reason: string;
  }>;
  importedDocumentIds: string[];
};

export type DocumentSpreadsheetPreflightResult = {
  fileName: string;
  ledgerKind: DocumentSpreadsheetLedgerKind;
  sheetName: string;
  totalRowsDetected: number;
  importableRowsDetected: number;
  skippedRowsDetected: number;
  warnings: string[];
  detectedHeaders: Record<string, string>;
  rawRowsDetected: number;
  consolidatedDocumentsDetected: number;
  duplicateGroupsDetected: number;
  ignoredResidualRows: number;
  blockedGroupsDetected: number;
  usdMissingFxCount: number;
  creditNotesDetected: number;
  minDate: string | null;
  maxDate: string | null;
};

type ColumnKey =
  | "documentDate"
  | "documentTypeLabel"
  | "documentDescription"
  | "documentNumber"
  | "counterpartyName"
  | "counterpartyTaxId"
  | "currency"
  | "subtotalAmount"
  | "taxAmount"
  | "taxRate"
  | "totalAmount"
  | "balanceAmount"
  | "dueDate"
  | "series"
  | "externalReference"
  | "lineConcept"
  | "fxRate"
  | "vatLabel";

type SheetSelection = {
  sheet: SpreadsheetSheetPreview;
  detectedHeaders: Partial<Record<ColumnKey, string>>;
  score: number;
};

type DocumentSpreadsheetMappingResult = {
  selectedSheet: SheetSelection | null;
  warnings: string[];
  providerCode: "heuristic" | "openai";
  modelCode: string | null;
  confidence: number;
};

type RawDocumentSpreadsheetRow = {
  rowNumber: number;
  typedRow: Record<string, string | null>;
  rawType: string | null;
  rawDescription: string | null;
  counterpartyName: string | null;
  counterpartyTaxId: string | null;
  documentDateRaw: string | null;
  dueDateRaw: string | null;
  documentNumberRaw: string | null;
  seriesRaw: string | null;
  externalReferenceRaw: string | null;
  currencyRaw: string | null;
  subtotalAmountRaw: string | null;
  taxAmountRaw: string | null;
  taxRateRaw: string | null;
  totalAmountRaw: string | null;
  balanceAmountRaw: string | null;
  lineConceptRaw: string | null;
  fxRateRaw: string | null;
  vatLabelRaw: string | null;
};

type ResolvedDocumentSpreadsheetRow = {
  rowNumber: number;
  rawType: string | null;
  rawDescription: string | null;
  counterpartyName: string | null;
  counterpartyTaxId: string | null;
  documentDate: string | null;
  dueDate: string | null;
  documentNumber: string | null;
  series: string | null;
  currencyCode: string | null;
  subtotalAmount: number | null;
  taxAmount: number | null;
  taxRate: number | null;
  totalAmount: number | null;
  balanceAmount: number | null;
  lineConcept: string | null;
  fxRate: number | null;
  vatLabel: string | null;
  warnings: string[];
  confidence: number;
  typedRow: Record<string, string | null>;
};

type DocumentSpreadsheetAiRowNormalization = {
  rowNumber: number;
  importable: boolean;
  skipReason: string | null;
  rawType: string | null;
  rawDescription: string | null;
  counterpartyName: string | null;
  counterpartyTaxId: string | null;
  documentDate: string | null;
  dueDate: string | null;
  documentNumber: string | null;
  series: string | null;
  currencyCode: string | null;
  subtotalAmount: number | null;
  taxAmount: number | null;
  taxRate: number | null;
  totalAmount: number | null;
  balanceAmount: number | null;
  warnings: string[];
  confidence: number;
};

type DocumentSpreadsheetRowsNormalizationResult = {
  rows: DocumentSpreadsheetImportRow[];
  skippedRows: Array<{
    rowNumber: number;
    reason: string;
  }>;
  warnings: string[];
  rawRowsDetected: number;
  consolidatedDocumentsDetected: number;
  duplicateGroupsDetected: number;
  ignoredResidualRows: number;
  blockedGroupsDetected: number;
  usdMissingFxCount: number;
  creditNotesDetected: number;
  minDate: string | null;
  maxDate: string | null;
};

const documentSpreadsheetColumnKeys = [
  "documentDate",
  "documentTypeLabel",
  "documentDescription",
  "documentNumber",
  "counterpartyName",
  "counterpartyTaxId",
  "currency",
  "subtotalAmount",
  "taxAmount",
  "taxRate",
  "totalAmount",
  "balanceAmount",
  "dueDate",
  "series",
  "externalReference",
  "lineConcept",
  "fxRate",
  "vatLabel",
] as const satisfies readonly ColumnKey[];

const DOCUMENT_SPREADSHEET_PROMPT_VERSION = "document_spreadsheet_mapping_v1";
const DOCUMENT_SPREADSHEET_SCHEMA_VERSION = "document_spreadsheet_mapping_schema_v1";
const DOCUMENT_SPREADSHEET_ROWS_PROMPT_VERSION = "document_spreadsheet_rows_v1";
const DOCUMENT_SPREADSHEET_ROWS_SCHEMA_VERSION = "document_spreadsheet_rows_schema_v1";
const DOCUMENT_SPREADSHEET_AI_BATCH_SIZE = 120;
const MISSING_FX_RATE_ERROR_CODE = "MISSING_FX_RATE";
const MISSING_FX_WARNING_PREFIX = `${MISSING_FX_RATE_ERROR_CODE}:`;

function hasMissingFxWarning(warnings: string[]) {
  return warnings.some((warning) => warning.startsWith(MISSING_FX_WARNING_PREFIX));
}

function getMissingFxBlockingReason(warnings: string[]) {
  return warnings.find((warning) => warning.startsWith(MISSING_FX_WARNING_PREFIX)) ?? null;
}

function buildMissingFxWarning(documentDate: string | null | undefined) {
  return documentDate
    ? `${MISSING_FX_WARNING_PREFIX} No encontramos una cotizacion valida para el documento del ${documentDate}.`
    : `${MISSING_FX_WARNING_PREFIX} No encontramos una cotizacion valida para este documento en USD.`;
}

function computeDocumentDateRange(rows: Array<{ facts: DocumentIntakeFactMap }>) {
  const dates = rows
    .map((row) => row.facts.document_date)
    .filter((value): value is string => typeof value === "string" && value.length >= 10)
    .sort((left, right) => left.localeCompare(right));

  return {
    minDate: dates[0] ?? null,
    maxDate: dates.at(-1) ?? null,
  };
}

function buildGenericNormalizationMetrics(input: {
  rows: DocumentSpreadsheetImportRow[];
  usableRawRowsCount: number;
  skippedRowsCount: number;
}) {
  const { minDate, maxDate } = computeDocumentDateRange(input.rows);

  return {
    rawRowsDetected: input.usableRawRowsCount,
    consolidatedDocumentsDetected: input.rows.length,
    duplicateGroupsDetected: Math.max(0, input.usableRawRowsCount - input.rows.length - input.skippedRowsCount),
    ignoredResidualRows: 0,
    blockedGroupsDetected: 0,
    usdMissingFxCount: input.rows.filter((row) => hasMissingFxWarning(row.warnings)).length,
    creditNotesDetected: input.rows.filter((row) => row.isCreditNote).length,
    minDate,
    maxDate,
  };
}

const documentSpreadsheetMappingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sheetName", "confidence", "warnings", "headerMap"],
  properties: {
    sheetName: {
      type: "string",
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
    headerMap: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["targetField", "sourceHeader"],
        properties: {
          targetField: {
            type: "string",
            enum: [...documentSpreadsheetColumnKeys],
          },
          sourceHeader: {
            type: "string",
          },
        },
      },
    },
  },
} as const;

const documentSpreadsheetRowsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["rows", "warnings"],
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "rowNumber",
          "importable",
          "skipReason",
          "rawType",
          "rawDescription",
          "counterpartyName",
          "counterpartyTaxId",
          "documentDate",
          "dueDate",
          "documentNumber",
          "series",
          "currencyCode",
          "subtotalAmount",
          "taxAmount",
          "taxRate",
          "totalAmount",
          "balanceAmount",
          "warnings",
          "confidence",
        ],
        properties: {
          rowNumber: {
            type: "number",
            minimum: 1,
          },
          importable: {
            type: "boolean",
          },
          skipReason: {
            type: ["string", "null"],
          },
          rawType: {
            type: ["string", "null"],
          },
          rawDescription: {
            type: ["string", "null"],
          },
          counterpartyName: {
            type: ["string", "null"],
          },
          counterpartyTaxId: {
            type: ["string", "null"],
          },
          documentDate: {
            type: ["string", "null"],
          },
          dueDate: {
            type: ["string", "null"],
          },
          documentNumber: {
            type: ["string", "null"],
          },
          series: {
            type: ["string", "null"],
          },
          currencyCode: {
            type: ["string", "null"],
          },
          subtotalAmount: {
            type: ["number", "null"],
          },
          taxAmount: {
            type: ["number", "null"],
          },
          taxRate: {
            type: ["number", "null"],
          },
          totalAmount: {
            type: ["number", "null"],
          },
          balanceAmount: {
            type: ["number", "null"],
          },
          warnings: {
            type: "array",
            items: {
              type: "string",
            },
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
        },
      },
    },
    warnings: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },
} as const;

const commonColumnMatchers: Record<Exclude<ColumnKey, "counterpartyName" | "counterpartyTaxId">, string[]> = {
  documentDate: ["fecha comprobante", "fecha documento", "fecha", "emision", "fecha emision"],
  documentTypeLabel: ["tipo comprobante", "tipo documento", "tipo doc", "tipo", "clase"],
  documentDescription: ["comprobante", "detalle", "concepto", "descripcion", "glosa"],
  documentNumber: ["numero comprobante", "nro comprobante", "nro", "numero", "num", "n"],
  currency: ["moneda", "divisa"],
  subtotalAmount: ["subtotal", "neto", "importe neto", "base imponible", "gravado"],
  taxAmount: ["iva total", "importe iva", "monto iva", "iva", "impuesto"],
  taxRate: ["tasa iva", "iva %", "alicuota", "alicuota iva", "tasa"],
  totalAmount: ["importe total", "monto total", "total", "importe", "monto"],
  balanceAmount: ["saldo pendiente", "saldo actual", "saldo"],
  dueDate: ["fecha vencimiento", "vencimiento", "vence"],
  series: ["serie"],
  externalReference: ["referencia", "ref", "id externo", "codigo externo"],
  lineConcept: ["concepto", "rubro", "detalle linea", "cuenta"],
  fxRate: ["cotizacion", "cotizaci?n", "tipo cambio", "tc"],
  vatLabel: ["iva nombre", "nombre iva", "tasa iva nombre", "iva tipo"],
};

const counterpartyHeaderMatchers: Record<DocumentSpreadsheetLedgerKind, Record<"counterpartyName" | "counterpartyTaxId", string[]>> = {
  purchase: {
    counterpartyName: ["proveedor", "emisor", "razon social", "nombre proveedor"],
    counterpartyTaxId: ["rut proveedor", "ruc proveedor", "doc proveedor", "rut emisor", "rut"],
  },
  sale: {
    counterpartyName: ["cliente", "receptor", "razon social cliente", "nombre cliente"],
    counterpartyTaxId: ["rut cliente", "ruc cliente", "doc cliente", "rut receptor", "rut"],
  },
};

function normalizeLooseText(value: string | null | undefined) {
  const normalized = normalizeTextToken(value);

  if (!normalized) {
    return "";
  }

  return normalized.replace(/[^a-z0-9]+/g, " ").trim();
}

function slugifyFragment(value: string) {
  return normalizeLooseText(value).replace(/\s+/g, "-").slice(0, 48) || "fila";
}

function firstNonEmptyString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function parseLocalizedNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,(?=\d{1,4}(?:\D|$))/g, ".")
    .replace(/[^0-9.\-]/g, "");

  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? roundCurrency(parsed) : null;
}

function excelSerialDateToIso(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const wholeDays = Math.floor(value);

  if (wholeDays < 1 || wholeDays > 400_000) {
    return null;
  }

  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + (wholeDays * 86_400_000));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function parseDateValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const normalized = trimmed.replace(/\s+/g, " ");
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(normalized);

  if (ddmmyyyy) {
    const day = Number.parseInt(ddmmyyyy[1], 10);
    const month = Number.parseInt(ddmmyyyy[2], 10);
    const rawYear = Number.parseInt(ddmmyyyy[3], 10);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;

    if (
      year >= 2000
      && month >= 1
      && month <= 12
      && day >= 1
      && day <= 31
    ) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const numericValue = parseLocalizedNumber(normalized);

  if (typeof numericValue === "number") {
    return excelSerialDateToIso(numericValue);
  }

  return null;
}

function normalizeIdentifierValue(value: string | null | undefined) {
  const normalized = firstNonEmptyString(value);

  if (!normalized) {
    return null;
  }

  return normalized.replace(/^(-?\d+)[.,]0+$/, "$1");
}

function parseCurrencyCode(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalizeLooseText(value);

    if (!normalized) {
      continue;
    }

    if (
      normalized.includes("usd")
      || normalized.includes("u s")
      || normalized.includes("us")
      || normalized.includes("dolar")
    ) {
      return "USD";
    }

    if (
      normalized === "$"
      || normalized.includes("uyu")
      || normalized.includes("peso")
      || normalized.includes("moneda nacional")
    ) {
      return "UYU";
    }
  }

  return "UYU";
}

function inferSettlementMethod(value: string | null | undefined) {
  const normalized = normalizeLooseText(value);

  if (!normalized) {
    return "unknown" as const;
  }

  if (normalized.includes("tarjeta") || normalized.includes("card")) {
    return "card" as const;
  }

  if (
    normalized.includes("transferencia")
    || normalized.includes("banco")
    || normalized.includes("transfer")
  ) {
    return "bank_transfer" as const;
  }

  if (normalized.includes("cheque") || normalized.includes("check")) {
    return "check" as const;
  }

  if (
    normalized.includes("contado")
    || normalized.includes("efectivo")
    || normalized.includes("caja")
    || normalized.includes("cash")
  ) {
    return "cash" as const;
  }

  return "unknown" as const;
}

function inferPaymentTerms(balanceAmount: number | null, rawType: string | null) {
  if (typeof balanceAmount === "number") {
    return balanceAmount > 0.009 ? "credit" as const : "cash" as const;
  }

  const normalized = normalizeLooseText(rawType);

  if (normalized.includes("credito") || normalized.includes("cr dito")) {
    return "credit" as const;
  }

  if (normalized.includes("contado") || normalized.includes("cash")) {
    return "cash" as const;
  }

  return "unknown" as const;
}

function inferDocumentType(
  ledgerKind: DocumentSpreadsheetLedgerKind,
  rawType: string | null,
  totalAmount: number | null,
) {
  const normalized = normalizeLooseText(rawType);
  const isCreditNote =
    normalized.includes("nota credito")
    || normalized.includes("nota de credito")
    || (typeof totalAmount === "number" && totalAmount < 0);

  if (ledgerKind === "purchase") {
    return isCreditNote ? "purchase_credit_note" : "purchase_invoice";
  }

  return isCreditNote ? "sale_credit_note" : "sale_invoice";
}

function inferOperationCategory(input: {
  ledgerKind: DocumentSpreadsheetLedgerKind;
  rawType: string | null;
  rawDescription: string | null;
  taxRate: number | null;
}) {
  const normalized = normalizeLooseText([
    input.rawType,
    input.rawDescription,
  ].filter(Boolean).join(" "));

  if (input.ledgerKind === "purchase") {
    if (normalized.includes("combustible") || normalized.includes("nafta") || normalized.includes("gasoil")) {
      return "fuel_and_lubricants";
    }

    if (normalized.includes("flete") || normalized.includes("transporte")) {
      return "transport";
    }

    if (normalized.includes("honorario") || normalized.includes("contador") || normalized.includes("abogado")) {
      return "professional_fees";
    }

    if (normalized.includes("alquiler")) {
      return "rent";
    }

    if (
      normalized.includes("mercader")
      || normalized.includes("reventa")
      || normalized.includes("inventario")
      || normalized.includes("stock")
    ) {
      return "goods_resale";
    }

    if (normalized.includes("servicio")) {
      return "services";
    }

    if (
      normalized.includes("gasto")
      || normalized.includes("papeler")
      || normalized.includes("oficina")
      || normalized.includes("licencia")
      || normalized.includes("admin")
    ) {
      return "admin_expense";
    }

    return null;
  }

  if (typeof input.taxRate === "number") {
    if (Math.abs(input.taxRate - 10) < 0.2) {
      return "taxed_minimum_10";
    }

    if (Math.abs(input.taxRate) < 0.2) {
      return "exempt_or_export";
    }

    if (Math.abs(input.taxRate - 22) < 0.2) {
      return "taxed_basic_22";
    }
  }

  if (normalized.includes("export")) {
    return "exempt_or_export";
  }

  if (normalized.includes("exenta") || normalized.includes("exonerada")) {
    return "exempt_or_export";
  }

  if (normalized.includes("no grav")) {
    return "non_taxed";
  }

  return null;
}

function inferTaxRate(input: {
  taxRate: number | null;
  subtotal: number | null;
  taxAmount: number | null;
}) {
  if (typeof input.taxRate === "number") {
    return roundCurrency(input.taxRate);
  }

  if (
    typeof input.subtotal === "number"
    && input.subtotal !== 0
    && typeof input.taxAmount === "number"
  ) {
    return roundCurrency((input.taxAmount / input.subtotal) * 100);
  }

  return null;
}

function scoreHeaderMatch(header: string, keywords: string[]) {
  const normalizedHeader = normalizeLooseText(header);

  if (!normalizedHeader) {
    return 0;
  }

  let score = 0;

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeLooseText(keyword);

    if (!normalizedKeyword) {
      continue;
    }

    if (normalizedHeader === normalizedKeyword) {
      return 100 + normalizedKeyword.length;
    }

    if (normalizedHeader.includes(normalizedKeyword)) {
      score = Math.max(score, 50 + normalizedKeyword.length);
    }
  }

  return score;
}

function roundConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function scoreSheetSelection(input: {
  sheet: SpreadsheetSheetPreview;
  detectedHeaders: Partial<Record<ColumnKey, string>>;
  ledgerKind: DocumentSpreadsheetLedgerKind;
}) {
  let score = 0;
  const normalizedTitle = normalizeLooseText(input.sheet.sheetName);

  if (input.detectedHeaders.documentDate) {
    score += 3;
  }

  if (input.detectedHeaders.counterpartyName) {
    score += 3;
  }

  if (input.detectedHeaders.totalAmount) {
    score += 3;
  }

  if (input.detectedHeaders.documentNumber) {
    score += 1;
  }

  if (input.detectedHeaders.currency) {
    score += 1;
  }

  if (input.detectedHeaders.taxAmount || input.detectedHeaders.subtotalAmount) {
    score += 1;
  }

  if (
    (input.ledgerKind === "purchase" && (normalizedTitle.includes("compra") || normalizedTitle.includes("proveedor")))
    || (input.ledgerKind === "sale" && (normalizedTitle.includes("venta") || normalizedTitle.includes("cliente")))
  ) {
    score += 2;
  }

  return score;
}

function isColumnKey(value: string): value is ColumnKey {
  return (documentSpreadsheetColumnKeys as readonly string[]).includes(value);
}

function buildDetectedHeadersFromAiHeaderMap(
  sheet: SpreadsheetSheetPreview,
  headerMap: Array<{ targetField: ColumnKey; sourceHeader: string }>,
) {
  const availableHeaders = new Set(sheet.headers);
  const detectedHeaders: Partial<Record<ColumnKey, string>> = {};

  for (const entry of headerMap) {
    if (!availableHeaders.has(entry.sourceHeader)) {
      continue;
    }

    detectedHeaders[entry.targetField] = entry.sourceHeader;
  }

  return detectedHeaders;
}

function summarizePreviewForPrompt(
  preview: SpreadsheetParseResult,
  ledgerKind: DocumentSpreadsheetLedgerKind,
) {
  return {
    fileName: preview.fileName,
    fileKind: preview.fileKind,
    totalSheets: preview.totalSheets,
    totalRows: preview.totalRows,
    warnings: preview.warnings,
    ledgerKind,
    expectedCounterpartyLabel: ledgerKind === "purchase" ? "proveedor" : "cliente",
    sheets: preview.sheets.map((sheet) => ({
      sheetName: sheet.sheetName,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      headers: sheet.headers,
      previewRows: sheet.previewRows.slice(0, 8),
      previewObjects: sheet.previewObjects.slice(0, 6),
      usedRange: sheet.usedRange,
      headerRowIndex: sheet.headerRowIndex,
      truncatedForAnalysis: sheet.truncatedForAnalysis,
    })),
  };
}

function buildDocumentSpreadsheetMappingSystemPrompt(ledgerKind: DocumentSpreadsheetLedgerKind) {
  const side = ledgerKind === "purchase" ? "compras" : "ventas";
  const counterparty = ledgerKind === "purchase" ? "proveedor" : "cliente";

  return [
    "Eres un intérprete de planillas contables para Convertilabs Uruguay.",
    `Debes encontrar la hoja principal de ${side} y mapear los encabezados reales al contrato interno del sistema.`,
    `La contraparte esperada para este caso es ${counterparty}.`,
    "Trabaja con encabezados y filas de ejemplo. No asumas posiciones fijas.",
    "Solo devuelve headers que existan literalmente en la hoja elegida.",
    "Prioriza fecha, contraparte, numero de comprobante, moneda, total y saldo.",
    "Si una columna no existe, simplemente no la mapees.",
  ].join("\n");
}

function buildDocumentSpreadsheetMappingUserPrompt(
  preview: SpreadsheetParseResult,
  ledgerKind: DocumentSpreadsheetLedgerKind,
) {
  return JSON.stringify(summarizePreviewForPrompt(preview, ledgerKind), null, 2);
}

function buildDocumentSpreadsheetRowsSystemPrompt(ledgerKind: DocumentSpreadsheetLedgerKind) {
  const side = ledgerKind === "purchase" ? "compras" : "ventas";
  const counterparty = ledgerKind === "purchase" ? "proveedor" : "cliente";

  return [
    "Eres un normalizador de filas de planillas contables para Convertilabs Uruguay.",
    `Recibiras filas de una hoja de ${side}. La contraparte principal esperada es ${counterparty}.`,
    "Debes decidir si cada fila representa un comprobante importable y convertirla al contrato interno.",
    "Las fechas pueden venir como seriales de Excel, por ejemplo 46097.0, y debes traducirlas a YYYY-MM-DD.",
    "Los montos pueden venir con comas, puntos, simbolos de moneda o formato local.",
    "Los identificadores como numero de comprobante, serie o RUT no deben conservar un sufijo .0 cuando en realidad son enteros.",
    "No inventes datos faltantes. Si la fila esta vacia, es subtotal, encabezado repetido o no alcanza para crear un comprobante, marca importable=false y explica el motivo.",
    "No cambies el rowNumber.",
  ].join("\n");
}

function buildDocumentSpreadsheetRowsUserPrompt(input: {
  fileName: string;
  sheetName: string;
  ledgerKind: DocumentSpreadsheetLedgerKind;
  detectedHeaders: Partial<Record<ColumnKey, string>>;
  rows: RawDocumentSpreadsheetRow[];
}) {
  return JSON.stringify({
    fileName: input.fileName,
    sheetName: input.sheetName,
    ledgerKind: input.ledgerKind,
    expectedCounterpartyLabel: input.ledgerKind === "purchase" ? "proveedor" : "cliente",
    detectedHeaders: input.detectedHeaders,
    rows: input.rows.map((row) => ({
      rowNumber: row.rowNumber,
      cells: Object.fromEntries(
        Object.entries({
          rawType: row.rawType,
          rawDescription: row.rawDescription,
          counterpartyName: row.counterpartyName,
          counterpartyTaxId: row.counterpartyTaxId,
          documentDate: row.documentDateRaw,
          dueDate: row.dueDateRaw,
          documentNumber: row.documentNumberRaw,
          series: row.seriesRaw,
          externalReference: row.externalReferenceRaw,
          currency: row.currencyRaw,
          subtotalAmount: row.subtotalAmountRaw,
          taxAmount: row.taxAmountRaw,
          taxRate: row.taxRateRaw,
          totalAmount: row.totalAmountRaw,
          balanceAmount: row.balanceAmountRaw,
        }).filter(([, value]) => typeof value === "string" && value.trim().length > 0),
      ),
    })),
  }, null, 2);
}

function chooseSheetByName(
  preview: SpreadsheetParseResult,
  sheetName: string,
) {
  const normalizedTarget = normalizeLooseText(sheetName);

  return preview.sheets.find((sheet) => normalizeLooseText(sheet.sheetName) === normalizedTarget) ?? null;
}

async function resolveDocumentSpreadsheetMapping(input: {
  preview: SpreadsheetParseResult;
  ledgerKind: DocumentSpreadsheetLedgerKind;
  provider?: DocumentSpreadsheetInterpreterProvider;
}) {
  const heuristicSheet = chooseBestSheet(input.preview, input.ledgerKind);
  const provider = input.provider ?? "auto";
  const heuristicConfidence = heuristicSheet
    ? roundConfidence(Math.max(0.58, Math.min(0.9, heuristicSheet.score / 12)))
    : 0;

  if (
    provider === "heuristic"
    || !process.env.OPENAI_API_KEY
    || input.preview.sheets.length === 0
  ) {
    return {
      selectedSheet: heuristicSheet,
      warnings: [],
      providerCode: "heuristic",
      modelCode: null,
      confidence: heuristicConfidence,
    } satisfies DocumentSpreadsheetMappingResult;
  }

  try {
    const response = await createStructuredOpenAIResponse<{
      sheetName: string;
      confidence: number;
      warnings: string[];
      headerMap: Array<{
        targetField: ColumnKey;
        sourceHeader: string;
      }>;
    }>({
      model: getOpenAIModelConfig().openAiDocumentModel,
      schemaName: "convertilabs_document_spreadsheet_mapping",
      schema: documentSpreadsheetMappingJsonSchema,
      systemPrompt: buildDocumentSpreadsheetMappingSystemPrompt(input.ledgerKind),
      userPrompt: buildDocumentSpreadsheetMappingUserPrompt(input.preview, input.ledgerKind),
      metadata: {
        prompt_version: DOCUMENT_SPREADSHEET_PROMPT_VERSION,
        schema_version: DOCUMENT_SPREADSHEET_SCHEMA_VERSION,
        ledger_kind: input.ledgerKind,
      },
    });
    const selectedSheet = chooseSheetByName(input.preview, response.output.sheetName);

    if (!selectedSheet) {
      throw new Error("La IA no pudo ubicar una hoja real dentro de la planilla.");
    }

    const normalizedHeaderMap = response.output.headerMap.filter((entry) =>
      typeof entry?.sourceHeader === "string"
      && entry.sourceHeader.trim().length > 0
      && typeof entry?.targetField === "string"
      && isColumnKey(entry.targetField));
    const detectedHeaders = buildDetectedHeadersFromAiHeaderMap(selectedSheet, normalizedHeaderMap);
    const score = scoreSheetSelection({
      sheet: selectedSheet,
      detectedHeaders,
      ledgerKind: input.ledgerKind,
    });

    if (score < 6) {
      throw new Error("La IA no devolvio un mapeo suficientemente utilizable para importar comprobantes.");
    }

    return {
      selectedSheet: {
        sheet: selectedSheet,
        detectedHeaders,
        score,
      },
      warnings: response.output.warnings.filter(Boolean),
      providerCode: "openai",
      modelCode: getOpenAIModelConfig().openAiDocumentModel,
      confidence: roundConfidence(response.output.confidence),
    } satisfies DocumentSpreadsheetMappingResult;
  } catch (error) {
    return {
      selectedSheet: heuristicSheet,
      warnings: [
        error instanceof Error
          ? `Fallback heuristico: ${error.message}`
          : "Fallback heuristico por error de interpretacion AI.",
      ],
      providerCode: "heuristic",
      modelCode: null,
      confidence: heuristicConfidence,
    } satisfies DocumentSpreadsheetMappingResult;
  }
}

function detectSheetHeaders(
  sheet: SpreadsheetSheetPreview,
  ledgerKind: DocumentSpreadsheetLedgerKind,
) {
  const detected: Partial<Record<ColumnKey, string>> = {};
  const takenHeaders = new Set<string>();
  const matcherMap: Record<ColumnKey, string[]> = {
    ...commonColumnMatchers,
    ...counterpartyHeaderMatchers[ledgerKind],
  };

  for (const [key, keywords] of Object.entries(matcherMap) as Array<[ColumnKey, string[]]>) {
    const best = sheet.headers
      .map((header) => ({
        header,
        score: takenHeaders.has(header) ? 0 : scoreHeaderMatch(header, keywords),
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (best && best.score > 0) {
      detected[key] = best.header;
      takenHeaders.add(best.header);
    }
  }

  return detected;
}

function chooseBestSheet(
  preview: SpreadsheetParseResult,
  ledgerKind: DocumentSpreadsheetLedgerKind,
) {
  const sheetScores = preview.sheets
    .filter((sheet) => sheet.previewObjects.length > 0)
    .map((sheet) => {
      const detectedHeaders = detectSheetHeaders(sheet, ledgerKind);
      const score = scoreSheetSelection({
        sheet,
        detectedHeaders,
        ledgerKind,
      });

      return {
        sheet,
        detectedHeaders,
        score,
      } satisfies SheetSelection;
    })
    .sort((a, b) => b.score - a.score);

  return sheetScores[0] ?? null;
}

function normalizeSpreadsheetHeaderCell(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function buildSheetWithDetectedHeaderRow(
  sheet: SpreadsheetSheetPreview,
  ledgerKind: DocumentSpreadsheetLedgerKind,
) {
  const matcherMap: Record<ColumnKey, string[]> = {
    ...commonColumnMatchers,
    ...counterpartyHeaderMatchers[ledgerKind],
  };
  let bestHeaderRowIndex = sheet.headerRowIndex ?? 0;
  let bestScore = -1;

  for (let rowIndex = 0; rowIndex < Math.min(sheet.rows.length, 20); rowIndex += 1) {
    const row = sheet.rows[rowIndex] ?? [];
    const nonEmptyCells = row.filter((value) => normalizeSpreadsheetHeaderCell(value).length > 0);

    if (nonEmptyCells.length < 2) {
      continue;
    }

    const rowScore = nonEmptyCells.reduce((sum, cell) => {
      const bestCellScore = Object.values(matcherMap).reduce(
        (currentBest, keywords) => Math.max(currentBest, scoreHeaderMatch(cell, keywords)),
        0,
      );

      return sum + bestCellScore;
    }, 0);

    if (rowScore > bestScore) {
      bestScore = rowScore;
      bestHeaderRowIndex = rowIndex;
    }
  }

  if (bestScore <= 0 || bestHeaderRowIndex === sheet.headerRowIndex) {
    return sheet;
  }

  const headers = (sheet.rows[bestHeaderRowIndex] ?? []).map((value, index) =>
    normalizeSpreadsheetHeaderCell(value) || `column_${index + 1}`);
  const dataRows = sheet.rows.slice(bestHeaderRowIndex + 1);

  return {
    ...sheet,
    headerRowIndex: bestHeaderRowIndex,
    headers,
    previewRows: dataRows.slice(0, 12),
    previewObjects: dataRows.slice(0, 12).map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null]))),
  } satisfies SpreadsheetSheetPreview;
}

function buildDocumentImportPreview(
  preview: SpreadsheetParseResult,
  ledgerKind: DocumentSpreadsheetLedgerKind,
) {
  return {
    ...preview,
    sheets: preview.sheets.map((sheet) => buildSheetWithDetectedHeaderRow(sheet, ledgerKind)),
  } satisfies SpreadsheetParseResult;
}

function getCellValue(
  row: Record<string, string | null>,
  detectedHeaders: Partial<Record<ColumnKey, string>>,
  key: ColumnKey,
) {
  const header = detectedHeaders[key];
  return header ? row[header] ?? null : null;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function buildRawDocumentSpreadsheetRows(input: {
  selectedSheet: SheetSelection;
}) {
  const dataRows = input.selectedSheet.sheet.headerRowIndex === null
    ? input.selectedSheet.sheet.rows
    : input.selectedSheet.sheet.rows.slice(input.selectedSheet.sheet.headerRowIndex + 1);

  return dataRows.map((rawRowValues, index) => {
    const rowNumber = (input.selectedSheet.sheet.headerRowIndex ?? -1) + index + 2;
    const typedRow = Object.fromEntries(
      input.selectedSheet.sheet.headers.map((header, headerIndex) => [header, rawRowValues[headerIndex] ?? null]),
    ) as Record<string, string | null>;

    return {
      rowNumber,
      typedRow,
      rawType: firstNonEmptyString(
        getCellValue(typedRow, input.selectedSheet.detectedHeaders, "documentTypeLabel"),
        getCellValue(typedRow, input.selectedSheet.detectedHeaders, "documentDescription"),
      ),
      rawDescription: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "documentDescription"),
      counterpartyName: firstNonEmptyString(
        getCellValue(typedRow, input.selectedSheet.detectedHeaders, "counterpartyName"),
      ),
      counterpartyTaxId: firstNonEmptyString(
        getCellValue(typedRow, input.selectedSheet.detectedHeaders, "counterpartyTaxId"),
      ),
      documentDateRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "documentDate"),
      dueDateRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "dueDate"),
      documentNumberRaw: firstNonEmptyString(
        getCellValue(typedRow, input.selectedSheet.detectedHeaders, "documentNumber"),
        getCellValue(typedRow, input.selectedSheet.detectedHeaders, "externalReference"),
      ),
      seriesRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "series"),
      externalReferenceRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "externalReference"),
      currencyRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "currency"),
      subtotalAmountRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "subtotalAmount"),
      taxAmountRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "taxAmount"),
      taxRateRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "taxRate"),
      totalAmountRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "totalAmount"),
      balanceAmountRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "balanceAmount"),
      lineConceptRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "lineConcept"),
      fxRateRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "fxRate"),
      vatLabelRaw: getCellValue(typedRow, input.selectedSheet.detectedHeaders, "vatLabel"),
    } satisfies RawDocumentSpreadsheetRow;
  });
}

function isBlankDocumentSpreadsheetRow(row: RawDocumentSpreadsheetRow) {
  return !firstNonEmptyString(
    row.rawType,
    row.rawDescription,
    row.counterpartyName,
    row.counterpartyTaxId,
    row.documentDateRaw,
    row.dueDateRaw,
    row.documentNumberRaw,
    row.seriesRaw,
    row.externalReferenceRaw,
    row.currencyRaw,
    row.subtotalAmountRaw,
    row.taxAmountRaw,
    row.taxRateRaw,
    row.totalAmountRaw,
    row.balanceAmountRaw,
    row.lineConceptRaw,
    row.fxRateRaw,
    row.vatLabelRaw,
  );
}

function buildEmptyFactMap(): DocumentIntakeFactMap {
  return {
    issuer_name: null,
    issuer_tax_id: null,
    issuer_address_raw: null,
    issuer_department: null,
    issuer_city: null,
    issuer_branch_code: null,
    merchant_category_hints: [],
    location_extraction_confidence: null,
    receiver_name: null,
    receiver_tax_id: null,
    document_number: null,
    series: null,
    currency_code: null,
    document_date: null,
    due_date: null,
    subtotal: null,
    tax_amount: null,
    total_amount: null,
    purchase_category_candidate: null,
    sale_category_candidate: null,
  };
}

function buildRowExtractedText(input: {
  ledgerKind: DocumentSpreadsheetLedgerKind;
  facts: DocumentIntakeFactMap;
  rawType: string | null;
  rawDescription: string | null;
  balanceAmount: number | null;
}) {
  const parts = [
    `Importado desde planilla mensual de ${input.ledgerKind === "purchase" ? "compras" : "ventas"}.`,
    input.facts.document_date ? `Fecha: ${input.facts.document_date}.` : null,
    input.rawType ? `Tipo reportado: ${input.rawType}.` : null,
    input.rawDescription ? `Detalle: ${input.rawDescription}.` : null,
    input.facts.document_number ? `Numero: ${input.facts.document_number}.` : null,
    input.ledgerKind === "purchase"
      ? input.facts.issuer_name ? `Proveedor: ${input.facts.issuer_name}.` : null
      : input.facts.receiver_name ? `Cliente: ${input.facts.receiver_name}.` : null,
    input.facts.currency_code ? `Moneda: ${input.facts.currency_code}.` : null,
    typeof input.facts.total_amount === "number" ? `Total: ${input.facts.total_amount}.` : null,
    typeof input.balanceAmount === "number" ? `Saldo reportado: ${input.balanceAmount}.` : null,
  ];

  return parts.filter(Boolean).join(" ");
}

function buildAccountingContext(input: {
  documentType: string;
  paymentTerms: "cash" | "credit" | "unknown";
  settlementMethod: "cash" | "bank_transfer" | "card" | "check" | "unknown";
  balanceAmount: number | null;
  fileName: string;
  sheetName: string;
  rowNumber: number;
  rowNumbers: number[];
  warnings: string[];
  fxRate: number | null;
  fxRateSource: "document_import" | "bcu" | null;
  fxDate: string | null;
  missingFxRate: boolean;
}): AccountingContextResolution {
  const blockingReasons: string[] = [];
  const reasonCodes: AccountingContextResolution["reasonCodes"] = [];

  if (input.paymentTerms === "unknown") {
    blockingReasons.push("La planilla no permite resolver si este comprobante es contado o credito.");
    reasonCodes.push("payment_terms_missing");
  }

  if (input.missingFxRate) {
    blockingReasons.push(
      getMissingFxBlockingReason(input.warnings)
      ?? "MISSING_FX_RATE: No encontramos una cotizacion valida para este documento en USD.",
    );
    reasonCodes.push("missing_fx_rate");
  }

  return {
    status:
      input.paymentTerms !== "unknown"
      || input.settlementMethod !== "unknown"
      || input.missingFxRate
        ? "provided"
        : "not_required",
    reasonCodes,
    userFreeText: null,
    businessPurposeNote: null,
    structuredContext: {
      source: "spreadsheet_monthly_import",
      payment_terms: input.paymentTerms !== "unknown" ? input.paymentTerms : null,
      settlement_method: input.settlementMethod !== "unknown" ? input.settlementMethod : null,
      settlement_evidence_source: "imported_erp",
      operation_kind: input.documentType,
      imported_balance_amount: input.balanceAmount,
      imported_file_name: input.fileName,
      imported_sheet_name: input.sheetName,
      imported_row_number: input.rowNumber,
      imported_row_numbers: input.rowNumbers,
      imported_warnings: input.warnings,
      document_fx_rate: input.fxRate,
      document_fx_rate_source: input.fxRateSource,
      document_fx_rate_date: input.fxDate,
      document_fx_missing_error_code: input.missingFxRate ? MISSING_FX_RATE_ERROR_CODE : null,
      document_fx_blocking_reason: input.missingFxRate
        ? getMissingFxBlockingReason(input.warnings)
        : null,
    },
    aiRequestPayload: {},
    aiResponse: {},
    providerCode: null,
    modelCode: null,
    promptHash: null,
    requestLatencyMs: null,
    manualOverrideAccountId: null,
    manualOverrideConceptId: null,
    manualOverrideOperationCategory: null,
    learnedConceptName: null,
    operationKind: input.documentType as AccountingContextResolution["operationKind"],
    paymentTerms: input.paymentTerms,
    settlementMethod: input.settlementMethod,
    settlementEvidenceSource: "imported_erp",
    settlementAllocations: [],
    shouldBlockConfirmation: blockingReasons.length > 0,
    canRunAssistant: false,
    blockingReasons,
  };
}

function buildInitialDraftStepRows(input: {
  draftId: string;
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  lineItems: DocumentIntakeLineItem[];
  operationCategory: string | null;
  paymentTerms: "cash" | "credit" | "unknown";
  savedAt: string;
}) {
  const hasAmounts =
    typeof input.facts.subtotal === "number"
    || typeof input.facts.tax_amount === "number"
    || typeof input.facts.total_amount === "number"
    || input.amountBreakdown.length > 0;

  return [
    {
      draft_id: input.draftId,
      step_code: "identity",
      status: "draft_saved",
      last_saved_at: input.savedAt,
      stale_reason: null,
      snapshot_json: {
        issuer_name: input.facts.issuer_name ?? null,
        issuer_tax_id: input.facts.issuer_tax_id ?? null,
        receiver_name: input.facts.receiver_name ?? null,
        receiver_tax_id: input.facts.receiver_tax_id ?? null,
      },
    },
    {
      draft_id: input.draftId,
      step_code: "fields",
      status: "draft_saved",
      last_saved_at: input.savedAt,
      stale_reason: null,
      snapshot_json: {
        document_number: input.facts.document_number ?? null,
        series: input.facts.series ?? null,
        document_date: input.facts.document_date ?? null,
        currency_code: input.facts.currency_code ?? null,
      },
    },
    {
      draft_id: input.draftId,
      step_code: "amounts",
      status: hasAmounts ? "draft_saved" : "not_started",
      last_saved_at: hasAmounts ? input.savedAt : null,
      stale_reason: null,
      snapshot_json: {
        subtotal: input.facts.subtotal ?? null,
        tax_amount: input.facts.tax_amount ?? null,
        total_amount: input.facts.total_amount ?? null,
        amount_breakdown_count: input.amountBreakdown.length,
        line_items_count: input.lineItems.length,
      },
    },
    {
      draft_id: input.draftId,
      step_code: "operation_context",
      status: input.operationCategory ? "draft_saved" : "not_started",
      last_saved_at: input.operationCategory ? input.savedAt : null,
      stale_reason: null,
      snapshot_json: {
        operation_category_candidate: input.operationCategory,
      },
    },
    {
      draft_id: input.draftId,
      step_code: "accounting_context",
      status: input.paymentTerms !== "unknown" ? "draft_saved" : "not_started",
      last_saved_at: input.paymentTerms !== "unknown" ? input.savedAt : null,
      stale_reason: null,
      snapshot_json: {
        payment_terms: input.paymentTerms !== "unknown" ? input.paymentTerms : null,
      },
    },
  ];
}

function buildDisplayLabel(input: {
  ledgerKind: DocumentSpreadsheetLedgerKind;
  counterpartyName: string | null;
  documentNumber: string | null;
  rowNumber: number;
}) {
  const side = input.ledgerKind === "purchase" ? "Compra importada" : "Venta importada";
  const detail = firstNonEmptyString(
    input.counterpartyName,
    input.documentNumber,
    `fila ${input.rowNumber}`,
  );

  return detail ? `${side} - ${detail}` : `${side} - fila ${input.rowNumber}`;
}

function buildDocumentImportRowFromResolvedFields(input: {
  ledgerKind: DocumentSpreadsheetLedgerKind;
  sheetName: string;
  rawRow: RawDocumentSpreadsheetRow;
  resolvedRow: ResolvedDocumentSpreadsheetRow;
}): null
  | { skippedRow: { rowNumber: number; reason: string } }
  | { row: DocumentSpreadsheetImportRow } {
  if (
    !input.resolvedRow.counterpartyName
    && !input.resolvedRow.documentDate
    && input.resolvedRow.totalAmount === null
    && input.resolvedRow.subtotalAmount === null
  ) {
    return null;
  }

  if (!input.resolvedRow.counterpartyName) {
    return {
      skippedRow: {
        rowNumber: input.rawRow.rowNumber,
        reason: "Falta la contraparte principal de la fila.",
      },
    };
  }

  if (!input.resolvedRow.documentDate) {
    return {
      skippedRow: {
        rowNumber: input.rawRow.rowNumber,
        reason: "No pudimos interpretar la fecha del comprobante.",
      },
    };
  }

  if (input.resolvedRow.totalAmount === null && input.resolvedRow.subtotalAmount === null) {
    return {
      skippedRow: {
        rowNumber: input.rawRow.rowNumber,
        reason: "La fila no trae total ni neto importable.",
      },
    };
  }

  const paymentTerms = inferPaymentTerms(input.resolvedRow.balanceAmount, input.resolvedRow.rawType);
  const settlementMethod = paymentTerms === "credit"
    ? "unknown"
    : inferSettlementMethod(input.resolvedRow.rawType);
  const currencyCode = input.resolvedRow.currencyCode ?? parseCurrencyCode(
    input.rawRow.currencyRaw,
    input.resolvedRow.rawType,
    input.resolvedRow.rawDescription,
  );
  const documentType = inferDocumentType(
    input.ledgerKind,
    input.resolvedRow.rawType,
    input.resolvedRow.totalAmount,
  );
  const operationCategory = inferOperationCategory({
    ledgerKind: input.ledgerKind,
    rawType: input.resolvedRow.rawType,
    rawDescription: input.resolvedRow.rawDescription,
    taxRate: input.resolvedRow.taxRate,
  });
  const facts = buildEmptyFactMap();

  if (input.ledgerKind === "purchase") {
    facts.issuer_name = input.resolvedRow.counterpartyName;
    facts.issuer_tax_id = input.resolvedRow.counterpartyTaxId;
  } else {
    facts.receiver_name = input.resolvedRow.counterpartyName;
    facts.receiver_tax_id = input.resolvedRow.counterpartyTaxId;
  }

  facts.document_number = input.resolvedRow.documentNumber;
  facts.series = input.resolvedRow.series;
  facts.currency_code = currencyCode;
  facts.document_date = input.resolvedRow.documentDate;
  facts.due_date = input.resolvedRow.dueDate ?? (paymentTerms === "cash" ? input.resolvedRow.documentDate : null);
  facts.subtotal = input.resolvedRow.subtotalAmount;
  facts.tax_amount = input.resolvedRow.taxAmount;
  facts.total_amount = input.resolvedRow.totalAmount ?? input.resolvedRow.subtotalAmount;
  facts.purchase_category_candidate =
    input.ledgerKind === "purchase" ? operationCategory : null;
  facts.sale_category_candidate =
    input.ledgerKind === "sale" ? operationCategory : null;

  const rowWarnings = [...input.resolvedRow.warnings];

  if (input.resolvedRow.subtotalAmount === null) {
    rowWarnings.push("La fila no trae subtotal/neto separado.");
  }

  if (input.resolvedRow.taxAmount === null) {
    rowWarnings.push("La fila no trae IVA separado.");
  }

  if (paymentTerms === "unknown") {
    rowWarnings.push("La planilla no permite resolver si la operacion es contado o credito.");
  }

  if (paymentTerms === "cash" && settlementMethod === "unknown") {
    rowWarnings.push("La planilla marca la operacion como cancelada, pero no informa el medio real de cobro o pago.");
  }

  if (currencyCode === "USD" && !(typeof input.resolvedRow.fxRate === "number" && input.resolvedRow.fxRate > 0)) {
    rowWarnings.push(buildMissingFxWarning(input.resolvedRow.documentDate));
  }

  const amountLabel =
    typeof input.resolvedRow.taxRate === "number"
      ? `Gravado ${roundCurrency(input.resolvedRow.taxRate)}%`
      : "Importe principal";
  const amountBase = input.resolvedRow.subtotalAmount ?? input.resolvedRow.totalAmount ?? null;
  const amountBreakdown = amountBase === null
    ? []
    : [({
      label: amountLabel,
      amount: amountBase,
      tax_rate: input.resolvedRow.taxRate,
      tax_code: input.resolvedRow.taxAmount !== null ? "iva" : null,
    })] satisfies DocumentIntakeAmountBreakdown[];
  const lineItems = [({
    line_number: 1,
    concept_code: null,
    concept_description: firstNonEmptyString(
      input.resolvedRow.lineConcept,
      input.resolvedRow.rawDescription,
      input.resolvedRow.rawType,
      input.resolvedRow.counterpartyName,
    ),
    quantity: null,
    unit_amount: null,
    net_amount: input.resolvedRow.subtotalAmount,
    tax_rate: input.resolvedRow.taxRate,
    tax_amount: input.resolvedRow.taxAmount,
    total_amount: input.resolvedRow.totalAmount ?? amountBase,
  })] satisfies DocumentIntakeLineItem[];
  const baseConfidence = rowWarnings.length === 0
    ? 0.92
    : rowWarnings.length === 1
      ? 0.82
      : 0.72;
  const confidence = roundConfidence(
    input.resolvedRow.confidence > 0
      ? Math.min(baseConfidence, input.resolvedRow.confidence)
      : baseConfidence,
  );

  return {
    row: {
      rowNumber: input.rawRow.rowNumber,
      sheetName: input.sheetName,
      documentRole: input.ledgerKind,
      documentType,
      operationCategory,
      paymentTerms,
      settlementMethod,
      balanceAmount: input.resolvedRow.balanceAmount,
      facts,
      amountBreakdown,
      lineItems,
      extractedText: buildRowExtractedText({
        ledgerKind: input.ledgerKind,
        facts,
        rawType: input.resolvedRow.rawType,
        rawDescription: input.resolvedRow.rawDescription,
        balanceAmount: input.resolvedRow.balanceAmount,
      }),
      warnings: rowWarnings,
      sourceReference: `${input.sheetName}:fila-${input.rawRow.rowNumber}`,
      displayLabel: buildDisplayLabel({
        ledgerKind: input.ledgerKind,
        counterpartyName: input.resolvedRow.counterpartyName,
        documentNumber: input.resolvedRow.documentNumber,
        rowNumber: input.rawRow.rowNumber,
      }),
      confidence,
      documentFxRate: input.resolvedRow.fxRate,
      documentFxRateSource: input.resolvedRow.fxRate && input.resolvedRow.fxRate > 0 ? "document_import" : null,
      documentFxRateDate: facts.document_date,
      sourceRows: [{
        rowNumber: input.rawRow.rowNumber,
        originalRow: input.rawRow.typedRow,
      }],
      sourceRowNumbers: [input.rawRow.rowNumber],
      consolidationKey: `${input.sheetName}:fila-${input.rawRow.rowNumber}`,
      isCreditNote: documentType === "purchase_credit_note" || documentType === "sale_credit_note",
      originalRow: input.rawRow.typedRow,
    } satisfies DocumentSpreadsheetImportRow,
  };
}

function buildResolvedRowHeuristically(input: {
  rawRow: RawDocumentSpreadsheetRow;
  mappingConfidence: number;
}) {
  let subtotalAmount = parseLocalizedNumber(input.rawRow.subtotalAmountRaw);
  let taxAmount = parseLocalizedNumber(input.rawRow.taxAmountRaw);
  let totalAmount = parseLocalizedNumber(input.rawRow.totalAmountRaw);
  const balanceAmount = parseLocalizedNumber(input.rawRow.balanceAmountRaw);
  const taxRate = inferTaxRate({
    taxRate: parseLocalizedNumber(input.rawRow.taxRateRaw),
    subtotal: subtotalAmount,
    taxAmount,
  });

  if (totalAmount === null && subtotalAmount !== null && taxAmount !== null) {
    totalAmount = roundCurrency(subtotalAmount + taxAmount);
  }

  if (subtotalAmount === null && totalAmount !== null && taxAmount !== null) {
    subtotalAmount = roundCurrency(totalAmount - taxAmount);
  }

  if (taxAmount === null && totalAmount !== null && subtotalAmount !== null) {
    taxAmount = roundCurrency(totalAmount - subtotalAmount);
  }

  return {
    rowNumber: input.rawRow.rowNumber,
    rawType: input.rawRow.rawType,
    rawDescription: input.rawRow.rawDescription,
    counterpartyName: input.rawRow.counterpartyName,
    counterpartyTaxId: normalizeIdentifierValue(input.rawRow.counterpartyTaxId),
    documentDate: parseDateValue(input.rawRow.documentDateRaw),
    dueDate: parseDateValue(input.rawRow.dueDateRaw),
    documentNumber: normalizeIdentifierValue(input.rawRow.documentNumberRaw),
    series: normalizeIdentifierValue(input.rawRow.seriesRaw),
    currencyCode: parseCurrencyCode(
      input.rawRow.currencyRaw,
      input.rawRow.rawType,
      input.rawRow.rawDescription,
    ),
    subtotalAmount,
    taxAmount,
    taxRate,
    totalAmount,
    balanceAmount,
    lineConcept: firstNonEmptyString(input.rawRow.lineConceptRaw),
    fxRate: parseLocalizedNumber(input.rawRow.fxRateRaw),
    vatLabel: firstNonEmptyString(input.rawRow.vatLabelRaw),
    warnings: [],
    confidence: input.mappingConfidence,
    typedRow: input.rawRow.typedRow,
  } satisfies ResolvedDocumentSpreadsheetRow;
}

async function normalizeDocumentSpreadsheetRowsWithOpenAI(input: {
  fileName: string;
  sheetName: string;
  ledgerKind: DocumentSpreadsheetLedgerKind;
  detectedHeaders: Partial<Record<ColumnKey, string>>;
  rawRows: RawDocumentSpreadsheetRow[];
}) {
  const warnings: string[] = [];
  const normalizedRows = new Map<number, DocumentSpreadsheetAiRowNormalization>();

  for (const batch of chunkArray(input.rawRows, DOCUMENT_SPREADSHEET_AI_BATCH_SIZE)) {
    const response = await createStructuredOpenAIResponse<{
      rows: DocumentSpreadsheetAiRowNormalization[];
      warnings: string[];
    }>({
      model: getOpenAIModelConfig().openAiDocumentModel,
      schemaName: "convertilabs_document_spreadsheet_rows",
      schema: documentSpreadsheetRowsJsonSchema,
      systemPrompt: buildDocumentSpreadsheetRowsSystemPrompt(input.ledgerKind),
      userPrompt: buildDocumentSpreadsheetRowsUserPrompt({
        fileName: input.fileName,
        sheetName: input.sheetName,
        ledgerKind: input.ledgerKind,
        detectedHeaders: input.detectedHeaders,
        rows: batch,
      }),
      metadata: {
        prompt_version: DOCUMENT_SPREADSHEET_ROWS_PROMPT_VERSION,
        schema_version: DOCUMENT_SPREADSHEET_ROWS_SCHEMA_VERSION,
        ledger_kind: input.ledgerKind,
        row_count: batch.length,
      },
    });

    warnings.push(...response.output.warnings.filter(Boolean));

    for (const row of response.output.rows) {
      normalizedRows.set(row.rowNumber, row);
    }
  }

  return {
    warnings,
    rows: normalizedRows,
  };
}

async function resolveDocumentSpreadsheetRows(input: {
  fileName: string;
  ledgerKind: DocumentSpreadsheetLedgerKind;
  selectedSheet: SheetSelection;
  provider?: DocumentSpreadsheetInterpreterProvider;
  mappingConfidence: number;
}) {
  const rows: DocumentSpreadsheetImportRow[] = [];
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];
  const warnings: string[] = [];
  const rawRows = buildRawDocumentSpreadsheetRows({
    selectedSheet: input.selectedSheet,
  });
  const usableRawRows = rawRows.filter((row) => !isBlankDocumentSpreadsheetRow(row));

  if (
    input.ledgerKind === "purchase"
    && isZetaPurchaseLayout(input.selectedSheet.detectedHeaders)
  ) {
    const normalized = normalizeZetaPurchaseRows({
      fileName: input.fileName,
      sheetName: input.selectedSheet.sheet.sheetName,
      rawRows: usableRawRows,
    });

    return {
      rows: normalized.rows,
      skippedRows: normalized.skippedRows,
      warnings: [...new Set(normalized.warnings)],
      rawRowsDetected: normalized.rawRowsDetected,
      consolidatedDocumentsDetected: normalized.consolidatedDocumentsDetected,
      duplicateGroupsDetected: normalized.duplicateGroupsDetected,
      ignoredResidualRows: normalized.ignoredResidualRows,
      blockedGroupsDetected: normalized.blockedGroupsDetected,
      usdMissingFxCount: normalized.usdMissingFxCount,
      creditNotesDetected: normalized.creditNotesDetected,
      minDate: normalized.minDate,
      maxDate: normalized.maxDate,
    } satisfies DocumentSpreadsheetRowsNormalizationResult;
  }

  let aiRows = new Map<number, DocumentSpreadsheetAiRowNormalization>();

  if (
    input.provider !== "heuristic"
    && process.env.OPENAI_API_KEY
    && usableRawRows.length > 0
  ) {
    try {
      const aiResult = await normalizeDocumentSpreadsheetRowsWithOpenAI({
        fileName: input.fileName,
        sheetName: input.selectedSheet.sheet.sheetName,
        ledgerKind: input.ledgerKind,
        detectedHeaders: input.selectedSheet.detectedHeaders,
        rawRows: usableRawRows,
      });
      aiRows = aiResult.rows;
      warnings.push(...aiResult.warnings);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Fallback heuristico en normalizacion de filas: ${error.message}`
          : "Fallback heuristico en normalizacion de filas.",
      );
    }
  }

  for (const rawRow of rawRows) {
    if (isBlankDocumentSpreadsheetRow(rawRow)) {
      continue;
    }

    const aiRow = aiRows.get(rawRow.rowNumber);
    const heuristicRow = buildResolvedRowHeuristically({
      rawRow,
      mappingConfidence: input.mappingConfidence,
    });

    if (aiRow && !aiRow.importable) {
      skippedRows.push({
        rowNumber: rawRow.rowNumber,
        reason: aiRow.skipReason ?? "La IA marco la fila como no importable.",
      });
      continue;
    }

    const resolvedRow = aiRow
      ? {
        rowNumber: rawRow.rowNumber,
        rawType: firstNonEmptyString(aiRow.rawType, heuristicRow.rawType),
        rawDescription: firstNonEmptyString(aiRow.rawDescription, heuristicRow.rawDescription),
        counterpartyName: firstNonEmptyString(aiRow.counterpartyName, heuristicRow.counterpartyName),
        counterpartyTaxId: normalizeIdentifierValue(aiRow.counterpartyTaxId ?? heuristicRow.counterpartyTaxId),
        documentDate: parseDateValue(aiRow.documentDate ?? heuristicRow.documentDate),
        dueDate: parseDateValue(aiRow.dueDate ?? heuristicRow.dueDate),
        documentNumber: normalizeIdentifierValue(aiRow.documentNumber ?? heuristicRow.documentNumber),
        series: normalizeIdentifierValue(aiRow.series ?? heuristicRow.series),
        currencyCode: firstNonEmptyString(aiRow.currencyCode)?.toUpperCase() ?? heuristicRow.currencyCode,
        subtotalAmount: aiRow.subtotalAmount ?? heuristicRow.subtotalAmount,
        taxAmount: aiRow.taxAmount ?? heuristicRow.taxAmount,
        taxRate: aiRow.taxRate ?? heuristicRow.taxRate,
        totalAmount: aiRow.totalAmount ?? heuristicRow.totalAmount,
        balanceAmount: aiRow.balanceAmount ?? heuristicRow.balanceAmount,
        lineConcept: heuristicRow.lineConcept,
        fxRate: heuristicRow.fxRate,
        vatLabel: heuristicRow.vatLabel,
        warnings: aiRow.warnings.filter(Boolean),
        confidence: roundConfidence(aiRow.confidence),
        typedRow: rawRow.typedRow,
      } satisfies ResolvedDocumentSpreadsheetRow
      : heuristicRow;

    const built = buildDocumentImportRowFromResolvedFields({
      ledgerKind: input.ledgerKind,
      sheetName: input.selectedSheet.sheet.sheetName,
      rawRow,
      resolvedRow,
    });

    if (!built) {
      continue;
    }

    if ("skippedRow" in built) {
      skippedRows.push(built.skippedRow);
      continue;
    }

    rows.push({
      ...built.row,
      sourceReference: `${input.fileName}:${input.selectedSheet.sheet.sheetName}:fila-${rawRow.rowNumber}`,
    });
  }

  return {
    rows,
    skippedRows,
    warnings,
    ...buildGenericNormalizationMetrics({
      rows,
      usableRawRowsCount: usableRawRows.length,
      skippedRowsCount: skippedRows.length,
    }),
  } satisfies DocumentSpreadsheetRowsNormalizationResult;
}

export async function preflightDocumentSpreadsheetImport(input: {
  fileName: string;
  mimeType: string | null;
  bytes: ArrayBuffer | Uint8Array;
  ledgerKind: DocumentSpreadsheetLedgerKind;
}) {
  const preview = buildDocumentImportPreview(
    parseSpreadsheetFile({
      fileName: input.fileName,
      mimeType: input.mimeType,
      bytes: input.bytes,
      rowLimitForAnalysis: 5000,
    }),
    input.ledgerKind,
  );
  const mapping = await resolveDocumentSpreadsheetMapping({
    preview,
    ledgerKind: input.ledgerKind,
    provider: "heuristic",
  });
  const selectedSheet = mapping.selectedSheet;

  if (!selectedSheet || selectedSheet.score < 6) {
    throw new Error(
      `No encontramos una hoja compatible con ${input.ledgerKind === "purchase" ? "compras" : "ventas"} en la planilla. Revisa que incluya fecha, contraparte y total.`,
    );
  }

  const normalizedRows = await resolveDocumentSpreadsheetRows({
    fileName: input.fileName,
    ledgerKind: input.ledgerKind,
    selectedSheet,
    provider: "heuristic",
    mappingConfidence: mapping.confidence,
  });
  const warnings = [...new Set([
    ...preview.warnings,
    ...mapping.warnings,
    ...normalizedRows.warnings,
  ])];

  if (selectedSheet.sheet.truncatedForAnalysis) {
    warnings.push(
      "La planilla supera el tramo recomendado para este flujo estandar. Divide el archivo y vuelve a intentar.",
    );
  }

  return {
    fileName: input.fileName,
    ledgerKind: input.ledgerKind,
    sheetName: selectedSheet.sheet.sheetName,
    totalRowsDetected: normalizedRows.rawRowsDetected,
    importableRowsDetected: normalizedRows.rows.length,
    skippedRowsDetected: normalizedRows.skippedRows.length,
    warnings,
    detectedHeaders: Object.fromEntries(
      Object.entries(selectedSheet.detectedHeaders)
        .filter(([, value]) => typeof value === "string"),
    ),
    rawRowsDetected: normalizedRows.rawRowsDetected,
    consolidatedDocumentsDetected: normalizedRows.consolidatedDocumentsDetected,
    duplicateGroupsDetected: normalizedRows.duplicateGroupsDetected,
    ignoredResidualRows: normalizedRows.ignoredResidualRows,
    blockedGroupsDetected: normalizedRows.blockedGroupsDetected,
    usdMissingFxCount: normalizedRows.usdMissingFxCount,
    creditNotesDetected: normalizedRows.creditNotesDetected,
    minDate: normalizedRows.minDate,
    maxDate: normalizedRows.maxDate,
  } satisfies DocumentSpreadsheetPreflightResult;
}

export async function extractDocumentSpreadsheetRows(input: {
  fileName: string;
  mimeType: string | null;
  bytes: ArrayBuffer | Uint8Array;
  ledgerKind: DocumentSpreadsheetLedgerKind;
  provider?: DocumentSpreadsheetInterpreterProvider;
}) {
  const preview = buildDocumentImportPreview(
    parseSpreadsheetFile({
      fileName: input.fileName,
      mimeType: input.mimeType,
      bytes: input.bytes,
      rowLimitForAnalysis: 5000,
    }),
    input.ledgerKind,
  );
  const mapping = await resolveDocumentSpreadsheetMapping({
    preview,
    ledgerKind: input.ledgerKind,
    provider: input.provider,
  });
  const selectedSheet = mapping.selectedSheet;

  if (!selectedSheet || selectedSheet.score < 6) {
    throw new Error(
      `No encontramos una hoja compatible con ${input.ledgerKind === "purchase" ? "compras" : "ventas"} en la planilla. Revisa que incluya fecha, contraparte y total.`,
    );
  }

  const warnings = [...new Set([
    ...preview.warnings,
    ...mapping.warnings,
  ])];

  if (selectedSheet.sheet.truncatedForAnalysis) {
    warnings.push(
      "La planilla supero el limite de filas analizadas para una sola corrida. Se importo un tramo amplio, pero conviene dividir periodos muy grandes.",
    );
  }

  if (!selectedSheet.detectedHeaders.taxAmount && !selectedSheet.detectedHeaders.subtotalAmount) {
    warnings.push(
      "La planilla no trae columnas de neto o IVA. Las filas se importan igual, pero el tratamiento fiscal puede requerir revision manual.",
    );
  }
  const normalizedRows = await resolveDocumentSpreadsheetRows({
    fileName: input.fileName,
    ledgerKind: input.ledgerKind,
    selectedSheet,
    provider: input.provider,
    mappingConfidence: mapping.confidence,
  });

  return {
    fileName: input.fileName,
    ledgerKind: input.ledgerKind,
    sheetName: selectedSheet.sheet.sheetName,
    rows: normalizedRows.rows,
    skippedRows: normalizedRows.skippedRows,
    warnings: [...new Set([
      ...warnings,
      ...normalizedRows.warnings,
    ])],
    detectedHeaders: Object.fromEntries(
      Object.entries(selectedSheet.detectedHeaders)
        .filter(([, value]) => typeof value === "string"),
    ),
    rawRowsDetected: normalizedRows.rawRowsDetected,
    consolidatedDocumentsDetected: normalizedRows.consolidatedDocumentsDetected,
    duplicateGroupsDetected: normalizedRows.duplicateGroupsDetected,
    ignoredResidualRows: normalizedRows.ignoredResidualRows,
    blockedGroupsDetected: normalizedRows.blockedGroupsDetected,
    usdMissingFxCount: normalizedRows.usdMissingFxCount,
    creditNotesDetected: normalizedRows.creditNotesDetected,
    minDate: normalizedRows.minDate,
    maxDate: normalizedRows.maxDate,
  } satisfies DocumentSpreadsheetExtractionResult;
}

export async function persistDocumentSpreadsheetImportRow(input: {
  supabase: SupabaseClient;
  organizationId: string;
  actorId: string | null;
  fileName: string;
  row: DocumentSpreadsheetImportRow;
}) {
  const savedAt = new Date().toISOString();
  const syntheticStoragePath = [
    "synthetic",
    input.organizationId,
    "spreadsheet-monthly-import",
    `${savedAt.slice(0, 10)}-${input.row.rowNumber}-${randomUUID()}-${slugifyFragment(input.fileName)}`,
  ].join("/");
  const validationErrors = hasMissingFxWarning(input.row.warnings)
    ? [MISSING_FX_RATE_ERROR_CODE]
    : [];
  const reviewRequired = validationErrors.length > 0;
  const isPostable = validationErrors.length === 0;
  const fxBlockingReason = getMissingFxBlockingReason(input.row.warnings);
  const documentMetadata = {
    synthetic_preview: true,
    source_label: "planilla_mensual",
    spreadsheet_source_file: input.fileName,
    spreadsheet_sheet_name: input.row.sheetName,
    spreadsheet_row_number: input.row.rowNumber,
    spreadsheet_source_rows: input.row.sourceRows,
    spreadsheet_source_row_numbers: input.row.sourceRowNumbers,
    spreadsheet_detected_role: input.row.documentRole,
    spreadsheet_original_row: input.row.originalRow,
    spreadsheet_warnings: input.row.warnings,
    warning_count: input.row.warnings.length,
    review_required: reviewRequired,
    validation_errors: validationErrors,
    is_postable: isPostable,
    fx_status: reviewRequired ? "missing_rate" : input.row.documentFxRate ? "resolved_from_document" : "not_required",
    fx_blocking_reason: fxBlockingReason,
    fx_rate_source: input.row.documentFxRateSource,
    fx_rate_value: input.row.documentFxRate,
    fx_rate_date: input.row.documentFxRateDate,
  };
  const { data: documentRow, error: documentError } = await input.supabase
    .from("documents")
    .insert({
      organization_id: input.organizationId,
      direction: input.row.documentRole,
      document_type: input.row.documentType,
      status: "extracted",
      posting_status: "draft",
      storage_bucket: "documents-private",
      storage_path: syntheticStoragePath,
      original_filename: input.row.displayLabel,
      mime_type: null,
      upload_source: "spreadsheet_batch",
      source_type: "spreadsheet_import",
      source_reference: input.row.sourceReference,
      external_reference: input.row.facts.document_number ?? null,
      uploaded_by: input.actorId,
      document_date: input.row.facts.document_date,
      document_currency_code: input.row.facts.currency_code,
      document_net_amount_original: input.row.facts.subtotal,
      document_tax_amount_original: input.row.facts.tax_amount,
      document_total_amount_original: input.row.facts.total_amount,
      net_amount_uyu: input.row.facts.currency_code === "UYU" ? input.row.facts.subtotal : null,
      tax_amount_uyu: input.row.facts.currency_code === "UYU" ? input.row.facts.tax_amount : null,
      total_amount_uyu: input.row.facts.currency_code === "UYU" ? input.row.facts.total_amount : null,
      metadata: documentMetadata,
      fx_rate_document_value: input.row.documentFxRate,
      fx_rate_document_date: input.row.documentFxRateDate,
      fx_rate_source: input.row.documentFxRateSource ?? (reviewRequired ? "document_default" : null),
      created_at: savedAt,
      updated_at: savedAt,
    })
    .select("id")
    .limit(1)
    .single();

  if (documentError || !documentRow?.id) {
    throw new Error(documentError?.message ?? "No se pudo crear el documento importado desde planilla.");
  }

  const { data: draftRow, error: draftError } = await input.supabase
    .from("document_drafts")
    .insert({
      organization_id: input.organizationId,
      document_id: documentRow.id,
      processing_run_id: null,
      organization_rule_snapshot_id: null,
      revision_number: 1,
      status: "open",
      document_role: input.row.documentRole,
      document_type: input.row.documentType,
      operation_context_json: {
        operation_category_candidate: input.row.operationCategory,
        source_type: "spreadsheet_import",
      },
      intake_context_json: {
        source_type: "spreadsheet_import",
        paymentTerms: input.row.paymentTerms,
        settlementMethodExplicit: input.row.settlementMethod,
        settlementMethodEvidenceText: "Importado desde planilla mensual.",
        transaction_family_resolution: {
          source: "manual_override",
          confidence: input.row.confidence,
          shouldReview: input.row.warnings.length > 0,
          warnings: input.row.warnings,
          evidence: [
            `Filas importadas desde planilla mensual (${input.row.sheetName} / ${input.row.sourceRowNumbers.join(", ")}).`,
          ],
        },
      },
      fields_json: buildDraftFieldsPayload({
        facts: input.row.facts,
        amountBreakdown: input.row.amountBreakdown,
        lineItems: input.row.lineItems,
      }),
      extracted_text: input.row.extractedText,
      warnings_json: input.row.warnings,
      journal_suggestion_json: {},
      tax_treatment_json: {},
      source_confidence: input.row.confidence,
      created_by: input.actorId,
      updated_by: input.actorId,
      created_at: savedAt,
      updated_at: savedAt,
    })
    .select("id")
    .limit(1)
    .single();

  if (draftError || !draftRow?.id) {
    throw new Error(draftError?.message ?? "No se pudo crear el borrador del documento importado.");
  }

  const { error: stepError } = await input.supabase
    .from("document_draft_steps")
    .insert(buildInitialDraftStepRows({
      draftId: draftRow.id,
      facts: input.row.facts,
      amountBreakdown: input.row.amountBreakdown,
      lineItems: input.row.lineItems,
      operationCategory: input.row.operationCategory,
      paymentTerms: input.row.paymentTerms,
      savedAt,
    }));

  if (stepError) {
    throw new Error(stepError.message);
  }

  const { error: revisionError } = await input.supabase
    .from("document_revisions")
    .insert({
      organization_id: input.organizationId,
      document_id: documentRow.id,
      revision_number: 1,
      working_draft_id: draftRow.id,
      status: "open",
      opened_by: input.actorId,
      opened_at: savedAt,
    });

  if (revisionError) {
    throw new Error(revisionError.message);
  }

  await upsertDocumentAccountingContext(input.supabase, {
    organizationId: input.organizationId,
    documentId: documentRow.id,
    draftId: draftRow.id,
    actorId: input.actorId,
    context: buildAccountingContext({
      documentType: input.row.documentType,
      paymentTerms: input.row.paymentTerms,
      settlementMethod: input.row.settlementMethod,
      balanceAmount: input.row.balanceAmount,
      fileName: input.fileName,
      sheetName: input.row.sheetName,
      rowNumber: input.row.rowNumber,
      rowNumbers: input.row.sourceRowNumbers,
      warnings: input.row.warnings,
      fxRate: input.row.documentFxRate,
      fxRateSource: input.row.documentFxRateSource,
      fxDate: input.row.documentFxRateDate,
      missingFxRate: reviewRequired,
    }),
  });

  const { error: updateDocumentError } = await input.supabase
    .from("documents")
    .update({
      current_draft_id: draftRow.id,
      current_processing_run_id: null,
      last_rule_snapshot_id: null,
      last_processed_at: savedAt,
      updated_at: savedAt,
    })
    .eq("id", documentRow.id);

  if (updateDocumentError) {
    throw new Error(updateDocumentError.message);
  }

  return documentRow.id as string;
}

export async function importDocumentsFromSpreadsheet(input: {
  supabase: SupabaseClient;
  organizationId: string;
  actorId: string | null;
  fileName: string;
  mimeType?: string | null;
  bytes: ArrayBuffer | Uint8Array;
  ledgerKind: DocumentSpreadsheetLedgerKind;
  provider?: DocumentSpreadsheetInterpreterProvider;
}) {
  const extracted = await extractDocumentSpreadsheetRows({
    fileName: input.fileName,
    mimeType: input.mimeType ?? null,
    bytes: input.bytes,
    ledgerKind: input.ledgerKind,
    provider: input.provider,
  });

  if (extracted.rows.length === 0) {
    throw new Error("La planilla no dejo filas importables para crear documentos.");
  }

  const importedDocumentIds: string[] = [];
  const failedRows: Array<{ rowNumber: number; reason: string }> = [];

  for (const row of extracted.rows) {
    try {
      const documentId = await persistDocumentSpreadsheetImportRow({
        supabase: input.supabase,
        organizationId: input.organizationId,
        actorId: input.actorId,
        fileName: input.fileName,
        row,
      });
      importedDocumentIds.push(documentId);
    } catch (error) {
      failedRows.push({
        rowNumber: row.rowNumber,
        reason: error instanceof Error ? error.message : "No se pudo importar la fila.",
      });
    }
  }

  return {
    ...extracted,
    importedCount: importedDocumentIds.length,
    failedRows,
    importedDocumentIds,
  } satisfies DocumentSpreadsheetBatchImportResult;
}
