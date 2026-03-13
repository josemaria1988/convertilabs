import type {
  ExportWorkbookSheet,
  VatRunExportDataset,
} from "@/modules/exports/types";

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

function buildSheets(dataset: VatRunExportDataset): ExportWorkbookSheet[] {
  return [
    {
      name: "Resumen ejecutivo",
      rows: [
        ["Organizacion", dataset.organizationName],
        ["Periodo", dataset.periodLabel],
        ["Cantidad documentos", dataset.totals.documentCount],
        ["Base imponible compras", dataset.totals.purchaseTaxableBase],
        ["Base imponible ventas", dataset.totals.saleTaxableBase],
        ["IVA debito", dataset.totals.outputVat],
        ["IVA credito", dataset.totals.inputVatCreditable],
        ["IVA no deducible", dataset.totals.inputVatNonDeductible],
        ["Neto IVA periodo", dataset.totals.netVatPayable],
        ["Warnings / exceptions", dataset.totals.warningsCount],
      ],
    },
    {
      name: "Libro compras",
      rows: [
        ["Fecha", "Proveedor", "RUT proveedor", "Numero factura", "Concepto principal", "Base", "IVA", "Total", "Deducibilidad", "Observaciones"],
        ...dataset.purchases.map((row) => [
          row.date,
          row.vendor,
          row.vendorTaxId,
          row.documentNumber,
          row.primaryConcept,
          row.taxableBase,
          row.vat,
          row.total,
          row.deductibilityStatus,
          row.notes,
        ]),
      ],
    },
    {
      name: "Libro ventas",
      rows: [
        ["Fecha", "Cliente", "Numero comprobante", "Base", "IVA", "Total", "Tasa", "Observaciones"],
        ...dataset.sales.map((row) => [
          row.date,
          row.customer,
          row.documentNumber,
          row.taxableBase,
          row.vat,
          row.total,
          row.rate,
          row.notes,
        ]),
      ],
    },
    {
      name: "Asientos contables",
      rows: [
        ["Fecha", "Referencia", "Cuenta", "Descripcion cuenta", "Debe", "Haber", "Provenance"],
        ...dataset.journalEntries.map((row) => [
          row.date,
          row.reference,
          row.account,
          row.accountName,
          row.debit,
          row.credit,
          row.provenance,
        ]),
      ],
    },
    {
      name: "Trazabilidad y revision",
      rows: [
        ["Documento", "Proveedor resuelto", "Duplicado detectado", "Concept match strategy", "Confidence", "Reviewer", "Fecha aprobacion", "Regla aplicada", "Flags"],
        ...dataset.traceability.map((row) => [
          row.document,
          row.vendorResolved,
          row.duplicateDetected,
          row.conceptMatchStrategy,
          row.confidence,
          row.reviewer,
          row.approvalDate,
          row.appliedRule,
          row.flags,
        ]),
      ],
    },
  ];
}

export function buildVatRunExcelWorkbook(dataset: VatRunExportDataset) {
  const sheets = buildSheets(dataset);

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
