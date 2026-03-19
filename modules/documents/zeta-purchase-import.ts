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

export type ZetaPurchaseRawRow = {
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

export type ZetaPurchaseImportRow = {
  rowNumber: number;
  sheetName: string;
  documentRole: "purchase";
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

export type ZetaPurchaseNormalizationResult = {
  rows: ZetaPurchaseImportRow[];
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

type ParsedZetaRow = {
  rowNumber: number;
  typedRow: Record<string, string | null>;
  rawType: string | null;
  rawDescription: string | null;
  counterpartyName: string;
  counterpartyTaxId: string | null;
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
  lineConcept: string | null;
  fxRate: number | null;
  vatLabel: string | null;
  paymentTerms: "cash" | "credit" | "unknown";
  settlementMethod: "cash" | "bank_transfer" | "card" | "check" | "unknown";
  operationCategory: string | null;
  documentType: "purchase_invoice" | "purchase_credit_note";
  warnings: string[];
};

const MISSING_FX_WARNING_PREFIX = "MISSING_FX_RATE:";
const ZETA_LAYOUT_REQUIRED_HEADERS = [
  "documentDate",
  "documentTypeLabel",
  "documentNumber",
  "counterpartyName",
  "counterpartyTaxId",
  "currency",
  "subtotalAmount",
  "taxAmount",
  "totalAmount",
  "series",
  "lineConcept",
  "fxRate",
  "vatLabel",
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
  counterpartyName: string;
  series: string | null;
  documentNumber: string;
}) {
  const documentRef = [input.series, input.documentNumber].filter(Boolean).join("-");
  return `Compra importada - ${input.counterpartyName}${documentRef ? ` (${documentRef})` : ""}`;
}

function buildExtractedText(input: {
  facts: DocumentIntakeFactMap;
  rawType: string | null;
  lineCount: number;
}) {
  const parts = [
    "Importado desde planilla mensual de compras Zetasoftware.",
    input.facts.document_date ? `Fecha: ${input.facts.document_date}.` : null,
    input.rawType ? `Tipo reportado: ${input.rawType}.` : null,
    input.facts.document_number ? `Numero: ${input.facts.document_number}.` : null,
    input.facts.series ? `Serie: ${input.facts.series}.` : null,
    input.facts.issuer_name ? `Proveedor: ${input.facts.issuer_name}.` : null,
    input.facts.currency_code ? `Moneda: ${input.facts.currency_code}.` : null,
    typeof input.facts.total_amount === "number" ? `Total: ${input.facts.total_amount}.` : null,
    `Lineas consolidadas: ${input.lineCount}.`,
  ];

  return parts.filter(Boolean).join(" ");
}

function inferPaymentTerms(balanceAmount: number | null, rawType: string | null) {
  if (typeof balanceAmount === "number") {
    return balanceAmount > 0.009 ? "credit" as const : "cash" as const;
  }

  const normalized = normalizeLooseText(rawType);

  if (normalized.includes("credito") || normalized.includes("cr dito")) {
    return "credit" as const;
  }

  if (normalized.includes("contado") || normalized.includes("cash")) {
    return "cash" as const;
  }

  return "unknown" as const;
}

function inferSettlementMethod(value: string | null | undefined) {
  const normalized = normalizeLooseText(value);

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

  if (normalized.includes("contado") || normalized.includes("efectivo") || normalized.includes("caja") || normalized.includes("cash")) {
    return "cash" as const;
  }

  return "unknown" as const;
}

function normalizePartyName(value: string | null | undefined) {
  const normalized = normalizeLooseText(value);
  return normalized || null;
}

function normalizeDocumentKeyPart(value: string | null | undefined, fallback: string) {
  const normalized = normalizeLooseText(value);
  return normalized || fallback;
}

function parseZetaVatRateFromLabel(value: string | null | undefined) {
  const normalized = normalizeLooseText(value);

  if (!normalized) {
    return null;
  }

  if (normalized.includes("22")) {
    return 22;
  }

  if (normalized.includes("10")) {
    return 10;
  }

  if (normalized.includes("0")) {
    return 0;
  }

  return null;
}

function inferVatRateFromAmounts(subtotalAmount: number, taxAmount: number) {
  if (Math.abs(taxAmount) <= 0.009) {
    return 0;
  }

  if (Math.abs(subtotalAmount) <= 0.009) {
    return null;
  }

  const candidates = [22, 10, 0];

  for (const candidate of candidates) {
    const expected = roundCurrency((subtotalAmount * candidate) / 100);

    if (Math.abs(expected - taxAmount) <= 0.05) {
      return candidate;
    }
  }

  return null;
}

function isCreditNote(rawType: string | null, totalAmount: number) {
  const normalized = normalizeLooseText(rawType);

  return normalized.includes("nota credito")
    || normalized.includes("nota de credito")
    || normalized.includes("devolucion")
    || totalAmount < 0;
}

function resolveOperationCategory(rawType: string | null) {
  const normalized = normalizeLooseText(rawType);

  if (normalized.includes("gasto")) {
    return "admin_expense";
  }

  if (normalized.includes("compra")) {
    return "goods_resale";
  }

  return null;
}

function isResidualRow(input: {
  vatLabel: string | null;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
}) {
  return !firstNonEmptyString(input.vatLabel)
    && Math.abs(input.taxAmount) <= 0.009
    && Math.abs(input.subtotalAmount) <= 1
    && Math.abs(input.totalAmount) <= 1;
}

function parseRow(rawRow: ZetaPurchaseRawRow) {
  const counterpartyName = firstNonEmptyString(rawRow.counterpartyName);

  if (!counterpartyName) {
    return {
      skipped: {
        rowNumber: rawRow.rowNumber,
        reason: "Falta la contraparte principal de la fila.",
      },
    } as const;
  }

  const documentDate = parseDateValue(rawRow.documentDateRaw);

  if (!documentDate) {
    return {
      skipped: {
        rowNumber: rawRow.rowNumber,
        reason: "No pudimos interpretar la fecha del comprobante.",
      },
    } as const;
  }

  const documentNumber = normalizeIdentifierValue(rawRow.documentNumberRaw);

  if (!documentNumber) {
    return {
      skipped: {
        rowNumber: rawRow.rowNumber,
        reason: "No pudimos identificar el numero del comprobante.",
      },
    } as const;
  }

  const subtotalAmountRaw = parseLocalizedNumber(rawRow.subtotalAmountRaw);
  const taxAmountRaw = parseLocalizedNumber(rawRow.taxAmountRaw);
  const totalAmountRaw = parseLocalizedNumber(rawRow.totalAmountRaw);
  const balanceAmount = parseLocalizedNumber(rawRow.balanceAmountRaw);

  let subtotalAmount = subtotalAmountRaw ?? 0;
  let taxAmount = taxAmountRaw ?? 0;
  let totalAmount = totalAmountRaw;

  if (totalAmount === null && subtotalAmountRaw !== null && taxAmountRaw !== null) {
    totalAmount = roundCurrency(subtotalAmountRaw + taxAmountRaw);
  }

  if (subtotalAmountRaw === null && totalAmountRaw !== null && taxAmountRaw !== null) {
    subtotalAmount = roundCurrency(totalAmountRaw - taxAmountRaw);
  }

  if (taxAmountRaw === null && totalAmountRaw !== null && subtotalAmountRaw !== null) {
    taxAmount = roundCurrency(totalAmountRaw - subtotalAmountRaw);
  }

  if (totalAmount === null) {
    return {
      skipped: {
        rowNumber: rawRow.rowNumber,
        reason: "La fila no trae total importable ni suficiente informacion para reconstruirlo.",
      },
    } as const;
  }

  const vatLabel = firstNonEmptyString(rawRow.vatLabelRaw);
  const taxRate = parseZetaVatRateFromLabel(vatLabel) ?? inferVatRateFromAmounts(subtotalAmount, taxAmount);
  const lineConcept = firstNonEmptyString(rawRow.lineConceptRaw, rawRow.rawDescription, rawRow.rawType);
  const currencyCode = parseCurrencyCode(rawRow.currencyRaw);
  const fxRate = parseLocalizedNumber(rawRow.fxRateRaw);
  const paymentTerms = inferPaymentTerms(balanceAmount, rawRow.rawType);
  const settlementMethod = paymentTerms === "credit"
    ? "unknown"
    : inferSettlementMethod(rawRow.rawType);
  const documentType = isCreditNote(rawRow.rawType, totalAmount)
    ? "purchase_credit_note"
    : "purchase_invoice";
  const warnings: string[] = [];

  if (taxRate === null) {
    warnings.push("No pudimos resolver la tasa de IVA de una linea importada desde Zeta.");
  }

  if (currencyCode === "USD" && (!fxRate || fxRate <= 0)) {
    warnings.push(buildFxMissingWarning(documentDate));
  }

  return {
    parsed: {
      rowNumber: rawRow.rowNumber,
      typedRow: rawRow.typedRow,
      rawType: rawRow.rawType,
      rawDescription: rawRow.rawDescription,
      counterpartyName,
      counterpartyTaxId: normalizeTaxId(rawRow.counterpartyTaxId),
      documentDate,
      dueDate: parseDateValue(rawRow.dueDateRaw),
      documentNumber,
      series: normalizeIdentifierValue(rawRow.seriesRaw),
      currencyCode,
      subtotalAmount,
      taxAmount,
      taxRate,
      totalAmount,
      balanceAmount,
      lineConcept,
      fxRate,
      vatLabel,
      paymentTerms,
      settlementMethod,
      operationCategory: resolveOperationCategory(rawRow.rawType),
      documentType,
      warnings,
    } satisfies ParsedZetaRow,
      isResidual: isResidualRow({
        vatLabel,
        subtotalAmount,
        taxAmount,
        totalAmount,
      }),
    } as const;
}

function buildAmountBreakdown(lines: ParsedZetaRow[]) {
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

function buildConsolidationKey(line: ParsedZetaRow) {
  return [
    line.documentDate,
    normalizeDocumentKeyPart(line.rawType, "tipo"),
    normalizeDocumentKeyPart(line.series, "sin-serie"),
    normalizeDocumentKeyPart(line.documentNumber, `fila-${line.rowNumber}`),
    line.currencyCode,
    normalizeDocumentKeyPart(line.counterpartyTaxId, normalizePartyName(line.counterpartyName) ?? `fila-${line.rowNumber}`),
  ].join("|");
}

export function isZetaPurchaseLayout(detectedHeaders: Partial<Record<string, string>>) {
  return ZETA_LAYOUT_REQUIRED_HEADERS.every((key) => typeof detectedHeaders[key] === "string");
}

export function normalizeZetaPurchaseRows(input: {
  fileName: string;
  sheetName: string;
  rawRows: ZetaPurchaseRawRow[];
}) {
  const groups = new Map<string, ParsedZetaRow[]>();
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];
  const warnings: string[] = [];
  const parsedDates: string[] = [];
  let rawRowsDetected = 0;
  let ignoredResidualRows = 0;

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

    if (parsed.isResidual) {
      ignoredResidualRows += 1;
      continue;
    }

    parsedDates.push(parsed.parsed.documentDate);
    const key = buildConsolidationKey(parsed.parsed);
    const current = groups.get(key) ?? [];
    current.push(parsed.parsed);
    groups.set(key, current);
  }

  const duplicateGroupsDetected = Array.from(groups.values()).filter((rows) => rows.length > 1).length;
  const rows: ZetaPurchaseImportRow[] = [];
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
      .map((value) => roundCurrency(value))));
    const fxRate = fxCandidates.length > 0 ? fxCandidates[0] : null;
    const isUsdMissingFx = first.currencyCode === "USD" && fxRate === null;
    const isCreditDocument = lines.some((line) => line.documentType === "purchase_credit_note") || totalAmount < 0;
    const facts = buildEmptyFactMap();
    facts.issuer_name = first.counterpartyName;
    facts.issuer_tax_id = first.counterpartyTaxId;
    facts.document_number = first.documentNumber;
    facts.series = first.series;
    facts.currency_code = first.currencyCode;
    facts.document_date = first.documentDate;
    facts.due_date = first.dueDate ?? (first.paymentTerms === "cash" ? first.documentDate : null);
    facts.subtotal = subtotal;
    facts.tax_amount = taxAmount;
    facts.total_amount = totalAmount;
    facts.purchase_category_candidate = first.operationCategory;

    const lineItems = lines.map((line, index) => ({
      line_number: index + 1,
      concept_code: null,
      concept_description: firstNonEmptyString(line.lineConcept, line.rawDescription, line.rawType, first.counterpartyName),
      quantity: null,
      unit_amount: null,
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
      documentRole: "purchase",
      documentType: isCreditDocument ? "purchase_credit_note" : "purchase_invoice",
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
        counterpartyName: first.counterpartyName,
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
    ignoredResidualRows,
    blockedGroupsDetected,
    usdMissingFxCount,
    creditNotesDetected,
    minDate: sortedDates[0] ?? null,
    maxDate: sortedDates.at(-1) ?? null,
  } satisfies ZetaPurchaseNormalizationResult;
}
