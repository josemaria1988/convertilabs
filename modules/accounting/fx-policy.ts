import { roundCurrency } from "@/modules/accounting/normalization";
import type { DocumentIntakeFactMap } from "@/modules/accounting/types";
import {
  resolveBcuFiscalFxRate,
  type BcuResolvedFxRate,
} from "@/modules/accounting/bcu-fx-service";

export const MISSING_FX_RATE_ERROR_CODE = "MISSING_FX_RATE";

export type FiscalFxPolicyCode = "dgi_previous_business_day_interbank";
export type PersistedDocumentFxSource = "document_import" | "bcu";

export type FiscalFxResolution = {
  policyCode: FiscalFxPolicyCode;
  currencyCode: string;
  functionalCurrencyCode: string;
  source:
    | "same_currency"
    | "bcu"
    | "cfe"
    | "manual_override"
    | "document_import"
    | "document_default";
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

export type StoredDocumentFxContext = {
  rate: number | null;
  source: PersistedDocumentFxSource | null;
  date: string | null;
  missingErrorCode: string | null;
  blockingReason: string | null;
};

function normalizeCurrencyCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized && normalized.length === 3 ? normalized : "UYU";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePositiveRate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function hasFunctionalFxResolution(input: {
  currencyCode: string;
  functionalCurrencyCode: string;
  rate: number;
  blockingReasons: string[];
}) {
  if (input.currencyCode === input.functionalCurrencyCode) {
    return true;
  }

  return input.blockingReasons.length === 0 && input.rate > 0;
}

function buildBcuLookupUnavailableReason(documentDate: string | null | undefined) {
  return documentDate
    ? `No pudimos consultar la cotizacion BCU para resolver el tipo de cambio fiscal previo al ${documentDate}.`
    : "No pudimos consultar la cotizacion BCU para resolver el tipo de cambio fiscal de este documento.";
}

function isGenericFxFetchFailureMessage(value: string) {
  return /fetch failed|failed to fetch|networkerror|network request failed|socket hang up|econnreset|enotfound|etimedout|timeout/i
    .test(value);
}

function normalizeFxLookupBlockingReason(input: {
  error: unknown;
  documentDate: string | null | undefined;
  fallbackBlockingReason: string;
}) {
  if (!(input.error instanceof Error) || !input.error.message.trim()) {
    return input.fallbackBlockingReason;
  }

  const message = input.error.message.trim();

  if (isGenericFxFetchFailureMessage(message)) {
    return buildBcuLookupUnavailableReason(input.documentDate);
  }

  return message;
}

function isPersistedDocumentFxSource(value: string | null): value is PersistedDocumentFxSource {
  return value === "document_import" || value === "bcu";
}

export function buildMissingFxBlockingReason(documentDate: string | null | undefined) {
  return documentDate
    ? `${MISSING_FX_RATE_ERROR_CODE}: No encontramos cotizacion BCU para el cierre habil previo del ${documentDate}.`
    : `${MISSING_FX_RATE_ERROR_CODE}: No encontramos cotizacion BCU para este documento en moneda extranjera.`;
}

export function extractStoredDocumentFxContext(value: unknown): StoredDocumentFxContext {
  const record = asRecord(value);
  const rawSource = asString(record.document_fx_rate_source);

  return {
    rate: normalizePositiveRate(asNumber(record.document_fx_rate)),
    source: isPersistedDocumentFxSource(rawSource) ? rawSource : null,
    date: asString(record.document_fx_rate_date),
    missingErrorCode: asString(record.document_fx_missing_error_code),
    blockingReason: asString(record.document_fx_blocking_reason),
  } satisfies StoredDocumentFxContext;
}

export async function resolveFiscalFxPolicy(input: {
  facts: DocumentIntakeFactMap;
  functionalCurrencyCode?: string | null;
  overrideRate?: number | null;
  overrideReason?: string | null;
  documentRate?: number | null;
  documentRateDate?: string | null;
  documentRateSource?: PersistedDocumentFxSource | null;
  allowBcuLookup?: boolean;
  fallbackBlockingReason?: string | null;
  fetchImpl?: typeof fetch;
}) {
  const currencyCode = normalizeCurrencyCode(input.facts.currency_code);
  const functionalCurrencyCode = normalizeCurrencyCode(input.functionalCurrencyCode ?? "UYU");
  const documentDate = input.facts.document_date ?? null;
  const fallbackBlockingReason =
    input.fallbackBlockingReason?.trim() || buildMissingFxBlockingReason(documentDate);

  if (currencyCode === functionalCurrencyCode) {
    return {
      policyCode: "dgi_previous_business_day_interbank",
      currencyCode,
      functionalCurrencyCode,
      source: "same_currency",
      rate: 1,
      bcuValue: 1,
      bcuDateUsed: documentDate,
      bcuSeries: null,
      documentValue: 1,
      documentDate,
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
      documentDate,
      overrideReason: input.overrideReason ?? null,
      warnings: ["Se uso un tipo de cambio manual con motivo auditado."],
      blockingReasons: [],
    } satisfies FiscalFxResolution;
  }

  const persistedDocumentRate = normalizePositiveRate(input.documentRate);

  if (persistedDocumentRate) {
    if (input.documentRateSource === "bcu") {
      return {
        policyCode: "dgi_previous_business_day_interbank",
        currencyCode,
        functionalCurrencyCode,
        source: "bcu",
        rate: persistedDocumentRate,
        bcuValue: persistedDocumentRate,
        bcuDateUsed: input.documentRateDate ?? documentDate,
        bcuSeries: null,
        documentValue: null,
        documentDate: input.documentRateDate ?? documentDate,
        overrideReason: null,
        warnings: [],
        blockingReasons: [],
      } satisfies FiscalFxResolution;
    }

    return {
      policyCode: "dgi_previous_business_day_interbank",
      currencyCode,
      functionalCurrencyCode,
      source: "document_import",
      rate: persistedDocumentRate,
      bcuValue: null,
      bcuDateUsed: null,
      bcuSeries: null,
      documentValue: persistedDocumentRate,
      documentDate: input.documentRateDate ?? documentDate,
      overrideReason: null,
      warnings: [],
      blockingReasons: [],
    } satisfies FiscalFxResolution;
  }

  if (input.allowBcuLookup === false) {
    return {
      policyCode: "dgi_previous_business_day_interbank",
      currencyCode,
      functionalCurrencyCode,
      source: "document_default",
      rate: 0,
      bcuValue: null,
      bcuDateUsed: null,
      bcuSeries: null,
      documentValue: null,
      documentDate,
      overrideReason: null,
      warnings: [],
      blockingReasons: [fallbackBlockingReason],
    } satisfies FiscalFxResolution;
  }

  let resolvedRate: BcuResolvedFxRate | null = null;
  const warnings: string[] = [];
  const blockingReasons: string[] = [];

  try {
    resolvedRate = await resolveBcuFiscalFxRate({
      currencyCode,
      documentDate,
      fetchImpl: input.fetchImpl,
    });
  } catch (error) {
    blockingReasons.push(
      normalizeFxLookupBlockingReason({
        error,
        documentDate,
        fallbackBlockingReason,
      }),
    );
  }

  if (!resolvedRate) {
    if (blockingReasons.length === 0) {
      blockingReasons.push(fallbackBlockingReason);
    }

    return {
      policyCode: "dgi_previous_business_day_interbank",
      currencyCode,
      functionalCurrencyCode,
      source: "document_default",
      rate: 0,
      bcuValue: null,
      bcuDateUsed: null,
      bcuSeries: null,
      documentValue: null,
      documentDate,
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
    documentDate,
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
  documentRate?: number | null;
  documentRateDate?: string | null;
  documentRateSource?: PersistedDocumentFxSource | null;
  allowBcuLookup?: boolean;
  fallbackBlockingReason?: string | null;
  fetchImpl?: typeof fetch;
}) {
  const fx = await resolveFiscalFxPolicy(input);
  const netAmountOriginal = asNumber(input.facts.subtotal) ?? 0;
  const taxAmountOriginal = asNumber(input.facts.tax_amount) ?? 0;
  const totalAmountOriginal = asNumber(input.facts.total_amount) ?? 0;
  const functionalFxResolved = hasFunctionalFxResolution({
    currencyCode: fx.currencyCode,
    functionalCurrencyCode: fx.functionalCurrencyCode,
    rate: fx.rate,
    blockingReasons: fx.blockingReasons,
  });
  const functionalRate = functionalFxResolved ? fx.rate : 0;

  return {
    currencyCode: fx.currencyCode,
    netAmountOriginal: roundCurrency(netAmountOriginal),
    taxAmountOriginal: roundCurrency(taxAmountOriginal),
    totalAmountOriginal: roundCurrency(totalAmountOriginal),
    netAmountUyu: roundCurrency(netAmountOriginal * functionalRate),
    taxAmountUyu: roundCurrency(taxAmountOriginal * functionalRate),
    totalAmountUyu: roundCurrency(totalAmountOriginal * functionalRate),
    fx,
  } satisfies DocumentMonetarySnapshot;
}
