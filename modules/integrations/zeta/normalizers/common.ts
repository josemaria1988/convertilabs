import {
  normalizeCurrencyCode,
  normalizeDocumentNumber,
  normalizeTaxId,
  normalizeTextToken,
  roundCurrency,
} from "@/modules/accounting";
import { fingerprintIntegrationPayload } from "@/modules/integrations/repository";

export type JsonRecord = Record<string, unknown>;

export type ZetaCanonicalLineItem = {
  lineNumber: number;
  conceptCode: string | null;
  description: string | null;
  quantity: number | null;
  unitAmount: number | null;
  netAmount: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  metadata: JsonRecord;
};

export type ZetaCanonicalDocument = {
  provider: "zetasoftware";
  sourceKind: "zeta_sales" | "zeta_received_cfe";
  stream: string;
  entityType: string;
  externalKey: string;
  humanKey: string;
  payloadHash: string;
  documentRole: "sale" | "purchase";
  documentType: string;
  issueDate: string | null;
  dueDate: string | null;
  series: string | null;
  number: string | null;
  reference: string | null;
  localCode: string | null;
  costCenterExternalCode: string | null;
  operationCode: string | null;
  counterparty: {
    role: "customer" | "vendor";
    externalCode: string | null;
    name: string | null;
    legalName: string | null;
    taxId: string | null;
    taxIdNormalized: string | null;
  };
  currency: {
    currencyCode: string | null;
    zetaCurrencyCode: string | number | null;
    sourceRate: number | null;
    sourceRateDate: string | null;
    sourceRateKind: string | null;
    fxStatus: "same_currency" | "source_rate_ok" | "missing_rate_blocked";
  };
  amounts: {
    net: number | null;
    tax: number | null;
    total: number | null;
  };
  cfe: {
    typeCode: string | number | null;
    state: string | null;
    dgiState: string | null;
    receiverState: string | null;
  };
  lines: ZetaCanonicalLineItem[];
  warnings: string[];
  sourcePdfUrl: string | null;
  raw: JsonRecord;
};

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,(?=\d{1,8}(?:\D|$))/g, ".")
    .replace(/[^0-9.\-]/g, "");

  if (!cleaned) {
    return null;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function asCurrency(value: unknown) {
  const parsed = asNumber(value);
  return typeof parsed === "number" ? roundCurrency(parsed) : null;
}

export function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = asString(value);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const normalized = asNumber(value);

    if (typeof normalized === "number") {
      return normalized;
    }
  }

  return null;
}

export function parseZetaDate(value: unknown) {
  const raw = asString(value);

  if (!raw) {
    return null;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (slash) {
    return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

export function normalizeZetaCurrency(input: {
  code?: unknown;
  iso?: unknown;
  symbol?: unknown;
  name?: unknown;
  abbreviation?: unknown;
}) {
  const iso = normalizeCurrencyCode(asString(input.iso));

  if (iso && iso.length === 3) {
    return iso;
  }

  const normalized = normalizeTextToken(
    [
      asString(input.symbol),
      asString(input.name),
      asString(input.abbreviation),
      asString(input.code),
    ].filter(Boolean).join(" "),
  );

  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("usd")
    || normalized.includes("u s")
    || normalized.includes("us$")
    || normalized.includes("dolar")
  ) {
    return "USD";
  }

  if (
    normalized === "$"
    || normalized.includes("uyu")
    || normalized.includes("peso")
    || normalized.includes("moneda nacional")
  ) {
    return "UYU";
  }

  return null;
}

export function signedAmount(input: {
  signed?: unknown;
  unsigned?: unknown;
  sign?: unknown;
}) {
  const signed = asCurrency(input.signed);

  if (typeof signed === "number") {
    return signed;
  }

  const unsigned = asCurrency(input.unsigned);

  if (typeof unsigned !== "number") {
    return null;
  }

  const sign = asNumber(input.sign);

  if (typeof sign === "number" && sign < 0) {
    return roundCurrency(unsigned * -1);
  }

  return unsigned;
}

export function normalizeIdentityPart(value: string | null | undefined) {
  const normalized = normalizeDocumentNumber(value);
  return normalized ?? "na";
}

export function compactMetadata(input: JsonRecord) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as JsonRecord;
}

export function buildCanonicalPayloadHash(input: unknown) {
  return fingerprintIntegrationPayload(input);
}

export function normalizeCounterpartyTaxId(value: unknown) {
  return normalizeTaxId(asString(value));
}

export function normalizeCounterpartyName(value: unknown) {
  return asString(value);
}
