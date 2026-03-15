export type DgiReconciliationBucketCode =
  | "sales_basic"
  | "sales_minimum"
  | "purchase_basic"
  | "purchase_minimum"
  | "exempt_or_non_taxed"
  | "import_vat"
  | "import_vat_advance"
  | "withholdings";

export type DgiBucketAmounts = {
  netAmountUyu: number;
  taxAmountUyu: number;
  treatmentKey?: string | null;
};

export type DgiBucketComparison = {
  bucketCode: DgiReconciliationBucketCode;
  label: string;
  dgiNetAmountUyu: number;
  systemNetAmountUyu: number;
  dgiTaxAmountUyu: number;
  systemTaxAmountUyu: number;
  deltaNetAmountUyu: number;
  deltaTaxAmountUyu: number;
  differenceStatus:
    | "matched"
    | "missing_in_system"
    | "extra_in_system"
    | "amount_mismatch"
    | "tax_treatment_mismatch"
    | "pending_manual_adjustment";
  metadata: Record<string, unknown>;
};

export const dgiBucketDefinitions: Array<{
  code: DgiReconciliationBucketCode;
  label: string;
}> = [
  { code: "sales_basic", label: "IVA basica ventas" },
  { code: "sales_minimum", label: "IVA minima ventas" },
  { code: "purchase_basic", label: "IVA basica compras" },
  { code: "purchase_minimum", label: "IVA minima compras" },
  { code: "exempt_or_non_taxed", label: "No gravado / exento" },
  { code: "import_vat", label: "IVA importacion" },
  { code: "import_vat_advance", label: "Anticipo IVA importacion" },
  { code: "withholdings", label: "Percepciones / retenciones" },
];

function roundCurrency(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.round(numeric * 100) / 100;
}

function normalizeBucketAmounts(
  value: Partial<DgiBucketAmounts> | null | undefined,
): DgiBucketAmounts {
  return {
    netAmountUyu: roundCurrency(value?.netAmountUyu),
    taxAmountUyu: roundCurrency(value?.taxAmountUyu),
    treatmentKey:
      typeof value?.treatmentKey === "string" && value.treatmentKey.trim()
        ? value.treatmentKey.trim()
        : null,
  };
}

export function buildEmptyDgiBucketMap() {
  return Object.fromEntries(
    dgiBucketDefinitions.map((bucket) => [
      bucket.code,
      {
        netAmountUyu: 0,
        taxAmountUyu: 0,
        treatmentKey: null,
      } satisfies DgiBucketAmounts,
    ]),
  ) as Record<DgiReconciliationBucketCode, DgiBucketAmounts>;
}

export function buildDgiReconciliationBucketComparisons(input: {
  baseline: Partial<Record<DgiReconciliationBucketCode, Partial<DgiBucketAmounts>>>;
  system: Partial<Record<DgiReconciliationBucketCode, Partial<DgiBucketAmounts>>>;
}) {
  const comparisons = dgiBucketDefinitions.map((bucket) => {
    const baseline = normalizeBucketAmounts(input.baseline[bucket.code]);
    const system = normalizeBucketAmounts(input.system[bucket.code]);
    const deltaNetAmountUyu = roundCurrency(system.netAmountUyu - baseline.netAmountUyu);
    const deltaTaxAmountUyu = roundCurrency(system.taxAmountUyu - baseline.taxAmountUyu);
    const baselineHasAmount = baseline.netAmountUyu !== 0 || baseline.taxAmountUyu !== 0;
    const systemHasAmount = system.netAmountUyu !== 0 || system.taxAmountUyu !== 0;
    let differenceStatus: DgiBucketComparison["differenceStatus"] = "matched";

    if (baseline.treatmentKey && system.treatmentKey && baseline.treatmentKey !== system.treatmentKey) {
      differenceStatus = "tax_treatment_mismatch";
    } else if (baselineHasAmount && !systemHasAmount) {
      differenceStatus = "missing_in_system";
    } else if (!baselineHasAmount && systemHasAmount) {
      differenceStatus = "extra_in_system";
    } else if (deltaNetAmountUyu !== 0 || deltaTaxAmountUyu !== 0) {
      differenceStatus = "amount_mismatch";
    }

    return {
      bucketCode: bucket.code,
      label: bucket.label,
      dgiNetAmountUyu: baseline.netAmountUyu,
      systemNetAmountUyu: system.netAmountUyu,
      dgiTaxAmountUyu: baseline.taxAmountUyu,
      systemTaxAmountUyu: system.taxAmountUyu,
      deltaNetAmountUyu,
      deltaTaxAmountUyu,
      differenceStatus,
      metadata: {
        baseline_treatment_key: baseline.treatmentKey,
        system_treatment_key: system.treatmentKey,
      },
    } satisfies DgiBucketComparison;
  });

  return comparisons;
}

export function summarizeDgiReconciliationDifferences(
  comparisons: DgiBucketComparison[],
) {
  return comparisons.reduce<Record<string, number>>((summary, bucket) => {
    summary[bucket.differenceStatus] = (summary[bucket.differenceStatus] ?? 0) + 1;
    return summary;
  }, {});
}
