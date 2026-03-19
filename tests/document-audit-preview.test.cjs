/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildDocumentAuditPreviewRows,
  countDocumentAuditPreviewRows,
  parseDocumentAuditPreviewRows,
} = require("@/modules/audit/document-import-audit");
const {
  formatDocumentSpreadsheetImportStatusMessage,
  isDocumentSpreadsheetImportTerminalStatus,
  summarizeDocumentSpreadsheetImportRun,
} = require("@/modules/documents/spreadsheet-import-runs");

function buildSpreadsheetRow(overrides = {}) {
  return {
    rowNumber: 12,
    sheetName: "Compras Febrero",
    documentRole: "purchase",
    documentType: "purchase_invoice",
    operationCategory: null,
    paymentTerms: "credit",
    settlementMethod: "unknown",
    balanceAmount: null,
    facts: {
      issuer_name: "Proveedor S.A.",
      issuer_tax_id: "213456780019",
      issuer_address_raw: null,
      issuer_department: null,
      issuer_city: null,
      issuer_branch_code: null,
      merchant_category_hints: [],
      location_extraction_confidence: null,
      receiver_name: null,
      receiver_tax_id: null,
      document_number: "A-12345",
      series: "A",
      currency_code: "UYU",
      document_date: "2026-02-15",
      due_date: null,
      subtotal: 100,
      tax_amount: 22,
      total_amount: 122,
      purchase_category_candidate: null,
      sale_category_candidate: null,
    },
    amountBreakdown: [],
    lineItems: [],
    extractedText: "Factura A-12345",
    warnings: [],
    sourceReference: "Compras Febrero:fila-12",
    displayLabel: "Compra importada - Proveedor S.A.",
    confidence: 0.92,
    documentFxRate: null,
    documentFxRateSource: null,
    documentFxRateDate: "2026-02-15",
    sourceRows: [{
      rowNumber: 12,
      originalRow: {
        Fecha: "15-02-2026",
        Numero: "A-12345",
      },
    }],
    sourceRowNumbers: [12],
    consolidationKey: "Compras Febrero:fila-12",
    isCreditNote: false,
    originalRow: {
      Fecha: "15-02-2026",
      Numero: "A-12345",
    },
    ...overrides,
  };
}

test("document audit preview rows start pending and can be parsed back from metadata", () => {
  const previewRows = buildDocumentAuditPreviewRows([
    buildSpreadsheetRow(),
    buildSpreadsheetRow({
      rowNumber: 18,
      sourceReference: "Compras Febrero:fila-18",
      consolidationKey: "Compras Febrero:fila-18",
      displayLabel: "Compra importada - Otro proveedor",
      facts: {
        ...buildSpreadsheetRow().facts,
        issuer_name: "Otro proveedor",
        document_number: "B-9988",
        total_amount: 88,
      },
    }),
  ]);

  assert.equal(previewRows.length, 2);
  assert.equal(previewRows[0].decision, "pending");
  assert.equal(previewRows[1].materializedDocumentId, null);

  const parsedRows = parseDocumentAuditPreviewRows({
    audit_preview_rows: previewRows,
  });
  const counts = countDocumentAuditPreviewRows(parsedRows);

  assert.equal(parsedRows.length, 2);
  assert.equal(parsedRows[0].row.displayLabel, "Compra importada - Proveedor S.A.");
  assert.deepEqual(counts, {
    total: 2,
    pending: 2,
    accepted: 0,
    rejected: 0,
    failed: 0,
  });
});

test("preview_ready is terminal for tracking and reports an audit preview message", () => {
  const run = {
    id: "run-preview-1",
    organizationId: "org-1",
    sourceDocumentId: null,
    fileName: "compras-febrero.xlsx",
    fileKind: "xlsx",
    importType: "document_batch_import",
    runMode: "interactive",
    status: "preview_ready",
    providerCode: null,
    modelCode: null,
    promptVersion: null,
    schemaVersion: null,
    batchId: null,
    responseId: null,
    estimatedCostUsd: null,
    warnings: [],
    preview: null,
    result: null,
    detectedMapping: {},
    statusEvents: [{
      code: "preview_ready",
      message: "Vista previa lista con 2 documento(s) detectado(s).",
      createdAt: "2026-03-19T12:00:00.000Z",
    }],
    retryCount: 0,
    confirmedAt: null,
    confirmedBy: null,
    metadata: {
      ledger_kind: "purchase",
      progress: {
        stage: "preview_ready",
        percent: 100,
        importableRowsDetected: 2,
        currentMessage:
          "Vista previa lista con 2 documento(s) detectado(s). Ahora puedes auditar el lote y aceptar o rechazar documentos antes de materializarlos.",
      },
    },
    createdAt: "2026-03-19T11:58:00.000Z",
    updatedAt: "2026-03-19T12:00:00.000Z",
  };

  const summary = summarizeDocumentSpreadsheetImportRun(run);
  const message = formatDocumentSpreadsheetImportStatusMessage(summary);

  assert.equal(isDocumentSpreadsheetImportTerminalStatus("preview_ready"), true);
  assert.equal(summary.isTerminal, true);
  assert.match(message, /vista previa/i);
  assert.match(message, /aceptar o rechazar/i);
});
