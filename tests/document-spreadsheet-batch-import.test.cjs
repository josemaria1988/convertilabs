/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  extractDocumentSpreadsheetRows,
} = require("@/modules/documents/spreadsheet-batch-import");

test("document spreadsheet import recovers real headers after a date-range row and maps Zeta-like purchases", async () => {
  const content = [
    "16/03/26 al",
    "",
    "Fecha\tTipo\tComprobante\tN°\tProveedor\tMoneda\tTotal\tSaldo",
    "16/03/26\tCompra Contado\tCompra Contado Gastos\t3550\tVeterinaria Piriapolis\t$\t2890\t0",
    "28/02/26\tCompra Crédito\tCompra Crédito Gastos\t4936316\tANTEL\t$\t350\t350",
    "12/03/26\tCompra Crédito\tCompra Crédito Gastos\t1904397\tVisa BROU USD\tU$S\t0,37\t0",
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
    "Fecha\tTipo\tComprobante\tN°\tProveedor\tMoneda\tTotal\tSaldo",
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
