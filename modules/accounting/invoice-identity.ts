import type {
  DocumentIntakeFactMap,
  InvoiceDuplicateStatus,
  InvoiceIdentityResult,
} from "@/modules/accounting/types";
import {
  normalizeCurrencyCode,
  normalizeDocumentNumber,
  normalizeTaxId,
  normalizeTextToken,
  roundCurrency,
} from "@/modules/accounting/normalization";

function buildReason(input: {
  duplicateStatus: InvoiceDuplicateStatus;
  fileHashDuplicateDocumentIds: string[];
  businessDuplicateDocumentId: string | null;
  suspiciousDuplicateDocumentId: string | null;
}) {
  if (input.duplicateStatus !== "suspected_duplicate") {
    return null;
  }

  if (input.fileHashDuplicateDocumentIds.length > 0 && input.businessDuplicateDocumentId) {
    return "file_hash_and_business_identity_match";
  }

  if (input.fileHashDuplicateDocumentIds.length > 0) {
    return "file_hash_match";
  }

  if (input.businessDuplicateDocumentId) {
    return "business_identity_match";
  }

  if (input.suspiciousDuplicateDocumentId) {
    return "fuzzy_business_identity_match";
  }

  return null;
}

type DuplicateCandidate = {
  documentId: string;
  issuerTaxIdNormalized: string | null;
  issuerNameNormalized: string | null;
  documentNumberNormalized: string | null;
  documentDate: string | null;
  totalAmount: number | null;
  currencyCode: string | null;
};

function parseDateToDayValue(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 86_400_000) : null;
}

function sameIssuer(input: {
  candidate: DuplicateCandidate;
  issuerTaxIdNormalized: string | null;
  issuerNameNormalized: string | null;
}) {
  if (
    input.issuerTaxIdNormalized
    && input.candidate.issuerTaxIdNormalized === input.issuerTaxIdNormalized
  ) {
    return true;
  }

  return Boolean(
    input.issuerNameNormalized
    && input.candidate.issuerNameNormalized
    && input.candidate.issuerNameNormalized === input.issuerNameNormalized,
  );
}

export function pickSuspiciousInvoiceDuplicateDocumentId(input: {
  issuerTaxIdNormalized: string | null;
  issuerNameNormalized: string | null;
  documentNumberNormalized: string | null;
  documentDate: string | null;
  totalAmount: number | null;
  currencyCode: string | null;
  candidates: DuplicateCandidate[];
}) {
  if (!input.documentNumberNormalized) {
    return null;
  }

  const targetDay = parseDateToDayValue(input.documentDate);

  for (const candidate of input.candidates) {
    if (candidate.documentNumberNormalized !== input.documentNumberNormalized) {
      continue;
    }

    if (!sameIssuer({
      candidate,
      issuerTaxIdNormalized: input.issuerTaxIdNormalized,
      issuerNameNormalized: input.issuerNameNormalized,
    })) {
      continue;
    }

    if (
      input.currencyCode
      && candidate.currencyCode
      && candidate.currencyCode !== input.currencyCode
    ) {
      continue;
    }

    const candidateDay = parseDateToDayValue(candidate.documentDate);
    const dateDistanceDays =
      targetDay !== null && candidateDay !== null
        ? Math.abs(targetDay - candidateDay)
        : null;
    const amountDelta =
      typeof input.totalAmount === "number" && typeof candidate.totalAmount === "number"
        ? Math.abs(roundCurrency(input.totalAmount) - roundCurrency(candidate.totalAmount))
        : null;
    const dateNear = dateDistanceDays !== null && dateDistanceDays <= 7;
    const amountNear = amountDelta !== null && amountDelta <= 2;
    const exactDate = Boolean(
      input.documentDate && candidate.documentDate && input.documentDate === candidate.documentDate,
    );
    const exactAmount = amountDelta !== null && amountDelta < 0.01;

    if ((exactDate && exactAmount) || (!dateNear && !amountNear)) {
      continue;
    }

    return candidate.documentId;
  }

  return null;
}

export function buildInvoiceIdentityResult(input: {
  facts: DocumentIntakeFactMap;
  fileHashDuplicateDocumentIds?: string[];
  businessDuplicateDocumentId?: string | null;
  suspiciousDuplicateDocumentId?: string | null;
  persistedDuplicateStatus?: InvoiceDuplicateStatus | null;
  persistedDuplicateOfDocumentId?: string | null;
  persistedDuplicateReason?: string | null;
}) {
  const issuerTaxIdNormalized = normalizeTaxId(input.facts.issuer_tax_id);
  const issuerNameNormalized = normalizeTextToken(input.facts.issuer_name);
  const documentNumberNormalized = normalizeDocumentNumber(
    [input.facts.series, input.facts.document_number].filter(Boolean).join("-"),
  );
  const documentDate = input.facts.document_date ?? null;
  const totalAmount =
    typeof input.facts.total_amount === "number"
      ? roundCurrency(input.facts.total_amount)
      : null;
  const currencyCode = normalizeCurrencyCode(input.facts.currency_code);
  let identityStrategy: InvoiceIdentityResult["identityStrategy"] = "insufficient_data";
  let invoiceIdentityKey: string | null = null;

  if (issuerTaxIdNormalized && documentNumberNormalized && documentDate) {
    identityStrategy = "tax_id_number_date";
    invoiceIdentityKey = [
      issuerTaxIdNormalized,
      documentNumberNormalized,
      documentDate,
    ].join("|");
  } else if (
    issuerTaxIdNormalized
    && documentNumberNormalized
    && totalAmount !== null
    && currencyCode
  ) {
    identityStrategy = "tax_id_number_total_currency";
    invoiceIdentityKey = [
      issuerTaxIdNormalized,
      documentNumberNormalized,
      totalAmount.toFixed(2),
      currencyCode,
    ].join("|");
  } else if (
    issuerNameNormalized
    && documentNumberNormalized
    && documentDate
    && totalAmount !== null
    && currencyCode
  ) {
    identityStrategy = "name_number_date_total_currency";
    invoiceIdentityKey = [
      issuerNameNormalized,
      documentNumberNormalized,
      documentDate,
      totalAmount.toFixed(2),
      currencyCode,
    ].join("|");
  }

  const fileHashDuplicateDocumentIds = input.fileHashDuplicateDocumentIds ?? [];
  const businessDuplicateDocumentId = input.businessDuplicateDocumentId ?? null;
  const suspiciousDuplicateDocumentId = input.suspiciousDuplicateDocumentId ?? null;
  const duplicateStatus =
    input.persistedDuplicateStatus
    ?? (
      fileHashDuplicateDocumentIds.length > 0
      || businessDuplicateDocumentId
      || suspiciousDuplicateDocumentId
        ? "suspected_duplicate"
        : "clear"
    );
  const duplicateOfDocumentId =
    input.persistedDuplicateOfDocumentId
    ?? businessDuplicateDocumentId
    ?? suspiciousDuplicateDocumentId
    ?? fileHashDuplicateDocumentIds[0]
    ?? null;
  const duplicateReason =
    input.persistedDuplicateReason
    ?? buildReason({
      duplicateStatus,
      fileHashDuplicateDocumentIds,
      businessDuplicateDocumentId,
      suspiciousDuplicateDocumentId,
    });
  const blockingReasons =
    duplicateStatus === "suspected_duplicate"
      ? ["El documento tiene un posible duplicado y requiere resolucion explicita."]
      : duplicateStatus === "confirmed_duplicate"
        ? ["El documento fue marcado como duplicado confirmado."]
        : [];

  return {
    issuerTaxIdNormalized,
    issuerNameNormalized,
    documentNumberNormalized,
    documentDate,
    totalAmount,
    currencyCode,
    identityStrategy,
    invoiceIdentityKey,
    duplicateStatus,
    duplicateOfDocumentId,
    duplicateReason,
    shouldBlockConfirmation: blockingReasons.length > 0,
    blockingReasons,
  } satisfies InvoiceIdentityResult;
}
