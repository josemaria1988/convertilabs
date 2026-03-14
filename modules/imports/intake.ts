import { classifyImportDocumentKind, classifyImportTaxLine } from "@/modules/imports/tax-classification";
import type {
  ImportDocumentIntakeInput,
  ImportDocumentIntakeResult,
} from "@/modules/imports/types";

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function pickFirstMatch(
  text: string,
  patterns: RegExp[],
) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export function interpretImportDocument(
  input: ImportDocumentIntakeInput,
) {
  const extractedNarrative = [
    input.documentType,
    input.facts.issuer_name,
    input.facts.receiver_name,
    input.extractedText,
    ...input.amountBreakdown.map((entry) => entry.label),
    ...input.lineItems.map((entry) => entry.concept_description ?? ""),
  ].filter(Boolean).join(" ");
  const normalizedNarrative = normalizeText(extractedNarrative);
  const documentKind = classifyImportDocumentKind({
    documentType: input.documentType,
    issuerName: input.facts.issuer_name,
    extractedText: input.extractedText,
  });
  const duaNumber = pickFirstMatch(normalizedNarrative, [
    /\bdua[\s#:/-]*([0-9]{6,8})\b/i,
    /\b([0-9]{6,8})\/(?:20)?([0-9]{2,4})\b/i,
  ]);
  const duaYearFromPair = /([0-9]{6,8})\/((?:19|20)[0-9]{2})/.exec(normalizedNarrative)?.[2] ?? null;
  const referenceCode = duaNumber
    ? `${duaNumber}${duaYearFromPair ? `/${duaYearFromPair}` : ""}`
    : input.facts.document_number ?? null;
  const warnings = [
    ...(normalizedNarrative.includes("zona franca") ? ["Se detecto zona franca y requiere revision manual."] : []),
    ...(normalizedNarrative.includes("suspenso") ? ["Se detecto suspenso y requiere revision manual."] : []),
    ...(normalizedNarrative.includes("reliquid") ? ["Se detecto reliquidacion y requiere revision manual."] : []),
    ...(normalizedNarrative.includes("exoner") ? ["Se detecto exoneracion especial y requiere revision manual."] : []),
    ...(normalizedNarrative.includes("parcial") ? ["Se detecto parcializacion y requiere revision manual."] : []),
  ];
  const taxes = [
    ...input.amountBreakdown
      .filter((entry) => typeof entry.amount === "number" && entry.amount > 0)
      .map((entry) => classifyImportTaxLine({
        taxLabel: entry.label,
        taxCode: entry.tax_code,
        externalTaxCode: entry.tax_code,
        amount: entry.amount ?? 0,
        currencyCode: input.facts.currency_code,
        sourceDocumentId: input.documentId,
        documentKind,
      })),
    ...input.lineItems
      .filter((entry) =>
        typeof entry.total_amount === "number"
        && entry.total_amount > 0
        && Boolean(entry.concept_description))
      .map((entry) => classifyImportTaxLine({
        taxLabel: entry.concept_description ?? "Tributo detectado",
        taxCode: entry.concept_code,
        externalTaxCode: entry.concept_code,
        amount: entry.total_amount ?? 0,
        currencyCode: input.facts.currency_code,
        sourceDocumentId: input.documentId,
        documentKind,
      })),
  ].filter((entry, index, array) => {
    const fingerprint = `${entry.taxLabel}|${entry.amount}|${entry.externalTaxCode}`;
    return array.findIndex((candidate) =>
      `${candidate.taxLabel}|${candidate.amount}|${candidate.externalTaxCode}` === fingerprint) === index;
  });
  const looksLikeLocalExpense =
    documentKind === "broker_invoice"
    || documentKind === "local_related_service"
    || normalizedNarrative.includes("honorarios")
    || normalizedNarrative.includes("servicio local");

  return {
    documentId: input.documentId,
    documentKind,
    duaNumber,
    duaYear: duaYearFromPair ?? (
      input.facts.document_date
        ? input.facts.document_date.slice(0, 4)
        : null
    ),
    referenceCode,
    supplierName: input.facts.issuer_name ?? null,
    supplierTaxId: input.facts.issuer_tax_id ?? null,
    operationDate: input.facts.document_date ?? null,
    paymentDate: input.facts.due_date ?? null,
    currencyCode: input.facts.currency_code ?? null,
    warnings,
    taxes,
    looksLikeLocalExpense,
    rawFacts: input.facts,
  } satisfies ImportDocumentIntakeResult;
}
