/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  aggregateImportOperationDocuments,
  classifyImportTaxLine,
  interpretImportDocument,
} = require("@/modules/imports");

test("import intake recognizes a standard DUA with import VAT", () => {
  const result = interpretImportDocument({
    documentId: "doc-1",
    documentType: "DUA",
    facts: {
      issuer_name: "Aduana",
      issuer_tax_id: null,
      receiver_name: "Rontil",
      receiver_tax_id: null,
      document_number: "778899",
      series: null,
      currency_code: "USD",
      document_date: "2026-03-05",
      due_date: null,
      subtotal: null,
      tax_amount: null,
      total_amount: 1500,
      purchase_category_candidate: null,
      sale_category_candidate: null,
    },
    amountBreakdown: [
      {
        label: "IVA importacion",
        amount: 1200,
        tax_rate: null,
        tax_code: "IVA-IMPO",
      },
    ],
    lineItems: [],
    extractedText: "Documento unico aduanero DUA 778899/2026",
  });

  assert.equal(result.documentKind, "dua");
  assert.equal(result.taxes[0].isCreditableVat, true);
  assert.equal(result.duaNumber, "778899");
});

test("tax classification keeps external tax codes and VAT advance flags", () => {
  const line = classifyImportTaxLine({
    taxLabel: "Anticipo IVA",
    taxCode: "AIVA",
    externalTaxCode: "AIVA-01",
    amount: 450,
    currencyCode: "USD",
    documentKind: "dua",
  });

  assert.equal(line.isVatAdvance, true);
  assert.equal(line.externalTaxCode, "AIVA-01");
});

test("broker invoices are treated as local expenses and not customs taxes", () => {
  const result = interpretImportDocument({
    documentId: "doc-2",
    documentType: "supplier_invoice",
    facts: {
      issuer_name: "Despachante del Sur",
      issuer_tax_id: "21999999999",
      receiver_name: "Rontil",
      receiver_tax_id: "21433455019",
      document_number: "55",
      series: "A",
      currency_code: "UYU",
      document_date: "2026-03-06",
      due_date: null,
      subtotal: 1000,
      tax_amount: 220,
      total_amount: 1220,
      purchase_category_candidate: null,
      sale_category_candidate: null,
    },
    amountBreakdown: [
      {
        label: "Honorarios despachante",
        amount: 1220,
        tax_rate: 22,
        tax_code: "SERV",
      },
    ],
    lineItems: [],
    extractedText: "Factura despachante por honorarios y gastos locales",
  });

  assert.equal(result.looksLikeLocalExpense, true);
  assert.equal(result.documentKind, "broker_invoice");
});

test("mixed import operations block when DUA references conflict", () => {
  const aggregate = aggregateImportOperationDocuments({
    documents: [
      {
        documentId: "doc-1",
        documentKind: "dua",
        duaNumber: "778899",
        duaYear: "2026",
        referenceCode: "778899/2026",
        supplierName: "Proveedor A",
        supplierTaxId: null,
        operationDate: "2026-03-05",
        paymentDate: null,
        currencyCode: "USD",
        warnings: [],
        taxes: [],
        looksLikeLocalExpense: false,
        rawFacts: {},
      },
      {
        documentId: "doc-2",
        documentKind: "commercial_invoice",
        duaNumber: "889900",
        duaYear: "2026",
        referenceCode: "889900/2026",
        supplierName: "Proveedor A",
        supplierTaxId: null,
        operationDate: "2026-03-05",
        paymentDate: null,
        currencyCode: "USD",
        warnings: [],
        taxes: [],
        looksLikeLocalExpense: false,
        rawFacts: {},
      },
    ],
  });

  assert.equal(aggregate.status, "blocked_manual_review");
  assert.match(aggregate.warnings.join(" "), /conflicto/i);
});
