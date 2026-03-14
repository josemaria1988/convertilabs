import type {
  ChartOfAccountsImportCanonical,
  HistoricalVatLiquidationCanonical,
  JournalTemplateImportCanonical,
  SpreadsheetCanonicalPayload,
} from "@/modules/spreadsheets/types";
import {
  buildCanonicalTaxPayload,
  type CanonicalAccountingPayload,
  type CanonicalTaxPayload,
} from "@/modules/exports/canonical";

export function spreadsheetCanonicalToTaxPayload(
  canonical: HistoricalVatLiquidationCanonical,
) {
  const latestPeriod = canonical.periods[0] ?? null;

  return buildCanonicalTaxPayload({
    organizationId: canonical.organizationId ?? "unknown",
    vatRunId: null,
    periodLabel: latestPeriod?.periodLabel ?? null,
    metrics: latestPeriod
      ? [
          {
            metricKey: "purchaseTaxableBase",
            value: latestPeriod.purchaseTaxableBase,
            sourceType: canonical.sourceType,
            warnings: [],
          },
          {
            metricKey: "saleTaxableBase",
            value: latestPeriod.saleTaxableBase,
            sourceType: canonical.sourceType,
            warnings: [],
          },
          {
            metricKey: "outputVat",
            value: latestPeriod.outputVat,
            sourceType: canonical.sourceType,
            warnings: [],
          },
          {
            metricKey: "inputVatCreditable",
            value: latestPeriod.inputVatCreditable,
            sourceType: canonical.sourceType,
            warnings: [],
          },
          {
            metricKey: "inputVatNonDeductible",
            value: latestPeriod.inputVatNonDeductible,
            sourceType: canonical.sourceType,
            warnings: [],
          },
          {
            metricKey: "importVat",
            value: latestPeriod.importVat,
            sourceType: canonical.sourceType,
            warnings: [],
          },
          {
            metricKey: "importVatAdvance",
            value: latestPeriod.importVatAdvance,
            sourceType: canonical.sourceType,
            warnings: [],
          },
          {
            metricKey: "netVatPayable",
            value: latestPeriod.netVatPayable,
            sourceType: canonical.sourceType,
            warnings: [],
          },
        ]
      : [],
    warnings: canonical.warnings,
  });
}

function buildAccountingPayloadFromTemplates(
  canonical: JournalTemplateImportCanonical,
) {
  return {
    organizationId: canonical.organizationId,
    payloadType: "journal_templates",
    sourceType: canonical.sourceType,
    entries: [],
    templates: canonical.templates.map((template) => ({
      templateName: template.templateName,
      conceptName: template.conceptName,
      mainAccountCode: template.mainAccountCode,
      operationCategory: template.operationCategory,
    })),
    chart: [],
    warnings: canonical.warnings,
  } satisfies CanonicalAccountingPayload;
}

function buildAccountingPayloadFromChart(
  canonical: ChartOfAccountsImportCanonical,
) {
  return {
    organizationId: canonical.organizationId,
    payloadType: "chart_of_accounts",
    sourceType: canonical.sourceType,
    entries: [],
    templates: [],
    chart: canonical.accounts.map((account) => ({
      code: account.code,
      name: account.name,
      accountType: account.accountType,
      normalSide: account.normalSide,
      isPostable: account.isPostable,
    })),
    warnings: canonical.warnings,
  } satisfies CanonicalAccountingPayload;
}

export function spreadsheetCanonicalToAccountingPayload(
  canonical: SpreadsheetCanonicalPayload,
) {
  if (canonical.importType === "journal_template_import") {
    return buildAccountingPayloadFromTemplates(canonical);
  }

  if (canonical.importType === "chart_of_accounts_import") {
    return buildAccountingPayloadFromChart(canonical);
  }

  return {
    organizationId: canonical.organizationId,
    payloadType: "journal_entries",
    sourceType: canonical.sourceType,
    entries: [],
    templates: [],
    chart: [],
    warnings: canonical.warnings,
  } satisfies CanonicalAccountingPayload;
}

export function isSpreadsheetTaxCanonical(
  payload: SpreadsheetCanonicalPayload,
): payload is HistoricalVatLiquidationCanonical {
  return payload.importType === "historical_vat_liquidation";
}

export type {
  CanonicalAccountingPayload,
  CanonicalTaxPayload,
};
