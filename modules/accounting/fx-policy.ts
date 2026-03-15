import { roundCurrency } from "@/modules/accounting/normalization";
import type { DocumentIntakeFactMap } from "@/modules/accounting/types";
import {
  resolveBcuFiscalFxRate,
  type BcuResolvedFxRate,
} from "@/modules/accounting/bcu-fx-service";

export type FiscalFxPolicyCode = "dgi_previous_business_day_interbank";

export type FiscalFxResolution = {
  policyCode: FiscalFxPolicyCode;
  currencyCode: string;
  functionalCurrencyCode: string;
  source: "same_currency" | "bcu" | "cfe" | "manual_override" | "document_default";
  rate: number;
  bcuValue: number | null;
  bcuDateUsed: string | null;
  bcuSeries: string | null;
  documentValue: number | null;
  documentDate: string | null;
  overrideReason: string | null;
  warnings: string[];
  blockingReasons: string[];
};

export type DocumentMonetarySnapshot = {
  currencyCode: string;
  netAmountOriginal: number;
  taxAmountOriginal: number;
  totalAmountOriginal: number;
  netAmountUyu: number;
  taxAmountUyu: number;
  totalAmountUyu: number;
  fx: FiscalFxResolution;
};

function normalizeCurrencyCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized && normalized.length === 3 ? normalized : "UYU";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function resolveFiscalFxPolicy(input: {
  facts: DocumentIntakeFactMap;
  functionalCurrencyCode?: string | null;
  overrideRate?: number | null;
  overrideReason?: string | null;
  fetchImpl?: typeof fetch;
}) {
  const currencyCode = normalizeCurrencyCode(input.facts.currency_code);
  const functionalCurrencyCode = normalizeCurrencyCode(input.functionalCurrencyCode ?? "UYU");

  if (currencyCode === functionalCurrencyCode) {
    return {
      policyCode: "dgi_previous_business_day_interbank",
      currencyCode,
      functionalCurrencyCode,
      source: "same_currency",
      rate: 1,
      bcuValue: 1,
      bcuDateUsed: input.facts.document_date ?? null,
      bcuSeries: null,
      documentValue: 1,
      documentDate: input.facts.document_date ?? null,
      overrideReason: null,
      warnings: [],
      blockingReasons: [],
    } satisfies FiscalFxResolution;
  }

  if (
    typeof input.overrideRate === "number"
    && Number.isFinite(input.overrideRate)
    && input.overrideRate > 0
  ) {
    return {
      policyCode: "dgi_previous_business_day_interbank",
      currencyCode,
      functionalCurrencyCode,
      source: "manual_override",
      rate: input.overrideRate,
      bcuValue: null,
      bcuDateUsed: null,
      bcuSeries: null,
      documentValue: null,
      documentDate: input.facts.document_date ?? null,
      overrideReason: input.overrideReason ?? null,
      warnings: ["Se uso un tipo de cambio manual con motivo auditado."],
      blockingReasons: [],
    } satisfies FiscalFxResolution;
  }

  let resolvedRate: BcuResolvedFxRate | null = null;
  const warnings: string[] = [];
  const blockingReasons: string[] = [];

  try {
    resolvedRate = await resolveBcuFiscalFxRate({
      currencyCode,
      documentDate: input.facts.document_date,
      fetchImpl: input.fetchImpl,
    });
  } catch (error) {
    blockingReasons.push(
      error instanceof Error
        ? error.message
        : "No se pudo resolver el tipo de cambio fiscal BCU.",
    );
  }

  if (!resolvedRate) {
    return {
      policyCode: "dgi_previous_business_day_interbank",
      currencyCode,
      functionalCurrencyCode,
      source: "document_default",
      rate: 1,
      bcuValue: null,
      bcuDateUsed: null,
      bcuSeries: null,
      documentValue: null,
      documentDate: input.facts.document_date ?? null,
      overrideReason: null,
      warnings,
      blockingReasons,
    } satisfies FiscalFxResolution;
  }

  return {
    policyCode: "dgi_previous_business_day_interbank",
    currencyCode,
    functionalCurrencyCode,
    source: "bcu",
    rate: resolvedRate.rate,
    bcuValue: resolvedRate.rate,
    bcuDateUsed: resolvedRate.dateUsed,
    bcuSeries: resolvedRate.seriesCode,
    documentValue: null,
    documentDate: input.facts.document_date ?? null,
    overrideReason: null,
    warnings,
    blockingReasons,
  } satisfies FiscalFxResolution;
}

export async function buildDocumentMonetarySnapshot(input: {
  facts: DocumentIntakeFactMap;
  functionalCurrencyCode?: string | null;
  overrideRate?: number | null;
  overrideReason?: string | null;
  fetchImpl?: typeof fetch;
}) {
  const fx = await resolveFiscalFxPolicy(input);
  const netAmountOriginal = asNumber(input.facts.subtotal);
  const taxAmountOriginal = asNumber(input.facts.tax_amount);
  const totalAmountOriginal = asNumber(input.facts.total_amount);

  return {
    currencyCode: fx.currencyCode,
    netAmountOriginal: roundCurrency(netAmountOriginal),
    taxAmountOriginal: roundCurrency(taxAmountOriginal),
    totalAmountOriginal: roundCurrency(totalAmountOriginal),
    netAmountUyu: roundCurrency(netAmountOriginal * fx.rate),
    taxAmountUyu: roundCurrency(taxAmountOriginal * fx.rate),
    totalAmountUyu: roundCurrency(totalAmountOriginal * fx.rate),
    fx,
  } satisfies DocumentMonetarySnapshot;
}
