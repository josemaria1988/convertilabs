export type CanonicalSourceType =
  | "system_generated"
  | "imported_from_spreadsheet"
  | "imported_from_document"
  | "manual_override";

export type CanonicalTaxMetricKey =
  | "purchaseTaxableBase"
  | "saleTaxableBase"
  | "outputVat"
  | "inputVatCreditable"
  | "inputVatNonDeductible"
  | "importVat"
  | "importVatAdvance"
  | "netVatPayable";

export type CanonicalTaxMetric = {
  metricKey: CanonicalTaxMetricKey;
  value: number;
  sourceType: CanonicalSourceType;
  warnings: string[];
};

export type CanonicalTaxPayload = {
  organizationId: string;
  vatRunId: string | null;
  periodLabel: string | null;
  metrics: CanonicalTaxMetric[];
  warnings: string[];
};

export type CanonicalAccountingPayload = {
  organizationId: string | null;
  payloadType: "journal_entries" | "journal_templates" | "chart_of_accounts";
  sourceType: CanonicalSourceType;
  entries: Array<{
    reference: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
  }>;
  templates: Array<{
    templateName: string;
    conceptName: string | null;
    mainAccountCode: string | null;
    operationCategory: string | null;
  }>;
  chart: Array<{
    code: string;
    name: string;
    accountType: string | null;
    normalSide: string | null;
    isPostable: boolean;
  }>;
  warnings: string[];
};

export type DGIFormMappingRecord = {
  formCode: string;
  lineCode: string;
  metricKey: CanonicalTaxMetricKey;
  label: string;
  calculationMode: "direct_metric";
  version: number;
  isFallback?: boolean;
};

export type DGIFormSummaryLine = {
  lineCode: string;
  label: string;
  metricKey: CanonicalTaxMetricKey;
  value: number;
  sourceType: CanonicalSourceType;
  warnings: string[];
};

export type DGIFormSummary = {
  organizationId: string;
  vatRunId: string | null;
  formCode: string;
  lines: DGIFormSummaryLine[];
  warnings: string[];
};

export function buildFallbackDgiMappings() {
  return [
    {
      formCode: "2176",
      lineCode: "114",
      metricKey: "outputVat",
      label: "IVA debito fiscal",
      calculationMode: "direct_metric",
      version: 1,
      isFallback: true,
    },
    {
      formCode: "2176",
      lineCode: "214",
      metricKey: "inputVatCreditable",
      label: "IVA compras acreditable",
      calculationMode: "direct_metric",
      version: 1,
      isFallback: true,
    },
    {
      formCode: "2176",
      lineCode: "216",
      metricKey: "importVat",
      label: "IVA importacion",
      calculationMode: "direct_metric",
      version: 1,
      isFallback: true,
    },
    {
      formCode: "2176",
      lineCode: "217",
      metricKey: "importVatAdvance",
      label: "Anticipo IVA importacion",
      calculationMode: "direct_metric",
      version: 1,
      isFallback: true,
    },
    {
      formCode: "2176",
      lineCode: "299",
      metricKey: "netVatPayable",
      label: "Resultado neto del periodo",
      calculationMode: "direct_metric",
      version: 1,
      isFallback: true,
    },
  ] satisfies DGIFormMappingRecord[];
}

export function buildCanonicalTaxPayload(input: {
  organizationId: string;
  vatRunId: string | null;
  periodLabel: string | null;
  metrics: CanonicalTaxMetric[];
  warnings?: string[];
}) {
  return {
    organizationId: input.organizationId,
    vatRunId: input.vatRunId,
    periodLabel: input.periodLabel,
    metrics: input.metrics,
    warnings: input.warnings ?? [],
  } satisfies CanonicalTaxPayload;
}

export function buildDgiFormSummary(input: {
  organizationId: string;
  vatRunId: string | null;
  formCode: string;
  metrics: CanonicalTaxMetric[];
  mappings: DGIFormMappingRecord[];
  warnings?: string[];
}) {
  const metricByKey = new Map(input.metrics.map((metric) => [metric.metricKey, metric]));
  const lines = input.mappings
    .filter((mapping) => mapping.formCode === input.formCode)
    .map((mapping) => {
      const metric = metricByKey.get(mapping.metricKey);

      return {
        lineCode: mapping.lineCode,
        label: mapping.label,
        metricKey: mapping.metricKey,
        value: metric?.value ?? 0,
        sourceType: metric?.sourceType ?? "system_generated",
        warnings: metric?.warnings ?? [],
      } satisfies DGIFormSummaryLine;
    });

  return {
    organizationId: input.organizationId,
    vatRunId: input.vatRunId,
    formCode: input.formCode,
    lines,
    warnings: input.warnings ?? [],
  } satisfies DGIFormSummary;
}
