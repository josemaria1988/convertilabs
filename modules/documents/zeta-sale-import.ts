import {
  normalizeTaxId,
  normalizeTextToken,
  roundCurrency,
} from "@/modules/accounting";
import { parseSpreadsheetDateValue } from "@/modules/documents/spreadsheet-date";
import type {
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentIntakeLineItem,
} from "@/modules/ai/document-intake-contract";

export type ZetaSaleRawRow = {
  rowNumber: number;
  typedRow: Record<string, string | null>;
  rawType: string | null;
  rawDescription: string | null;
  counterpartyName: string | null;
  counterpartyTaxId: string | null;
  documentDateRaw: string | null;
  dueDateRaw: string | null;
  documentNumberRaw: string | null;
  seriesRaw: string | null;
  externalReferenceRaw: string | null;
  currencyRaw: string | null;
  subtotalAmountRaw: string | null;
  taxAmountRaw: string | null;
  taxRateRaw: string | null;
  totalAmountRaw: string | null;
  balanceAmountRaw: string | null;
  lineConceptRaw: string | null;
  fxRateRaw: string | null;
  vatLabelRaw: string | null;
};

export type ZetaSaleImportRow = {
  rowNumber: number;
  sheetName: string;
  documentRole: "sale";
  documentType: string;
  operationCategory: string | null;
  paymentTerms: "cash" | "credit" | "unknown";
  settlementMethod: "cash" | "bank_transfer" | "card" | "check" | "unknown";
  balanceAmount: number | null;
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  lineItems: DocumentIntakeLineItem[];
  extractedText: string;
  warnings: string[];
  sourceReference: string;
  displayLabel: string;
  confidence: number;
  documentFxRate: number | null;
  documentFxRateSource: "document_import" | "bcu" | null;
  documentFxRateDate: string | null;
  sourceRows: Array<{
    rowNumber: number;
    originalRow: Record<string, string | null>;
  }>;
  sourceRowNumbers: number[];
  consolidationKey: string;
  isCreditNote: boolean;
  originalRow: Record<string, string | null>;
};

export type ZetaSaleNormalizationResult = {
  rows: ZetaSaleImportRow[];
  skippedRows: Array<{
    rowNumber: number;
    reason: string;
  }>;
  warnings: string[];
  rawRowsDetected: number;
  consolidatedDocumentsDetected: number;
  duplicateGroupsDetected: number;
  ignoredResidualRows: number;
  blockedGroupsDetected: number;
  usdMissingFxCount: number;
  creditNotesDetected: number;
  minDate: string | null;
  maxDate: string | null;
};

type ParsedZetaSaleRow = {
  rowNumber: number;
  typedRow: Record<string, string | null>;
  rawType: string | null;
  cfeLabel: string | null;
  clientCode: string | null;
  clientName: string;
  clientTaxId: string | null;
  documentDate: string;
  dueDate: string | null;
  documentNumber: string;
  series: string | null;
  currencyCode: string;
  subtotalAmount: number;
  taxAmount: number;
  taxRate: number | null;
  totalAmount: number;
  balanceAmount: number | null;
  quantity: number | null;
  unitAmount: number | null;
  articleCode: string | null;
  description: string | null;
  reference: string | null;
  fxRate: number | null;
  paymentTerms: "cash" | "credit" | "unknown";
  settlementMethod: "cash" | "bank_transfer" | "card" | "check" | "unknown";
  operationCategory: string | null;
  documentType: "sale_invoice" | "sale_credit_note";
  warnings: string[];
};

const MISSING_FX_WARNING_PREFIX = "MISSING_FX_RATE:";
const ZETA_SALE_LAYOUT_REQUIRED_HEADERS = [
  "Fecha",
  "Comprobante",
  "Serie",
  "Nº",
  "Cliente",
  "Cliente #",
  "RUT",
  "Artículo",
  "Descripción",
  "Moneda",
  "Cotización",
  "Subtotal",
  "IVA",
  "Total",
] as const;

function normalizeLooseText(value: string | null | undefined) {
  const normalized = normalizeTextToken(value);

  if (!normalized) {
    return "";
  }

  return normalized.replace(/[^a-z0-9]+/g, " ").trim();
}

function firstNonEmptyString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function normalizeIdentifierValue(value: string | null | undefined) {
  const normalized = firstNonEmptyString(value);

  if (!normalized) {
    return null;
  }

  return normalized.replace(/^(-?\d+)[.,]0+$/, "$1");
}

function slugifyFragment(value: string) {
  return normalizeLooseText(value).replace(/\s+/g, "-").slice(0, 48) || "fila";
}

function parseLocalizedNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,(?=\d{1,4}(?:\D|$))/g, ".")
    .replace(/[^0-9.\-]/g, "");

  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? roundCurrency(parsed) : null;
}

function roundRate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function parseLocalizedFxRate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/\s+/g, "")
    .replace(/[^0-9,.\-]/g, "");

  if (!cleaned) {
    return null;
  }

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized = cleaned;

  if (lastDot >= 0 && lastComma >= 0) {
    if (lastDot > lastComma) {
      normalized = cleaned.replace(/,/g, "");
    } else {
      normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
    }
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else if (lastDot >= 0) {
    const parts = cleaned.split(".");

    if (parts.length > 2) {
      const decimalPart = parts.pop();
      normalized = `${parts.join("")}.${decimalPart ?? ""}`;
    }
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? roundRate(parsed) : null;
}

function parseDateValue(value: string | null | undefined) {
  return parseSpreadsheetDateValue(value);
}

function parseCurrencyCode(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalizeLooseText(value);

    if (!normalized) {
      continue;
    }

    if (
      normalized.includes("usd")
      || normalized.includes("u s")
      || normalized.includes("us")
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
  }

  return "UYU";
}

function roundConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function isSameMonth(left: string | null, right: string | null) {
  return Boolean(left && right && left.slice(0, 7) === right.slice(0, 7));
}

function buildEmptyFactMap(): DocumentIntakeFactMap {
  return {
    issuer_name: null,
    issuer_tax_id: null,
    issuer_address_raw: null,
    issuer_department: null,
    issuer_city: null,
    issuer_branch_code: null,
    merchant_category_hints: [],
    location_extraction_confidence: null,
    receiver_name: null,
    receiver_tax_id: null,
    document_number: null,
    series: null,
    currency_code: null,
    document_date: null,
    due_date: null,
    subtotal: null,
    tax_amount: null,
    total_amount: null,
    purchase_category_candidate: null,
    sale_category_candidate: null,
  };
}

function buildFxMissingWarning(documentDate: string | null) {
  return documentDate
    ? `${MISSING_FX_WARNING_PREFIX} No pudimos resolver la cotizacion para ${documentDate}. Reintenta obtencion BCU.`
    : `${MISSING_FX_WARNING_PREFIX} No pudimos resolver la cotizacion documental en USD.`;
}

function buildDisplayLabel(input: {
  clientName: string;
  series: string | null;
  documentNumber: string;
}) {
  const documentRef = [input.series, input.documentNumber].filter(Boolean).join("-");
  return `Venta importada - ${input.clientName}${documentRef ? ` (${documentRef})` : ""}`;
}

function buildExtractedText(input: {
  facts: DocumentIntakeFactMap;
  rawType: string | null;
  lineCount: number;
}) {
  const parts = [
    "Importado desde planilla mensual de ventas Zetasoftware.",
    input.facts.document_date ? `Fecha: ${input.facts.document_date}.` : null,
    input.rawType ? `Tipo reportado: ${input.rawType}.` : null,
    input.facts.document_number ? `Numero: ${input.facts.document_number}.` : null,
    input.facts.series ? `Serie: ${input.facts.series}.` : null,
    input.facts.receiver_name ? `Cliente: ${input.facts.receiver_name}.` : null,
    input.facts.currency_code ? `Moneda: ${input.facts.currency_code}.` : null,
    typeof input.facts.total_amount === "number" ? `Total: ${input.facts.total_amount}.` : null,
    `Lineas consolidadas: ${input.lineCount}.`,
  ];

  return parts.filter(Boolean).join(" ");
}

function inferPaymentTerms(rawType: string | null, cfeLabel: string | null) {
  const normalized = normalizeLooseText(firstNonEmptyString(rawType, cfeLabel));

  if (normalized.includes("credito")) {
    return "credit" as const;
  }

  if (normalized.includes("contado") || normalized.includes("ticket")) {
    return "cash" as const;
  }

  return "unknown" as const;
}

function inferSettlementMethod(rawType: string | null) {
  const normalized = normalizeLooseText(rawType);

  if (!normalized) {
    return "unknown" as const;
  }

  if (normalized.includes("tarjeta") || normalized.includes("card")) {
    return "card" as const;
  }

  if (normalized.includes("transferencia") || normalized.includes("banco") || normalized.includes("transfer")) {
    return "bank_transfer" as const;
  }

  if (normalized.includes("cheque") || normalized.includes("check")) {
    return "check" as const;
  }

  if (normalized.includes("contado") || normalized.includes("efectivo") || normalized.includes("caja") || normalized.includes("ticket")) {
    return "cash" as const;
  }

  return "unknown" as const;
}

function parseZetaVatRateFromAmounts(subtotalAmount: number, taxAmount: number) {
  if (Math.abs(taxAmount) <= 0.009) {
    return 0;
  }

  if (Math.abs(subtotalAmount) <= 0.009) {
    return null;
  }

  for (const candidate of [22, 10, 0]) {
    const expected = roundCurrency((subtotalAmount * candidate) / 100);

    if (Math.abs(expected - taxAmount) <= 0.05) {
      return candidate;
    }
  }

  return null;
}

function isCreditNote(input: {
  rawType: string | null;
  cfeLabel: string | null;
  signedSubtotal: number | null;
  signedTaxAmount: number | null;
}) {
  const normalized = normalizeLooseText(firstNonEmptyString(input.rawType, input.cfeLabel));

  return normalized.includes("nota credito")
    || normalized.includes("nota de credito")
    || normalized.includes("devolucion")
    || (typeof input.signedSubtotal === "number" && input.signedSubtotal < 0)
    || (typeof input.signedTaxAmount === "number" && input.signedTaxAmount < 0);
}

function resolveOperationCategory(input: {
  rawType: string | null;
  currencyCode: string;
  taxAmount: number;
}) {
  const normalized = normalizeLooseText(input.rawType);

  if (Math.abs(input.taxAmount) <= 0.009 && input.currencyCode === "USD") {
    return "export_sale";
  }

  if (normalized.includes("credito") || normalized.includes("contado")) {
    return "goods_resale";
  }

  return null;
}

function resolveTypedRowValue(
  typedRow: Record<string, string | null>,
  candidates: string[],
) {
  for (const candidate of candidates) {
    const direct = typedRow[candidate];

    if (typeof direct === "string" && direct.trim().length > 0) {
      return direct;
    }
  }

  const typedEntries = Object.entries(typedRow);

  for (const candidate of candidates) {
    for (const [header, value] of typedEntries) {
      if (typeof value !== "string" || value.trim().length === 0) {
        continue;
      }

      if (header.trim() === candidate.trim()) {
        return value;
      }
    }
  }

  return null;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasHeader(headers: string[], candidates: string[]) {
  const normalizedHeaders = new Set(headers.map((header) => normalizeHeader(header)));

  return candidates.some((candidate) => normalizedHeaders.has(normalizeHeader(candidate)));
}

function parseRow(rawRow: ZetaSaleRawRow) {
  const documentDate = parseDateValue(firstNonEmptyString(
    resolveTypedRowValue(rawRow.typedRow, ["Fecha"]),
    rawRow.documentDateRaw,
  ));

  if (!documentDate) {
    return {
      skipped: {
        rowNumber: rawRow.rowNumber,
        reason: "No pudimos interpretar la fecha del comprobante.",
      },
    } as const;
  }

  const rawType = firstNonEmptyString(
    resolveTypedRowValue(rawRow.typedRow, ["Comprobante"]),
    rawRow.rawType,
  );
  const cfeLabel = firstNonEmptyString(
    resolveTypedRowValue(rawRow.typedRow, ["CFE"]),
  );
  const documentNumber = normalizeIdentifierValue(firstNonEmptyString(
    resolveTypedRowValue(rawRow.typedRow, ["Nº", "N°", "Numero", "Número", "NÂº", "NÂ°", "NÃºmero"]),
    rawRow.documentNumberRaw,
  ));

  if (!documentNumber) {
    return {
      skipped: {
        rowNumber: rawRow.rowNumber,
        reason: "No pudimos identificar el numero del comprobante.",
      },
    } as const;
  }

  const clientCode = normalizeIdentifierValue(resolveTypedRowValue(rawRow.typedRow, ["Cliente #"]));
  const clientName = firstNonEmptyString(
    resolveTypedRowValue(rawRow.typedRow, ["Cliente"]),
    rawRow.counterpartyName,
    clientCode,
  );

  if (!clientName) {
    return {
      skipped: {
        rowNumber: rawRow.rowNumber,
        reason: "Falta el nombre del cliente para la fila importada.",
      },
    } as const;
  }

  const subtotalAmount = parseLocalizedNumber(firstNonEmptyString(
    resolveTypedRowValue(rawRow.typedRow, ["Subtotal"]),
    rawRow.subtotalAmountRaw,
    resolveTypedRowValue(rawRow.typedRow, ["Subtotal (+/-)"]),
  ));
  const taxAmount = parseLocalizedNumber(firstNonEmptyString(
    resolveTypedRowValue(rawRow.typedRow, ["IVA"]),
    rawRow.taxAmountRaw,
    resolveTypedRowValue(rawRow.typedRow, ["Total IVA (+/-)"]),
  ));
  let totalAmount = parseLocalizedNumber(firstNonEmptyString(
    resolveTypedRowValue(rawRow.typedRow, ["Total"]),
    rawRow.totalAmountRaw,
  ));

  if (totalAmount === null && subtotalAmount !== null && taxAmount !== null) {
    totalAmount = roundCurrency(subtotalAmount + taxAmount);
  }

  if (subtotalAmount === null || taxAmount === null || totalAmount === null) {
    return {
      skipped: {
        rowNumber: rawRow.rowNumber,
        reason: "La fila no trae subtotal, IVA y total suficientes para construir la venta.",
      },
    } as const;
  }

  const signedSubtotal = parseLocalizedNumber(resolveTypedRowValue(rawRow.typedRow, ["Subtotal (+/-)"]));
  const signedTaxAmount = parseLocalizedNumber(resolveTypedRowValue(rawRow.typedRow, ["Total IVA (+/-)"]));
  const currencyCode = parseCurrencyCode(
    resolveTypedRowValue(rawRow.typedRow, ["Moneda"]),
    rawRow.currencyRaw,
  );
  const fxRate = parseLocalizedFxRate(firstNonEmptyString(
    resolveTypedRowValue(rawRow.typedRow, ["Cotización", "Cotizacion", "CotizaciÃ³n"]),
    rawRow.fxRateRaw,
  ));
  const quantity = parseLocalizedNumber(resolveTypedRowValue(rawRow.typedRow, ["Cantidad"]));
  const unitAmount = parseLocalizedNumber(resolveTypedRowValue(rawRow.typedRow, ["Precio"]));
  const articleCode = normalizeIdentifierValue(resolveTypedRowValue(rawRow.typedRow, ["Artículo", "Articulo", "ArtÃ­culo"]));
  const description = firstNonEmptyString(
    resolveTypedRowValue(rawRow.typedRow, ["Descripción", "Descripcion", "DescripciÃ³n"]),
    rawRow.rawDescription,
  );
  const paymentTerms = inferPaymentTerms(rawType, cfeLabel);
  const documentType = isCreditNote({
    rawType,
    cfeLabel,
    signedSubtotal,
    signedTaxAmount,
  })
    ? "sale_credit_note"
    : "sale_invoice";
  const taxRate = parseZetaVatRateFromAmounts(subtotalAmount, taxAmount);
  const warnings: string[] = [];

  if (taxRate === null) {
    warnings.push("No pudimos resolver la tasa de IVA de una linea importada desde Zeta ventas.");
  }

  if (currencyCode === "USD" && (!fxRate || fxRate <= 0)) {
    warnings.push(buildFxMissingWarning(documentDate));
  }

  return {
    parsed: {
      rowNumber: rawRow.rowNumber,
      typedRow: rawRow.typedRow,
      rawType,
      cfeLabel,
      clientCode,
      clientName,
      clientTaxId: normalizeTaxId(firstNonEmptyString(
        resolveTypedRowValue(rawRow.typedRow, ["RUT"]),
        rawRow.counterpartyTaxId,
      )),
      documentDate,
      dueDate: paymentTerms === "cash" ? documentDate : parseDateValue(rawRow.dueDateRaw),
      documentNumber,
      series: normalizeIdentifierValue(firstNonEmptyString(
        resolveTypedRowValue(rawRow.typedRow, ["Serie"]),
        rawRow.seriesRaw,
      )),
      currencyCode,
      subtotalAmount,
      taxAmount,
      taxRate,
      totalAmount,
      balanceAmount: paymentTerms === "credit" ? totalAmount : 0,
      quantity,
      unitAmount,
      articleCode,
      description,
      reference: firstNonEmptyString(resolveTypedRowValue(rawRow.typedRow, ["Referencia"])),
      fxRate,
      paymentTerms,
      settlementMethod: paymentTerms === "credit" ? "unknown" : inferSettlementMethod(rawType),
      operationCategory: resolveOperationCategory({
        rawType,
        currencyCode,
        taxAmount,
      }),
      documentType,
      warnings,
    } satisfies ParsedZetaSaleRow,
    isResidual: false,
  } as const;
}

function buildAmountBreakdown(lines: ParsedZetaSaleRow[]) {
  const grouped = new Map<string, { amount: number; taxAmount: number; taxRate: number | null }>();

  for (const line of lines) {
    const key = line.taxRate === null ? "unknown" : String(line.taxRate);
    const current = grouped.get(key) ?? {
      amount: 0,
      taxAmount: 0,
      taxRate: line.taxRate,
    };
    current.amount = roundCurrency(current.amount + line.subtotalAmount);
    current.taxAmount = roundCurrency(current.taxAmount + line.taxAmount);
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map((entry) => ({
    label:
      entry.taxRate === 22
        ? "IVA 22%"
        : entry.taxRate === 10
          ? "IVA 10%"
          : entry.taxRate === 0
            ? "IVA 0%"
            : "Importe principal",
    amount: entry.amount,
    tax_rate: entry.taxRate,
    tax_code: Math.abs(entry.taxAmount) > 0.009 ? "iva" : null,
  })) satisfies DocumentIntakeAmountBreakdown[];
}

function buildConsolidationKey(line: ParsedZetaSaleRow) {
  return [
    line.documentDate,
    normalizeLooseText(line.rawType) || "tipo",
    normalizeLooseText(line.series) || "sin-serie",
    normalizeLooseText(line.documentNumber) || `fila-${line.rowNumber}`,
    line.currencyCode,
    normalizeLooseText(line.clientTaxId) || normalizeLooseText(line.clientCode) || normalizeLooseText(line.clientName),
  ].join("|");
}

export function isZetaSaleLayout(headers: string[]) {
  return ZETA_SALE_LAYOUT_REQUIRED_HEADERS.every((header) => hasHeader(headers, [header]));
}

export function normalizeZetaSaleRows(input: {
  fileName: string;
  sheetName: string;
  rawRows: ZetaSaleRawRow[];
}) {
  const groups = new Map<string, ParsedZetaSaleRow[]>();
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];
  const warnings: string[] = [];
  const parsedDates: string[] = [];
  let rawRowsDetected = 0;

  for (const rawRow of input.rawRows) {
    const hasContent = Object.values(rawRow.typedRow).some((value) => typeof value === "string" && value.trim().length > 0);

    if (!hasContent) {
      continue;
    }

    rawRowsDetected += 1;
    const parsed = parseRow(rawRow);

    if ("skipped" in parsed && parsed.skipped) {
      skippedRows.push(parsed.skipped);
      continue;
    }

    parsedDates.push(parsed.parsed.documentDate);
    const key = buildConsolidationKey(parsed.parsed);
    const current = groups.get(key) ?? [];
    current.push(parsed.parsed);
    groups.set(key, current);
  }

  const duplicateGroupsDetected = Array.from(groups.values()).filter((rows) => rows.length > 1).length;
  const rows: ZetaSaleImportRow[] = [];
  let blockedGroupsDetected = 0;
  let usdMissingFxCount = 0;
  let creditNotesDetected = 0;

  for (const [consolidationKey, lines] of groups.entries()) {
    const first = lines[0];
    const subtotal = roundCurrency(lines.reduce((sum, line) => sum + line.subtotalAmount, 0));
    const taxAmount = roundCurrency(lines.reduce((sum, line) => sum + line.taxAmount, 0));
    const totalAmount = roundCurrency(lines.reduce((sum, line) => sum + line.totalAmount, 0));
    const totalsMatch = Math.abs(roundCurrency(subtotal + taxAmount) - totalAmount) <= 0.05;

    if (!totalsMatch) {
      blockedGroupsDetected += 1;
      skippedRows.push({
        rowNumber: first.rowNumber,
        reason: "La factura consolidada no cierra entre subtotal, IVA y total.",
      });
      continue;
    }

    const fxCandidates = Array.from(new Set(lines
      .map((line) => line.fxRate)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
      .map((value) => roundRate(value))));
    const fxRate = fxCandidates.length > 0 ? fxCandidates[0] : null;
    const isUsdMissingFx = first.currencyCode === "USD" && fxRate === null;
    const isCreditDocument = lines.some((line) => line.documentType === "sale_credit_note");
    const facts = buildEmptyFactMap();
    facts.receiver_name = first.clientName;
    facts.receiver_tax_id = first.clientTaxId;
    facts.document_number = first.documentNumber;
    facts.series = first.series;
    facts.currency_code = first.currencyCode;
    facts.document_date = first.documentDate;
    facts.due_date = first.paymentTerms === "cash" ? first.documentDate : null;
    facts.subtotal = subtotal;
    facts.tax_amount = taxAmount;
    facts.total_amount = totalAmount;
    facts.sale_category_candidate = Math.abs(taxAmount) <= 0.009
      ? "exempt_or_export"
      : first.operationCategory;

    const lineItems = lines.map((line, index) => ({
      line_number: index + 1,
      concept_code: line.articleCode,
      concept_description: firstNonEmptyString(
        line.description,
        line.reference,
        line.rawType,
        line.clientName,
      ),
      quantity: line.quantity,
      unit_amount: line.unitAmount,
      net_amount: line.subtotalAmount,
      tax_rate: line.taxRate,
      tax_amount: line.taxAmount,
      total_amount: line.totalAmount,
    })) satisfies DocumentIntakeLineItem[];
    const lineWarnings = lines.flatMap((line) => line.warnings);
    const groupWarnings = [
      ...lineWarnings,
      ...(fxCandidates.length > 1
        ? ["La factura importada trae mas de una cotizacion positiva. Se uso la primera detectada."]
        : []),
    ];

    if (isUsdMissingFx) {
      usdMissingFxCount += 1;
    }

    if (isCreditDocument) {
      creditNotesDetected += 1;
    }

    rows.push({
      rowNumber: first.rowNumber,
      sheetName: input.sheetName,
      documentRole: "sale",
      documentType: isCreditDocument ? "sale_credit_note" : "sale_invoice",
      operationCategory: first.operationCategory,
      paymentTerms: first.paymentTerms,
      settlementMethod: first.settlementMethod,
      balanceAmount: first.balanceAmount,
      facts,
      amountBreakdown: buildAmountBreakdown(lines),
      lineItems,
      extractedText: buildExtractedText({
        facts,
        rawType: first.rawType,
        lineCount: lines.length,
      }),
      warnings: Array.from(new Set(groupWarnings)),
      sourceReference: `${input.fileName}:${input.sheetName}:grupo-${slugifyFragment(consolidationKey)}`,
      displayLabel: buildDisplayLabel({
        clientName: first.clientName,
        series: first.series,
        documentNumber: first.documentNumber,
      }),
      confidence: roundConfidence(groupWarnings.length === 0 ? 0.98 : 0.86),
      documentFxRate: fxRate,
      documentFxRateSource: fxRate && fxRate > 0 ? "document_import" : null,
      documentFxRateDate: facts.document_date,
      sourceRows: lines.map((line) => ({
        rowNumber: line.rowNumber,
        originalRow: line.typedRow,
      })),
      sourceRowNumbers: lines.map((line) => line.rowNumber),
      consolidationKey,
      isCreditNote: isCreditDocument,
      originalRow: first.typedRow,
    });
  }

  const monthCounts = parsedDates.reduce((map, value) => {
    const month = value.slice(0, 7);
    map.set(month, (map.get(month) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  const dominantMonth = Array.from(monthCounts.entries())
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  const outsideDominantMonthCount = dominantMonth
    ? parsedDates.filter((value) => !isSameMonth(value, `${dominantMonth}-01`)).length
    : 0;

  if (outsideDominantMonthCount > 0 && dominantMonth) {
    warnings.push(
      `Detectamos ${outsideDominantMonthCount} fila(s) fuera del mes dominante ${dominantMonth}. Revisa si la exportacion mezcla periodos.`,
    );
  }

  const sortedDates = parsedDates.slice().sort((left, right) => left.localeCompare(right));

  return {
    rows,
    skippedRows,
    warnings,
    rawRowsDetected,
    consolidatedDocumentsDetected: groups.size,
    duplicateGroupsDetected,
    ignoredResidualRows: 0,
    blockedGroupsDetected,
    usdMissingFxCount,
    creditNotesDetected,
    minDate: sortedDates[0] ?? null,
    maxDate: sortedDates.at(-1) ?? null,
  } satisfies ZetaSaleNormalizationResult;
}
