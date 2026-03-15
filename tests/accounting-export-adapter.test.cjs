/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildAccountingExportCsv,
  buildAccountingExportWorkbook,
} = require("@/modules/exports/accounting-adapters");

function buildDataset() {
  return {
    organizationId: "org-1",
    organizationName: "Convertilabs Demo",
    periodLabel: "2026-03",
    scope: "all_posted",
    rows: [
      {
        entryDate: "2026-03-10",
        reference: "A-100",
        description: "Venta plaza",
        documentFilename: "venta-a-100.pdf",
        documentPostingStatus: "posted_final",
        postingMode: "final",
        accountCode: "4.1.1.01",
        externalAccountCode: "EXT-4101",
        accountName: "Ventas plaza tasa basica",
        debit: 0,
        credit: 1220,
        originalCurrencyCode: "UYU",
        originalAmount: 1220,
        functionalCurrencyCode: "UYU",
        functionalAmountUyu: 1220,
        fxRateApplied: 1,
        taxProfileHint: "UY_VAT_SALE_BASIC",
        accountIsProvisional: false,
      },
      {
        entryDate: "2026-03-11",
        reference: "B-200",
        description: "Gasto por clasificar",
        documentFilename: "compra-b-200.pdf",
        documentPostingStatus: "posted_provisional",
        postingMode: "provisional",
        accountCode: "TEMP-EXP",
        externalAccountCode: null,
        accountName: "Gasto por clasificar",
        debit: 500,
        credit: 0,
        originalCurrencyCode: "USD",
        originalAmount: 12.5,
        functionalCurrencyCode: "UYU",
        functionalAmountUyu: 500,
        fxRateApplied: 40,
        taxProfileHint: "UY_VAT_NON_DEDUCTIBLE",
        accountIsProvisional: true,
      },
    ],
    recategorizationQueue: [
      {
        documentId: "doc-2",
        documentFilename: "compra-b-200.pdf",
        documentDate: "2026-03-11",
        postingStatus: "posted_provisional",
      },
    ],
    dgiDifferences: [
      {
        bucketCode: "sales_basic",
        label: "IVA basica ventas",
        differenceStatus: "amount_mismatch",
        deltaNetAmountUyu: 20,
        deltaTaxAmountUyu: 4.4,
        notes: "Diferencia con baseline.",
      },
    ],
    warnings: ["1 documento provisional pendiente."],
  };
}

test("accounting export adapter renders CSV with external codes and posting status", () => {
  const csv = buildAccountingExportCsv(buildDataset());

  assert.match(csv, /EXT-4101/);
  assert.match(csv, /posted_provisional/);
  assert.match(csv, /TEMP-EXP/);
  assert.match(csv, /UY_VAT_NON_DEDUCTIBLE/);
});

test("accounting export adapter renders workbook with recategorization and DGI sheets", () => {
  const workbook = buildAccountingExportWorkbook(buildDataset());

  assert.match(workbook, /Asientos/);
  assert.match(workbook, /Recategorizacion/);
  assert.match(workbook, /Conciliacion DGI/);
  assert.match(workbook, /Convertilabs Demo/);
});
