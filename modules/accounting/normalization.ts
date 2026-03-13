import type { JsonRecord } from "@/modules/accounting/types";

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function roundCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100) / 100;
}

export function normalizeWhitespace(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

export function normalizeTextToken(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return null;
  }

  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizeTaxId(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\D+/g, "");
  return normalized || null;
}

export function normalizeDocumentNumber(value: string | null | undefined) {
  const normalized = normalizeTextToken(value);

  if (!normalized) {
    return null;
  }

  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  return compact || null;
}

export function normalizeCurrencyCode(value: string | null | undefined) {
  const normalized = normalizeTextToken(value);

  if (!normalized) {
    return null;
  }

  return normalized.toUpperCase();
}
