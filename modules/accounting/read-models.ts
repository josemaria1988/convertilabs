import { roundCurrency } from "@/modules/accounting/normalization";

export type JournalLineageInput = {
  organizationId: string;
  journalEntryId: string;
  entryNumber?: number | null;
  entryDate?: string | null;
  status?: string | null;
  reversesJournalEntryId?: string | null;
  reversedByJournalEntryId?: string | null;
  adjustsJournalEntryId?: string | null;
};

export type JournalLineageRow = {
  organizationId: string;
  journalEntryId: string;
  relatedJournalEntryId: string;
  relationType: "reverses" | "reversed_by" | "adjusts";
  entryNumber: number | null;
  relatedEntryNumber: number | null;
  entryDate: string | null;
  relatedEntryDate: string | null;
  entryStatus: string | null;
  relatedEntryStatus: string | null;
};

export type StatementReadInputRow = {
  organizationId?: string | null;
  fiscalPeriodId?: string | null;
  fiscalPeriodCode?: string | null;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  chapterCode?: string | null;
  presentationCode?: string | null;
  statementSection?: string | null;
  naturalBalance?: "debit" | "credit" | null;
  debit?: number | null;
  credit?: number | null;
  functionalDebit?: number | null;
  functionalCredit?: number | null;
  balance?: number | null;
  functionalBalance?: number | null;
};

export type StatementReadRow = {
  organizationId: string | null;
  fiscalPeriodId: string | null;
  fiscalPeriodCode: string | null;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  chapterCode: string | null;
  presentationCode: string | null;
  statementSection: string | null;
  naturalBalance: "debit" | "credit" | null;
  reportSection: string;
  presentationBalance: number;
  rawFunctionalBalance: number;
  hasAbnormalBalance: boolean;
};

function compareNullableText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").localeCompare(right ?? "");
}

function defaultReportSectionRank(reportSection: string) {
  void reportSection;
  return 99;
}

export function buildJournalLineageRows(entries: JournalLineageInput[]) {
  const byId = new Map(entries.map((entry) => [entry.journalEntryId, entry]));
  const rows: JournalLineageRow[] = [];

  for (const entry of entries) {
    const relationships = [
      {
        relationType: "reverses" as const,
        relatedId: entry.reversesJournalEntryId ?? null,
      },
      {
        relationType: "reversed_by" as const,
        relatedId: entry.reversedByJournalEntryId ?? null,
      },
      {
        relationType: "adjusts" as const,
        relatedId: entry.adjustsJournalEntryId ?? null,
      },
    ];

    for (const relationship of relationships) {
      if (!relationship.relatedId) {
        continue;
      }

      const related = byId.get(relationship.relatedId);
      rows.push({
        organizationId: entry.organizationId,
        journalEntryId: entry.journalEntryId,
        relatedJournalEntryId: relationship.relatedId,
        relationType: relationship.relationType,
        entryNumber: entry.entryNumber ?? null,
        relatedEntryNumber: related?.entryNumber ?? null,
        entryDate: entry.entryDate ?? null,
        relatedEntryDate: related?.entryDate ?? null,
        entryStatus: entry.status ?? null,
        relatedEntryStatus: related?.status ?? null,
      });
    }
  }

  return rows.sort((left, right) =>
    compareNullableText(left.organizationId, right.organizationId)
    || (left.entryNumber ?? Number.MAX_SAFE_INTEGER) - (right.entryNumber ?? Number.MAX_SAFE_INTEGER)
    || compareNullableText(left.journalEntryId, right.journalEntryId)
    || compareNullableText(left.relationType, right.relationType)
    || (left.relatedEntryNumber ?? Number.MAX_SAFE_INTEGER) - (right.relatedEntryNumber ?? Number.MAX_SAFE_INTEGER)
    || compareNullableText(left.relatedJournalEntryId, right.relatedJournalEntryId));
}

function buildStatementRows(
  rows: StatementReadInputRow[],
  filter: (row: StatementReadInputRow) => boolean,
  reportSection: (row: StatementReadInputRow) => string,
  presentationBalance: (row: StatementReadInputRow) => number,
  reportSectionRank: (reportSection: string) => number = defaultReportSectionRank,
) {
  return rows
    .filter(filter)
    .map((row) => {
      const rawFunctionalBalance = roundCurrency(
        row.functionalBalance
        ?? roundCurrency((row.functionalDebit ?? row.debit ?? 0) - (row.functionalCredit ?? row.credit ?? 0)),
      );
      const naturalBalance = row.naturalBalance ?? null;
      const presentation = roundCurrency(presentationBalance({
        ...row,
        functionalBalance: rawFunctionalBalance,
      }));
      const hasAbnormalBalance =
        naturalBalance === "debit"
          ? rawFunctionalBalance < 0
          : naturalBalance === "credit"
            ? rawFunctionalBalance > 0
            : false;

      return {
        organizationId: row.organizationId ?? null,
        fiscalPeriodId: row.fiscalPeriodId ?? null,
        fiscalPeriodCode: row.fiscalPeriodCode ?? null,
        accountId: row.accountId ?? null,
        accountCode: row.accountCode ?? null,
        accountName: row.accountName ?? null,
        accountType: row.accountType ?? null,
        chapterCode: row.chapterCode ?? null,
        presentationCode: row.presentationCode ?? null,
        statementSection: row.statementSection ?? null,
        naturalBalance,
        reportSection: reportSection(row),
        presentationBalance: presentation,
        rawFunctionalBalance,
        hasAbnormalBalance,
      } satisfies StatementReadRow;
    })
    .sort((left, right) =>
      reportSectionRank(left.reportSection) - reportSectionRank(right.reportSection)
      || compareNullableText(left.reportSection, right.reportSection)
      || compareNullableText(left.chapterCode, right.chapterCode)
      || compareNullableText(left.presentationCode, right.presentationCode)
      || compareNullableText(left.accountCode, right.accountCode)
      || compareNullableText(left.accountId, right.accountId));
}

export function buildBalanceSheetRows(rows: StatementReadInputRow[]) {
  return buildStatementRows(
    rows,
    (row) =>
      row.accountType === "asset"
      || row.accountType === "liability"
      || row.accountType === "equity",
    (row) => row.accountType ?? "other",
    (row) =>
      row.accountType === "asset"
        ? row.functionalBalance ?? 0
        : -1 * (row.functionalBalance ?? 0),
    (section) => {
      switch (section) {
        case "asset":
          return 1;
        case "liability":
          return 2;
        case "equity":
          return 3;
        default:
          return 99;
      }
    },
  );
}

export function buildIncomeStatementRows(rows: StatementReadInputRow[]) {
  return buildStatementRows(
    rows,
    (row) => row.accountType === "revenue" || row.accountType === "expense",
    (row) => row.accountType ?? "other",
    (row) =>
      row.accountType === "revenue"
        ? -1 * (row.functionalBalance ?? 0)
        : row.functionalBalance ?? 0,
    (section) => {
      switch (section) {
        case "revenue":
          return 1;
        case "expense":
          return 2;
        default:
          return 99;
      }
    },
  );
}
