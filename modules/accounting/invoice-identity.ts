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

  return null;
}

export function buildInvoiceIdentityResult(input: {
  facts: DocumentIntakeFactMap;
  fileHashDuplicateDocumentIds?: string[];
  businessDuplicateDocumentId?: string | null;
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
  const duplicateStatus =
    input.persistedDuplicateStatus
    ?? (
      fileHashDuplicateDocumentIds.length > 0 || businessDuplicateDocumentId
        ? "suspected_duplicate"
        : "clear"
    );
  const duplicateOfDocumentId =
    input.persistedDuplicateOfDocumentId
    ?? businessDuplicateDocumentId
    ?? fileHashDuplicateDocumentIds[0]
    ?? null;
  const duplicateReason =
    input.persistedDuplicateReason
    ?? buildReason({
      duplicateStatus,
      fileHashDuplicateDocumentIds,
      businessDuplicateDocumentId,
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
