import type { ExportWorkbookSheet } from "@/modules/exports/types";
import type { AccountingExportLayoutCode } from "@/modules/exports/external-system-layouts";

export type AccountingExportScope =
  | "posted_provisional"
  | "posted_final"
  | "all_posted";

export type AccountingExportRow = {
  entryDate: string;
  reference: string;
  description: string | null;
  documentFilename: string | null;
  documentPostingStatus: string | null;
  postingMode: string | null;
  accountCode: string;
  externalAccountCode: string | null;
  accountName: string;
  debit: number;
  credit: number;
  originalCurrencyCode: string | null;
  originalAmount: number | null;
  functionalCurrencyCode: string | null;
  functionalAmountUyu: number | null;
  fxRateApplied: number | null;
  taxProfileHint: string | null;
  accountIsProvisional: boolean;
};

export type AccountingExportDataset = {
  organizationId: string;
  organizationName: string;
  periodLabel: string;
  scope: AccountingExportScope;
  rows: AccountingExportRow[];
  recategorizationQueue: Array<{
    documentId: string;
    documentFilename: string;
    documentDate: string | null;
    postingStatus: string | null;
  }>;
  dgiDifferences: Array<{
    bucketCode: string;
    label: string;
    differenceStatus: string;
    deltaNetAmountUyu: number;
    deltaTaxAmountUyu: number;
    notes: string | null;
  }>;
  warnings: string[];
};

function escapeCsvCell(value: string | number | boolean | null) {
  const stringValue =
    value === null
      ? ""
      : typeof value === "boolean"
        ? (value ? "true" : "false")
        : String(value);

  if (!/[",\r\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, "\"\"")}"`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function inferCellType(value: string | number | null) {
  return typeof value === "number" ? "Number" : "String";
}

function renderCell(value: string | number | null) {
  const normalized = value === null ? "" : String(value);
  return `<Cell><Data ss:Type="${inferCellType(value)}">${escapeXml(normalized)}</Data></Cell>`;
}

function renderSheet(sheet: ExportWorkbookSheet) {
  const rows = sheet.rows
    .map((row) => `<Row>${row.map((cell) => renderCell(cell)).join("")}</Row>`)
    .join("");

  return `<Worksheet ss:Name="${escapeXml(sheet.name)}"><Table>${rows}</Table></Worksheet>`;
}

export function buildAccountingExportCsv(dataset: AccountingExportDataset) {
  const header = [
    "entry_date",
    "reference",
    "description",
    "document_filename",
    "document_posting_status",
    "posting_mode",
    "account_code",
    "external_account_code",
    "account_name",
    "debit",
    "credit",
    "original_currency_code",
    "original_amount",
    "functional_currency_code",
    "functional_amount_uyu",
    "fx_rate_applied",
    "tax_profile_hint",
    "account_is_provisional",
  ];
  const rows = dataset.rows.map((row) => [
    row.entryDate,
    row.reference,
    row.description,
    row.documentFilename,
    row.documentPostingStatus,
    row.postingMode,
    row.accountCode,
    row.externalAccountCode,
    row.accountName,
    row.debit,
    row.credit,
    row.originalCurrencyCode,
    row.originalAmount,
    row.functionalCurrencyCode,
    row.functionalAmountUyu,
    row.fxRateApplied,
    row.taxProfileHint,
    row.accountIsProvisional,
  ]);

  return [
    header.map((value) => escapeCsvCell(value)).join(","),
    ...rows.map((row) => row.map((value) => escapeCsvCell(value)).join(",")),
  ].join("\r\n");
}

function buildAccountingExportSheets(
  dataset: AccountingExportDataset,
): ExportWorkbookSheet[] {
  return [
    {
      name: "Asientos",
      rows: [
        [
          "Fecha",
          "Referencia",
          "Descripcion",
          "Documento",
          "Posting status",
          "Modo",
          "Cuenta",
          "Cuenta externa",
          "Nombre cuenta",
          "Debe",
          "Haber",
          "Moneda origen",
          "Importe origen",
          "Moneda funcional",
          "Importe UYU",
          "FX",
          "Perfil fiscal",
          "Provisional",
        ],
        ...dataset.rows.map((row) => [
          row.entryDate,
          row.reference,
          row.description,
          row.documentFilename,
          row.documentPostingStatus,
          row.postingMode,
          row.accountCode,
          row.externalAccountCode,
          row.accountName,
          row.debit,
          row.credit,
          row.originalCurrencyCode,
          row.originalAmount,
          row.functionalCurrencyCode,
          row.functionalAmountUyu,
          row.fxRateApplied,
          row.taxProfileHint,
          row.accountIsProvisional ? "Si" : "No",
        ]),
      ],
    },
    {
      name: "Recategorizacion",
      rows: [
        ["Documento", "Fecha", "Posting status"],
        ...dataset.recategorizationQueue.map((row) => [
          row.documentFilename,
          row.documentDate,
          row.postingStatus,
        ]),
      ],
    },
    {
      name: "Conciliacion DGI",
      rows: [
        ["Bucket", "Etiqueta", "Estado", "Delta neto UYU", "Delta IVA UYU", "Notas"],
        ...dataset.dgiDifferences.map((row) => [
          row.bucketCode,
          row.label,
          row.differenceStatus,
          row.deltaNetAmountUyu,
          row.deltaTaxAmountUyu,
          row.notes,
        ]),
      ],
    },
    {
      name: "Resumen",
      rows: [
        ["Organizacion", dataset.organizationName],
        ["Periodo", dataset.periodLabel],
        ["Scope", dataset.scope],
        ["Lineas exportadas", dataset.rows.length],
        ["Provisionales pendientes", dataset.recategorizationQueue.length],
        ["Buckets DGI", dataset.dgiDifferences.length],
        ["Warnings", dataset.warnings.join(" ")],
      ],
    },
  ];
}

export function buildAccountingExportWorkbook(dataset: AccountingExportDataset) {
  const sheets = buildAccountingExportSheets(dataset);

  return [
    '<?xml version="1.0"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:html="http://www.w3.org/TR/REC-html40">',
    sheets.map((sheet) => renderSheet(sheet)).join(""),
    "</Workbook>",
  ].join("");
}

export function buildAccountingExportArtifact(input: {
  dataset: AccountingExportDataset;
  layoutCode: AccountingExportLayoutCode;
}) {
  switch (input.layoutCode) {
    case "generic_excel_xml":
      return buildAccountingExportWorkbook(input.dataset);
    case "generic_csv":
    default:
      return buildAccountingExportCsv(input.dataset);
  }
}
