import type {
  ImportDocumentIntakeResult,
  ImportOperationAggregateResult,
} from "@/modules/imports/types";

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

export function aggregateImportOperationDocuments(input: {
  documents: ImportDocumentIntakeResult[];
}) {
  const duaNumbers = uniqueValues(input.documents.map((document) => document.duaNumber));
  const duaYears = uniqueValues(input.documents.map((document) => document.duaYear));
  const currencies = uniqueValues(input.documents.map((document) => document.currencyCode));
  const suppliers = uniqueValues(input.documents.map((document) => document.supplierName));
  const operationDates = uniqueValues(input.documents.map((document) => document.operationDate));
  const paymentDates = uniqueValues(input.documents.map((document) => document.paymentDate));
  const warnings = input.documents.flatMap((document) => document.warnings);

  if (duaNumbers.length > 1) {
    warnings.push("Hay conflicto de numero DUA entre documentos vinculados.");
  }

  if (currencies.length > 1) {
    warnings.push("Hay conflicto de moneda entre documentos vinculados.");
  }

  if (suppliers.length > 1) {
    warnings.push("Hay conflicto de proveedor entre documentos vinculados.");
  }

  const taxLines = input.documents
    .filter((document) => !document.looksLikeLocalExpense)
    .flatMap((document) => document.taxes);
  const blockedBySpecialCase = warnings.some((warning) =>
    /zona franca|suspenso|reliquidacion|exoneracion|parcializacion/i.test(warning));
  const hasPrimaryDua = input.documents.some((document) => document.documentKind === "dua");
  const linkedDocuments = input.documents.map((document) => ({
    documentId: document.documentId,
    documentType: document.documentKind,
    isPrimary: document.documentKind === "dua",
    looksLikeLocalExpense: document.looksLikeLocalExpense,
  }));
  const status =
    blockedBySpecialCase || duaNumbers.length > 1 || currencies.length > 1
      ? "blocked_manual_review"
      : hasPrimaryDua
        ? "ready_for_review"
        : input.documents.length > 0
          ? "processing"
          : "draft";

  return {
    referenceCode: uniqueValues(input.documents.map((document) => document.referenceCode))[0] ?? null,
    duaNumber: duaNumbers[0] ?? null,
    duaYear: duaYears[0] ?? null,
    supplierName: suppliers[0] ?? null,
    supplierTaxId: uniqueValues(input.documents.map((document) => document.supplierTaxId))[0] ?? null,
    currencyCode: currencies[0] ?? null,
    operationDate: operationDates[0] ?? null,
    paymentDate: paymentDates[0] ?? null,
    status,
    warnings: Array.from(new Set(warnings)),
    taxLines,
    linkedDocuments,
    summary: {
      linked_document_count: input.documents.length,
      customs_tax_count: taxLines.length,
      local_expense_count: linkedDocuments.filter((document) => document.looksLikeLocalExpense).length,
    },
  } satisfies ImportOperationAggregateResult;
}
