import type { ImportLinkedDocumentType, ImportTaxLine } from "@/modules/imports/types";

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function classifyImportDocumentKind(input: {
  documentType: string | null;
  issuerName?: string | null;
  extractedText?: string | null;
}) {
  const narrative = [
    input.documentType,
    input.issuerName,
    input.extractedText,
  ].map((value) => normalizeText(value)).join(" ");

  if (
    narrative.includes("dua")
    || narrative.includes("documento unico aduanero")
    || narrative.includes("despacho aduanero")
  ) {
    return "dua" satisfies ImportLinkedDocumentType;
  }

  if (
    narrative.includes("despachante")
    || narrative.includes("agencia de aduana")
    || narrative.includes("customs broker")
  ) {
    return "broker_invoice" satisfies ImportLinkedDocumentType;
  }

  if (narrative.includes("flete") || narrative.includes("freight")) {
    return "freight_invoice" satisfies ImportLinkedDocumentType;
  }

  if (narrative.includes("seguro") || narrative.includes("insurance")) {
    return "insurance_invoice" satisfies ImportLinkedDocumentType;
  }

  if (narrative.includes("servicio local") || narrative.includes("gasto local")) {
    return "local_related_service" satisfies ImportLinkedDocumentType;
  }

  if (narrative.includes("invoice") || narrative.includes("factura comercial")) {
    return "commercial_invoice" satisfies ImportLinkedDocumentType;
  }

  return "unknown" satisfies ImportLinkedDocumentType;
}

export function classifyImportTaxLine(input: {
  taxLabel: string;
  taxCode?: string | null;
  externalTaxCode?: string | null;
  amount: number;
  currencyCode?: string | null;
  sourceDocumentId?: string | null;
  documentKind?: ImportLinkedDocumentType;
}) {
  const narrative = [
    input.taxLabel,
    input.taxCode,
    input.externalTaxCode,
  ].map((value) => normalizeText(value)).join(" ");
  const warnings: string[] = [];
  const isBrokerLike =
    input.documentKind === "broker_invoice"
    || input.documentKind === "local_related_service";
  const isCreditableVat =
    !isBrokerLike
    && (narrative.includes("iva import")
      || narrative.includes("iva impo")
      || (narrative.includes("iva") && narrative.includes("aduan")));
  const isVatAdvance =
    !isBrokerLike
    && (narrative.includes("anticipo iva")
      || narrative.includes("anticipo")
      || narrative.includes("percepcion iva"));
  const isOtherTax = !isCreditableVat && !isVatAdvance;

  if (isBrokerLike) {
    warnings.push("El documento parece gasto local relacionado y no tributo aduanero puro.");
  }

  return {
    taxCode: input.taxCode ?? null,
    taxLabel: input.taxLabel,
    externalTaxCode: input.externalTaxCode ?? null,
    amount: input.amount,
    currencyCode: input.currencyCode ?? null,
    isCreditableVat,
    isVatAdvance,
    isOtherTax,
    sourceDocumentId: input.sourceDocumentId ?? null,
    warnings,
  } satisfies ImportTaxLine;
}
