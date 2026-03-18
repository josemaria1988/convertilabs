/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildBalanceSheetRows,
  buildIncomeStatementRows,
  buildJournalLineageRows,
} = require("@/modules/accounting/read-models");

test("journal lineage read model exposes reversal and adjustment edges", () => {
  const rows = buildJournalLineageRows([
    {
      organizationId: "org-1",
      journalEntryId: "je-100",
      entryNumber: 100,
      entryDate: "2026-03-31",
      status: "posted",
      reversedByJournalEntryId: "je-101",
    },
    {
      organizationId: "org-1",
      journalEntryId: "je-101",
      entryNumber: 101,
      entryDate: "2026-04-05",
      status: "posted",
      reversesJournalEntryId: "je-100",
    },
    {
      organizationId: "org-1",
      journalEntryId: "je-102",
      entryNumber: 102,
      entryDate: "2026-04-05",
      status: "posted",
      adjustsJournalEntryId: "je-100",
    },
  ]);

  assert.deepEqual(rows, [
    {
      organizationId: "org-1",
      journalEntryId: "je-100",
      relatedJournalEntryId: "je-101",
      relationType: "reversed_by",
      entryNumber: 100,
      relatedEntryNumber: 101,
      entryDate: "2026-03-31",
      relatedEntryDate: "2026-04-05",
      entryStatus: "posted",
      relatedEntryStatus: "posted",
    },
    {
      organizationId: "org-1",
      journalEntryId: "je-101",
      relatedJournalEntryId: "je-100",
      relationType: "reverses",
      entryNumber: 101,
      relatedEntryNumber: 100,
      entryDate: "2026-04-05",
      relatedEntryDate: "2026-03-31",
      entryStatus: "posted",
      relatedEntryStatus: "posted",
    },
    {
      organizationId: "org-1",
      journalEntryId: "je-102",
      relatedJournalEntryId: "je-100",
      relationType: "adjusts",
      entryNumber: 102,
      relatedEntryNumber: 100,
      entryDate: "2026-04-05",
      relatedEntryDate: "2026-03-31",
      entryStatus: "posted",
      relatedEntryStatus: "posted",
    },
  ]);
});

test("balance sheet read model normalizes signs by financial section", () => {
  const rows = buildBalanceSheetRows([
    {
      organizationId: "org-1",
      fiscalPeriodId: "fp-2026",
      fiscalPeriodCode: "FY-2026",
      accountId: "cash",
      accountCode: "1110",
      accountName: "Caja",
      accountType: "asset",
      chapterCode: "1",
      presentationCode: "1.1",
      naturalBalance: "debit",
      functionalBalance: 500,
    },
    {
      organizationId: "org-1",
      fiscalPeriodId: "fp-2026",
      fiscalPeriodCode: "FY-2026",
      accountId: "payables",
      accountCode: "2101",
      accountName: "Proveedores",
      accountType: "liability",
      chapterCode: "2",
      presentationCode: "2.1",
      naturalBalance: "credit",
      functionalBalance: -300,
    },
    {
      organizationId: "org-1",
      fiscalPeriodId: "fp-2026",
      fiscalPeriodCode: "FY-2026",
      accountId: "equity",
      accountCode: "3101",
      accountName: "Capital",
      accountType: "equity",
      chapterCode: "3",
      presentationCode: "3.1",
      naturalBalance: "credit",
      functionalBalance: -200,
    },
  ]);

  assert.deepEqual(
    rows.map((row) => ({
      accountCode: row.accountCode,
      reportSection: row.reportSection,
      presentationBalance: row.presentationBalance,
      hasAbnormalBalance: row.hasAbnormalBalance,
    })),
    [
      {
        accountCode: "1110",
        reportSection: "asset",
        presentationBalance: 500,
        hasAbnormalBalance: false,
      },
      {
        accountCode: "2101",
        reportSection: "liability",
        presentationBalance: 300,
        hasAbnormalBalance: false,
      },
      {
        accountCode: "3101",
        reportSection: "equity",
        presentationBalance: 200,
        hasAbnormalBalance: false,
      },
    ],
  );
});

test("income statement read model keeps revenue and expense signs presentation-friendly", () => {
  const rows = buildIncomeStatementRows([
    {
      organizationId: "org-1",
      fiscalPeriodId: "fp-2026",
      fiscalPeriodCode: "FY-2026",
      accountId: "sales",
      accountCode: "4101",
      accountName: "Ventas",
      accountType: "revenue",
      chapterCode: "4",
      presentationCode: "4.1",
      naturalBalance: "credit",
      functionalBalance: -1200,
    },
    {
      organizationId: "org-1",
      fiscalPeriodId: "fp-2026",
      fiscalPeriodCode: "FY-2026",
      accountId: "expense",
      accountCode: "6101",
      accountName: "Servicios",
      accountType: "expense",
      chapterCode: "6",
      presentationCode: "6.1",
      naturalBalance: "debit",
      functionalBalance: 450,
    },
  ]);

  assert.deepEqual(
    rows.map((row) => ({
      accountCode: row.accountCode,
      reportSection: row.reportSection,
      presentationBalance: row.presentationBalance,
    })),
    [
      {
        accountCode: "4101",
        reportSection: "revenue",
        presentationBalance: 1200,
      },
      {
        accountCode: "6101",
        reportSection: "expense",
        presentationBalance: 450,
      },
    ],
  );
});
