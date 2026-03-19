/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  extractDocumentSpreadsheetRows,
  findDuplicateSpreadsheetImportDocument,
  preflightDocumentSpreadsheetImport,
} = require("@/modules/documents/spreadsheet-batch-import");
const openAiResponses = require("@/lib/llm/openai-responses");

function buildSpreadsheetImportSupabaseState(overrides = {}) {
  return {
    documentInvoiceIdentities: [],
    documents: [],
    ...overrides,
  };
}

function applyFilters(rows, queryState) {
  let filtered = [...rows];

  for (const [column, value] of Object.entries(queryState.eqFilters)) {
    filtered = filtered.filter((row) => row[column] === value);
  }

  for (const [column, values] of Object.entries(queryState.inFilters)) {
    filtered = filtered.filter((row) => values.includes(row[column]));
  }

  for (const entry of queryState.notFilters) {
    if (entry.operator === "is" && entry.value === null) {
      filtered = filtered.filter((row) => row[entry.column] !== null && row[entry.column] !== undefined);
    }
  }

  if (queryState.orderBy) {
    const { column, ascending } = queryState.orderBy;
    filtered.sort((left, right) => {
      const leftValue = left[column] ?? null;
      const rightValue = right[column] ?? null;

      if (leftValue === rightValue) {
        return 0;
      }

      if (leftValue === null) {
        return ascending ? -1 : 1;
      }

      if (rightValue === null) {
        return ascending ? 1 : -1;
      }

      return ascending
        ? String(leftValue).localeCompare(String(rightValue))
        : String(rightValue).localeCompare(String(leftValue));
    });
  }

  if (typeof queryState.limitCount === "number") {
    filtered = filtered.slice(0, queryState.limitCount);
  }

  return filtered;
}

function buildSpreadsheetImportSupabaseClient(state) {
  return {
    from(table) {
      const queryState = {
        eqFilters: {},
        inFilters: {},
        notFilters: [],
        orderBy: null,
        limitCount: null,
      };

      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          queryState.eqFilters[column] = value;
          return builder;
        },
        in(column, values) {
          queryState.inFilters[column] = values;
          return builder;
        },
        not(column, operator, value) {
          queryState.notFilters.push({ column, operator, value });
          return builder;
        },
        order(column, options = {}) {
          queryState.orderBy = {
            column,
            ascending: options.ascending !== false,
          };
          return builder;
        },
        limit(value) {
          queryState.limitCount = value;
          return builder;
        },
        then(resolve, reject) {
          try {
            if (table === "document_invoice_identities") {
              resolve({
                data: applyFilters(state.documentInvoiceIdentities, queryState),
                error: null,
              });
              return;
            }

            if (table === "documents") {
              resolve({
                data: applyFilters(state.documents, queryState),
                error: null,
              });
              return;
            }

            throw new Error(`Unexpected table lookup: ${table}`);
          } catch (error) {
            reject(error);
          }
        },
      };

      return builder;
    },
  };
}

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

test("document spreadsheet import accepts dash-separated invoice dates without falling back to creation date", async () => {
  const content = [
    "01-02-2026 al 28-02-2026",
    "",
    "Fecha\tTipo\tComprobante\tNÃ‚Â°\tProveedor\tMoneda\tTotal\tSaldo",
    "01-02-2026\tCompra CrÃƒÂ©dito\tCompra CrÃƒÂ©dito Gastos\t1001\tPergol Maquinaria S.A.\t$\t32.0\t32.0",
    "28-02-2026\tCompra CrÃƒÂ©dito\tCompra CrÃƒÂ©dito Gastos\t1002\tPergol Maquinaria S.A.\t$\t254.0\t254.0",
  ].join("\n");

  const result = await extractDocumentSpreadsheetRows({
    fileName: "compras-zeta-febrero.tsv",
    mimeType: "text/tab-separated-values",
    bytes: Buffer.from(content, "utf8"),
    ledgerKind: "purchase",
    provider: "heuristic",
  });

  assert.equal(result.rows.length, 2);
  assert.equal(result.skippedRows.length, 0);
  assert.equal(result.rows[0].facts.document_date, "2026-02-01");
  assert.equal(result.rows[1].facts.document_date, "2026-02-28");
});

test("document spreadsheet import duplicate guard blocks an existing invoice identity match by number and total", async () => {
  const supabase = buildSpreadsheetImportSupabaseClient(buildSpreadsheetImportSupabaseState({
    documentInvoiceIdentities: [
      {
        document_id: "doc-existing-1",
        organization_id: "org-1",
        document_date: "2026-02-18",
        document_number_normalized: "a1001",
        total_amount: 254,
        created_at: "2026-03-01T00:00:00.000Z",
      },
    ],
  }));

  const duplicate = await findDuplicateSpreadsheetImportDocument({
    supabase,
    organizationId: "org-1",
    row: {
      documentRole: "purchase",
      facts: {
        issuer_name: "Pergol Maquinaria S.A.",
        issuer_tax_id: null,
        receiver_name: null,
        receiver_tax_id: null,
        document_number: "1001",
        series: "A",
        currency_code: "UYU",
        document_date: "2026-02-28",
        due_date: null,
        subtotal: 208.2,
        tax_amount: 45.8,
        total_amount: 254,
        purchase_category_candidate: null,
        sale_category_candidate: null,
      },
    },
  });

  assert.equal(duplicate?.documentId, "doc-existing-1");
  assert.equal(duplicate?.matchedOn, "invoice_identity");
});

test("document spreadsheet import duplicate guard falls back to existing documents by external reference and total", async () => {
  const supabase = buildSpreadsheetImportSupabaseClient(buildSpreadsheetImportSupabaseState({
    documents: [
      {
        id: "doc-existing-2",
        organization_id: "org-1",
        direction: "purchase",
        document_date: "2026-02-10",
        external_reference: "1002",
        document_total_amount_original: 32,
        created_at: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "doc-other-direction",
        organization_id: "org-1",
        direction: "sale",
        document_date: "2026-02-10",
        external_reference: "1002",
        document_total_amount_original: 32,
        created_at: "2026-03-01T00:00:00.000Z",
      },
    ],
  }));

  const duplicate = await findDuplicateSpreadsheetImportDocument({
    supabase,
    organizationId: "org-1",
    row: {
      documentRole: "purchase",
      facts: {
        issuer_name: "Pergol Maquinaria S.A.",
        issuer_tax_id: null,
        receiver_name: null,
        receiver_tax_id: null,
        document_number: "1002",
        series: null,
        currency_code: "UYU",
        document_date: "2026-02-28",
        due_date: null,
        subtotal: 26.23,
        tax_amount: 5.77,
        total_amount: 32,
        purchase_category_candidate: null,
        sale_category_candidate: null,
      },
    },
  });

  assert.equal(duplicate?.documentId, "doc-existing-2");
  assert.equal(duplicate?.matchedOn, "document_record");
});

test("document spreadsheet import consolidates Zeta-like sales using the real client column and preserves FX rate", async () => {
  const content = [
    "01-02-2026 al 28-02-2026",
    "Fecha\tComprobante\tCFE\tPendiente Entrega\tSerie\tNº\tCliente #\tCliente\tRUT\tCentro de Costos\tReferencia\tCantidad\tOrigen\tDestino\tArtículo\tDescripción\tMoneda\tCotización\tPrecio\tSubtotal\tSubtotal (+/-)\tIVA\tTotal IVA (+/-)\tTotal",
    "27-02-2026\tVenta Crédito (CFE)\te-Factura\tN\tA\t6395\tCL00029\tAgropecuaria El Tero\t200027620010\t\t\t1\t\t\t000351\tChapa perforada 1\tU$S\t38.436\t78.69\t78.69\t78.69\t17.31\t17.31\t96",
    "27-02-2026\tVenta Crédito (CFE)\te-Factura\tN\tA\t6395\tCL00029\tAgropecuaria El Tero\t200027620010\t\t\t4\t\t\t000318\tChapa perforada 2\tU$S\t38.436\t102.46\t409.84\t409.84\t90.16\t90.16\t500",
    "27-02-2026\tNota de Crédito Venta (CFE)\tNota de Crédito de e-Factura\tN\tA\t903\tCL00029\tAgropecuaria El Tero\t200027620010\t\t\t1\t\t\t000351\tAjuste comercial\tU$S\t38.436\t78.69\t78.69\t-78.69\t17.31\t-17.31\t96",
  ].join("\n");

  const result = await extractDocumentSpreadsheetRows({
    fileName: "ventas-zeta.tsv",
    mimeType: "text/tab-separated-values",
    bytes: Buffer.from(content, "utf8"),
    ledgerKind: "sale",
    provider: "heuristic",
  });

  assert.equal(result.rows.length, 2);
  assert.equal(result.skippedRows.length, 0);
  assert.equal(result.consolidatedDocumentsDetected, 2);
  assert.equal(result.duplicateGroupsDetected, 1);

  const invoice = result.rows.find((row) => row.facts.document_number === "6395");
  const creditNote = result.rows.find((row) => row.facts.document_number === "903");

  assert.ok(invoice);
  assert.ok(creditNote);
  assert.equal(invoice.facts.receiver_name, "Agropecuaria El Tero");
  assert.equal(invoice.facts.receiver_tax_id, "200027620010");
  assert.equal(invoice.facts.subtotal, 488.53);
  assert.equal(invoice.facts.tax_amount, 107.47);
  assert.equal(invoice.facts.total_amount, 596);
  assert.equal(invoice.documentFxRate, 38.436);
  assert.equal(invoice.documentFxRateSource, "document_import");
  assert.equal(invoice.paymentTerms, "credit");
  assert.equal(invoice.lineItems.length, 2);
  assert.equal(invoice.lineItems[0].concept_code, "000351");
  assert.equal(invoice.lineItems[1].concept_description, "Chapa perforada 2");
  assert.deepEqual(invoice.sourceRowNumbers, [3, 4]);

  assert.equal(creditNote.documentType, "sale_credit_note");
  assert.equal(creditNote.isCreditNote, true);
  assert.equal(creditNote.facts.receiver_name, "Agropecuaria El Tero");
  assert.equal(creditNote.documentFxRate, 38.436);
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
