/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildChartImportPreview,
  buildTemplateImportPreview,
} = require("@/modules/accounting");

test("chart import preview normalizes a simple account row", () => {
  const preview = buildChartImportPreview({
    canonical: {
      importType: "chart_of_accounts_import",
      organizationId: "org-1",
      sourceType: "imported_from_spreadsheet",
      accounts: [
        {
          code: "6101",
          name: "Gastos administrativos",
          accountType: "expense",
          normalSide: null,
          isPostable: true,
        },
      ],
      warnings: [],
    },
  });

  assert.equal(preview.readyCount, 1);
  assert.equal(preview.accounts[0].accountType, "expense");
  assert.equal(preview.accounts[0].normalSide, "debit");
});

test("chart import preview blocks duplicate account codes", () => {
  const preview = buildChartImportPreview({
    canonical: {
      importType: "chart_of_accounts_import",
      organizationId: "org-1",
      sourceType: "imported_from_spreadsheet",
      accounts: [
        {
          code: "1101",
          name: "Caja",
          accountType: "asset",
          normalSide: "debit",
          isPostable: true,
        },
      ],
      warnings: [],
    },
    existingAccountCodes: ["1101"],
  });

  assert.equal(preview.blockedCount, 1);
  assert.equal(preview.accounts[0].status, "duplicate_existing");
});

test("template import preview accepts a simple journal structure", () => {
  const preview = buildTemplateImportPreview({
    canonical: {
      importType: "journal_template_import",
      organizationId: "org-1",
      sourceType: "imported_from_spreadsheet",
      templates: [
        {
          templateName: "Compra combustible",
          documentRole: "purchase",
          documentSubtype: "supplier_invoice",
          operationCategory: "fuel_and_lubricants",
          conceptName: "Combustible",
          mainAccountCode: "6105",
          vatAccountCode: "1181",
          counterpartyAccountCode: "2110",
          notes: null,
        },
      ],
      warnings: [],
    },
    availableAccountCodes: ["6105", "1181", "2110"],
  });

  assert.equal(preview.readyCount, 1);
  assert.equal(preview.templates[0].status, "ready");
  assert.equal(preview.templates[0].vatAccountCode, "1181");
});

test("template import preview blocks rows when the main account is missing", () => {
  const preview = buildTemplateImportPreview({
    canonical: {
      importType: "journal_template_import",
      organizationId: "org-1",
      sourceType: "imported_from_spreadsheet",
      templates: [
        {
          templateName: "Honorarios",
          documentRole: "purchase",
          documentSubtype: "supplier_invoice",
          operationCategory: "professional_fees",
          conceptName: "Honorarios profesionales",
          mainAccountCode: "6210",
          vatAccountCode: "1181",
          counterpartyAccountCode: "2110",
          notes: null,
        },
      ],
      warnings: [],
    },
    availableAccountCodes: ["1181", "2110"],
    existingConceptCodes: ["honorarios-profesionales"],
  });

  assert.equal(preview.blockedCount, 1);
  assert.equal(preview.templates[0].status, "missing_main_account");
});
