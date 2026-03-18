/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  extractDocumentSpreadsheetRows,
  preflightDocumentSpreadsheetImport,
} = require("@/modules/documents/spreadsheet-batch-import");
const openAiResponses = require("@/lib/llm/openai-responses");

test("document spreadsheet import recovers real headers after a date-range row and maps Zeta-like purchases", async () => {
  const content = [
    "16/03/26 al",
    "",
    "Fecha\tTipo\tComprobante\tNÂ°\tProveedor\tMoneda\tTotal\tSaldo",
    "16/03/26\tCompra Contado\tCompra Contado Gastos\t3550\tVeterinaria Piriapolis\t$\t2890\t0",
    "28/02/26\tCompra CrÃ©dito\tCompra CrÃ©dito Gastos\t4936316\tANTEL\t$\t350\t350",
    "12/03/26\tCompra CrÃ©dito\tCompra CrÃ©dito Gastos\t1904397\tVisa BROU USD\tU$S\t0,37\t0",
  ].join("\n");

  const result = await extractDocumentSpreadsheetRows({
    fileName: "compras-zeta.tsv",
    mimeType: "text/tab-separated-values",
    bytes: Buffer.from(content, "utf8"),
    ledgerKind: "purchase",
    provider: "heuristic",
  });

  assert.equal(result.rows.length, 3);
  assert.equal(result.detectedHeaders.documentDate, "Fecha");
  assert.equal(result.detectedHeaders.counterpartyName, "Proveedor");
  assert.equal(result.detectedHeaders.totalAmount, "Total");
  assert.match(result.warnings.join(" "), /neto o IVA/i);

  assert.equal(result.rows[0].facts.issuer_name, "Veterinaria Piriapolis");
  assert.equal(result.rows[0].facts.currency_code, "UYU");
  assert.equal(result.rows[0].facts.total_amount, 2890);
  assert.equal(result.rows[0].paymentTerms, "cash");
  assert.equal(result.rows[0].settlementMethod, "cash");

  assert.equal(result.rows[1].facts.document_number, "4936316");
  assert.equal(result.rows[1].paymentTerms, "credit");
  assert.equal(result.rows[1].settlementMethod, "unknown");
  assert.equal(result.rows[1].balanceAmount, 350);

  assert.equal(result.rows[2].facts.currency_code, "USD");
  assert.equal(result.rows[2].facts.total_amount, 0.37);
});

test("document spreadsheet import reads all bounded rows instead of only preview rows", async () => {
  const rows = [
    "Fecha\tTipo\tComprobante\tNÂ°\tProveedor\tMoneda\tTotal\tSaldo",
    ...Array.from({ length: 15 }, (_, index) =>
      `16/03/26\tCompra Contado\tCompra Contado Gastos\t${1000 + index}\tProveedor ${index + 1}\t$\t${100 + index}\t0`),
  ];

  const result = await extractDocumentSpreadsheetRows({
    fileName: "compras-lote.tsv",
    mimeType: "text/tab-separated-values",
    bytes: Buffer.from(rows.join("\n"), "utf8"),
    ledgerKind: "purchase",
    provider: "heuristic",
  });

  assert.equal(result.rows.length, 15);
  assert.equal(result.rows[14].facts.document_number, "1014");
  assert.equal(result.rows[14].facts.issuer_name, "Proveedor 15");
});

test("document spreadsheet import accepts Excel serial dates and numeric ids in heuristic mode", async () => {
  const content = [
    "16/03/26 al",
    "",
    "Fecha\tTipo\tComprobante\tNÂ°\tProveedor\tMoneda\tTotal\tSaldo",
    "46097.0\tCompra Contado\tCompra Contado Gastos\t3550.0\tVeterinaria Piriapolis\t$\t2890.0\t0.0",
    "46081.0\tCompra CrÃ©dito\tCompra CrÃ©dito Gastos\t4936316.0\tANTEL\t$\t350.0\t350.0",
  ].join("\n");

  const result = await extractDocumentSpreadsheetRows({
    fileName: "compras-zeta-serial.tsv",
    mimeType: "text/tab-separated-values",
    bytes: Buffer.from(content, "utf8"),
    ledgerKind: "purchase",
    provider: "heuristic",
  });

  assert.equal(result.rows.length, 2);
  assert.equal(result.skippedRows.length, 0);
  assert.equal(result.rows[0].facts.document_date, "2026-03-16");
  assert.equal(result.rows[0].facts.document_number, "3550");
  assert.equal(result.rows[1].facts.document_date, "2026-02-28");
  assert.equal(result.rows[1].facts.document_number, "4936316");
});

test("document spreadsheet preflight counts candidate rows without calling OpenAI", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";

  try {
    const rows = [
      "Fecha\tTipo\tComprobante\tNÃ‚Â°\tProveedor\tMoneda\tTotal\tSaldo",
      ...Array.from({ length: 301 }, (_, index) =>
        `16/03/26\tCompra Contado\tCompra Contado Gastos\t${1000 + index}\tProveedor ${index + 1}\t$\t${100 + index}\t0`),
    ];

    const result = await preflightDocumentSpreadsheetImport({
      fileName: "compras-preflight.tsv",
      mimeType: "text/tab-separated-values",
      bytes: Buffer.from(rows.join("\n"), "utf8"),
      ledgerKind: "purchase",
    });

    assert.equal(result.importableRowsDetected, 301);
    assert.equal(result.totalRowsDetected, 301);
    assert.equal(result.sheetName, "Sheet1");
  } finally {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("document spreadsheet import lets OpenAI normalize raw spreadsheet values before creating documents", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalCreateStructuredOpenAIResponse = openAiResponses.createStructuredOpenAIResponse;
  process.env.OPENAI_API_KEY = "test-key";

  openAiResponses.createStructuredOpenAIResponse = async (input) => {
    if (input.schemaName === "convertilabs_document_spreadsheet_mapping") {
      return {
        responseId: "resp_mapping",
        output: {
          sheetName: "Sheet1",
          confidence: 0.95,
          warnings: [],
          headerMap: [
            { targetField: "documentDate", sourceHeader: "Fecha" },
            { targetField: "documentTypeLabel", sourceHeader: "Tipo" },
            { targetField: "documentDescription", sourceHeader: "Comprobante" },
            { targetField: "documentNumber", sourceHeader: "NÂ°" },
            { targetField: "counterpartyName", sourceHeader: "Proveedor" },
            { targetField: "currency", sourceHeader: "Moneda" },
            { targetField: "totalAmount", sourceHeader: "Total" },
            { targetField: "balanceAmount", sourceHeader: "Saldo" },
          ],
        },
        rawText: "",
        usage: {
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          estimatedCostUsd: null,
        },
        rawResponse: {},
      };
    }

    if (input.schemaName === "convertilabs_document_spreadsheet_rows") {
      return {
        responseId: "resp_rows",
        output: {
          warnings: [],
          rows: [
            {
              rowNumber: 4,
              importable: true,
              skipReason: null,
              rawType: "Compra Contado",
              rawDescription: "Compra Contado Gastos",
              counterpartyName: "Veterinaria Piriapolis",
              counterpartyTaxId: null,
              documentDate: "2026-03-16",
              dueDate: null,
              documentNumber: "3550",
              series: null,
              currencyCode: "UYU",
              subtotalAmount: null,
              taxAmount: null,
              taxRate: null,
              totalAmount: 2890,
              balanceAmount: 0,
              warnings: [],
              confidence: 0.97,
            },
            {
              rowNumber: 5,
              importable: true,
              skipReason: null,
              rawType: "Compra CrÃ©dito",
              rawDescription: "Compra CrÃ©dito Gastos",
              counterpartyName: "ANTEL",
              counterpartyTaxId: null,
              documentDate: "2026-02-28",
              dueDate: null,
              documentNumber: "4936316",
              series: null,
              currencyCode: "UYU",
              subtotalAmount: null,
              taxAmount: null,
              taxRate: null,
              totalAmount: 350,
              balanceAmount: 350,
              warnings: ["Interpretado desde serial de Excel."],
              confidence: 0.98,
            },
          ],
        },
        rawText: "",
        usage: {
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          estimatedCostUsd: null,
        },
        rawResponse: {},
      };
    }

    throw new Error(`Unexpected schemaName ${input.schemaName}`);
  };

  try {
    const content = [
      "16/03/26 al",
      "",
      "Fecha\tTipo\tComprobante\tNÂ°\tProveedor\tMoneda\tTotal\tSaldo",
      "46097.0\tCompra Contado\tCompra Contado Gastos\t3550.0\tVeterinaria Piriapolis\t$\t2890.0\t0.0",
      "46081.0\tCompra CrÃ©dito\tCompra CrÃ©dito Gastos\t4936316.0\tANTEL\t$\t350.0\t350.0",
    ].join("\n");

    const result = await extractDocumentSpreadsheetRows({
      fileName: "compras-zeta-ai.tsv",
      mimeType: "text/tab-separated-values",
      bytes: Buffer.from(content, "utf8"),
      ledgerKind: "purchase",
      provider: "openai",
    });

    assert.equal(result.rows.length, 2);
    assert.equal(result.skippedRows.length, 0);
    assert.equal(result.rows[0].facts.document_date, "2026-03-16");
    assert.equal(result.rows[0].facts.document_number, "3550");
    assert.equal(result.rows[1].paymentTerms, "credit");
    assert.match(result.rows[1].warnings.join(" "), /serial de excel/i);
  } finally {
    openAiResponses.createStructuredOpenAIResponse = originalCreateStructuredOpenAIResponse;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});
