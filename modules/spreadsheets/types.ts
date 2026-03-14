export type SpreadsheetFileKind =
  | "csv"
  | "tsv"
  | "xlsx"
  | "xls"
  | "unknown";

export type SpreadsheetImportType =
  | "historical_vat_liquidation"
  | "journal_template_import"
  | "chart_of_accounts_import"
  | "mixed"
  | "unsupported";

export type SupportedSpreadsheetSheetImportType = Exclude<
  SpreadsheetImportType,
  "mixed" | "unsupported"
>;

export type SpreadsheetImportRunMode =
  | "interactive"
  | "batch";

export type SpreadsheetImportRunStatus =
  | "preview_ready"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export type SpreadsheetUsedRange = {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
  startCell: string;
  endCell: string;
};

export type SpreadsheetSheetPreview = {
  sheetName: string;
  rowCount: number;
  columnCount: number;
  headerRowIndex: number | null;
  headers: string[];
  rows: string[][];
  previewRows: string[][];
  previewObjects: Array<Record<string, string | null>>;
  usedRange: SpreadsheetUsedRange | null;
  truncatedForAnalysis: boolean;
};

export type SpreadsheetParseResult = {
  fileName: string;
  mimeType: string | null;
  fileKind: SpreadsheetFileKind;
  sizeBytes: number;
  totalSheets: number;
  totalRows: number;
  totalCells: number;
  warnings: string[];
  sheets: SpreadsheetSheetPreview[];
  metadata: {
    parserVariant: string;
  };
};

export type SpreadsheetSheetIntent = {
  sheetName: string;
  intent: SupportedSpreadsheetSheetImportType | "irrelevant";
  confidence: number;
  reasons: string[];
  headerMap: Array<{
    sourceHeader: string;
    targetField: string;
  }>;
};

export type HistoricalVatLiquidationPeriod = {
  periodLabel: string;
  documentCount: number;
  purchaseTaxableBase: number;
  saleTaxableBase: number;
  outputVat: number;
  inputVatCreditable: number;
  inputVatNonDeductible: number;
  importVat: number;
  importVatAdvance: number;
  netVatPayable: number;
  notes: string;
  sourceType: "imported_from_spreadsheet";
};

export type HistoricalVatLiquidationCanonical = {
  importType: "historical_vat_liquidation";
  organizationId: string | null;
  sourceType: "imported_from_spreadsheet";
  periods: HistoricalVatLiquidationPeriod[];
  warnings: string[];
};

export type JournalTemplateImportCanonical = {
  importType: "journal_template_import";
  organizationId: string | null;
  sourceType: "imported_from_spreadsheet";
  templates: Array<{
    templateName: string;
    documentRole: string;
    documentSubtype: string | null;
    operationCategory: string | null;
    conceptName: string | null;
    mainAccountCode: string | null;
    vatAccountCode: string | null;
    counterpartyAccountCode: string | null;
    notes: string | null;
  }>;
  warnings: string[];
};

export type ChartOfAccountsImportCanonical = {
  importType: "chart_of_accounts_import";
  organizationId: string | null;
  sourceType: "imported_from_spreadsheet";
  accounts: Array<{
    code: string;
    name: string;
    accountType: string | null;
    normalSide: string | null;
    isPostable: boolean;
  }>;
  warnings: string[];
};

export type MixedSpreadsheetCanonical = {
  importType: "mixed";
  organizationId: string | null;
  sourceType: "imported_from_spreadsheet";
  sheets: Array<{
    sheetName: string;
    importType: SupportedSpreadsheetSheetImportType;
  }>;
  warnings: string[];
};

export type UnsupportedSpreadsheetCanonical = {
  importType: "unsupported";
  organizationId: string | null;
  sourceType: "imported_from_spreadsheet";
  warnings: string[];
};

export type SpreadsheetCanonicalPayload =
  | HistoricalVatLiquidationCanonical
  | JournalTemplateImportCanonical
  | ChartOfAccountsImportCanonical
  | MixedSpreadsheetCanonical
  | UnsupportedSpreadsheetCanonical;

export type SpreadsheetInterpretationResult = {
  importType: SpreadsheetImportType;
  confidence: number;
  warnings: string[];
  mappingDetected: Record<string, unknown>;
  sheetIntents: SpreadsheetSheetIntent[];
  canonical: SpreadsheetCanonicalPayload;
  providerCode: "heuristic" | "openai";
  modelCode: string | null;
  promptVersion: string;
  schemaVersion: string;
  responseId: string | null;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  estimatedCostUsd: number | null;
};

export type SpreadsheetImportStatusEvent = {
  code: string;
  message: string;
  createdAt: string;
};

export type SpreadsheetImportRunRecord = {
  id: string;
  organizationId: string;
  sourceDocumentId: string | null;
  fileName: string;
  fileKind: SpreadsheetFileKind;
  importType: SpreadsheetImportType;
  runMode: SpreadsheetImportRunMode;
  status: SpreadsheetImportRunStatus;
  providerCode: string | null;
  modelCode: string | null;
  promptVersion: string | null;
  schemaVersion: string | null;
  batchId: string | null;
  responseId: string | null;
  estimatedCostUsd: number | null;
  warnings: string[];
  preview: SpreadsheetParseResult | null;
  result: SpreadsheetInterpretationResult | null;
  detectedMapping: Record<string, unknown>;
  statusEvents: SpreadsheetImportStatusEvent[];
  retryCount: number;
  confirmedAt: string | null;
  confirmedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
